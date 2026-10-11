import { ResourceDef } from '../data/resources';
import { Station } from '../data/recipes';
import { Point } from '../world/tiles';
import type { StockEntry } from '../data/loot';

/** Non-resource node kinds: crafting stations, altars, and camp NPCs. */
export type FixtureKind = Station | 'altar' | 'mentor' | 'toolsmith' | 'shrine' | 'merchant' | 'chest' | 'slayer_master';
export type NodeKind = 'resource' | FixtureKind;

/** A blocking world object the player interacts with: a resource or a crafting station. */
export class ResourceNode {
  /** Products left before depletion (resources only). */
  remaining = 0;
  /** Tick at which a player-lit fire burns out; undefined = permanent. */
  expiresAt?: number;
  /** Relic shrines and chests work once. */
  used = false;
  /** Merchant's remaining wares. */
  stock?: StockEntry[];

  constructor(
    public pos: Point,
    public kind: NodeKind,
    public def?: ResourceDef,
  ) {}

  get depleted(): boolean {
    return this.kind === 'resource' && this.remaining <= 0;
  }

  get name(): string {
    if (this.def) {
      if (!this.depleted) return this.def.name;
      return this.def.kind === 'rock' ? 'Rocks' : this.def.kind === 'tree' ? 'Tree stump' : 'Still water';
    }
    return { fire: 'Fire', furnace: 'Furnace', anvil: 'Anvil', altar: 'Altar', mentor: 'Mentor', toolsmith: 'Toolsmith', shrine: 'Relic shrine', merchant: 'Wandering merchant', chest: 'Chest', slayer_master: 'Slayer master' }[this.kind as FixtureKind];
  }

  get examine(): string {
    if (this.def) {
      if (!this.depleted) return this.def.examine;
      return this.def.kind === 'rock' ? 'There is no ore currently available in this rock.'
        : this.def.kind === 'tree' ? 'This tree has been cut down.' : 'The fish have gone.';
    }
    return {
      fire: 'Hot!',
      furnace: 'A red hot furnace, for smelting ore into bars.',
      anvil: 'Used for fashioning metal items.',
      altar: 'An altar to the gods. Pray here to recharge your Prayer.',
      mentor: 'A grizzled dungeoneer. Maybe they can teach me a thing or two.',
      toolsmith: 'Makes and sells tools for the dungeon.',
      shrine: this.used ? 'Its power is spent.' : 'Something ancient and powerful slumbers here.',
      merchant: 'Sells supplies to brave (or foolish) dungeoneers. Buys loot, too.',
      slayer_master: 'A master of the Slayer skill. Hands out monster-hunting tasks.',
      chest: this.used ? "It's empty." : 'I wonder what is inside.',
    }[this.kind as FixtureKind];
  }
}
