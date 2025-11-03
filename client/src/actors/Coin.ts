import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Coin collectible actor
 * Animated spinning coin that can be collected
 */
export class Coin extends ex.Actor {
  private spinAnimation!: ex.Animation;
  public canBeCollected: boolean = false;

  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 16,
      height: 16,
      collisionType: ex.CollisionType.Passive, // Passive so player can pass through
      z: Number.MAX_SAFE_INTEGER - 4, // Above map, below player
    });
  }

  onInitialize(_engine: ex.Engine): void {
    // Wait for money image to load
    const loadMoney = Images.money.isLoaded()
      ? Promise.resolve()
      : Images.money.load();

    loadMoney.then(() => {
      this.setupAnimation();
    });

    // Grace period to prevent immediate pickup
    setTimeout(() => {
      this.canBeCollected = true;
    }, 500); // Half second grace period
  }

  private setupAnimation(): void {
    const moneyImage = Images.money;
    
    // Money.png has 6 frames in a single row
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: moneyImage,
      grid: {
        rows: 1,
        columns: 6,
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });

    // Create spinning animation with all 6 frames
    this.spinAnimation = ex.Animation.fromSpriteSheet(
      spriteSheet,
      [0, 1, 2, 3, 4, 5],
      100 // Animation speed in ms per frame
    );

    this.graphics.use(this.spinAnimation);
  }
}

