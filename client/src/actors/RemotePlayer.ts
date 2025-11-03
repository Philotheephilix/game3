import * as ex from 'excalibur';
import { Images } from '../resources';

// RemotePlayer renders like Player but has no input or gameplay logic
export class RemotePlayer extends ex.Actor {
  private idleAnimations: { [key: string]: ex.Animation } = {};
  private runAnimations: { [key: string]: ex.Animation } = {};
  private lastFacingDirection: string = 'down';
  private targetPos: ex.Vector = ex.Vector.Zero.clone();
  private slideSpeed: number = 120; // pixels per second

  constructor(x: number, y: number) {
    super({ pos: new ex.Vector(x, y), width: 16, height: 16, collisionType: ex.CollisionType.PreventCollision });
    this.targetPos = new ex.Vector(x, y);
  }

  onInitialize(_engine: ex.Engine): void {
    const loadIdle = Images.playerIdle.isLoaded() ? Promise.resolve() : Images.playerIdle.load();
    const loadRun = Images.playerRun.isLoaded() ? Promise.resolve() : Images.playerRun.load();
    Promise.all([loadIdle, loadRun]).then(() => this.setupSprites());
  }

  private setupSprites(): void {
    const idleImage = Images.playerIdle;
    const idleRows = 3;
    const idleColumns = 4;
    let spriteWidth = 32;
    let spriteHeight = 32;
    try {
      const testSprite = idleImage.toSprite();
      if (testSprite) {
        spriteWidth = testSprite.width / idleColumns;
        spriteHeight = testSprite.height / idleRows;
      }
    } catch {}

    const idleSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: idleImage,
      grid: { rows: idleRows, columns: idleColumns, spriteWidth, spriteHeight },
    });

    this.idleAnimations['down'] = ex.Animation.fromSpriteSheet(idleSpriteSheet, [0, 1, 2, 3], 200);
    this.idleAnimations['up'] = ex.Animation.fromSpriteSheet(idleSpriteSheet, [4, 5, 6, 7], 200);
    this.idleAnimations['right'] = ex.Animation.fromSpriteSheet(idleSpriteSheet, [8, 9, 10, 11], 200);
    this.idleAnimations['left'] = ex.Animation.fromSpriteSheet(idleSpriteSheet, [8, 9, 10, 11], 200);
    this.idleAnimations['left'].flipHorizontal = true;

    const runImage = Images.playerRun;
    const runRows = 3;
    const runColumns = 8;
    const runSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: runImage,
      grid: { rows: runRows, columns: runColumns, spriteWidth, spriteHeight },
    });
    this.runAnimations['down'] = ex.Animation.fromSpriteSheet(runSpriteSheet, [0,1,2,3,4,5,6,7], 100);
    this.runAnimations['up'] = ex.Animation.fromSpriteSheet(runSpriteSheet, [8,9,10,11,12,13,14,15], 100);
    this.runAnimations['right'] = ex.Animation.fromSpriteSheet(runSpriteSheet, [16,17,18,19,20,21,22,23], 100);
    this.runAnimations['left'] = ex.Animation.fromSpriteSheet(runSpriteSheet, [16,17,18,19,20,21,22,23], 100);
    this.runAnimations['left'].flipHorizontal = true;

    this.graphics.use(this.idleAnimations['down']);
  }

  // Move and animate based on direction of travel
  public setRemotePosition(nx: number, ny: number): void {
    this.targetPos = new ex.Vector(nx, ny);
  }

  onPreUpdate(_engine: ex.Engine, delta: number): void {
    // Slide towards target position
    const toTarget = this.targetPos.sub(this.pos);
    const dist = toTarget.size;
    const dt = delta / 1000;
    const maxStep = this.slideSpeed * dt;
    if (dist > 0.5) {
      const dir = toTarget.normalize();
      const step = Math.min(maxStep, dist);
      this.pos = this.pos.add(dir.scale(step));

      let facing = this.lastFacingDirection;
      if (Math.abs(dir.x) > Math.abs(dir.y)) facing = dir.x > 0 ? 'right' : 'left';
      else facing = dir.y > 0 ? 'down' : 'up';
      this.lastFacingDirection = facing;
      if (this.runAnimations[facing]) this.graphics.use(this.runAnimations[facing]);
    } else {
      // Idle at target
      const facing = this.lastFacingDirection;
      if (this.idleAnimations[facing]) this.graphics.use(this.idleAnimations[facing]);
    }
  }
}


