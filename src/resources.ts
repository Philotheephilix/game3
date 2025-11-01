import * as ex from 'excalibur';

/**
 * Asset Resources
 * Add your assets here and they will be automatically loaded
 */

// Sprites/Images
export const Images = {
  // Example: Add your sprite images here
  // playerSprite: new ex.ImageSource('./assets/sprites/player.png'),
  // enemySprite: new ex.ImageSource('./assets/sprites/enemy.png'),
};

// Maps/Tilemaps
export const Maps = {
  // Example: Add your map files here
  // mainMap: new ex.ImageSource('./assets/maps/main-map.png'),
  // tilemap: new ex.TileMap('./assets/maps/tilemap.json'),
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
