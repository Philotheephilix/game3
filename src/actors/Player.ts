import * as ex from 'excalibur';
import { Resources } from '../resources';

/**
 * Player actor class
 */
export class Player extends ex.Actor {
  private speed: number = 200;

  constructor(x: number, y: number) {
    super({
      pos: new ex.Vector(x, y),
      width: 40,
      height: 40,
      color: ex.Color.Blue,
      collisionType: ex.CollisionType.Active,
    });
  }

  onInitialize(engine: ex.Engine): void {
    // Load player sprite if available
    // const sprite = Resources.Images.playerSprite.toSprite();
    // this.graphics.use(sprite);
    
    // Set up keyboard input
    engine.input.keyboard.on('press', (evt) => {
      this.handleInput(evt.key);
    });
  }

  onPreUpdate(engine: ex.Engine, delta: number): void {
    const leftRight = engine.input.keyboard.isHeld(ex.Keys.A) || engine.input.keyboard.isHeld(ex.Keys.ArrowLeft)
      ? -1
      : engine.input.keyboard.isHeld(ex.Keys.D) || engine.input.keyboard.isHeld(ex.Keys.ArrowRight)
      ? 1
      : 0;

    const upDown = engine.input.keyboard.isHeld(ex.Keys.W) || engine.input.keyboard.isHeld(ex.Keys.ArrowUp)
      ? -1
      : engine.input.keyboard.isHeld(ex.Keys.S) || engine.input.keyboard.isHeld(ex.Keys.ArrowDown)
      ? 1
      : 0;

    // Normalize diagonal movement
    const direction = new ex.Vector(leftRight, upDown);
    if (direction.size > 0) {
      direction.normalize();
    }

    this.vel = direction.scale(this.speed);
  }

  private handleInput(key: ex.Input.Keys): void {
    // Handle key press events here if needed
    // For example, interactions, abilities, etc.
  }
}
