import { ResourceDef } from '../data/resources';
import { Station } from '../data/recipes';
import { Point } from '../world/tiles';
import type { StockEntry } from '../data/loot';
import { SHORTCUT_KINDS } from '../data/agility';
import { REWARD_TEXT, WandererDeal } from '../data/wanderers';
import { STRUCTURE_BY_ID, StructureId } from '../data/construction';

/** Non-resource node kinds: crafting stations, altars, and camp NPCs. */
export type FixtureKind = Exclude<Station, 'mix' | 'fletch'> | 'shortcut' | 'altar' | 'mentor' | 'toolsmith' | 'shrine' | 'merchant' | 'chest' | 'slayer_master' | 'armourer' | 'enchanter'
  | 'builder' | 'quest_board' | 'dark_shrine' | 'wanderer' | StructureId;
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
  /** Wandering adventurer: what they want and what they pay. */
  deal?: WandererDeal;
  /** Locked chests: Thieving level to pick the lock (cleared once picked). */
  lockLevel?: number;
  /** Agility shortcuts: the floor tiles on either side of the wall, and the level needed. */
  shortcut?: { a: Point; b: Point; level: number; kind: number };

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
    if (this.kind === 'chest' && this.lockLevel) return 'Locked chest';
    if (this.kind === 'shortcut') return SHORTCUT_KINDS[this.shortcut!.kind].name;
    if (this.kind in STRUCTURE_BY_ID) return STRUCTURE_BY_ID[this.kind as StructureId].name;
    return { builder: 'Builder', quest_board: 'Quest board', dark_shrine: 'Dark shrine', wanderer: 'Wandering adventurer', shortcut: '', fire: 'Fire', furnace: 'Furnace', anvil: 'Anvil', altar: 'Altar', mentor: 'Mentor', toolsmith: 'Toolsmith', shrine: 'Relic shrine', merchant: 'Wandering merchant', chest: 'Chest', slayer_master: 'Slayer master', armourer: 'Armourer', enchanter: 'Enchanter' }[this.kind as Exclude<FixtureKind, StructureId>];
  }

  get examine(): string {
    if (this.def) {
      if (!this.depleted) return this.def.examine;
      return {
        rock: 'There is no ore currently available in this rock.', tree: 'This tree has been cut down.',
        fishing: 'The fish have gone.', herb: 'Nothing left to pick.',
      }[this.def.kind];
    }
    if (this.kind === 'chest' && this.lockLevel) return `It's locked. I'd need a Thieving level of ${this.lockLevel} to pick it.`;
    if (this.kind === 'shortcut') return `${SHORTCUT_KINDS[this.shortcut!.kind].examine} (Agility ${this.shortcut!.level})`;
    if (this.kind in STRUCTURE_BY_ID) return `Your ${STRUCTURE_BY_ID[this.kind as StructureId].name.toLowerCase()}. The Builder can upgrade it.`;
    return {
      builder: 'Builds and upgrades camp structures from tokens and the materials you bring home.',
      quest_board: 'Jobs from the folk around camp. Rewards for the brave.',
      wanderer: this.used ? 'They look happy with the trade.'
        : this.deal ? `They want ${this.deal.request.qty} ${this.deal.request.what}, and offer ${REWARD_TEXT[this.deal.reward]}.` : 'A fellow adventurer.',
      dark_shrine: this.used ? 'Its hunger is sated.' : 'It offers power, for a price: a relic of your choice, and a curse for the rest of the run.',
      shortcut: '',
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
      enchanter: 'She can weave lasting magic into your Armourer gear.',
      chest: this.used ? "It's empty." : 'I wonder what is inside.',
    }[this.kind as Exclude<FixtureKind, StructureId>];
  }
}
