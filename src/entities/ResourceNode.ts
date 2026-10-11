import { ResourceDef } from '../data/resources';
import { Station } from '../data/recipes';
import { Point } from '../world/tiles';
import type { StockEntry } from '../data/loot';

/** Non-resource node kinds: crafting stations, altars, and camp NPCs. */
export type FixtureKind = Exclude<Station, 'mix'> | 'altar' | 'mentor' | 'toolsmith' | 'shrine' | 'merchant' | 'chest' | 'slayer_master' | 'armourer';
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
      return { rock: 'Rocks', tree: 'Tree stump', fishing: 'Still water', herb: 'Picked patch' }[this.def.kind];
    }
    return { fire: 'Fire', furnace: 'Furnace', anvil: 'Anvil', altar: 'Altar', mentor: 'Mentor', toolsmith: 'Toolsmith', shrine: 'Relic shrine', merchant: 'Wandering merchant', chest: 'Chest', slayer_master: 'Slayer master', armourer: 'Armourer' }[this.kind as FixtureKind];
  }

  get examine(): string {
    if (this.def) {
      if (!this.depleted) return this.def.examine;
      return {
        rock: 'There is no ore currently available in this rock.', tree: 'This tree has been cut down.',
        fishing: 'The fish have gone.', herb: 'Nothing left to pick.',
      }[this.def.kind];
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
      armourer: 'Sells better starting gear for every future run.',
      chest: this.used ? "It's empty." : 'I wonder what is inside.',
    }[this.kind as FixtureKind];
  }
}
