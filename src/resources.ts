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
  playerDamage: new ex.ImageSource('/src/assets/character/Damage.png'),
  playerDead: new ex.ImageSource('/src/assets/character/Dead.png'),
  inventorySlots: new ex.ImageSource('/src/assets/character/Slots.png'),
  inventoryBar: new ex.ImageSource('/src/assets/character/invimage.png'),
  money: new ex.ImageSource('/src/assets/Money.png'),
  moleEntering: new ex.ImageSource('/src/assets/sprites/entering.png'),
  moleLeaving: new ex.ImageSource('/src/assets/sprites/leaving.png'),
  moleIdle: new ex.ImageSource('/src/assets/sprites/idle.png'),
  moleSpitting: new ex.ImageSource('/src/assets/sprites/spitting.png'),
  moleDamage: new ex.ImageSource('/src/assets/sprites/damage.png'),
  moleDead: new ex.ImageSource('/src/assets/sprites/dead.png'),
  projectileGreen: new ex.ImageSource('/src/assets/sprites/projectile/Green.png'),
  playerBowAttack: new ex.ImageSource('/src/assets/character/Bow and Arrow.png'),
  arrowProjectile: new ex.ImageSource('/src/assets/character/Arrow.png'),
  playerSickle: new ex.ImageSource('/src/assets/Manu/Sickle.png'),
  fallCrops: new ex.ImageSource('/src/assets/Farm Crops - Tiny Asset Pack/Fall Crops.png'),
  healthBars: new ex.ImageSource('/src/assets/Bars.png'),
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
export const ResourceLoader = new ex.Loader({ suppressPlayButton: true });
Object.values(Resources).forEach(resource => {
  ResourceLoader.addResource(resource);
});
