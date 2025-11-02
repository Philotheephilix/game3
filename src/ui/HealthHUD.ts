import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Health bar HUD for player
 */
export class HealthHUD {
  private healthBarActor!: ex.Actor;
  private backgroundActor!: ex.Actor;
  private healthFillSprite!: ex.Sprite;
  private maxWidth: number = 16; // Width of player (16 pixels)
  private barHeight: number = 2; // Small height for bar

  initialize(scene: ex.Scene, _engine: ex.Engine): void {
    // Create health bar background (dark/empty bar)
    this.backgroundActor = new ex.Actor({
      pos: new ex.Vector(0, 0), // Will be positioned in update
      width: this.maxWidth,
      height: this.barHeight,
      z: Number.MAX_SAFE_INTEGER, // Always on top
    });

    const backgroundRect = new ex.Rectangle({
      width: this.maxWidth,
      height: this.barHeight,
      color: ex.Color.fromHex('#300000'), // Dark red background
    });
    this.backgroundActor.graphics.add(backgroundRect);

    // Create health bar fill
    this.healthBarActor = new ex.Actor({
      pos: new ex.Vector(0, 0), // Will be positioned in update
      width: this.maxWidth,
      height: this.barHeight,
      z: Number.MAX_SAFE_INTEGER, // Always on top
    });

    // Create sprite from Bars.png first column
    const loadBars = Images.healthBars.isLoaded()
      ? Promise.resolve()
      : Images.healthBars.load();

    loadBars.then(() => {
      this.setupHealthBarSprite();
    });

    scene.add(this.backgroundActor);
    scene.add(this.healthBarActor);
  }

  private setupHealthBarSprite(): void {
    const barsImage = Images.healthBars;
    
    // Bars.png is 192x160
    // Per description: first column is full health
    // Need to figure out sprite dimensions - likely 32x32 or similar
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: barsImage,
      grid: {
        rows: 5, // Estimate based on typical bar layouts
        columns: 4, // 192/48 = 4
        spriteWidth: 48,
        spriteHeight: 32,
      },
    });

    // Use first column, second row (vertical red bar without icon) - frame index 5
    // Create a single frame animation to extract the sprite
    const healthAnimation = ex.Animation.fromSpriteSheet(spriteSheet, [5], 100);
    this.healthFillSprite = healthAnimation.frames[0]?.graphic as ex.Sprite;
    
    if (this.healthFillSprite) {
      this.healthBarActor.graphics.use(this.healthFillSprite);
    }
  }

  updateHealth(currentHealth: number, maxHealth: number, playerPos: ex.Vector): void {
    const healthPercent = currentHealth / maxHealth;
    const currentWidth = this.maxWidth * healthPercent;
    
    // Create new rectangle with updated width
    const fillRect = new ex.Rectangle({
      width: currentWidth,
      height: this.barHeight,
      color: ex.Color.Red,
    });
    
    // Use new rectangle (replaces old graphics)
    this.healthBarActor.graphics.use(fillRect);
    
    // Position bar under player (slightly below center)
    this.backgroundActor.pos = new ex.Vector(playerPos.x, playerPos.y + 12);
    this.healthBarActor.pos = new ex.Vector(playerPos.x, playerPos.y + 12);
  }
}

