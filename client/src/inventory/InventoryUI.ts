import * as ex from 'excalibur';
import { Inventory, InventoryItem, ITEMS } from './Inventory';
import { Images } from '../resources';

/**
 * InventoryUI - Handles rendering and interaction for the inventory system
 */
export class InventoryUI {
  private inventory: Inventory;
  private slotSprites: ex.Sprite[] = [];
  private slotActors: ex.Actor[] = [];
  private highlightActor!: ex.Actor;
  private activeHighlightActor!: ex.Actor;
  private tooltipActor!: ex.Actor;
  private tooltipText!: ex.Text;
  
  private slotSize: number = 48; // Size of each slot in pixels (will be scaled)
  private slotSpacing: number = 2; // Gap between slots
  private numSlots: number = 8;
  
  private hoveredSlot: number = -1;
  private draggedSlot: number = -1;
  private draggedItem: InventoryItem | null = null;
  private dragOffset: ex.Vector = ex.Vector.Zero;
  private dragSprite: ex.Sprite | null = null;
  
  private scene!: ex.Scene;
  private engine!: ex.Engine;
  
  // Slot background sprites (5th row from Slots.png, 0-indexed row 4)
  private slotBackgroundSprite: ex.Sprite | null = null;

  constructor(inventory: Inventory) {
    this.inventory = inventory;
  }

  /**
   * Initialize the inventory UI
   */
  initialize(scene: ex.Scene, engine: ex.Engine): void {
    this.scene = scene;
    this.engine = engine;

    // Load the slot background sprite (5th row from Slots.png)
    this.loadSlotSprites();

    // Create highlight actors
    this.createHighlightActors();

    // Create tooltip
    this.createTooltip();

    // Create slot actors
    this.createSlotActors();

    // Set up input handlers
    this.setupInputHandlers();

    // Initialize with some sample items for testing
    this.inventory.addItem('wood', 10);
    this.inventory.addItem('ore', 5);
    this.inventory.addItem('apple', 3);
  }

  /**
   * Load slot sprites from the 5th row (row 4, 0-indexed) of Slots.png
   */
  private loadSlotSprites(): void {
    const slotsImage = Images.inventorySlots;
    
    // Wait for image to load if not already loaded
    if (!slotsImage.isLoaded()) {
      slotsImage.load().then(() => {
        this.createSlotBackgroundSprite();
      }).catch((e) => {
        console.error('Failed to load Slots.png:', e);
      });
    } else {
      this.createSlotBackgroundSprite();
    }
  }

  /**
   * Create slot background sprite from the 5th row
   */
  private createSlotBackgroundSprite(): void {
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

    // Get first sprite from the 5th row to use as background (frame 32)
    const slotFrameIndex = 4 * 8; // Row 4 * 8 columns = frame 32
    
    try {
      const slotAnimation = ex.Animation.fromSpriteSheet(spriteSheet, [slotFrameIndex], 100);
      const graphic = slotAnimation.frames[0]?.graphic;
      
      if (graphic instanceof ex.Sprite) {
        // Create a new sprite with proper scaling
        this.slotBackgroundSprite = new ex.Sprite({
          image: graphic.image,
          sourceView: graphic.sourceView,
          destSize: { width: this.slotSize, height: this.slotSize },
        });
        console.log('Loaded slot background sprite from row 4');
        
        // Update existing slot actors if they were created before sprite loaded
        this.updateSlotBackgrounds();
      } else {
        console.warn('Slot background graphic is not a Sprite');
      }
    } catch (e) {
      console.error('Failed to load slot background sprite:', e);
    }
  }

  /**
   * Update slot actors with background sprite
   */
  private updateSlotBackgrounds(): void {
    if (!this.slotBackgroundSprite) return;
    
    this.slotActors.forEach((slotActor) => {
      // Remove old graphics and add the sprite
      slotActor.graphics.clear();
      
      // Add background
      slotActor.graphics.add(this.slotBackgroundSprite!);
      
      // Re-add item icon and text if they exist
      const itemIcon = new ex.Rectangle({
        width: this.slotSize - 8,
        height: this.slotSize - 8,
        color: ex.Color.White,
      });
      itemIcon.visible = false;
      slotActor.graphics.add(itemIcon);
      (slotActor as any).itemIcon = itemIcon;

      // Create quantity text
      const qtyText = new ex.Text({
        text: '',
        font: new ex.Font({ size: 12, family: 'Arial', bold: true }),
        color: ex.Color.White,
      });
      qtyText.anchor = ex.Vector.Down.add(ex.Vector.Right); // Bottom-right
      qtyText.pos = new ex.Vector(this.slotSize / 2 - 4, this.slotSize / 2 - 4);
      qtyText.visible = false;
      slotActor.graphics.add(qtyText);
      (slotActor as any).qtyText = qtyText;
    });
  }

  /**
   * Create highlight actors for hover and active slot
   */
  private createHighlightActors(): void {
    // Hover highlight (light orange border)
    this.highlightActor = new ex.Actor({
      pos: ex.Vector.Zero,
      width: this.slotSize,
      height: this.slotSize,
      z: Number.MAX_SAFE_INTEGER - 1,
    });
    
    const highlightRect = new ex.Rectangle({
      width: this.slotSize,
      height: this.slotSize,
      color: ex.Color.Orange,
      lineWidth: 3,
      strokeColor: ex.Color.Orange,
    });
    highlightRect.fillOpacity = 0;
    this.highlightActor.graphics.add(highlightRect);
    this.highlightActor.graphics.visible = false;

    // Active slot highlight (darker orange/border)
    this.activeHighlightActor = new ex.Actor({
      pos: ex.Vector.Zero,
      width: this.slotSize,
      height: this.slotSize,
      z: Number.MAX_SAFE_INTEGER - 2,
    });
    
    const activeRect = new ex.Rectangle({
      width: this.slotSize,
      height: this.slotSize,
      color: ex.Color.fromHex('#FF8C00'), // Dark orange
      lineWidth: 4,
      strokeColor: ex.Color.fromHex('#FF8C00'),
    });
    activeRect.fillOpacity = 0;
    this.activeHighlightActor.graphics.add(activeRect);
    this.activeHighlightActor.graphics.visible = false;

    this.scene.add(this.highlightActor);
    this.scene.add(this.activeHighlightActor);
  }

  /**
   * Create tooltip actor
   */
  private createTooltip(): void {
    this.tooltipActor = new ex.Actor({
      pos: ex.Vector.Zero,
      z: Number.MAX_SAFE_INTEGER,
    });

    this.tooltipText = new ex.Text({
      text: '',
      font: new ex.Font({ size: 14, family: 'Arial' }),
      color: ex.Color.White,
    });

    const tooltipBg = new ex.Rectangle({
      width: 100,
      height: 30,
      color: ex.Color.fromHex('#333333'),
    });
    tooltipBg.fillOpacity = 0.9;

    this.tooltipActor.graphics.add(tooltipBg);
    this.tooltipActor.graphics.add(this.tooltipText);
    this.tooltipActor.graphics.visible = false;

    this.scene.add(this.tooltipActor);
  }

  /**
   * Create actors for each inventory slot
   */
  private createSlotActors(): void {
    for (let i = 0; i < this.numSlots; i++) {
      const slotActor = new ex.Actor({
        pos: ex.Vector.Zero, // Position will be updated in update()
        width: this.slotSize,
        height: this.slotSize,
        z: Number.MAX_SAFE_INTEGER - 3,
      });

      // Add background sprite if available
      if (this.slotBackgroundSprite) {
        // Use the sprite directly (Excalibur handles sharing sprites efficiently)
        slotActor.graphics.add(this.slotBackgroundSprite);
      } else {
        // Fallback: colored rectangle
        const bg = new ex.Rectangle({
          width: this.slotSize,
          height: this.slotSize,
          color: ex.Color.fromHex('#2D2D2D'),
        });
        slotActor.graphics.add(bg);
      }

      // Create item icon graphic (will be shown/hidden based on inventory)
      const itemIcon = new ex.Rectangle({
        width: this.slotSize - 8,
        height: this.slotSize - 8,
        color: ex.Color.White,
      });
      itemIcon.visible = false;
      slotActor.graphics.add(itemIcon);

      // Create quantity text
      const qtyText = new ex.Text({
        text: '',
        font: new ex.Font({ size: 12, family: 'Arial', bold: true }),
        color: ex.Color.White,
      });
      qtyText.anchor = ex.Vector.Down.add(ex.Vector.Right); // Bottom-right
      qtyText.pos = new ex.Vector(this.slotSize / 2 - 4, this.slotSize / 2 - 4);
      qtyText.visible = false;
      slotActor.graphics.add(qtyText);

      // Store references
      (slotActor as any).slotIndex = i;
      (slotActor as any).itemIcon = itemIcon;
      (slotActor as any).qtyText = qtyText;

      this.slotActors.push(slotActor);
      this.scene.add(slotActor);
    }
  }

  /**
   * Set up input handlers
   */
  private setupInputHandlers(): void {
    // Keyboard shortcuts (1-8) for selecting slots
    this.engine.input.keyboard.on('press', (evt: ex.Input.KeyEvent) => {
      if (evt.key >= ex.Keys.Digit1 && evt.key <= ex.Keys.Digit8) {
        const slotIndex = evt.key - ex.Keys.Digit1;
        this.inventory.setActiveSlot(slotIndex);
      }
    });

    // Mouse input - use engine input for pointer events
    this.engine.input.pointers.primary.on('down', (evt: ex.Input.PointerEvent) => {
      this.handlePointerDown(evt);
    });

    this.engine.input.pointers.primary.on('up', (evt: ex.Input.PointerEvent) => {
      this.handlePointerUp(evt);
    });

    this.engine.input.pointers.primary.on('move', (evt: ex.Input.PointerEvent) => {
      this.handlePointerMove(evt);
    });
  }

  /**
   * Handle pointer down (click)
   */
  private handlePointerDown(evt: ex.Input.PointerEvent): void {
    const worldPos = evt.worldPos || this.engine.input.pointers.primary.lastWorldPos;
    if (!worldPos) return;
    
    const slotIndex = this.getSlotAt(worldPos);
    
    if (slotIndex >= 0) {
      const item = this.inventory.getItem(slotIndex);
      
      // Use button property from event, or default to left button
      const button = (evt as any).button !== undefined ? (evt as any).button : ex.PointerButton.Left;
      
      if (button === ex.PointerButton.Left) {
        // Left click: pick up or drop
        if (this.draggedSlot === -1 && item) {
          // Start dragging
          this.draggedSlot = slotIndex;
          this.draggedItem = { ...item };
          const slotPos = this.getSlotPosition(slotIndex);
          this.dragOffset = worldPos.sub(slotPos);
          this.createDragSprite(item);
        } else if (this.draggedSlot >= 0) {
          // Drop item
          this.handleDrop(slotIndex);
        }
      } else if (button === ex.PointerButton.Right) {
        // Right click: split stack
        if (this.draggedSlot === -1 && item && item.qty > 1) {
          // Find first empty slot or target slot
          const targetSlot = slotIndex === 0 ? 1 : slotIndex - 1;
          this.inventory.splitStack(slotIndex, targetSlot);
        }
      }
    }
  }

  /**
   * Handle pointer up (release)
   */
  private handlePointerUp(evt: ex.Input.PointerEvent): void {
    if (this.draggedSlot >= 0) {
      const worldPos = evt.worldPos || this.engine.input.pointers.primary.lastWorldPos;
      if (worldPos) {
        const slotIndex = this.getSlotAt(worldPos);
        if (slotIndex >= 0) {
          this.handleDrop(slotIndex);
        } else {
          // Cancel drag
          this.cancelDrag();
        }
      } else {
        this.cancelDrag();
      }
    }
  }

  /**
   * Handle pointer move (hover, drag)
   */
  private handlePointerMove(evt: ex.Input.PointerEvent): void {
    const worldPos = evt.worldPos || this.engine.input.pointers.primary.lastWorldPos;
    if (!worldPos) return;
    
    const slotIndex = this.getSlotAt(worldPos);
    
    // Update hover
    if (slotIndex !== this.hoveredSlot) {
      this.hoveredSlot = slotIndex;
      this.updateHover();
    }

    // Update tooltip
    if (slotIndex >= 0) {
      const item = this.inventory.getItem(slotIndex);
      if (item) {
        const itemDef = ITEMS[item.itemId];
        if (itemDef) {
          this.showTooltip(worldPos, `${itemDef.name} x${item.qty}`);
        }
      } else {
        this.hideTooltip();
      }
    } else {
      this.hideTooltip();
    }

    // Update drag sprite position is handled in update() method
  }

  /**
   * Handle dropping an item
   */
  private handleDrop(targetSlot: number): void {
    if (this.draggedSlot < 0 || !this.draggedItem) return;

    if (targetSlot === this.draggedSlot) {
      // Dropped on same slot, cancel
      this.cancelDrag();
      return;
    }

    const targetItem = this.inventory.getItem(targetSlot);

    if (!targetItem) {
      // Empty slot, move item
      this.inventory.setItem(targetSlot, this.draggedItem);
      this.inventory.setItem(this.draggedSlot, null);
    } else if (targetItem.itemId === this.draggedItem.itemId) {
      // Same item, try to stack
      const itemDef = ITEMS[targetItem.itemId];
      const maxStack = itemDef?.maxStack || 64;
      const space = maxStack - targetItem.qty;
      
      if (space > 0) {
        const transfer = Math.min(this.draggedItem.qty, space);
        targetItem.qty += transfer;
        this.draggedItem.qty -= transfer;
        
        if (this.draggedItem.qty > 0) {
          this.inventory.setItem(this.draggedSlot, this.draggedItem);
        } else {
          this.inventory.setItem(this.draggedSlot, null);
        }
        this.inventory.setItem(targetSlot, targetItem);
      } else {
        // Can't stack, swap
        this.inventory.swapSlots(this.draggedSlot, targetSlot);
      }
    } else {
      // Different item, swap
      this.inventory.swapSlots(this.draggedSlot, targetSlot);
    }

    this.cancelDrag();
  }

  /**
   * Cancel drag operation
   */
  private cancelDrag(): void {
    if (this.dragSprite) {
      this.scene.remove(this.dragSprite);
      this.dragSprite = null;
    }
    this.draggedSlot = -1;
    this.draggedItem = null;
    this.dragOffset = ex.Vector.Zero;
  }

  /**
   * Create sprite for dragged item
   */
  private createDragSprite(item: InventoryItem): void {
    const itemDef = ITEMS[item.itemId];
    if (!itemDef) return;

    // Remove old drag sprite if exists
    if (this.dragSprite) {
      this.scene.remove(this.dragSprite);
    }

    const itemIcon = new ex.Rectangle({
      width: this.slotSize - 8,
      height: this.slotSize - 8,
      color: ex.Color.fromHex(itemDef.color),
    });
    itemIcon.opacity = 0.7; // Semi-transparent

    const dragActor = new ex.Actor({
      pos: ex.Vector.Zero,
      width: this.slotSize,
      height: this.slotSize,
      z: Number.MAX_SAFE_INTEGER,
    });
    dragActor.graphics.add(itemIcon);
    dragActor.graphics.visible = true;

    this.dragSprite = dragActor;
    this.scene.add(dragActor);
  }

  /**
   * Get slot index at world position
   */
  private getSlotAt(worldPos: ex.Vector): number {
    const slotPositions = this.getSlotPositions();
    
    for (let i = 0; i < slotPositions.length; i++) {
      const slotPos = slotPositions[i];
      const dx = Math.abs(worldPos.x - slotPos.x);
      const dy = Math.abs(worldPos.y - slotPos.y);
      
      if (dx < this.slotSize / 2 && dy < this.slotSize / 2) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * Get position of a slot in world coordinates
   */
  private getSlotPosition(slotIndex: number): ex.Vector {
    const positions = this.getSlotPositions();
    return positions[slotIndex] || ex.Vector.Zero;
  }

  /**
   * Get all slot positions (updated each frame based on camera)
   */
  private getSlotPositions(): ex.Vector[] {
    const screenWidth = this.engine.drawWidth;
    const screenHeight = this.engine.drawHeight;
    const cameraPos = this.scene.camera.pos;
    const zoomFactor = this.scene.camera.zoom;
    
    // Calculate screen position (bottom center, slightly above bottom)
    const screenX = screenWidth / 2;
    const screenY = screenHeight - 60; // 60px from bottom
    
    // Convert to world coordinates
    const worldX = cameraPos.x + (screenX - screenWidth / 2) / zoomFactor;
    const worldY = cameraPos.y + (screenY - screenHeight / 2) / zoomFactor;
    
    // Calculate total width of all slots
    const totalWidth = this.numSlots * this.slotSize + (this.numSlots - 1) * this.slotSpacing;
    const startX = worldX - totalWidth / 2 + this.slotSize / 2;
    
    // Generate positions
    const positions: ex.Vector[] = [];
    for (let i = 0; i < this.numSlots; i++) {
      const x = startX + i * (this.slotSize + this.slotSpacing);
      positions.push(new ex.Vector(x, worldY));
    }
    
    return positions;
  }

  /**
   * Update hover highlight
   */
  private updateHover(): void {
    if (this.hoveredSlot >= 0) {
      const pos = this.getSlotPosition(this.hoveredSlot);
      this.highlightActor.pos = pos;
      this.highlightActor.graphics.visible = true;
    } else {
      this.highlightActor.graphics.visible = false;
    }
  }

  /**
   * Show tooltip
   */
  private showTooltip(pos: ex.Vector, text: string): void {
    this.tooltipText.text = text;
    this.tooltipActor.pos = new ex.Vector(pos.x, pos.y - this.slotSize / 2 - 20);
    this.tooltipActor.graphics.visible = true;
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    this.tooltipActor.graphics.visible = false;
  }

  /**
   * Update inventory UI (called each frame)
   */
  update(engine: ex.Engine): void {
    const slotPositions = this.getSlotPositions();
    const zoomFactor = this.scene.camera.zoom;
    const scaleFactor = 1 / zoomFactor; // Inverse scale to keep UI size constant

    // Update each slot
    for (let i = 0; i < this.slotActors.length; i++) {
      const slotActor = this.slotActors[i];
      const slotPos = slotPositions[i];
      const item = this.inventory.getItem(i);
      const itemIcon = (slotActor as any).itemIcon;
      const qtyText = (slotActor as any).qtyText;

      // Update position and scale
      slotActor.pos = slotPos;
      slotActor.scale = new ex.Vector(scaleFactor, scaleFactor);

      // Update item display
      if (item) {
        const itemDef = ITEMS[item.itemId];
        if (itemDef && itemIcon) {
          itemIcon.color = ex.Color.fromHex(itemDef.color);
          itemIcon.visible = true;
        }
        
        if (qtyText) {
          qtyText.text = item.qty > 1 ? item.qty.toString() : '';
          qtyText.visible = item.qty > 1;
        }
      } else {
        if (itemIcon) itemIcon.visible = false;
        if (qtyText) qtyText.visible = false;
      }
    }

    // Update active slot highlight
    const activeSlotIndex = this.inventory.getActiveSlot();
    if (activeSlotIndex >= 0 && activeSlotIndex < this.numSlots) {
      const activePos = slotPositions[activeSlotIndex];
      this.activeHighlightActor.pos = activePos;
      this.activeHighlightActor.scale = new ex.Vector(scaleFactor, scaleFactor);
      this.activeHighlightActor.graphics.visible = true;
    } else {
      this.activeHighlightActor.graphics.visible = false;
    }

    // Update hover highlight scale
    if (this.highlightActor.graphics.visible) {
      this.highlightActor.scale = new ex.Vector(scaleFactor, scaleFactor);
    }

    // Update tooltip scale
    if (this.tooltipActor.graphics.visible) {
      this.tooltipActor.scale = new ex.Vector(scaleFactor, scaleFactor);
    }

    // Update drag sprite if dragging
    if (this.dragSprite && this.draggedSlot >= 0) {
      const pointer = this.engine.input.pointers.primary;
      const mousePos = pointer.lastWorldPos;
      if (mousePos) {
        this.dragSprite.pos = mousePos.sub(this.dragOffset);
        this.dragSprite.scale = new ex.Vector(scaleFactor, scaleFactor);
        this.dragSprite.graphics.visible = true;
      }
    } else if (this.dragSprite) {
      this.dragSprite.graphics.visible = false;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Remove all actors
    this.slotActors.forEach(actor => this.scene.remove(actor));
    this.scene.remove(this.highlightActor);
    this.scene.remove(this.activeHighlightActor);
    this.scene.remove(this.tooltipActor);
    if (this.dragSprite) {
      this.scene.remove(this.dragSprite);
    }
  }
}

