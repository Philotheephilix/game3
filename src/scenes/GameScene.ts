import * as ex from 'excalibur';
import { Player } from '../actors/Player';
import { Coin } from '../actors/Coin';
import { Crop } from '../actors/Crop';
import { MoleEnemy } from '../actors/MoleEnemy';
import { Projectile } from '../actors/Projectile';
import { PlayerArrow } from '../actors/PlayerArrow';
import { Maps, Images } from '../resources';
import { SimpleInventoryHUD } from '../ui/SimpleInventoryHUD';
import { HealthHUD } from '../ui/HealthHUD';

export function setGameEngine(_engine: ex.Engine) {
  // Placeholder for future scene transitions
}

/**
 * Main game scene with player and game logic
 */
export class GameScene extends ex.Scene {
  private player!: Player;
  private inventoryHUD!: SimpleInventoryHUD;
  private healthHUD!: HealthHUD;
  private coins: Coin[] = [];
  private crops: Crop[] = [];
  private moles: MoleEnemy[] = [];
  private projectiles: Projectile[] = [];
  private playerArrows: PlayerArrow[] = [];
  private moleSpawnTimer: number = 0;
  private mapWidth: number = 640; // 40 tiles * 16px
  private mapHeight: number = 320; // 20 tiles * 16px

  onInitialize(_engine: ex.Engine): void {
    console.log('GameScene initializing...');
    
    // Load and add the mine map
    const mapResource = Maps.mineMap;
    
    // Map should be loaded since we wait for resources in game.start()
    if (mapResource.isLoaded()) {
      console.log('Mine map is loaded, adding to scene');
      mapResource.addToScene(this);
      
      // Calculate map bounds (40 tiles wide x 20 tiles tall, 16px per tile)
      this.mapWidth = 40 * 16; // 640 pixels
      this.mapHeight = 20 * 16; // 320 pixels
      
      // Set up camera bounds based on map size
      this.camera.strategy.limitCameraBounds(
        new ex.BoundingBox(0, 0, this.mapWidth, this.mapHeight)
      );
      
      // Add collision physics to walls and objects layers
      // Use a small delay to ensure map is fully added to scene
      setTimeout(() => {
        this.setupMapCollisions(mapResource);
      }, 50);
    } else {
      console.warn('Mine map is not loaded yet! Trying fallback...');
      // Try to load it if not ready
      mapResource.load().then(() => {
        console.log('Mine map loaded in fallback, adding to scene');
        mapResource.addToScene(this);
        // Calculate map bounds in fallback too
        this.mapWidth = 40 * 16; // 640 pixels
        this.mapHeight = 20 * 16; // 320 pixels
        this.camera.strategy.limitCameraBounds(
          new ex.BoundingBox(0, 0, this.mapWidth, this.mapHeight)
        );
        this.setupMapCollisions(mapResource);
      }).catch((error) => {
        console.error('Error loading mine map:', error);
      });
    }


    // Create and add player in a clear soil area (left of top-left mine entrance)
    // Position: ~3 tiles from left (48px), ~5 tiles from top (80px)
    this.player = new Player(48, 80);
    
    // Ensure player renders on top of map layers
    this.add(this.player);
    this.player.z = Number.MAX_SAFE_INTEGER; // Topmost layer to render above everything

    // Set up camera to follow player
    this.camera.strategy.lockToActor(this.player);

    // Set camera zoom to 500% (5x)
    this.camera.zoom = 5;

    // Set up player arrow callback
    this.player.setArrowCallback(
      (fromPos, direction) => this.spawnPlayerArrow(fromPos, direction)
    );

    // Set up sickle callback for crop harvesting
    this.player.setSickleCallback(
      (position) => this.handleSickleHit(position)
    );

    // Initialize health HUD
    this.healthHUD = new HealthHUD();
    this.healthHUD.initialize(this, _engine);

    // Initialize inventory HUD
    this.inventoryHUD = new SimpleInventoryHUD();
    this.inventoryHUD.initialize(this, _engine);

    // Set up drop item callbacks
    this.inventoryHUD.setItemDropCallbacks(
      (itemType, position) => this.handleItemDrop(itemType, position),
      () => this.getPlayerPosition(),
      (itemType) => this.countSceneItems(itemType)
    );

    // Spawn some coins on the map
    this.spawnCoins();
    
    // Spawn crops on the map
    this.spawnCrops();
  }

  private spawnCoins(): void {
    // Wait for money image to be loaded
    const loadMoney = Images.money.isLoaded()
      ? Promise.resolve()
      : Images.money.load();

    loadMoney.then(() => {
      // Spawn coins at various locations on the map
      const coinPositions = [
        { x: 80, y: 80 },    // Near player start
        { x: 150, y: 100 },  // Top area
        { x: 200, y: 150 },  // Middle area
        { x: 350, y: 120 },  // Right side
        { x: 450, y: 180 },  // Bottom right
        { x: 100, y: 200 },  // Bottom left
      ];

      coinPositions.forEach(pos => {
        const coin = new Coin(pos.x, pos.y);
        this.add(coin);
        this.coins.push(coin);
      });
    });
  }

  private spawnCrops(): void {
    // Wait for fall crops image to be loaded
    const loadCrops = Images.fallCrops.isLoaded()
      ? Promise.resolve()
      : Images.fallCrops.load();

    loadCrops.then(() => {
      // Spawn crops at random positions on soil/dirt tiles
      const cropTypes = [
        'crop1', 'crop2', 'crop3', 'crop4', 'crop5', 'crop6',
        'crop7', 'crop8', 'crop9', 'crop10', 'crop11', 'crop12',
        'crop13', 'crop14', 'crop15', 'crop16', 'crop17', 'crop18'
      ];

      // Spawn 15 crops randomly
      for (let i = 0; i < 15; i++) {
        const randomX = Math.random() * 600 + 20; // Random x position
        const randomY = Math.random() * 280 + 20; // Random y position
        const randomCropType = cropTypes[Math.floor(Math.random() * cropTypes.length)];
        
        const crop = new Crop(randomX, randomY, randomCropType);
        this.add(crop);
        this.crops.push(crop);
        // z-index is already set in Crop constructor to be above ground
      }
    });
  }

  private collectCoin(coin: Coin): void {
    console.log('collectCoin called for coin at', coin.pos);
    // Check if coin is still in the scene (not already collected)
    if (!coin.scene) {
      console.log('Coin already collected, returning');
      return;
    }

    // Create sprite for inventory
    const moneyImage = Images.money;
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: moneyImage,
      grid: {
        rows: 1,
        columns: 6,
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });
    
    // Create animation from first frame
    const coinAnimation = ex.Animation.fromSpriteSheet(spriteSheet, [0], 100);
    const coinSprite = coinAnimation.frames[0]?.graphic as ex.Sprite;

    // Add to inventory
    if (coinSprite) {
      const success = this.inventoryHUD.addItem({
        type: 'coin',
        sprite: coinSprite,
        count: 1,
      });

      if (success) {
        // Remove coin from scene
        coin.kill();
        console.log('Coin collected successfully!');
      } else {
        console.log('Failed to add coin to inventory - inventory full?');
      }
    } else {
      console.log('Failed to create coin sprite');
    }
  }

  private handleSickleHit(position: ex.Vector): void {
    // Check crops within harvest distance (tiles are 16x16, so 24 pixels is about 1.5 tiles)
    const harvestDistance = 24;
    this.crops.forEach(crop => {
      if (crop.scene) {
        const distance = position.distance(crop.pos);
        if (distance < harvestDistance) {
          this.harvestCrop(crop);
        }
      }
    });
  }

  private harvestCrop(crop: Crop): void {
    console.log('harvestCrop called for crop at', crop.pos, 'cropType:', crop.getCropType());
    // Check if crop is still in the scene
    if (!crop.scene) {
      console.log('Crop already harvested, returning');
      return;
    }

    // Wait for crops image to be loaded before creating sprite
    const cropsImage = Images.fallCrops;
    const loadCrops = cropsImage.isLoaded()
      ? Promise.resolve()
      : cropsImage.load();

    loadCrops.then(() => {
      console.log('Fall crops image loaded, creating sprite');
      
      // Create sprite for inventory using the crop's type
      const spriteSheet = ex.SpriteSheet.fromImageSource({
        image: cropsImage,
        grid: {
          rows: 6,
          columns: 9,
          spriteWidth: 16,
          spriteHeight: 16,
        },
      });
      
      // Get the row for this crop type - always use frame 7 (index 6) for inventory icon
      const cropRowMapping: { [key: string]: number } = {
        'crop1': 0, 'crop2': 0, 'crop3': 0,
        'crop4': 1, 'crop5': 1, 'crop6': 1,
        'crop7': 2, 'crop8': 2, 'crop9': 2,
        'crop10': 3, 'crop11': 3, 'crop12': 3,
        'crop13': 4, 'crop14': 4, 'crop15': 4,
        'crop16': 5, 'crop17': 5, 'crop18': 5,
      };

      const rowIndex = cropRowMapping[crop.getCropType()];
      console.log('Row index for', crop.getCropType(), ':', rowIndex);
      
      if (rowIndex !== undefined) {
        // Always use frame 6 (index 5, the 6th frame) for inventory icon
        const inventoryIconColumn = 5; // Frame 6 (0-based index 5)
        const cropSprite = spriteSheet.getSprite(inventoryIconColumn, rowIndex);
        console.log('Crop sprite created:', cropSprite ? 'success' : 'failed', 'at column', inventoryIconColumn, 'row', rowIndex);

        // Add to inventory
        if (cropSprite) {
          // Clone the sprite so each crop type has its own instance
          // This prevents sprite sharing issues when multiple crop types are harvested
          const clonedSprite = cropSprite.clone();
          
          // Scale sprite to fit inventory slot (slots are 14x14, sprite is 16x16)
          clonedSprite.scale = new ex.Vector(14 / 16, 14 / 16); // Scale down to fit
          
          // Use the specific crop type as the inventory item type so each crop type has its own slot
          const cropType = crop.getCropType();
          console.log('Adding crop to inventory:', cropType, 'with sprite:', clonedSprite);
          
          const success = this.inventoryHUD.addItem({
            type: cropType, // e.g., 'crop1', 'crop2', etc.
            sprite: clonedSprite,
            count: 1,
          });

          console.log('AddItem result:', success ? 'success' : 'failed');

          if (success) {
            // Remove crop from scene
            crop.kill();
            console.log('Crop harvested successfully!');
          } else {
            console.log('Failed to add crop to inventory - inventory full?');
          }
        } else {
          console.log('Failed to create crop sprite - sprite is null');
        }
      } else {
        console.log('Failed to find row index for crop type:', crop.getCropType());
      }
    }).catch((error) => {
      console.error('Error loading fall crops image:', error);
    });
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    // Clamp player position to map bounds
    // Player is 16x16, so we need to keep at least 8px from edges (half the width/height)
    const playerHalfSize = 8;
    this.player.pos.x = Math.max(playerHalfSize, Math.min(this.mapWidth - playerHalfSize, this.player.pos.x));
    this.player.pos.y = Math.max(playerHalfSize, Math.min(this.mapHeight - playerHalfSize, this.player.pos.y));

    // Check for coin collection by distance
    const pickupDistance = 20; // pixels
    this.coins.forEach(coin => {
      if (coin.scene && coin.canBeCollected) { // Make sure coin is still alive and can be collected
        const distance = coin.pos.distance(this.player.pos);
        if (distance < pickupDistance) {
          this.collectCoin(coin);
        }
      }
    });

    // Spawn moles randomly
    this.moleSpawnTimer += delta;
    if (this.moleSpawnTimer >= 3000 && this.moles.length < 3) { // Spawn every 3 seconds, max 3 moles
      this.spawnRandomMole();
      this.moleSpawnTimer = 0;
    }

    // Clean up dead moles
    this.moles = this.moles.filter(mole => mole.scene);
    
    // Clean up dead projectiles
    this.projectiles = this.projectiles.filter(proj => proj.scene);
    
    // Clean up dead player arrows
    this.playerArrows = this.playerArrows.filter(arrow => arrow.scene);
    
    // Clean up dead crops
    this.crops = this.crops.filter(crop => crop.scene);
    
    // Check for arrow hitting moles
    this.playerArrows.forEach(arrow => {
      if (arrow.scene) {
        this.moles.forEach(mole => {
          if (mole.scene && !mole.isDead()) {
            const distance = arrow.pos.distance(mole.pos);
            if (distance < 16) { // Hit detection radius
              console.log('Arrow hit mole!');
              mole.takeDamage(arrow.getDamage());
              arrow.kill();
            }
          }
        });
      }
    });

    // Check for enemy projectiles hitting player
    this.projectiles.forEach(projectile => {
      if (projectile.scene) {
        const distance = projectile.pos.distance(this.player.pos);
        if (distance < 16) { // Hit detection radius
          console.log('Enemy projectile hit player!');
          this.player.takeDamage(1);
          projectile.kill();
        }
      }
    });

    // Update health HUD
    if (this.healthHUD) {
      this.healthHUD.updateHealth(this.player.getHealth(), this.player.getMaxHealth(), this.player.pos);
    }

    // Update mole health bar positions
    this.moles.forEach(mole => {
      mole.updateHealthBarPosition();
    });
  }

  private spawnRandomMole(): void {
    // Spawn mole at random position on the map
    const mapWidth = 40 * 16; // 640 pixels
    const mapHeight = 20 * 16; // 320 pixels
    
    const x = Math.random() * mapWidth;
    const y = Math.random() * mapHeight;
    
    const mole = new MoleEnemy(x, y);
    
    // Set up projectile callback
    mole.setProjectileCallback(
      (fromPos, toPos) => this.spawnProjectile(fromPos, toPos),
      () => this.player.pos.clone()
    );
    
    this.add(mole);
    this.moles.push(mole);
    console.log(`Spawned mole at ${x}, ${y}`);
  }

  private spawnProjectile(fromPos: ex.Vector, toPos: ex.Vector): void {
    const projectile = new Projectile(fromPos, toPos);
    this.add(projectile);
    this.projectiles.push(projectile);
    console.log(`Spawned projectile from ${fromPos} to ${toPos}`);
  }

  private spawnPlayerArrow(fromPos: ex.Vector, direction: ex.Vector): void {
    const arrow = new PlayerArrow(fromPos, direction);
    this.add(arrow);
    this.playerArrows.push(arrow);
    console.log(`Spawned player arrow from ${fromPos} in direction ${direction}`);
  }

  private handleItemDrop(itemType: string, position: ex.Vector): void {
    if (itemType === 'coin') {
      // Spawn a new coin at the drop position
      const coin = new Coin(position.x, position.y);
      this.add(coin);
      this.coins.push(coin);
      console.log(`Dropped ${itemType} at ${position.x}, ${position.y}`);
    }
  }

  private getPlayerPosition(): ex.Vector {
    // Get player position with 6px offset based on facing direction
    const playerPos = this.player.pos.clone();
    const offsetDistance = 6; // pixels away from player
    
    // Get facing direction from player
    const facingDirection = (this.player as any).lastFacingDirection || 'down';
    
    // Calculate offset based on direction
    let offsetX = 0;
    let offsetY = 0;
    
    switch (facingDirection) {
      case 'down':
        offsetY = offsetDistance;
        break;
      case 'up':
        offsetY = -offsetDistance;
        break;
      case 'right':
        offsetX = offsetDistance;
        break;
      case 'left':
        offsetX = -offsetDistance;
        break;
      default:
        offsetY = offsetDistance; // Default to down
    }
    
    return new ex.Vector(playerPos.x + offsetX, playerPos.y + offsetY);
  }

  private countSceneItems(itemType: string): number {
    if (itemType === 'coin') {
      return this.coins.filter(coin => coin.scene).length;
    }
    return 0;
  }

  onPostDraw(ctx: ex.ExcaliburGraphicsContext, _delta: number): void {
    // Draw inventory HUD on top of everything
    if (this.inventoryHUD) {
      this.inventoryHUD.draw(ctx, this.player);
    }
  }


  

  private setupMapCollisions(mapResource: any): void {
    // Use the fallback method which fetches the map JSON directly
    // This is more reliable since TiledResource doesn't expose .data directly
    console.log('Setting up map collisions using fallback method');
    this.setupMapCollisionsFallback(mapResource);
  }

  private setupMapCollisionsFallback(_mapResource: any): void {
    // Fallback approach: parse from the map JSON file directly
    // This ensures wall collisions are properly set up with layer offsets
    const tileWidth = 16;
    const tileHeight = 16;
    const mapWidth = 40;

    // Parse wall and object layer data from the map
    fetch('/src/assets/mine.tmj')
      .then(response => response.json())
      .then(mapData => {
        const wallLayer = mapData.layers.find((layer: any) => layer.name === 'wall');
        const objectsLayer = mapData.layers.find((layer: any) => layer.name === 'objects');

        // Add collisions to wall layer with proper offset handling
        if (wallLayer && wallLayer.data) {
          const offsetX = wallLayer.offsetx || 0;
          const offsetY = wallLayer.offsety || 0;
          this.addCollisionsFromData(
            wallLayer.data, 
            'wall', 
            tileWidth, 
            tileHeight, 
            wallLayer.width || mapWidth,
            offsetX,
            offsetY
          );
        }

        // Add collisions to objects layer
        if (objectsLayer && objectsLayer.data) {
          const offsetX = objectsLayer.offsetx || 0;
          const offsetY = objectsLayer.offsety || 0;
          this.addCollisionsFromData(
            objectsLayer.data, 
            'objects', 
            tileWidth, 
            tileHeight, 
            objectsLayer.width || mapWidth,
            offsetX,
            offsetY
          );
        }
      })
      .catch(error => {
        console.warn('Could not load map data for collisions:', error);
      });
  }

  private addCollisionsFromData(
    tileData: number[],
    layerName: string,
    tileWidth: number,
    tileHeight: number,
    mapWidth: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    let collisionCount = 0;

    tileData.forEach((tileId: number, index: number) => {
      if (tileId !== 0) {
        // Calculate position based on tile index
        const col = index % mapWidth;
        const row = Math.floor(index / mapWidth);
        
        // Calculate world position, accounting for layer offset
        const x = col * tileWidth + tileWidth / 2 + offsetX;
        const y = row * tileHeight + tileHeight / 2 + offsetY;

        // Create a collision body actor
        // Actors with width/height automatically get box colliders in Excalibur
        const collider = new ex.Actor({
          pos: new ex.Vector(x, y),
          width: tileWidth,
          height: tileHeight,
          collisionType: ex.CollisionType.Fixed, // Walls and objects are fixed (immovable)
          color: ex.Color.Transparent, // Invisible collision bodies
        });
        
        // Make sure it doesn't render
        collider.graphics.visible = false;
        collider.z = -1; // Behind everything
        
        this.add(collider);
        collisionCount++;
      }
    });
    
    console.log(`Added ${collisionCount} collision bodies to ${layerName} layer (offset: ${offsetX}, ${offsetY})`);
  }

  onActivate(): void {
    console.log('GameScene activated');
  }

  onDeactivate(): void {
    console.log('GameScene deactivated');
  }
  
}
