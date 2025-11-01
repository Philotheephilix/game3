import * as ex from 'excalibur';
import { ResourceLoader, Resources } from './resources';
import { GameScene } from './scenes/GameScene';
import { MainScene } from './scenes/MainScene';

/**
 * Main game class
 */
class Game extends ex.Engine {
  constructor() {
    super({
      width: 800,
      height: 600,
      displayMode: ex.DisplayMode.FitScreen,
      backgroundColor: ex.Color.fromHex('#2c3e50')
    });
  }

  public start(): Promise<void> {
    // Register scenes
    this.add('game', new GameScene());
    this.add('main', new MainScene());

    // Start the game with the loader
    // All resources will be loaded before the game starts
    return super.start(ResourceLoader).then(() => {
      // Switch to the game scene after resources are loaded
      this.goToScene('game');
    });
  }
}

// Initialize and start the game
const game = new Game();
game.start().catch(console.error);

export { game };
