import * as ex from 'excalibur';
import { Images } from '../resources';

/**
 * Inventory slot data
 */
export interface InventorySlot {
  itemId: string | null;
  quantity: number;
}

/**
 * InventoryHUD - Screen-fixed inventory bar using the 5th row of Slots.png
 * This is a HUD UI element, not a game world actor
 */
export class InventoryHUD {
  private slots: InventorySlot[] = [];
  private selectedSlot: number = 0;
  private draggedSlot: number = -1;
  private draggedItem: InventorySlot | null = null;
  private hoveredSlot: number = -1;
  
  private slotSprites: ex.Sprite[] = [];
  private slotSize: number = 16; // Each slot is 16x16 pixels
  private numSlots: number = 8;
  private barWidth: number = 128; // 8 slots * 16px = 128px (matching sprite)
  private barHeight: number = 24; // Height of the bar sprite
  
  private scene!: ex.Scene;
  private engine!: ex.Engine;
  private hudActor!: ex.Actor; // Actor used only for rendering, positioned in screen space
  
  // Sprite from 5th row (row 4, 0-indexed) of Slots.png
  private barSprite: ex.Sprite | null = null;

  constructor() {
    // Initialize empty slots
    for (let i = 0; i < this.numSlots; i++) {
      this.slots.push({ itemId: null, quantity: 0 });
    }
  }

  /**
   * Initialize the inventory HUD
   */
  initialize(scene: ex.Scene, engine: ex.Engine): void {
    this.scene = scene;
    this.engine = engine;

    // Load the inventory bar sprite (5th row from Slots.png)
    this.loadBarSprite();

    // Create HUD actor for rendering (not a world actor, just for UI)
    this.hudActor = new ex.Actor({
      pos: ex.Vector.Zero, // Position will be updated to screen space
      width: this.barWidth,
      height: this.barHeight,
      z: Number.MAX_SAFE_INTEGER, // On top of everything
    });

    // Set up input handlers
    this.setupInputHandlers();

    // Add to scene
    this.scene.add(this.hudActor);

    // Initialize with some test items
    this.addItem('wood', 5, 0);
    this.addItem('ore', 3, 1);
  }

  /**
   * Load the bar sprite from the 5th row (row 4, 0-indexed) of Slots.png
   */
  private loadBarSprite(): void {
    const slotsImage = Images.inventorySlots;
    
    if (!slotsImage.isLoaded()) {
      slotsImage.load().then(() => {
        this.createBarSprite();
      }).catch((e) => {
        console.error('Failed to load Slots.png:', e);
      });
    } else {
      this.createBarSprite();
    }
  }

  /**
   * Create sprite from the 5th row
   */
  private createBarSprite(): void {
    const slotsImage = Images.inventorySlots;

    // Slots.png is 128x128, divided into 8x8 grid (16x16 per tile)
    // 5th row (row 4, 0-indexed) contains frames 32-39
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: slotsImage,
      grid: {
        rows: 8,
        columns: 8,
        spriteWidth: 16,
        spriteHeight: 16,
      },
    });

    // Get the full bar from row 4 (frames 32-39, which is the complete 8-slot bar)
    // Frame 32 is the first slot, frame 39 is the last slot
    // We'll use frame 32 as a template and tile it, or we can create a composite sprite
    try {
      // For simplicity, get frame 32 and use it as a repeating pattern
      // Or better: create a sprite from the entire row
      const frames = [32, 33, 34, 35, 36, 37, 38, 39];
      const animation = ex.Animation.fromSpriteSheet(spriteSheet, frames, 100);
      
      // Create a composite graphic from all frames
      // Actually, we'll draw each slot individually for better control
      for (let i = 0; i < this.numSlots; i++) {
        const frameAnimation = ex.Animation.fromSpriteSheet(spriteSheet, [frames[i]], 100);
        const slotSprite = frameAnimation.frames[0]?.graphic as ex.Sprite;
        if (slotSprite) {
          this.slotSprites.push(slotSprite);
        }
      }
      
      console.log(`Loaded ${this.slotSprites.length} slot sprites from row 4`);
    } catch (e) {
      console.error('Failed to load slot sprites:', e);
    }
  }

  /**
   * Set up input handlers for interaction
   */
  private setupInputHandlers(): void {
    // Keyboard shortcuts (1-8) for selecting slots
    this.engine.input.keyboard.on('press', (evt: ex.Input.KeyEvent) => {
      if (evt.key >= ex.Keys.Digit1 && evt.key <= ex.Keys.Digit8) {
        const slotIndex = evt.key - ex.Keys.Digit1;
        this.selectSlot(slotIndex);
      }
    });

    // Mouse input
    this.engine.input.pointers.primary.on('down', (evt: ex.Input.PointerEvent) => {
      this.handleMouseDown(evt);
    });

    this.engine.input.pointers.primary.on('up', (evt: ex.Input.PointerEvent) => {
      this.handleMouseUp(evt);
    });

    this.engine.input.pointers.primary.on('move', (evt: ex.Input.PointerEvent) => {
      this.handleMouseMove(evt);
    });
  }

  /**
   * Get slot index from screen coordinates
   */
  private getSlotAtScreen(screenX: number, screenY: number): number {
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    
    // Inventory bar position (bottom center)
    const barX = (screenWidth - this.barWidth) / 2;
    const barY = screenHeight - this.barHeight - 20; // 20px from bottom
    
    // Check if click is within the bar bounds
    if (screenY >= barY && screenY <= barY + this.barHeight) {
      if (screenX >= barX && screenX <= barX + this.barWidth) {
        const relativeX = screenX - barX;
        const slotIndex = Math.floor(relativeX / this.slotSize);
        if (slotIndex >= 0 && slotIndex < this.numSlots) {
          return slotIndex;
        }
      }
    }
    
    return -1;
  }

  /**
   * Handle mouse down
   */
  private handleMouseDown(evt: ex.Input.PointerEvent): void {
    const screenPos = evt.screenPos;
    const slotIndex = this.getSlotAtScreen(screenPos.x, screenPos.y);
    
    if (slotIndex >= 0) {
      const slot = this.slots[slotIndex];
      
      if (evt.button === ex.PointerButton.Left) {
        if (this.draggedSlot === -1 && slot.itemId) {
          // Start dragging
          this.draggedSlot = slotIndex;
          this.draggedItem = { ...slot };
        } else if (this.draggedSlot >= 0) {
          // Drop item
          this.handleDrop(slotIndex);
        }
      } else if (evt.button === ex.PointerButton.Right) {
        // Right click: select slot
        this.selectSlot(slotIndex);
      }
    }
  }

  /**
   * Handle mouse up
   */
  private handleMouseUp(evt: ex.Input.PointerEvent): void {
    if (this.draggedSlot >= 0) {
      const screenPos = evt.screenPos;
      const slotIndex = this.getSlotAtScreen(screenPos.x, screenPos.y);
      
      if (slotIndex >= 0 && slotIndex !== this.draggedSlot) {
        this.handleDrop(slotIndex);
      } else {
        // Cancel drag
        this.draggedSlot = -1;
        this.draggedItem = null;
      }
    }
  }

  /**
   * Handle mouse move
   */
  private handleMouseMove(evt: ex.Input.PointerEvent): void {
    const screenPos = evt.screenPos;
    const slotIndex = this.getSlotAtScreen(screenPos.x, screenPos.y);
    
    this.hoveredSlot = slotIndex;
  }

  /**
   * Handle dropping an item
   */
  private handleDrop(targetSlot: number): void {
    if (this.draggedSlot < 0 || !this.draggedItem) return;
    
    if (targetSlot === this.draggedSlot) {
      this.draggedSlot = -1;
      this.draggedItem = null;
      return;
    }

    const targetSlotData = this.slots[targetSlot];
    
    if (!targetSlotData.itemId) {
      // Empty slot, move item
      this.slots[targetSlot] = { ...this.draggedItem };
      this.slots[this.draggedSlot] = { itemId: null, quantity: 0 };
    } else if (targetSlotData.itemId === this.draggedItem.itemId) {
      // Same item, stack
      targetSlotData.quantity += this.draggedItem.quantity;
      this.slots[this.draggedSlot] = { itemId: null, quantity: 0 };
    } else {
      // Different item, swap
      const temp = { ...this.slots[targetSlot] };
      this.slots[targetSlot] = { ...this.draggedItem };
      this.slots[this.draggedSlot] = temp;
    }

    this.draggedSlot = -1;
    this.draggedItem = null;
  }

  /**
   * Select a slot
   */
  selectSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      this.selectedSlot = slotIndex;
    }
  }

  /**
   * Get selected slot index
   */
  getSelectedSlot(): number {
    return this.selectedSlot;
  }

  /**
   * Add item to a specific slot
   */
  addItem(itemId: string, quantity: number = 1, slotIndex?: number): boolean {
    if (slotIndex !== undefined) {
      // Add to specific slot
      if (slotIndex >= 0 && slotIndex < this.numSlots) {
        const slot = this.slots[slotIndex];
        if (slot.itemId === null || slot.itemId === itemId) {
          if (slot.itemId === null) {
            slot.itemId = itemId;
            slot.quantity = quantity;
          } else {
            slot.quantity += quantity;
          }
          return true;
        }
      }
      return false;
    } else {
      // Find first empty slot or stack with existing
      for (let i = 0; i < this.numSlots; i++) {
        const slot = this.slots[i];
        if (slot.itemId === null) {
          slot.itemId = itemId;
          slot.quantity = quantity;
          return true;
        } else if (slot.itemId === itemId) {
          slot.quantity += quantity;
          return true;
        }
      }
      return false;
    }
  }

  /**
   * Get item at slot
   */
  getItem(slotIndex: number): InventorySlot | null {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      return this.slots[slotIndex];
    }
    return null;
  }

  /**
   * Remove item from slot
   */
  removeItem(slotIndex: number, quantity: number = 1): boolean {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      const slot = this.slots[slotIndex];
      if (slot.itemId && slot.quantity >= quantity) {
        slot.quantity -= quantity;
        if (slot.quantity <= 0) {
          slot.itemId = null;
          slot.quantity = 0;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Get all slots
   */
  getSlots(): InventorySlot[] {
    return [...this.slots];
  }

  /**
   * Update the HUD (called each frame)
   */
  update(): void {
    // Update HUD actor position to screen space
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    
    // Position at bottom center (in world space, but offset from camera to appear fixed)
    const cameraPos = this.scene.camera.pos;
    const zoomFactor = this.scene.camera.zoom;
    
    // Calculate screen position
    const screenX = screenWidth / 2;
    const screenY = screenHeight - this.barHeight - 20;
    
    // Convert to world position (camera-relative)
    const worldX = cameraPos.x + (screenX - screenWidth / 2) / zoomFactor;
    const worldY = cameraPos.y + (screenY - screenHeight / 2) / zoomFactor;
    
    this.hudActor.pos = new ex.Vector(worldX, worldY);
    this.hudActor.scale = new ex.Vector(1 / zoomFactor, 1 / zoomFactor);
  }

  /**
   * Draw using Excalibur's graphics context
   */
  drawWithContext(ctx: ex.ExcaliburGraphicsContext, delta: number): void {
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;

    // Position at bottom center (screen coordinates)
    const barX = (screenWidth - this.barWidth) / 2;
    const barY = screenHeight - this.barHeight - 20;

    // Save the current state
    ctx.save();

    // Draw each slot using Excalibur's graphics API
    for (let i = 0; i < this.numSlots; i++) {
      const slotX = barX + i * this.slotSize;
      const slot = this.slots[i];

      // Draw slot background (fallback rectangle)
      ctx.drawRectangle(
        new ex.Vector(slotX, barY),
        this.slotSize,
        this.barHeight,
        ex.Color.fromHex('#8B4513')
      );

      // Draw slot border
      ctx.drawRectangle(
        new ex.Vector(slotX, barY),
        this.slotSize,
        this.barHeight,
        ex.Color.Transparent,
        ex.Color.fromHex('#D2691E'),
        2
      );

      // Try to draw sprite if available
      if (this.slotSprites[i]) {
        try {
          this.slotSprites[i].draw(ctx, slotX, barY);
        } catch (e) {
          // Sprite drawing failed, use fallback
        }
      }

      // Draw selection highlight
      if (i === this.selectedSlot) {
        ctx.drawRectangle(
          new ex.Vector(slotX, barY),
          this.slotSize,
          this.barHeight,
          ex.Color.Transparent,
          ex.Color.fromHex('#FF8C00'),
          3
        );
      }

      // Draw hover highlight
      if (i === this.hoveredSlot && this.draggedSlot === -1) {
        ctx.drawRectangle(
          new ex.Vector(slotX, barY),
          this.slotSize,
          this.barHeight,
          ex.Color.Transparent,
          ex.Color.fromHex('#FFA500'),
          2
        );
      }

      // Draw item icon
      if (slot.itemId) {
        const iconSize = 12;
        const iconX = slotX + (this.slotSize - iconSize) / 2;
        const iconY = barY + (this.barHeight - iconSize) / 2;

        ctx.drawRectangle(
          new ex.Vector(iconX, iconY),
          iconSize,
          iconSize,
          this.getItemColorEx(slot.itemId)
        );

        // Draw quantity
        if (slot.quantity > 1) {
          const text = new ex.Text({
            text: slot.quantity.toString(),
            font: new ex.Font({
              size: 10,
              color: ex.Color.White,
              textAlign: ex.TextAlign.Right,
            }),
          });
          text.draw(ctx, slotX + this.slotSize - 2, barY + this.barHeight - 2);
        }
      }
    }

    // Draw dragged item
    if (this.draggedSlot >= 0 && this.draggedItem) {
      const pointer = this.engine.input.pointers.primary;
      const screenPos = pointer.lastScreenPos || ex.Vector.Zero;

      const iconSize = 12;
      ctx.opacity = 0.7;
      ctx.drawRectangle(
        new ex.Vector(screenPos.x - iconSize / 2, screenPos.y - iconSize / 2),
        iconSize,
        iconSize,
        this.getItemColorEx(this.draggedItem.itemId || '')
      );
    }

    ctx.restore();
  }

  /**
   * Draw the inventory HUD (legacy method - kept for compatibility)
   */
  draw(): void {
    // Get raw canvas context for screen-space drawing
    const canvas = this.engine.canvas;
    if (!canvas) {
      return;
    }
    
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) {
      return;
    }
    
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    
    // Position at bottom center (screen coordinates)
    const barX = (screenWidth - this.barWidth) / 2;
    const barY = screenHeight - this.barHeight - 20;
    
    // Save current transform
    ctx.save();
    
    // Reset transform to screen space (important for screen-fixed UI)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Debug log (remove after testing)
    // console.log('Drawing inventory at:', barX, barY, 'screen size:', screenWidth, screenHeight);
    
    // Draw each slot
    for (let i = 0; i < this.numSlots; i++) {
      const slotX = barX + i * this.slotSize;
      const slot = this.slots[i];
      
      // Draw slot background sprite
      if (this.slotSprites[i] && this.slotSprites[i].image && this.slotSprites[i].image.image) {
        const sprite = this.slotSprites[i];
        const img = sprite.image.image;
        
        ctx.save();
        ctx.imageSmoothingEnabled = false; // Pixel-perfect rendering
        
        // Draw sprite
        if (sprite.sourceView) {
          ctx.drawImage(
            img,
            sprite.sourceView.x || 0,
            sprite.sourceView.y || 0,
            sprite.sourceView.width || this.slotSize,
            sprite.sourceView.height || this.barHeight,
            slotX,
            barY,
            this.slotSize,
            this.barHeight
          );
        } else {
          // Fallback: draw whole image
          ctx.drawImage(img, slotX, barY, this.slotSize, this.barHeight);
        }
        ctx.restore();
      } else {
        // Fallback: draw colored rectangle so we can at least see something
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(slotX, barY, this.slotSize, this.barHeight);
        ctx.strokeStyle = '#D2691E';
        ctx.lineWidth = 2;
        ctx.strokeRect(slotX, barY, this.slotSize, this.barHeight);
      }
      
      // Draw selection highlight
      if (i === this.selectedSlot) {
        ctx.strokeStyle = '#FF8C00';
        ctx.lineWidth = 3;
        ctx.strokeRect(slotX, barY, this.slotSize, this.barHeight);
      }
      
      // Draw hover highlight
      if (i === this.hoveredSlot && this.draggedSlot === -1) {
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.strokeRect(slotX, barY, this.slotSize, this.barHeight);
      }
      
      // Draw item icon (placeholder - you can add actual item sprites)
      if (slot.itemId) {
        // Simple colored square for now
        const iconSize = 12;
        const iconX = slotX + (this.slotSize - iconSize) / 2;
        const iconY = barY + (this.barHeight - iconSize) / 2;
        
        ctx.fillStyle = this.getItemColor(slot.itemId);
        ctx.fillRect(iconX, iconY, iconSize, iconSize);
        
        // Draw quantity
        if (slot.quantity > 1) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '10px Arial';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'bottom';
          ctx.fillText(slot.quantity.toString(), slotX + this.slotSize - 2, barY + this.barHeight - 2);
        }
      }
    }
    
    // Draw dragged item
    if (this.draggedSlot >= 0 && this.draggedItem) {
      const pointer = this.engine.input.pointers.primary;
      const screenPos = pointer.lastScreenPos || ex.Vector.Zero;
      
      ctx.save();
      ctx.globalAlpha = 0.7;
      const iconSize = 12;
      ctx.fillStyle = this.getItemColor(this.draggedItem.itemId || '');
      ctx.fillRect(screenPos.x - iconSize / 2, screenPos.y - iconSize / 2, iconSize, iconSize);
      ctx.restore();
    }
    
    // Restore transform
    ctx.restore();
  }

  /**
   * Get color for item (placeholder - replace with actual item sprites)
   */
  private getItemColor(itemId: string): string {
    const colors: { [key: string]: string } = {
      'wood': '#8B4513',
      'ore': '#708090',
      'apple': '#FF4444',
      'sword': '#C0C0C0',
    };
    return colors[itemId] || '#FFFFFF';
  }

  /**
   * Get Excalibur Color for item (for use with ExcaliburGraphicsContext)
   */
  private getItemColorEx(itemId: string): ex.Color {
    const hexColor = this.getItemColor(itemId);
    return ex.Color.fromHex(hexColor);
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.hudActor) {
      this.scene.remove(this.hudActor);
    }
  }
}

