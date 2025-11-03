import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Projectile shot by mole enemy
 * Animates while traveling
 */
export class Projectile extends ex.Actor {
  private flyAnimation!: ex.Animation;
  private target!: ex.Vector;
  private speed: number = 200;

  constructor(startPos: ex.Vector, targetPos: ex.Vector) {
    super({
      pos: startPos,
      width: 16,
      height: 16,
      collisionType: ex.CollisionType.Passive,
      z: Number.MAX_SAFE_INTEGER - 3,
    });
    
    this.target = targetPos;
  }

  onInitialize(_engine: ex.Engine): void {
    const loadProjectile = Images.projectileGreen.isLoaded()
      ? Promise.resolve()
      : Images.projectileGreen.load();

    loadProjectile.then(() => {
      this.setupAnimation();
      const direction = this.target.sub(this.pos).normalize();
      this.vel = direction.scale(this.speed);
    });
  }

  private setupAnimation(): void {
    const projectileImage = Images.projectileGreen;
    
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: projectileImage,
      grid: {
        rows: 1,
        columns: 10,
        spriteWidth: 32,
        spriteHeight: 48,
      },
    });

    this.flyAnimation = ex.Animation.fromSpriteSheet(
      spriteSheet,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      100
    );

    this.graphics.use(this.flyAnimation);
  }

  onPreUpdate(_engine: ex.Engine, _delta: number): void {
    const distanceToTarget = this.pos.distance(this.target);
    if (distanceToTarget < 10) {
      this.kill();
    }
    
    if (this.pos.distance(ex.Vector.Zero) > 1000) {
      this.kill();
    }
  }
}
