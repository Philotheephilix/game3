# Assets Directory

## Structure

- `maps/` - Place your map files here (PNG images, JSON tilemaps, etc.)
- `sprites/` - Place your sprite images here (PNG, JPG, etc.)

## Usage

1. Add your asset files to the appropriate folders
2. Import and reference them in `src/resources.ts`
3. The assets will be automatically loaded when the game starts

## Example

To add a player sprite:
1. Place `player.png` in `sprites/` folder
2. Update `src/resources.ts`:
   ```typescript
   playerSprite: new ex.ImageSource('./assets/sprites/player.png'),
   ```
3. Use it in your actors:
   ```typescript
   const sprite = Resources.Images.playerSprite.toSprite();
   this.graphics.use(sprite);
   ```
