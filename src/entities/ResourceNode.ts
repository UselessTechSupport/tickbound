import { ResourceDef } from '../data/resources';
import { Station } from '../data/recipes';
import { Point } from '../world/tiles';

/** Non-resource node kinds: crafting stations, altars, and camp NPCs. */
export type FixtureKind = Station | 'altar' | 'mentor' | 'toolsmith';
export type NodeKind = 'resource' | FixtureKind;

/** A blocking world object the player interacts with: a resource or a crafting station. */
export class ResourceNode {
  /** Products left before depletion (resources only). */
  remaining = 0;
  /** Tick at which a player-lit fire burns out; undefined = permanent. */
  expiresAt?: number;

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
    return { fire: 'Fire', furnace: 'Furnace', anvil: 'Anvil', altar: 'Altar', mentor: 'Mentor', toolsmith: 'Toolsmith' }[this.kind as FixtureKind];
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
    }[this.kind as FixtureKind];
  }
}
