import * as ex from 'excalibur';
import { Player } from '../actors/Player';
import { Resources } from '../resources';

/**
 * Main game scene with player and game logic
 */
export class GameScene extends ex.Scene {
  private player!: Player;

  onInitialize(engine: ex.Engine): void {
    // Create and add player
    this.player = new Player(
      engine.halfDrawWidth,
      engine.halfDrawHeight
    );
    this.add(this.player);

    // TODO: Add your map here when ready
    // Example:
    // const map = new ex.TileMap({ ... });
    // this.add(map);

    // Set up camera to follow player
    this.camera.strategy.lockToActor(this.player);
    this.camera.strategy.limitCameraBounds(
      new ex.BoundingBox(0, 0, 2000, 2000) // Adjust based on your map size
    );
  }

  onActivate(): void {
    console.log('GameScene activated');
  }

  onDeactivate(): void {
    console.log('GameScene deactivated');
  }
}
