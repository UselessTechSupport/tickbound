import { item } from '../data/items';

export const INVENTORY_SIZE = 28;

export interface ItemStack {
  id: string;
  qty: number;
}

export class Inventory {
  slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null);

  /** Adds items; returns false (adding nothing) if there isn't room. */
  add(id: string, qty = 1): boolean {
    if (item(id).stackable) {
      const existing = this.slots.find((s) => s?.id === id);
      if (existing) {
        existing.qty += qty;
        return true;
      }
      const free = this.slots.indexOf(null);
      if (free < 0) return false;
      this.slots[free] = { id, qty };
      return true;
    }
    if (this.freeSlots() < qty) return false;
    for (let i = 0; i < qty; i++) this.slots[this.slots.indexOf(null)] = { id, qty: 1 };
    return true;
  }

  /** Removes up to `qty` from a slot and returns what was removed. */
  take(slot: number, qty = Infinity): ItemStack | null {
    const s = this.slots[slot];
    if (!s) return null;
    const n = Math.min(qty, s.qty);
    s.qty -= n;
    if (s.qty <= 0) this.slots[slot] = null;
    return { id: s.id, qty: n };
  }

  /** Whether one more of `id` would fit. */
  canAdd(id: string): boolean {
    return this.freeSlots() > 0 || (!!item(id).stackable && this.count(id) > 0);
  }

  count(id: string): number {
    return this.slots.reduce((n, s) => n + (s?.id === id ? s.qty : 0), 0);
  }

  /** Removes `qty` of an item from wherever it is; returns false (removing nothing) if there isn't enough. */
  remove(id: string, qty = 1): boolean {
    if (this.count(id) < qty) return false;
    let left = qty;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (this.slots[i]?.id === id) left -= this.take(i, left)!.qty;
    }
    return true;
  }

  freeSlots(): number {
    return this.slots.filter((s) => s === null).length;
  }
}
