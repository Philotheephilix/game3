import * as ex from 'excalibur';
import { ResourceLoader } from './resources';
import { GameScene } from './scenes/GameScene';
import { MainScene } from './scenes/MainScene';

/**
 * Main game class
 */
class Game extends ex.Engine {
  constructor() {
    // Use viewport dimensions and scale to fill screen
    const viewportWidth = window.innerWidth || 1920;
    const viewportHeight = window.innerHeight || 1080;
    
    super({
      width: viewportWidth,
      height: viewportHeight,
      displayMode: ex.DisplayMode.FillScreen,
      pixelArt: false,
      physics: {
        enabled: true,
        gravity: ex.Vector.Zero, // No gravity for top-down game
      }
    });
    
    // Handle window resize to maintain full screen
    window.addEventListener('resize', () => {
      // FillScreen mode automatically handles scaling, but we update the base resolution
      this.screen.applyResolutionAndViewport();
    });
  }

  public start(): Promise<void> {
    // Register scenes
    this.add('main', new MainScene());
    this.add('game', new GameScene());
    
    // Start with main scene immediately so something shows
    this.goToScene('main');

    // Start the game with the loader
    // All resources will be loaded before the game starts
    return super.start(ResourceLoader).then(() => {
      console.log('Resources loaded, switching to game scene');
      // Switch to the game scene after resources are loaded
      this.goToScene('game');
    }).catch((error) => {
      console.error('Error starting game:', error);
      // Even if resources fail, at least show the main scene
      this.goToScene('main');
    });
  }
}

// Initialize and start the game
const game = new Game();
game.start().catch(console.error);

export { game };
