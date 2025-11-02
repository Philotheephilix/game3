import * as ex from 'excalibur';
import { Player } from '../actors/Player';

/**
 * Inventory item interface
 */
export interface InventoryItem {
  type: string;
  sprite?: ex.Sprite;
  count: number; // Number of items in this slot
}

/**
 * Simple pixel art inventory HUD - Minecraft style
 * Uses Excalibur Actors for rendering
 */
export class SimpleInventoryHUD {
  private engine!: ex.Engine;
  private scene!: ex.Scene;
  private selectedSlot: number = 0;
  private numSlots: number = 8;
  private showOverlay: boolean = false; // Toggle overlay above player
  
  private inventory: (InventoryItem | null)[] = [];
  private overlaySlots: ex.Actor[] = [];
  private overlayHighlights: ex.Actor[] = [];
  private slotItems: ex.Actor[] = []; // Actors for displaying items in slots
  private slotCountActors: ex.Actor[] = []; // Actors for displaying count text
  private slotCountTexts: ex.Text[] = []; // Text objects for updating counts
  
  private lastClickTime: number = 0;
  private lastClickedSlot: number = -1;
  private onItemDrop?: (itemType: string, position: ex.Vector) => void; // Callback for dropping items
  private getDropPositionCallback?: () => ex.Vector; // Callback to get drop position
  private countSceneItemsCallback?: (itemType: string) => number; // Callback to count items in scene

  initialize(scene: ex.Scene, engine: ex.Engine): void {
    this.scene = scene;
    this.engine = engine;

    // Initialize inventory array
    for (let i = 0; i < this.numSlots; i++) {
      this.inventory.push(null);
    }

    // Create overlay actors (initially hidden)
    this.createOverlaySlots();

    // Set up keyboard input for slot selection
    this.engine.input.keyboard.on('press', (evt: any) => {
      // Number keys 1-8
      if (evt.key >= ex.Keys.Digit1 && evt.key <= ex.Keys.Digit8) {
        const slotIndex = Number(evt.key) - Number(ex.Keys.Digit1);
        this.selectSlot(slotIndex);
      }
      // Arrow keys for navigation
      if (evt.key === ex.Keys.ArrowLeft) {
        this.selectSlot((this.selectedSlot - 1 + this.numSlots) % this.numSlots);
      }
      if (evt.key === ex.Keys.ArrowRight) {
        this.selectSlot((this.selectedSlot + 1) % this.numSlots);
      }
      // Press R to toggle overlay above player
      if (evt.key === ex.Keys.KeyR) {
        this.showOverlay = !this.showOverlay;
        this.overlaySlots.forEach(slot => slot.graphics.visible = this.showOverlay);
        // Update item visibility based on whether they have graphics
        this.slotItems.forEach((item, i) => {
          item.graphics.visible = this.showOverlay && this.inventory[i] !== null;
        });
        // Update count visibility based on whether they have graphics
        this.slotCountActors.forEach((count, i) => {
          count.graphics.visible = this.showOverlay && this.inventory[i] !== null && this.inventory[i]!.count > 1;
        });
        this.overlayHighlights.forEach(highlight => highlight.graphics.visible = this.showOverlay && this.overlayHighlights.indexOf(highlight) === this.selectedSlot);
        console.log('Overlay:', this.showOverlay ? 'visible' : 'hidden');
      }
    });

    // Set up mouse click detection
    this.engine.input.pointers.primary.on('down', (evt: ex.PointerEvent) => {
      if (!this.showOverlay) return;
      
      // Get world position from the event
      const worldPos = evt.worldPos || this.engine.input.pointers.primary.lastWorldPos;
      if (!worldPos) return;
      
      // Check if clicking on any overlay slot
      this.overlaySlots.forEach((slot, index) => {
        if (slot.graphics.visible && slot.collider.bounds.contains(worldPos)) {
          // Check for double click
          const currentTime = Date.now();
          const isDoubleClick = (currentTime - this.lastClickTime < 300) && (this.lastClickedSlot === index);
          
          if (isDoubleClick) {
            // Double click detected - try to drop item
            this.dropItem(index);
          } else {
            // Single click - select slot
            this.selectSlot(index);
            this.lastClickTime = currentTime;
            this.lastClickedSlot = index;
          }
        }
      });
    });
  }

  private createOverlaySlots(): void {
    const slotSize = 16;
    
    for (let i = 0; i < this.numSlots; i++) {
      const slot = new ex.Actor({
        width: slotSize,
        height: slotSize,
        z: Number.MAX_SAFE_INTEGER - 2, // Just below player but above map
      });
      
      // Draw slot with border in one graphics operation
      const slotRect = new ex.Rectangle({
        width: slotSize,
        height: slotSize,
        color: ex.Color.fromHex('#2C2C2C'),
        strokeColor: ex.Color.fromHex('#0F0F0F'),
      });
      slot.graphics.add(slotRect);
      
      // Create highlight actor
      const highlight = new ex.Actor({
        width: slotSize + 2,
        height: slotSize + 2,
        z: Number.MAX_SAFE_INTEGER - 3, // Just below slots
      });
      
      const highlightRect = new ex.Rectangle({
        width: slotSize + 2,
        height: slotSize + 2,
        strokeColor: ex.Color.White,
      });
      highlight.graphics.add(highlightRect);
      highlight.graphics.visible = false;
      
      // Create item actor for this slot
      const itemActor = new ex.Actor({
        width: slotSize - 2,
        height: slotSize - 2,
        z: Number.MAX_SAFE_INTEGER - 1, // Between slot and highlight
      });
      itemActor.graphics.visible = false;
      
      // Create count text for this slot
      const countText = new ex.Text({
        text: '',
        font: new ex.Font({ 
          size: 8, 
          family: 'Arial', 
          color: ex.Color.White,
          bold: true,
        }),
      });
      
      // Create actor to hold the count text
      const countActor = new ex.Actor({
        width: slotSize,
        height: slotSize,
        z: Number.MAX_SAFE_INTEGER, // On top of item
      });
      countActor.graphics.add(countText);
      countActor.graphics.visible = false;
      
      this.overlayHighlights.push(highlight);
      this.slotItems.push(itemActor);
      this.slotCountActors.push(countActor);
      this.slotCountTexts.push(countText);
      slot.graphics.visible = false; // Initially hidden
      this.overlaySlots.push(slot);
      this.scene.add(slot);
      this.scene.add(highlight);
      this.scene.add(itemActor);
      this.scene.add(countActor);
    }
  }

  selectSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      this.selectedSlot = slotIndex;
      this.updateSelectionHighlight();
      console.log(`Selected inventory slot ${slotIndex + 1}`);
    }
  }

  private updateSelectionHighlight(): void {
    // Update overlay highlights
    this.overlayHighlights.forEach((highlight, i) => {
      highlight.graphics.visible = this.showOverlay && i === this.selectedSlot;
    });
  }

  /**
   * Add an item to the inventory
   * Returns true if successful, false if inventory is full
   */
  addItem(item: InventoryItem): boolean {
    // First try to find an existing slot with the same item type
    for (let i = 0; i < this.numSlots; i++) {
      if (this.inventory[i] !== null && this.inventory[i]!.type === item.type) {
        // Found existing item of same type, increment count
        this.inventory[i]!.count++;
        this.updateSlotDisplay(i);
        console.log(`Added ${item.type} to existing stack. Total: ${this.inventory[i]!.count}`);
        return true;
      }
    }
    
    // No existing stack found, find first empty slot
    for (let i = 0; i < this.numSlots; i++) {
      if (this.inventory[i] === null) {
        this.inventory[i] = item;
        this.updateSlotDisplay(i);
        console.log(`Added ${item.type} to slot ${i + 1}`);
        return true;
      }
    }
    console.log('Inventory is full!');
    return false;
  }

  /**
   * Set the callbacks for dropping items
   */
  setItemDropCallbacks(
    dropCallback: (itemType: string, position: ex.Vector) => void,
    getPositionCallback: () => ex.Vector,
    countCallback: (itemType: string) => number
  ): void {
    this.onItemDrop = dropCallback;
    this.getDropPositionCallback = getPositionCallback;
    this.countSceneItemsCallback = countCallback;
  }

  /**
   * Drop an item from inventory
   */
  private dropItem(slotIndex: number): void {
    const item = this.inventory[slotIndex];
    if (!item || item.count <= 0) return;

    // Check max limit - don't drop if there are already 10 coins
    if (this.onItemDrop) {
      // Count total items of same type in scene
      const totalInScene = this.countSceneItemsCallback ? this.countSceneItemsCallback(item.type) : 0;
      if (totalInScene >= 10) {
        console.log(`Cannot drop: already ${totalInScene} ${item.type}s in scene (max 10)`);
        return;
      }

      // Decrement count or remove slot
      if (item.count > 1) {
        item.count--;
        this.updateSlotDisplay(slotIndex);
        console.log(`Dropped ${item.type}. Remaining: ${item.count}`);
      } else {
        this.inventory[slotIndex] = null;
        this.updateSlotDisplay(slotIndex);
        console.log(`Dropped last ${item.type}`);
      }

      // Get player position for drop
      const dropPosition = this.getDropPositionCallback ? this.getDropPositionCallback() : ex.Vector.Zero;
      this.onItemDrop(item.type, dropPosition);
    }
  }

  /**
   * Update the visual display of a slot
   */
  private updateSlotDisplay(slotIndex: number): void {
    const item = this.inventory[slotIndex];
    const itemActor = this.slotItems[slotIndex];
    const countActor = this.slotCountActors[slotIndex];
    const countText = this.slotCountTexts[slotIndex];
    
    if (item && item.sprite) {
      itemActor.graphics.use(item.sprite);
      // Only show items when overlay is visible
      itemActor.graphics.visible = this.showOverlay;
      
      // Show count if more than 1, but only if overlay is visible
      if (item.count > 1) {
        countText.text = item.count.toString();
        countActor.graphics.visible = this.showOverlay;
      } else {
        countActor.graphics.visible = false;
      }
    } else {
      itemActor.graphics.visible = false;
      countActor.graphics.visible = false;
    }
  }

  draw(_ctx: ex.ExcaliburGraphicsContext, player: Player): void {
    // Update overlay positions to follow player in world space
    if (this.showOverlay && player) {
      this.updateOverlayPosition(player);
    }
  }

  private updateOverlayPosition(player: Player): void {
    const slotSize = 16;
    const spacing = 0;
    const totalWidth = this.numSlots * slotSize + (this.numSlots - 1) * spacing;
    
    // Position above player's head in world space (not screen space)
    const startX = player.pos.x - totalWidth / 2;
    const y = player.pos.y - 40; // 40 pixels above player
    
    this.overlaySlots.forEach((slot, i) => {
      const x = startX + i * (slotSize + spacing);
      slot.pos = new ex.Vector(x + slotSize / 2, y + slotSize / 2);
    });
    
    // Update highlight positions
    this.overlayHighlights.forEach((highlight, i) => {
      const x = startX + i * (slotSize + spacing);
      highlight.pos = new ex.Vector(x + slotSize / 2, y + slotSize / 2);
    });

    // Update item positions
    this.slotItems.forEach((item, i) => {
      const x = startX + i * (slotSize + spacing);
      item.pos = new ex.Vector(x + slotSize / 2, y + slotSize / 2);
    });

    // Update count positions
    this.slotCountActors.forEach((count, i) => {
      const x = startX + i * (slotSize + spacing);
      count.pos = new ex.Vector(x + slotSize / 2, y + slotSize / 2);
    });
  }
}
