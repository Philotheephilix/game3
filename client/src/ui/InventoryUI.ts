import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Inventory UI component
 * Displays inventory slots at the bottom of the screen
 */
export class InventoryUI {
  private inventoryBar!: ex.Actor;
  private slotActors: ex.Actor[] = [];
  private numSlots: number = 8;
  private scene: ex.Scene;
  private engine!: ex.Engine;

  constructor(scene: ex.Scene, numSlots: number = 8) {
    this.scene = scene;
    this.numSlots = numSlots;
  }

  onInitialize(engine: ex.Engine): void {
    this.engine = engine;
    // Wait for the slots image to load
    if (!Images.inventorySlots.isLoaded()) {
      Images.inventorySlots.load().then(() => {
        this.setupInventory(engine);
      });
    } else {
      this.setupInventory(engine);
    }
  }
  
  // Update UI position to stay fixed to screen (called in scene update)
  onUpdate(): void {
    if (!this.engine || !this.inventoryBar) return;
    
    // Keep inventory bar fixed to screen coordinates
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    const barHeight = 32;
    
    // Update position to stay at bottom center of screen
    this.inventoryBar.pos = new ex.Vector(screenWidth / 2, screenHeight - barHeight / 2 - 10);
    
    // Update slot positions
    const slotSize = 16;
    const totalBarWidth = this.numSlots * slotSize;
    const startX = screenWidth / 2 - totalBarWidth / 2;
    const barY = screenHeight - 32 - 10;
    
    this.slotActors.forEach((slot, i) => {
      slot.pos = new ex.Vector(startX + i * slotSize + slotSize / 2, barY + slotSize / 2);
    });
  }

  private setupInventory(engine: ex.Engine): void {
    // The inventory bar is approximately 128x32 pixels with 8 slots (16x16 each)
    // Based on the sprite sheet description, the inventory bars with slots are at the bottom
    
    const slotSize = 16;
    const barHeight = 32;
    const barWidth = this.numSlots * slotSize; // 8 slots * 16px = 128px
    
    try {
      const screenWidth = engine.drawWidth;
      const screenHeight = engine.drawHeight;
      
      // Get the full image sprite to extract a region
      const fullSprite = Images.inventorySlots.toSprite();
      
      if (fullSprite) {
        console.log('Inventory slots image loaded:', fullSprite.width, 'x', fullSprite.height);
        
        // Try to extract the inventory bar region from the sprite sheet
        // Based on description: inventory bars with 8 slots are at the bottom rows
        // The bar is 128x32 pixels, starting at some position in the sprite sheet
        
        // Create inventory bar actor positioned at bottom center of screen
        this.inventoryBar = new ex.Actor({
          pos: new ex.Vector(screenWidth / 2, screenHeight - barHeight / 2 - 10),
          width: barWidth,
          height: barHeight,
        });

        // Try to create a cropped sprite from the inventory bar region
        // The bottom inventory bars start around y position (image height - 64) for two 32px bars
        // We'll extract a 128x32 region from the bottom of the image
        
        const spriteHeight = fullSprite.height;
        const sourceY = spriteHeight - 64; // Start from second-to-last 32px row (the one with dark orange slots)
        
        // Create a cropped sprite using GraphicsRegion or directly from image
        try {
          // Extract region using sprite sheet approach
          // The inventory bars are likely in a grid, let's try extracting them
          this.createInventoryBarFromSpriteSheet(engine, screenWidth, screenHeight, slotSize, barHeight);
        } catch (e) {
          console.log('Could not extract sprite, using fallback');
          this.createFallbackInventory(engine);
        }
      } else {
        this.createFallbackInventory(engine);
      }
    } catch (error) {
      console.error('Error setting up inventory:', error);
      this.createFallbackInventory(engine);
    }
  }
  
  private createInventoryBarFromSpriteSheet(engine: ex.Engine, screenWidth: number, screenHeight: number, slotSize: number, barHeight: number): void {
    // The sprite sheet has the inventory bars - let's extract them properly
    // Based on description, bars are 128x32, but the sprite sheet might be organized differently
    
    // Try using the full sprite and cropping it
    const fullSprite = Images.inventorySlots.toSprite();
    
    if (fullSprite && fullSprite.image) {
      // Create the inventory bar background using the sprite
      const barY = screenHeight - barHeight / 2 - 10;
      const barWidth = this.numSlots * slotSize;
      
      // For now, use the full sprite or create slots individually
      // Try to extract the inventory bar that has 8 slots
      // It's likely the one with dark orange slots (bottom row in sprite sheet)
      
      // Create the inventory bar container
      this.inventoryBar = new ex.Actor({
        pos: new ex.Vector(screenWidth / 2, barY),
        width: barWidth,
        height: barHeight,
      });

      // Use the sprite directly or extract the bar region
      // Since Excalibur doesn't easily crop sprites, we'll use individual slot sprites
      this.createInventorySlots(engine, screenWidth, screenHeight, slotSize);
      
      this.inventoryBar.z = Number.MAX_SAFE_INTEGER;
      this.inventoryBar.body.collisionType = ex.CollisionType.PreventCollision;
      this.scene.add(this.inventoryBar);
    }
  }

  private createInventorySlots(engine: ex.Engine, screenWidth: number, screenHeight: number, slotSize: number): void {
    const barY = screenHeight - 32 - 10; // 32px height + 10px margin
    const totalBarWidth = this.numSlots * slotSize;
    const startX = screenWidth / 2 - totalBarWidth / 2;
    
    // Get the full sprite to calculate dimensions
    const fullSprite = Images.inventorySlots.toSprite();
    if (!fullSprite) {
      console.warn('Could not load inventory slots sprite');
      return;
    }
    
    // Based on description: sprite sheet has 128x32 inventory bars
    // The bars with slots have 8 slots of 16x16 each
    // Try to extract the entire bar as one sprite, or create individual slots
    
    // First, try to extract the inventory bar directly (128x32)
    // The bars are at the bottom: one with dark orange slots, one with light orange slots
    // Let's try to create a region sprite for the bar
    
    const spriteWidth = fullSprite.width;
    const spriteHeight = fullSprite.height;
    
    // Try extracting the bar region - it's likely near the bottom
    // Position: x=0 or at start, y=spriteHeight-64 (for the second-to-last bar with dark orange)
    try {
      // Use GraphicsRegion to extract the bar sprite
      // The inventory bar with dark orange slots is at the bottom
      const barSourceY = spriteHeight - 64; // Second-to-last 32px row (dark orange slots)
      const barSourceX = 0;
      
      // Create a sprite with a source view to extract the inventory bar region
      const barSprite = new ex.Sprite({
        image: Images.inventorySlots,
        sourceView: {
          x: barSourceX,
          y: barSourceY,
          width: totalBarWidth,
          height: 32,
        },
      });
      
      // Use the extracted bar sprite
      this.inventoryBar.graphics.add(barSprite);
      console.log('Extracted inventory bar sprite from image');
      
    } catch (e) {
      console.log('Could not extract bar sprite, creating individual slots');
      // Fallback: create individual slots using sprite sheet
      this.createIndividualSlots(engine, screenWidth, screenHeight, slotSize, barY, startX);
    }
  }
  
  private createIndividualSlots(engine: ex.Engine, screenWidth: number, screenHeight: number, slotSize: number, barY: number, startX: number): void {
    // Create sprite sheet with 16x16 grid to extract individual slot sprites
    const fullSprite = Images.inventorySlots.toSprite();
    if (!fullSprite) return;
    
    // Estimate grid - slots are 16x16, try different grid configurations
    const estimatedRows = Math.floor(fullSprite.height / slotSize);
    const estimatedCols = Math.floor(fullSprite.width / slotSize);
    
    console.log(`Trying sprite sheet grid: ${estimatedCols} columns x ${estimatedRows} rows`);
    
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: Images.inventorySlots,
      grid: {
        rows: estimatedRows,
        columns: estimatedCols,
        spriteWidth: slotSize,
        spriteHeight: slotSize,
      },
    });

    // The dark orange slots (16x16) should be somewhere in the sprite sheet
    // Try frames from bottom rows - likely in last few rows
    const slotsStartRow = estimatedRows - 2; // Second-to-last row has the slots
    const slotFrameStart = slotsStartRow * estimatedCols;
    
    for (let i = 0; i < this.numSlots; i++) {
      const slotX = startX + i * slotSize + slotSize / 2;
      const slotY = barY + slotSize / 2;
      
      // Try different frame indices for the slot sprites
      const slotFrame = slotFrameStart + (i % estimatedCols);
      
      const slotActor = new ex.Actor({
        pos: new ex.Vector(slotX, slotY),
        width: slotSize,
        height: slotSize,
      });
      
      try {
        const slotSprite = spriteSheet.getSprite(slotFrame);
        if (slotSprite) {
          slotActor.graphics.add(slotSprite);
        } else {
          // Fallback: use colored rectangle
          const slotRect = new ex.Rectangle({
            width: slotSize,
            height: slotSize,
            color: ex.Color.fromHex('#8B4513'),
          });
          slotActor.graphics.add(slotRect);
        }
      } catch (e) {
        // Fallback: use colored rectangle
        const slotRect = new ex.Rectangle({
          width: slotSize,
          height: slotSize,
          color: ex.Color.fromHex('#8B4513'),
        });
        slotActor.graphics.add(slotRect);
      }
      
      slotActor.z = Number.MAX_SAFE_INTEGER;
      slotActor.body.collisionType = ex.CollisionType.PreventCollision;
      
      this.slotActors.push(slotActor);
      this.scene.add(slotActor);
    }
    
    console.log(`Created ${this.numSlots} individual inventory slots`);
  }

  private createFallbackInventory(engine: ex.Engine): void {
    const screenWidth = engine.drawWidth;
    const screenHeight = engine.drawHeight;
    const slotSize = 16;
    const barHeight = 32;
    const totalBarWidth = this.numSlots * slotSize;
    
    // Create a simple inventory bar
    this.inventoryBar = new ex.Actor({
      pos: new ex.Vector(screenWidth / 2, screenHeight - barHeight / 2 - 10),
      width: totalBarWidth,
      height: barHeight,
    });
    
    // Draw inventory bar background using Rectangle graphic
    const barRect = new ex.Rectangle({
      width: totalBarWidth,
      height: barHeight,
      color: ex.Color.fromHex('#654321'),
    });
    this.inventoryBar.graphics.add(barRect);
    
    this.inventoryBar.z = Number.MAX_SAFE_INTEGER;
    this.inventoryBar.body.collisionType = ex.CollisionType.PreventCollision;
    
    // Create individual slots
    const startX = screenWidth / 2 - totalBarWidth / 2;
    for (let i = 0; i < this.numSlots; i++) {
      const slotActor = new ex.Actor({
        pos: new ex.Vector(startX + i * slotSize + slotSize / 2, 
          screenHeight - barHeight / 2 - 10),
        width: slotSize,
        height: slotSize,
      });
      
      const slotRect = new ex.Rectangle({
        width: slotSize - 2,
        height: slotSize - 2,
        color: ex.Color.fromHex('#8B4513'),
      });
      slotActor.graphics.add(slotRect);
      
      slotActor.z = Number.MAX_SAFE_INTEGER;
      slotActor.body.collisionType = ex.CollisionType.PreventCollision;
      
      this.slotActors.push(slotActor);
      this.scene.add(slotActor);
    }
    
    this.scene.add(this.inventoryBar);
  }
}

