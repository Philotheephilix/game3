import * as ex from 'excalibur';
import { Player } from '../actors/Player';
import { Maps } from '../resources';
import { SimpleInventoryHUD } from '../ui/SimpleInventoryHUD';
import { HealthHUD } from '../ui/HealthHUD';

// Store game engine reference for scene transitions
let gameEngine: ex.Engine | null = null;

export function setGameEngine(engine: ex.Engine) {
  gameEngine = engine;
}

/**
 * Room scene - interior room that can be entered and exited
 */
export class RoomScene extends ex.Scene {
  private player!: Player;
  private inventoryHUD!: SimpleInventoryHUD;
  private healthHUD!: HealthHUD;
  private mapWidth: number = 480; // 30 tiles * 16px
  private mapHeight: number = 320; // 20 tiles * 16px
  private entryPosition: ex.Vector; // Position where player entered (for exit)
  private exitPosition: ex.Vector = new ex.Vector(240, 32); // Top center exit

  constructor(entryPos: ex.Vector) {
    super();
    this.entryPosition = entryPos;
  }

  onInitialize(_engine: ex.Engine): void {
    console.log('RoomScene initializing...');
    console.log('Room map resource:', Maps.roomMap);
    console.log('Map loaded?', Maps.roomMap.isLoaded());
    
    // Load and add the room map
    const mapResource = Maps.roomMap;
    
    if (mapResource.isLoaded()) {
      console.log('Room map is loaded, adding to scene');
      mapResource.addToScene(this);
      
      // Calculate map bounds (30 tiles wide x 20 tiles tall, 16px per tile)
      this.mapWidth = 30 * 16; // 480 pixels
      this.mapHeight = 20 * 16; // 320 pixels
      
      // Set up camera bounds
      this.camera.strategy.limitCameraBounds(
        new ex.BoundingBox(0, 0, this.mapWidth, this.mapHeight)
      );
      
      setTimeout(() => {
        this.setupMapCollisions(mapResource);
      }, 50);
    } else {
      console.warn('Room map is not loaded yet! Loading now...');
      mapResource.load().then(() => {
        console.log('Room map loaded successfully, adding to scene');
        mapResource.addToScene(this);
        this.mapWidth = 30 * 16;
        this.mapHeight = 20 * 16;
        this.camera.strategy.limitCameraBounds(
          new ex.BoundingBox(0, 0, this.mapWidth, this.mapHeight)
        );
        setTimeout(() => {
          this.setupMapCollisions(mapResource);
        }, 50);
      }).catch((error) => {
        console.error('Error loading room map:', error);
        console.error('Error details:', error.stack || error.message);
      });
    }

    // Create and add player at entry position (where they entered from)
    this.player = new Player(this.entryPosition.x, this.entryPosition.y);
    this.add(this.player);
    this.player.z = Number.MAX_SAFE_INTEGER;

    // Set up camera to follow player
    this.camera.strategy.lockToActor(this.player);
    this.camera.zoom = 5;

    // Set up player arrow callback (if needed)
    this.player.setArrowCallback(
      (fromPos, direction) => {
        // No arrows in room
      }
    );

    // Initialize HUDs
    this.healthHUD = new HealthHUD();
    this.healthHUD.initialize(this, _engine);

    this.inventoryHUD = new SimpleInventoryHUD();
    this.inventoryHUD.initialize(this, _engine);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    // Clamp player position to map bounds
    const playerHalfSize = 8;
    this.player.pos.x = Math.max(playerHalfSize, Math.min(this.mapWidth - playerHalfSize, this.player.pos.x));
    this.player.pos.y = Math.max(playerHalfSize, Math.min(this.mapHeight - playerHalfSize, this.player.pos.y));

    // Check if player is near exit door (top center)
    const exitDistance = 20;
    if (this.player.pos.distance(this.exitPosition) < exitDistance) {
      console.log('Player at exit door, returning to game scene');
      if (gameEngine) {
        gameEngine.goToScene('game');
      }
    }
  }

  onActivate(): void {
    console.log('RoomScene activated');
  }

  onDeactivate(): void {
    console.log('RoomScene deactivated');
  }

  private setupMapCollisions(mapResource: any): void {
    // Basic collision setup for walls
    const tileWidth = 16;
    const tileHeight = 16;
    const mapWidth = 30; // 30 tiles wide

    fetch('/src/assets/maps/gamemaplvl.tmx')
      .then(response => response.text())
      .then(text => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const layers = Array.from(xmlDoc.getElementsByTagName('layer'));
        
        layers.forEach(layerElement => {
          const layerName = layerElement.getAttribute('name');
          const layerWidth = parseInt(layerElement.getAttribute('width') || '0');
          const layerHeight = parseInt(layerElement.getAttribute('height') || '0');
          const offsetX = parseFloat(layerElement.getAttribute('offsetx') || '0');
          const offsetY = parseFloat(layerElement.getAttribute('offsety') || '0');
          
          const dataElement = layerElement.getElementsByTagName('data')[0];
          if (dataElement && dataElement.textContent) {
            const tileData = dataElement.textContent.split(',').map(Number);
            
            if (layerName === 'wall' || layerName === 'objects') {
              this.addCollisionsFromData(
                tileData,
                layerName,
                tileWidth,
                tileHeight,
                layerWidth,
                offsetX,
                offsetY
              );
            }
          }
        });
      })
      .catch(error => {
        console.error('Error loading room map data for collisions:', error);
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
    for (let i = 0; i < tileData.length; i++) {
      const tileId = tileData[i];
      if (tileId !== 0) {
        const tileX = (i % mapWidth) * tileWidth + tileWidth / 2 + offsetX;
        const tileY = Math.floor(i / mapWidth) * tileHeight + tileHeight / 2 + offsetY;
        
        const collision = new ex.Actor({
          pos: new ex.Vector(tileX, tileY),
          width: tileWidth,
          height: tileHeight,
          collisionType: ex.CollisionType.Fixed,
        });
        this.add(collision);
        collisionCount++;
      }
    }
    console.log(`Added ${collisionCount} collision bodies to ${layerName} layer`);
  }

  onPostDraw(ctx: ex.ExcaliburGraphicsContext, _delta: number): void {
    // Draw inventory HUD
    if (this.inventoryHUD) {
      this.inventoryHUD.draw(ctx, this.player);
    }
  }

  getPlayer(): Player {
    return this.player;
  }

  getPlayerPosition(): ex.Vector {
    return this.player.pos;
  }
}

