import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Arrow projectile shot by player
 */
export class PlayerArrow extends ex.Actor {
  private flyAnimation!: ex.Animation;
  private target!: ex.Vector;
  private speed: number = 300;
  private damage: number = 1;

  constructor(startPos: ex.Vector, direction: ex.Vector) {
    super({
      pos: startPos,
      width: 16,
      height: 16,
      collisionType: ex.CollisionType.Passive,
      z: Number.MAX_SAFE_INTEGER - 2, // Above moles, below player
    });
    
    // Calculate target position based on direction
    this.target = startPos.add(direction.scale(1000)); // Shoot 1000 pixels in direction
  }

  onInitialize(_engine: ex.Engine): void {
    const loadArrow = Images.arrowProjectile.isLoaded()
      ? Promise.resolve()
      : Images.arrowProjectile.load();

    loadArrow.then(() => {
      this.setupAnimation();
      
      // Calculate direction to target
      const direction = this.target.sub(this.pos).normalize();
      this.vel = direction.scale(this.speed);
      
      // Rotate arrow to match direction (row 3 is horizontal, so rotate for vertical shots)
      const angle = Math.atan2(direction.y, direction.x);
      this.rotation = angle;
    });
  }

  private setupAnimation(): void {
    const arrowImage = Images.arrowProjectile;
    
    // Arrow.png is 192x48
    // Per description: 16 pixels tall (48/3 = 16), 192 pixels wide
    // Multiple arrows per row - we'll use 16x16 sprites
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: arrowImage,
      grid: {
        rows: 3,
        columns: 12, // 192/16 = 12 columns
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });

    // Use row 3 (frames 24-35) for horizontal arrows
    this.flyAnimation = ex.Animation.fromSpriteSheet(
      spriteSheet,
      [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
      50 // Faster animation for flight
    );

    this.graphics.use(this.flyAnimation);
  }

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    // Destroy when it reaches or passes the target
    const distanceToTarget = this.pos.distance(this.target);
    if (distanceToTarget < 20) {
      this.kill();
    }
    
    // Also destroy if it's too far from the scene
    if (this.pos.distance(ex.Vector.Zero) > 1000) {
      this.kill();
    }
  }

  getDamage(): number {
    return this.damage;
  }
}

