import * as ex from 'excalibur';
import { Player } from '../actors/Player';
import { RemotePlayer } from '../actors/RemotePlayer';
import { Coin } from '../actors/Coin';
import { Crop } from '../actors/Crop';
import { MoleEnemy } from '../actors/MoleEnemy';
import { Projectile } from '../actors/Projectile';
import { PlayerArrow } from '../actors/PlayerArrow';
import { Maps, Images } from '../resources';
import { movePlayer } from '/cartridge-game.ts';
import { SimpleInventoryHUD } from '../ui/SimpleInventoryHUD';
import { collectAsset, hit } from '/cartridge-game.ts';
import { HealthHUD } from '../ui/HealthHUD';
import { setPlayerStats, applyUpgrades, getPlayerStats } from './UpgradeMenuScene';

// Store game engine reference for scene transitions
let gameEngine: ex.Engine | null = null;

export function setGameEngine(engine: ex.Engine) {
  gameEngine = engine;
}

/**
 * Main game scene with player and game logic
 */
export class GameScene extends ex.Scene {
  private player!: Player;
  private remotePlayer!: RemotePlayer;
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
  private gameOverOverlay!: ex.Actor;
  private gameOverText!: ex.Actor;
  private playAgainButton!: ex.Actor;
  
  // Timer system
  private timeRemaining: number = 20; // seconds
  private timeLimit: number = 20; // base time limit (can be upgraded)
  private timerActor!: ex.Actor;
  private timerTextActor!: ex.Actor;
  private timerPanel!: ex.Actor; // Panel background
  private warningTextActor!: ex.Actor;
  private warningShadowActor!: ex.Actor; // Shadow actor for warning
  private hasShownWarning: boolean = false;
  private lastSentAt: number = 0;
  private lastSentPos: { x: number; y: number } = { x: 0, y: 0 };
  private toriiPollHandle: number | null = null;
  private safeAreaMenuOpen: boolean = false;
  private lastSafeAreaCheck: number = 0;
  private safeAreaMarker!: ex.Actor;
  private safeAreaLabel!: ex.Actor;
  private safeAreaPulseScale: number = 1.0;
  private safeAreaPulseDirection: number = 1;

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
    
    // Setup timer UI
    this.setupTimerUI(_engine);
    // Create remote player actor (simple marker)
    this.remotePlayer = new RemotePlayer(0, 0);
    this.remotePlayer.z = Number.MAX_SAFE_INTEGER - 1;
    this.add(this.remotePlayer);

    // Start Torii position polling (every 1s)
    this.startToriiPositionPolling();
    
    // Setup safe area marker
    this.setupSafeAreaMarker();
    
    // Get time limit from upgrade menu (or use default)
    const stats = getPlayerStats();
    this.timeLimit = stats.timeLimit || 20;
    this.timeRemaining = this.timeLimit;
    this.hasShownWarning = false;
  }
  
  private setupTimerUI(_engine: ex.Engine): void {
    // Load clock image if not already loaded
    const clockImage = Images.clock;
    
    const loadClock = clockImage.isLoaded()
      ? Promise.resolve()
      : clockImage.load();
    
    loadClock.then(() => {
      // Create background panel for timer (semi-transparent black box)
      const panelWidth = 120;
      const panelHeight = 60;
      
      this.timerPanel = new ex.Actor({
        pos: ex.Vector.Zero, // Will be updated to screen position
        width: panelWidth,
        height: panelHeight,
        anchor: ex.Vector.Half,
        z: Number.MAX_SAFE_INTEGER - 1,
      });
      
      // Create panel background with rounded corners effect
      const panelBg = new ex.Rectangle({
        width: panelWidth,
        height: panelHeight,
        color: new ex.Color(0, 0, 0, 0.7), // Semi-transparent black
        strokeColor: ex.Color.fromHex('#FFD700'), // Gold border
      });
      this.timerPanel.graphics.add(panelBg);
      this.add(this.timerPanel);
      
      // Create clock sprite actor (smaller, inside panel)
      const clockSprite = ex.Sprite.from(clockImage);
      clockSprite.scale = new ex.Vector(0.4, 0.4); // Smaller scale
      
      this.timerActor = new ex.Actor({
        pos: ex.Vector.Zero, // Will be updated to screen position
        anchor: ex.Vector.Half,
        width: clockImage.width * 0.4,
        height: clockImage.height * 0.4,
        z: Number.MAX_SAFE_INTEGER,
      });
      this.timerActor.graphics.add(clockSprite);
      this.add(this.timerActor);
      
      // Create timer text actor (inside panel, right side)
      this.timerTextActor = new ex.Actor({
        pos: ex.Vector.Zero, // Will be updated to screen position
        anchor: ex.Vector.Half,
        z: Number.MAX_SAFE_INTEGER,
      });
      const timerText = new ex.Text({
        text: `${Math.ceil(this.timeRemaining)}s`,
        font: new ex.Font({
          size: 28,
          family: 'Arial',
          color: ex.Color.White,
          bold: true,
        }),
      });
      this.timerTextActor.graphics.add(timerText);
      this.add(this.timerTextActor);
      
      // Create warning text actor with better styling (centered, top)
      this.warningTextActor = new ex.Actor({
        pos: ex.Vector.Zero, // Will be updated to screen position
        anchor: ex.Vector.Half,
        z: Number.MAX_SAFE_INTEGER,
      });
      
      // Warning background (semi-transparent red)
      const warningBg = new ex.Rectangle({
        width: 400,
        height: 60,
        color: new ex.Color(255, 0, 0, 0.8), // Semi-transparent red
        strokeColor: ex.Color.White,
      });
      this.warningTextActor.graphics.add(warningBg);
      
      // Warning text
      const warningText = new ex.Text({
        text: '⚠ RETURN TO SAFE AREA! ⚠',
        font: new ex.Font({
          size: 36,
          family: 'Arial',
          color: ex.Color.White,
          bold: true,
        }),
      });
      
      this.warningTextActor.graphics.add(warningText);
      this.warningTextActor.graphics.visible = false;
      this.add(this.warningTextActor);
      
      // Create text shadow for better visibility (as separate actor)
      this.warningShadowActor = new ex.Actor({
        pos: ex.Vector.Zero, // Will be updated to screen position
        anchor: ex.Vector.Half,
        z: Number.MAX_SAFE_INTEGER - 1,
      });
      const warningTextShadow = new ex.Text({
        text: '⚠ RETURN TO SAFE AREA! ⚠',
        font: new ex.Font({
          size: 36,
          family: 'Arial',
          color: ex.Color.Black,
          bold: true,
        }),
      });
      this.warningShadowActor.graphics.add(warningTextShadow);
      this.warningShadowActor.graphics.visible = false;
      this.add(this.warningShadowActor);
    });
  }
  
  private updateTimerUI(_engine: ex.Engine): void {
    if (!this.timerPanel || !this.timerActor || !this.timerTextActor) {
      return;
    }
    
    const screenWidth = _engine.drawWidth;
    const screenHeight = _engine.drawHeight;
    const cameraPos = this.camera.pos;
    const zoomFactor = this.camera.zoom;
    
    // Timer panel position (top right corner in screen space)
    const timerPanelScreenX = screenWidth - 70; // 70px from right edge
    const timerPanelScreenY = 50; // 50px from top
    
    // Convert screen coordinates to world coordinates (accounting for camera)
    const timerPanelWorldX = cameraPos.x + (timerPanelScreenX - screenWidth / 2) / zoomFactor;
    const timerPanelWorldY = cameraPos.y + (timerPanelScreenY - screenHeight / 2) / zoomFactor;
    
    this.timerPanel.pos = new ex.Vector(timerPanelWorldX, timerPanelWorldY);
    this.timerPanel.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor); // Scale inversely with zoom
    
    // Clock icon position (left side of panel)
    const clockScreenX = timerPanelScreenX - 30;
    const clockScreenY = timerPanelScreenY - 5;
    const clockWorldX = cameraPos.x + (clockScreenX - screenWidth / 2) / zoomFactor;
    const clockWorldY = cameraPos.y + (clockScreenY - screenHeight / 2) / zoomFactor;
    
    this.timerActor.pos = new ex.Vector(clockWorldX, clockWorldY);
    this.timerActor.scale = new ex.Vector(0.4 / zoomFactor, 0.4 / zoomFactor);
    
    // Timer text position (right side of panel)
    const textScreenX = timerPanelScreenX + 25;
    const textScreenY = timerPanelScreenY - 5;
    const textWorldX = cameraPos.x + (textScreenX - screenWidth / 2) / zoomFactor;
    const textWorldY = cameraPos.y + (textScreenY - screenHeight / 2) / zoomFactor;
    
    this.timerTextActor.pos = new ex.Vector(textWorldX, textWorldY);
    this.timerTextActor.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
    
    // Warning message position (top center in screen space)
    if (this.warningTextActor) {
      const warningScreenX = screenWidth / 2;
      const warningScreenY = 80;
      const warningWorldX = cameraPos.x + (warningScreenX - screenWidth / 2) / zoomFactor;
      const warningWorldY = cameraPos.y + (warningScreenY - screenHeight / 2) / zoomFactor;
      
      this.warningTextActor.pos = new ex.Vector(warningWorldX, warningWorldY);
      this.warningTextActor.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
    }
    
    // Warning shadow position (slightly offset)
    if (this.warningShadowActor) {
      const shadowScreenX = screenWidth / 2 + 2;
      const shadowScreenY = 82;
      const shadowWorldX = cameraPos.x + (shadowScreenX - screenWidth / 2) / zoomFactor;
      const shadowWorldY = cameraPos.y + (shadowScreenY - screenHeight / 2) / zoomFactor;
      
      this.warningShadowActor.pos = new ex.Vector(shadowWorldX, shadowWorldY);
      this.warningShadowActor.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
    }
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
        // On-chain collect asset for coins -> asset_id 1
        try {
          const chain: any = (window as any).__chain;
          const gameId = localStorage.getItem('game_id');
          if (chain && chain.account && chain.manifest && gameId) {
            collectAsset(chain.account, chain.manifest, String(gameId), '1').catch(console.error);
          }
        } catch {}
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
            // Map crop type to asset id: small=2 (crop1-6), big=3 (crop7-12), others=4
            try {
              const chain: any = (window as any).__chain;
              const gameId = localStorage.getItem('game_id');
              if (chain && chain.account && chain.manifest && gameId) {
                const num = parseInt(cropType.replace('crop', ''), 10);
                let assetId = 4;
                if (!isNaN(num)) {
                  if (num >= 1 && num <= 6) assetId = 2; else if (num >= 7 && num <= 12) assetId = 3; else assetId = 4;
                }
                collectAsset(chain.account, chain.manifest, String(gameId), String(assetId)).catch(console.error);
              }
            } catch {}
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
    // Update timer
    this.updateTimer(delta);
    
    // Update timer UI position to screen space (outside map)
    this.updateTimerUI(_engine);
    
    // Clamp player position to map bounds
    // Player is 16x16, so we need to keep at least 8px from edges (half the width/height)
    const playerHalfSize = 8;
    this.player.pos.x = Math.max(playerHalfSize, Math.min(this.mapWidth - playerHalfSize, this.player.pos.x));
    this.player.pos.y = Math.max(playerHalfSize, Math.min(this.mapHeight - playerHalfSize, this.player.pos.y));

    // Throttled push of local position to chain (every 500ms when changed >1px)
    try {
      const now = performance.now();
      const chain: any = (window as any).__chain;
      const gameId = localStorage.getItem('game_id');
      if (chain && chain.account && chain.manifest && gameId) {
        const dx = Math.abs(this.player.pos.x - this.lastSentPos.x);
        const dy = Math.abs(this.player.pos.y - this.lastSentPos.y);
        if (now - this.lastSentAt > 500 && (dx > 1 || dy > 1)) {
          this.lastSentAt = now;
          this.lastSentPos = { x: this.player.pos.x, y: this.player.pos.y };
          movePlayer(chain.account, chain.manifest, String(gameId), String(Math.round(this.player.pos.x)), String(Math.round(this.player.pos.y))).catch(() => {});
        }
      }
    } catch {}

        // Check for door to upgrade menu
        // Door is at tile position (26, 2-3) and (27, 2-3) in doors layer
        const doorLayerOffsetX = -8.66667;
        const doorLayerOffsetY = 0;
        const tileSize = 16;
        // Door center is more precisely calculated - door tiles are at (26,2), (27,2), (26,3), (27,3)
        const doorCenterX = 26.5 * tileSize + doorLayerOffsetX; // ~415.3
        const doorCenterY = 2.5 * tileSize + doorLayerOffsetY; // ~40.0
        const doorAreaCenter = new ex.Vector(doorCenterX, doorCenterY);
        
        // Calculate distance from player to door center
        const distanceToDoorCenter = this.player.pos.distance(doorAreaCenter);
        
        // Door dimensions
        const doorWidth = 2 * tileSize; // 32px
        const doorHeight = 2 * tileSize; // 32px
        
        // Check if player is directly at the door within a small margin
        const playerX = this.player.pos.x;
        const playerY = this.player.pos.y;
        
        // Door area: center ± half width/height + margin for player size
        // Increased margin to 16px to make it more forgiving
        const doorLeft = doorCenterX - doorWidth / 2 - 16; // Left edge - 16px margin
        const doorRight = doorCenterX + doorWidth / 2 + 16; // Right edge + 16px margin
        const doorTop = doorCenterY - doorHeight / 2 - 16; // Top edge - 16px margin
        const doorBottom = doorCenterY + doorHeight / 2 + 16; // Bottom edge + 16px margin
        
        // Check if player is within the door area
        const isInDoorArea = playerX >= doorLeft && playerX <= doorRight && 
                            playerY >= doorTop && playerY <= doorBottom;
        
        // Distance check - 100px range (reasonable for "near" the door)
        const doorTriggerDistance = 100;
        
        // Debug logging every few frames (throttle to avoid spam)
        if (Math.random() < 0.05) { // 5% chance per frame
          console.log(`[DOOR DEBUG] Player: (${playerX.toFixed(1)}, ${playerY.toFixed(1)}), Door: (${doorAreaCenter.x.toFixed(1)}, ${doorAreaCenter.y.toFixed(1)}), Distance: ${distanceToDoorCenter.toFixed(1)}, InArea: ${isInDoorArea}, DoorBounds: [${doorLeft.toFixed(1)}, ${doorRight.toFixed(1)}, ${doorTop.toFixed(1)}, ${doorBottom.toFixed(1)}]`);
        }
        
        // Trigger when near the door - use OR logic so either condition works
        if (isInDoorArea || distanceToDoorCenter < doorTriggerDistance) {
      const currentTime = Date.now();
      
      // Only trigger once per 2 seconds to avoid spam (but check every frame)
      const shouldTrigger = !this.safeAreaMenuOpen && (currentTime - this.lastSafeAreaCheck) > 2000;
      
      if (shouldTrigger) {
        this.safeAreaMenuOpen = true;
        this.lastSafeAreaCheck = currentTime;
        
        console.log('[DOOR] Player near safe area door!');
        console.log(`[DOOR] Player position: (${this.player.pos.x.toFixed(1)}, ${this.player.pos.y.toFixed(1)})`);
        console.log(`[DOOR] Door position: (${doorAreaCenter.x.toFixed(1)}, ${doorAreaCenter.y.toFixed(1)})`);
        console.log(`[DOOR] Distance: ${distanceToDoorCenter.toFixed(1)}`);
        console.log(`[DOOR] Trigger distance: ${doorTriggerDistance}, InArea: ${isInDoorArea}`);
        
        // Count coins from inventory (accessing private inventory array)
        let coinCount = 0;
        const inventory = (this.inventoryHUD as any).inventory;
        if (inventory) {
          for (let i = 0; i < inventory.length; i++) {
            const item = inventory[i];
            if (item && item.type === 'coin') {
              coinCount += item.count || 0;
            }
          }
        }
        console.log(`[DOOR] Coin count: ${coinCount}`);
        
        // Get player stats
        const maxHealth = this.player.getMaxHealth();
        const attack = this.player.getAttack();
        const stamina = this.player.getStamina();
        console.log(`[DOOR] Player stats - Health: ${maxHealth}, Attack: ${attack}, Stamina: ${stamina}`);
        
        // Set player stats for upgrade menu
        setPlayerStats(coinCount, maxHealth, attack, stamina, this.inventoryHUD);
        
        // Transition to upgrade menu scene
        const engine = gameEngine || this.engine || _engine;
        console.log(`[DOOR] Engine reference: ${engine ? 'FOUND' : 'MISSING'}`);
        if (engine) {
          try {
            console.log(`[DOOR] Attempting to goToScene('upgrade')...`);
            engine.goToScene('upgrade');
            console.log(`[DOOR] goToScene('upgrade') called successfully`);
          } catch (error) {
            console.error('[DOOR] Error transitioning to upgrade menu:', error);
            console.error('[DOOR] Error stack:', (error as Error).stack);
          }
        } else {
          console.error('[DOOR] No engine reference available!');
        }
        
        // Also send message to HTML to open safe area menu (optional, can be used for web UI)
        if (typeof window !== 'undefined') {
          // Get current game ID (you may need to adjust this based on how game ID is stored)
          const gameId = '1'; // Default, you might want to get this from somewhere
          window.postMessage({ type: 'OPEN_SAFE_AREA', gameId: gameId }, '*');
          
          // Also try calling a function directly if it exists
          if ((window as any).openSafeAreaMenu) {
            try {
              (window as any).openSafeAreaMenu(gameId);
            } catch (error) {
              console.error('[DOOR] Error calling openSafeAreaMenu:', error);
            }
          }
        }
      }
      
      return;
    } else {
      // Player moved away from door, reset flag
      if (this.safeAreaMenuOpen) {
        this.safeAreaMenuOpen = false;
      }
    }

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
          // On-chain hit transaction with amount 10
          try {
            const chain: any = (window as any).__chain;
            const gameId = localStorage.getItem('game_id');
            if (chain && chain.account && chain.manifest && gameId) {
              const p = chain.participantIndex === '1' ? '1' : '0';
              hit(chain.account, chain.manifest, String(gameId), p, '10').catch(console.error);
            }
          } catch {}
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

    // Animate safe area marker pulse
    if (this.safeAreaMarker) {
      this.safeAreaPulseScale += this.safeAreaPulseDirection * 0.02;
      if (this.safeAreaPulseScale >= 1.3) {
        this.safeAreaPulseDirection = -1;
      } else if (this.safeAreaPulseScale <= 1.0) {
        this.safeAreaPulseDirection = 1;
      }
      this.safeAreaMarker.scale = new ex.Vector(this.safeAreaPulseScale, this.safeAreaPulseScale);
    }

    // Check if player is dead and handle restart input
    if (this.player && this.player.isPlayerDead()) {
      // Check both wasPressed and isHeld to catch key presses reliably
      const enterPressed = _engine.input.keyboard.wasPressed(ex.Keys.Enter) || 
                          _engine.input.keyboard.isHeld(ex.Keys.Enter);
      const spacePressed = _engine.input.keyboard.wasPressed(ex.Keys.Space) || 
                          _engine.input.keyboard.isHeld(ex.Keys.Space);
      
      if (enterPressed || spacePressed) {
        console.log('[RESTART] Restart key pressed - Enter:', enterPressed, 'Space:', spacePressed);
        this.restartGame();
      }
    }
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

  private startToriiPositionPolling(): void {
    const poll = async () => {
      try {
        const chain: any = (window as any).__chain;
        const gameId = localStorage.getItem('game_id');
        if (!chain || !gameId) return;
        const query = `
          query GetGames {
            diGameModels {
              edges { node { game_id position_a_x position_a_y position_b_x position_b_y participant_a participant_b } }
            }
          }
        `;
        const res = await fetch('https://api.cartridge.gg/x/harvest/torii/graphql', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
        });
        const json = await res.json();
        const edges = json?.data?.diGameModels?.edges || [];
        const targetId = Number(gameId);
        const node = edges.map((e: any) => e.node).find((n: any) => {
          const raw = String(n.game_id);
          const num = raw.startsWith('0x') || raw.startsWith('0X') ? parseInt(raw, 16) : parseInt(raw, 10);
          return num === targetId;
        });
        if (!node) return;
        const p = chain.participantIndex === '1' ? '1' : '0';
        const ax = Number(node.position_a_x) || 0;
        const ay = Number(node.position_a_y) || 0;
        const bx = Number(node.position_b_x) || 0;
        const by = Number(node.position_b_y) || 0;
        // Only update the OTHER participant from Torii
        if (p === '0') {
          this.remotePlayer.setRemotePosition(bx, by);
        } else {
          this.remotePlayer.setRemotePosition(ax, ay);
        }
      } catch (e) {
        // swallow errors to keep polling
      }
    };
    // initial + interval
    poll();
    this.toriiPollHandle = window.setInterval(poll, 1000);
  }

  onPostDraw(ctx: ex.ExcaliburGraphicsContext, _delta: number): void {
    // Draw inventory HUD on top of everything
    if (this.inventoryHUD) {
      this.inventoryHUD.draw(ctx, this.player);
    }

    // Check if player is dead and show "Play Again" screen
    if (this.player && this.player.isPlayerDead()) {
      this.drawGameOverScreen(ctx);
    }
  }

  private drawGameOverScreen(_ctx: ex.ExcaliburGraphicsContext): void {
    if (!this.engine) return;
    
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    const cameraPos = this.camera.pos;
    const zoomFactor = this.camera.zoom;
    
    // Screen space positions (centered)
    const centerScreenX = screenWidth / 2;
    const centerScreenY = screenHeight / 2;
    
    // Create overlay actor if it doesn't exist (full screen, screen space)
    if (!this.gameOverOverlay) {
      // Overlay should cover entire screen in world space
      const overlayWorldX = cameraPos.x;
      const overlayWorldY = cameraPos.y;
      const overlayWidth = screenWidth / zoomFactor;
      const overlayHeight = screenHeight / zoomFactor;
      
      this.gameOverOverlay = new ex.Actor({
        pos: new ex.Vector(overlayWorldX, overlayWorldY),
        width: overlayWidth,
        height: overlayHeight,
        anchor: ex.Vector.Half,
        z: Number.MAX_SAFE_INTEGER - 2,
      });
      const overlayRect = new ex.Rectangle({
        width: overlayWidth,
        height: overlayHeight,
        color: new ex.Color(0, 0, 0, 0.8),
      });
      this.gameOverOverlay.graphics.add(overlayRect);
      this.gameOverOverlay.scale = new ex.Vector(1, 1);
      this.add(this.gameOverOverlay);
    } else {
      // Update overlay position each frame
      const overlayWorldX = cameraPos.x;
      const overlayWorldY = cameraPos.y;
      const overlayWidth = screenWidth / zoomFactor;
      const overlayHeight = screenHeight / zoomFactor;
      this.gameOverOverlay.pos = new ex.Vector(overlayWorldX, overlayWorldY);
      // Update overlay size by recreating rectangle
      const newOverlayRect = new ex.Rectangle({
        width: overlayWidth,
        height: overlayHeight,
        color: new ex.Color(0, 0, 0, 0.8),
      });
      this.gameOverOverlay.graphics.use(newOverlayRect);
    }
    
    // Create play again message (small, styled like warning)
    if (!this.playAgainButton) {
      const messageWidth = 300;
      const messageHeight = 50;
      const messageScreenY = centerScreenY + 20; // Below center
      
      const messageWorldX = cameraPos.x + (centerScreenX - screenWidth / 2) / zoomFactor;
      const messageWorldY = cameraPos.y + (messageScreenY - screenHeight / 2) / zoomFactor;
      
      this.playAgainButton = new ex.Actor({
        pos: new ex.Vector(messageWorldX, messageWorldY),
        anchor: ex.Vector.Half,
        width: messageWidth,
        height: messageHeight,
        z: Number.MAX_SAFE_INTEGER,
      });
      
      // Small background panel (like warning)
      const messageBg = new ex.Rectangle({
        width: messageWidth,
        height: messageHeight,
        color: new ex.Color(0, 150, 0, 0.8), // Semi-transparent green
        strokeColor: ex.Color.White,
      });
      this.playAgainButton.graphics.add(messageBg);
      
      // Small text (like warning but smaller)
      const playAgainText = new ex.Text({
        text: 'PLAY AGAIN',
        font: new ex.Font({
          size: 24, // Smaller than warning (which is 36)
          family: 'Arial',
          color: ex.Color.White,
          bold: true,
        }),
      });
      this.playAgainButton.graphics.add(playAgainText);
      this.playAgainButton.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
      this.add(this.playAgainButton);
    } else {
      // Update position each frame for screen space
      const messageScreenY = centerScreenY + 20;
      const messageWorldX = cameraPos.x + (centerScreenX - screenWidth / 2) / zoomFactor;
      const messageWorldY = cameraPos.y + (messageScreenY - screenHeight / 2) / zoomFactor;
      this.playAgainButton.pos = new ex.Vector(messageWorldX, messageWorldY);
      this.playAgainButton.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
    }
    
    // Hide game over text (remove it, use smaller message instead)
    if (this.gameOverText) {
      this.gameOverText.graphics.visible = false;
    }
    
    // Show game over elements
    this.gameOverOverlay.graphics.visible = true;
    this.playAgainButton.graphics.visible = true;
  }

  private restartGame(): void {
    console.log('[RESTART] Restarting game...');
    
    // Hide game over screen
    if (this.gameOverOverlay) {
      this.gameOverOverlay.graphics.visible = false;
    }
    if (this.gameOverText) {
      this.gameOverText.graphics.visible = false;
    }
    if (this.playAgainButton) {
      this.playAgainButton.graphics.visible = false;
    }
    
    // Reset player
    if (this.player) {
      this.player.kill();
    }
    
    // Clear all game entities
    this.coins.forEach(coin => coin.kill());
    this.moles.forEach(mole => mole.kill());
    this.projectiles.forEach(proj => proj.kill());
    this.playerArrows.forEach(arrow => arrow.kill());
    this.crops.forEach(crop => crop.kill());
    
    // Clear arrays
    this.coins = [];
    this.moles = [];
    this.projectiles = [];
    this.playerArrows = [];
    this.crops = [];
    
    // Reset inventory
    if (this.inventoryHUD) {
      const inventory = (this.inventoryHUD as any).inventory;
      if (inventory) {
        for (let i = 0; i < inventory.length; i++) {
          inventory[i] = null;
          this.inventoryHUD['updateSlotDisplay'](i);
        }
      }
    }
    
    // Reset timer
    const stats = getPlayerStats();
    this.timeLimit = stats.timeLimit || 20;
    this.timeRemaining = this.timeLimit;
    this.hasShownWarning = false;
    
    // Respawn player at start position
    this.player = new Player(48, 80);
    this.add(this.player);
    this.player.z = Number.MAX_SAFE_INTEGER;
    
    // Re-set camera to follow player
    this.camera.strategy.lockToActor(this.player);
    this.camera.zoom = 5; // Reset zoom
    
    // Set up player callbacks again
    this.player.setArrowCallback(
      (fromPos, direction) => this.spawnPlayerArrow(fromPos, direction)
    );
    this.player.setSickleCallback(
      (position) => this.handleSickleHit(position)
    );
    
    // Respawn coins
    this.spawnCoins();
    
    // Respawn crops
    this.spawnCrops();
    
    // Reset timers
    this.moleSpawnTimer = 0;
    
    console.log('[RESTART] Game restarted successfully');
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
        
        // Add collisions to doors layer
        const doorsLayer = mapData.layers.find((layer: any) => layer.name === 'doors');
        if (doorsLayer && doorsLayer.data) {
          const offsetX = doorsLayer.offsetx || 0;
          const offsetY = doorsLayer.offsety || 0;
          this.addCollisionsFromData(
            doorsLayer.data, 
            'doors', 
            tileWidth, 
            tileHeight, 
            doorsLayer.width || mapWidth,
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
    offsetY: number = 0,
    excludeTileIds: number[] = []
  ): void {
    let collisionCount = 0;

    tileData.forEach((tileId: number, index: number) => {
      // Skip empty tiles
      if (tileId !== 0 && !excludeTileIds.includes(tileId)) {
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
    
    // Apply upgrades when returning from upgrade menu
    if (this.player) {
      applyUpgrades(this.player);
    }
    
    // Reset timer when scene activates
    const stats = getPlayerStats();
    this.timeLimit = stats.timeLimit || 20;
    this.timeRemaining = this.timeLimit;
    this.hasShownWarning = false;
    
    // Hide warning when scene activates
    if (this.warningTextActor) {
      this.warningTextActor.graphics.visible = false;
    }
    if (this.warningShadowActor) {
      this.warningShadowActor.graphics.visible = false;
    }
  }

  onDeactivate(): void {
    console.log('GameScene deactivated');
    if (this.toriiPollHandle) {
      window.clearInterval(this.toriiPollHandle);
      this.toriiPollHandle = null;
    }
  }
  
  private updateTimer(delta: number): void {
    if (!this.player || this.player.isPlayerDead()) {
      return; // Don't update timer if player is dead
    }
    
    // Convert delta from milliseconds to seconds
    const deltaSeconds = delta / 1000;
    
    // Decrease timer
    this.timeRemaining -= deltaSeconds;
    
    // Show warning at 10 seconds remaining
    if (this.timeRemaining <= 10 && !this.hasShownWarning) {
      this.hasShownWarning = true;
      if (this.warningTextActor) {
        this.warningTextActor.graphics.visible = true;
      }
      if (this.warningShadowActor) {
        this.warningShadowActor.graphics.visible = true;
      }
    }
    
    // Hide warning if timer goes back above 10 (shouldn't happen, but just in case)
    if (this.timeRemaining > 10 && this.hasShownWarning) {
      this.hasShownWarning = false;
      if (this.warningTextActor) {
        this.warningTextActor.graphics.visible = false;
      }
      if (this.warningShadowActor) {
        this.warningShadowActor.graphics.visible = false;
      }
    }
    
    // Kill player if time runs out
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      if (this.player && !this.player.isPlayerDead()) {
        // Deal enough damage to kill the player
        this.player.takeDamage(this.player.getHealth() + 1);
      }
      // Hide warning text when time runs out
      if (this.warningTextActor) {
        this.warningTextActor.graphics.visible = false;
      }
      if (this.warningShadowActor) {
        this.warningShadowActor.graphics.visible = false;
      }
    }
    
    // Update timer text display
    if (this.timerTextActor) {
      const seconds = Math.ceil(this.timeRemaining);
      
      // Change color based on time remaining
      let textColor = ex.Color.White;
      if (this.timeRemaining <= 10) {
        textColor = ex.Color.Red;
      } else if (this.timeRemaining <= 15) {
        textColor = ex.Color.fromHex('#FFA500'); // Orange
      }
      
      // Recreate text with updated time and color (larger size for better visibility)
      const newFont = new ex.Font({
        size: 28,
        family: 'Arial',
        color: textColor,
        bold: true,
      });
      
      const newText = new ex.Text({
        text: `${seconds}s`,
        font: newFont,
      });
      
      this.timerTextActor.graphics.use(newText);
    }
    
    // Make warning text pulse when showing
    if (this.warningTextActor && this.warningTextActor.graphics.visible) {
      // Simple pulse effect - scale slightly based on time
      const pulseScale = 1.0 + Math.sin(this.timeRemaining * 2) * 0.1; // Pulse animation
      this.warningTextActor.scale = new ex.Vector(pulseScale, pulseScale);
    }
  }

  private setupSafeAreaMarker(): void {
    // Calculate door position (same as in door detection)
    const doorLayerOffsetX = -8.66667;
    const doorLayerOffsetY = 0;
    const tileSize = 16;
    const doorCenterX = 26.5 * tileSize + doorLayerOffsetX; // ~415.3
    const doorCenterY = 2.5 * tileSize + doorLayerOffsetY; // ~40.0
    
    // Create a glowing/pulsing marker above the safe area
    this.safeAreaMarker = new ex.Actor({
      pos: new ex.Vector(doorCenterX, doorCenterY - 20), // Above the door
      width: 32,
      height: 32,
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER - 2, // Just below player but above most things
    });

    // Create a pulsing circle/indicator
    const markerCircle = new ex.Circle({
      radius: 16,
      color: ex.Color.fromHex('#00FF00'), // Green
      lineWidth: 3,
      strokeColor: ex.Color.fromHex('#00AA00'),
    });
    this.safeAreaMarker.graphics.add(markerCircle);

    // Add a filled circle for better visibility
    const fillCircle = new ex.Circle({
      radius: 12,
      color: ex.Color.fromHex('#00FF0044'), // Semi-transparent green
    });
    this.safeAreaMarker.graphics.add(fillCircle);

    this.add(this.safeAreaMarker);

    // Create text label "SAFE AREA"
    const labelText = new ex.Text({
      text: 'SAFE AREA',
      font: new ex.Font({
        size: 8,
        family: 'Arial',
        color: ex.Color.White,
        bold: true,
      }),
    });

    this.safeAreaLabel = new ex.Actor({
      pos: new ex.Vector(doorCenterX, doorCenterY - 40), // Above the marker
      anchor: ex.Vector.Half,
      z: Number.MAX_SAFE_INTEGER - 2,
    });

    // Add background for text visibility
    const labelBg = new ex.Rectangle({
      width: 70,
      height: 12,
      color: ex.Color.fromHex('#00000088'), // Semi-transparent black
    });
    this.safeAreaLabel.graphics.add(labelBg);
    this.safeAreaLabel.graphics.add(labelText);

    this.add(this.safeAreaLabel);
  }
  
}
