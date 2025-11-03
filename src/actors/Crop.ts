import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Crop actor that can be harvested with sickle
 */
export class Crop extends ex.Actor {
  private cropType: string;

  constructor(x: number, y: number, cropType: string) {
    super({
      pos: new ex.Vector(x, y),
      width: 16,
      height: 16,
      collisionType: ex.CollisionType.Passive,
      z: Number.MAX_SAFE_INTEGER - 1, // Above ground layer, below player
    });

    this.cropType = cropType;
  }

  onInitialize(_engine: ex.Engine): void {
    // Wait for fall crops image to load
    const loadCrops = Images.fallCrops.isLoaded()
      ? Promise.resolve()
      : Images.fallCrops.load();

    loadCrops.then(() => {
      this.setupSprite();
    });
  }

  private setupSprite(): void {
    // Fall Crops.png is 144x96 (9 columns x 6 rows, 16x16 tiles)
    // We want frames 4, 5, 6 from each row
    const cropSpriteSheet = ex.SpriteSheet.fromImageSource({
      image: Images.fallCrops,
      grid: {
        rows: 6,
        columns: 9,
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });

    // Map crop types to row indices and frame indices
    // Each crop type uses frames 4, 5, or 6 from a specific row
    const cropMapping: { [key: string]: { row: number; frames: number[] } } = {
      'crop1': { row: 0, frames: [4] }, // Frame 4 from row 1
      'crop2': { row: 0, frames: [5] }, // Frame 5 from row 1
      'crop3': { row: 0, frames: [6] }, // Frame 6 from row 1
      'crop4': { row: 1, frames: [4] }, // Frame 4 from row 2
      'crop5': { row: 1, frames: [5] }, // Frame 5 from row 2
      'crop6': { row: 1, frames: [6] }, // Frame 6 from row 2
      'crop7': { row: 2, frames: [4] }, // Frame 4 from row 3
      'crop8': { row: 2, frames: [5] }, // Frame 5 from row 3
      'crop9': { row: 2, frames: [6] }, // Frame 6 from row 3
      'crop10': { row: 3, frames: [4] }, // Frame 4 from row 4
      'crop11': { row: 3, frames: [5] }, // Frame 5 from row 4
      'crop12': { row: 3, frames: [6] }, // Frame 6 from row 4
      'crop13': { row: 4, frames: [4] }, // Frame 4 from row 5
      'crop14': { row: 4, frames: [5] }, // Frame 5 from row 5
      'crop15': { row: 4, frames: [6] }, // Frame 6 from row 5
      'crop16': { row: 5, frames: [4] }, // Frame 4 from row 6
      'crop17': { row: 5, frames: [5] }, // Frame 5 from row 6
      'crop18': { row: 5, frames: [6] }, // Frame 6 from row 6
    };

    const mapping = cropMapping[this.cropType];
    if (mapping) {
      // getSprite expects (columnIndex, rowIndex)
      // mapping.frames[0] is the column (4, 5, or 6)
      // mapping.row is the row index (0-5)
      const columnIndex = mapping.frames[0];
      const rowIndex = mapping.row;
      
      const sprite = cropSpriteSheet.getSprite(columnIndex, rowIndex);
      if (sprite) {
        this.graphics.use(sprite);
        this.scale = new ex.Vector(1, 1);
      }
    }
  }

  getCropType(): string {
    return this.cropType;
  }
}

