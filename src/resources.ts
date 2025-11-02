import * as ex from 'excalibur';
import * as tiled from '@excaliburjs/plugin-tiled';

/**
 * Asset Resources
 * Add your assets here and they will be automatically loaded
 */

// Sprites/Images
export const Images = {
  playerIdle: new ex.ImageSource('/src/assets/character/Idle.png'),
  playerRun: new ex.ImageSource('/src/assets/character/Run.png'),
  inventorySlots: new ex.ImageSource('/src/assets/character/Slots.png'),
  inventoryBar: new ex.ImageSource('/src/assets/character/invimage.png'),
  money: new ex.ImageSource('/src/assets/Money.png'),
};

// Maps/Tilemaps
export const Maps = {
  mineMap: new tiled.TiledResource('/src/assets/mine.tmj'),
};

// Sounds (if needed)
export const Sounds = {
  // Example: Add your sound files here
  // backgroundMusic: new ex.Sound('./assets/sounds/background.mp3'),
};

// Collect all resources for loading
export const Resources = {
  ...Images,
  ...Maps,
  ...Sounds,
};

// Resource loader helper
export const ResourceLoader = new ex.Loader();
Object.values(Resources).forEach(resource => {
  ResourceLoader.addResource(resource);
});
