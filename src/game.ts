import * as ex from 'excalibur';
import { ResourceLoader } from './resources';
import { GameScene, setGameEngine as setGameEngineForGame } from './scenes/GameScene';
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
    // Register scenes - add 'game' first so it becomes the default
    this.add('game', new GameScene());
    this.add('main', new MainScene());
    
    // Set the game engine reference for scene transitions
    setGameEngineForGame(this);

    // Start the game with the loader
    // All resources will be loaded before the game starts
    return super.start(ResourceLoader).then(() => {
      console.log('Resources loaded');
      // Switch to game scene after resources load
      this.goToScene('game');
    }).catch((error) => {
      console.error('Error starting game:', error);
      // Even if resources fail, at least show the game scene
      this.goToScene('game');
    });
  }
}

// Export game class instead of auto-starting
export { Game };

// Export a function to start the game when needed
export function createAndStartGame(): Promise<void> {
  const game = new Game();
  return game.start().catch(console.error);
}
