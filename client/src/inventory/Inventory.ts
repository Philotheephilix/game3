/**
 * Inventory System - Manages items and slots
 */

export interface InventoryItem {
  itemId: string;
  qty: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  color: string; // For colored icon
  maxStack?: number;
}

/**
 * Available items in the game
 */
export const ITEMS: { [key: string]: ItemDefinition } = {
  wood: {
    id: 'wood',
    name: 'Wood',
    color: '#8B4513', // Brown
    maxStack: 64,
  },
  ore: {
    id: 'ore',
    name: 'Iron Ore',
    color: '#708090', // Slate gray
    maxStack: 64,
  },
  apple: {
    id: 'apple',
    name: 'Apple',
    color: '#FF4444', // Red
    maxStack: 64,
  },
  sword: {
    id: 'sword',
    name: 'Sword',
    color: '#C0C0C0', // Silver
    maxStack: 1,
  },
};

/**
 * Inventory class - manages items across 8 slots
 */
export class Inventory {
  private slots: (InventoryItem | null)[] = [];
  private readonly numSlots: number = 8;
  private activeSlot: number = 0; // Currently selected slot (0-7)

  constructor() {
    // Initialize all slots as empty
    for (let i = 0; i < this.numSlots; i++) {
      this.slots[i] = null;
    }

    // Load from localStorage if available
    this.loadInventory();
  }

  /**
   * Get all slots
   */
  getSlots(): (InventoryItem | null)[] {
    return this.slots;
  }

  /**
   * Get item at a specific slot
   */
  getItem(slotIndex: number): InventoryItem | null {
    if (slotIndex < 0 || slotIndex >= this.numSlots) return null;
    return this.slots[slotIndex];
  }

  /**
   * Get currently active slot index
   */
  getActiveSlot(): number {
    return this.activeSlot;
  }

  /**
   * Set active slot (0-7)
   */
  setActiveSlot(slotIndex: number): void {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      this.activeSlot = slotIndex;
      this.saveInventory();
    }
  }

  /**
   * Add item to inventory
   * Returns true if successfully added, false if inventory full
   */
  addItem(itemId: string, quantity: number = 1): boolean {
    const itemDef = ITEMS[itemId];
    if (!itemDef) {
      console.warn(`Unknown item: ${itemId}`);
      return false;
    }

    let remaining = quantity;
    const maxStack = itemDef.maxStack || 64;

    // First, try to stack with existing items of the same type
    for (let i = 0; i < this.numSlots && remaining > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.itemId === itemId && slot.qty < maxStack) {
        const space = maxStack - slot.qty;
        const add = Math.min(remaining, space);
        slot.qty += add;
        remaining -= add;
      }
    }

    // If still remaining, try to find empty slots
    for (let i = 0; i < this.numSlots && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const add = Math.min(remaining, maxStack);
        this.slots[i] = { itemId, qty: add };
        remaining -= add;
      }
    }

    this.saveInventory();
    return remaining === 0;
  }

  /**
   * Remove item from a slot
   */
  removeItem(slotIndex: number, quantity: number = 1): boolean {
    if (slotIndex < 0 || slotIndex >= this.numSlots) return false;
    const slot = this.slots[slotIndex];
    if (!slot) return false;

    if (slot.qty <= quantity) {
      this.slots[slotIndex] = null;
    } else {
      slot.qty -= quantity;
    }

    this.saveInventory();
    return true;
  }

  /**
   * Set item at a specific slot (for drag/drop)
   */
  setItem(slotIndex: number, item: InventoryItem | null): void {
    if (slotIndex >= 0 && slotIndex < this.numSlots) {
      this.slots[slotIndex] = item;
      this.saveInventory();
    }
  }

  /**
   * Swap items between two slots
   */
  swapSlots(slot1: number, slot2: number): void {
    if (slot1 < 0 || slot1 >= this.numSlots || slot2 < 0 || slot2 >= this.numSlots) return;
    const temp = this.slots[slot1];
    this.slots[slot1] = this.slots[slot2];
    this.slots[slot2] = temp;
    this.saveInventory();
  }

  /**
   * Split stack - move half the quantity to target slot (or swap if target has item)
   */
  splitStack(sourceSlot: number, targetSlot: number): void {
    if (sourceSlot < 0 || sourceSlot >= this.numSlots || targetSlot < 0 || targetSlot >= this.numSlots) return;
    
    const sourceItem = this.slots[sourceSlot];
    if (!sourceItem || sourceItem.qty < 2) return;

    const targetItem = this.slots[targetSlot];

    // If target slot is empty, split the stack
    if (targetItem === null) {
      const halfQty = Math.floor(sourceItem.qty / 2);
      this.slots[targetSlot] = {
        itemId: sourceItem.itemId,
        qty: sourceItem.qty - halfQty,
      };
      sourceItem.qty = halfQty;
    } else if (targetItem.itemId === sourceItem.itemId) {
      // If same item, try to stack
      const itemDef = ITEMS[sourceItem.itemId];
      const maxStack = itemDef?.maxStack || 64;
      const space = maxStack - targetItem.qty;
      if (space > 0) {
        const transfer = Math.min(sourceItem.qty, space);
        targetItem.qty += transfer;
        sourceItem.qty -= transfer;
        if (sourceItem.qty === 0) {
          this.slots[sourceSlot] = null;
        }
      }
    } else {
      // Different item, swap
      this.swapSlots(sourceSlot, targetSlot);
    }

    this.saveInventory();
  }

  /**
   * Get item definition by ID
   */
  static getItemDefinition(itemId: string): ItemDefinition | undefined {
    return ITEMS[itemId];
  }

  /**
   * Save inventory to localStorage
   */
  saveInventory(): void {
    try {
      const data = {
        slots: this.slots,
        activeSlot: this.activeSlot,
      };
      localStorage.setItem('gameInventory', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save inventory:', e);
    }
  }

  /**
   * Load inventory from localStorage
   */
  loadInventory(): void {
    try {
      const data = localStorage.getItem('gameInventory');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.slots && Array.isArray(parsed.slots)) {
          // Validate and restore slots
          for (let i = 0; i < Math.min(parsed.slots.length, this.numSlots); i++) {
            const slot = parsed.slots[i];
            if (slot && slot.itemId && slot.qty > 0) {
              this.slots[i] = slot;
            } else {
              this.slots[i] = null;
            }
          }
        }
        if (typeof parsed.activeSlot === 'number') {
          this.activeSlot = Math.max(0, Math.min(7, parsed.activeSlot));
        }
      }
    } catch (e) {
      console.warn('Failed to load inventory:', e);
    }
  }

  /**
   * Clear inventory (for testing)
   */
  clear(): void {
    for (let i = 0; i < this.numSlots; i++) {
      this.slots[i] = null;
    }
    this.activeSlot = 0;
    this.saveInventory();
  }
}

