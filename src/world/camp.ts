import { ResourceNode } from '../entities/ResourceNode';
import { FloorMap, Tile, setTile } from './tiles';
import { STRUCTURE_BY_ID, StructureId } from '../data/construction';

export const CAMP_WIDTH = 26;
export const CAMP_HEIGHT = 16;

/** The hand-made hub between runs: Mentor, Toolsmith, Slayer master, a campfire, and the ladder down. */
/** NPCs that only show up once unlocked, at fixed spots. */
const NPC_SPOTS = { armourer: { x: 7, y: 10 }, slayer_master: { x: 19, y: 10 }, enchanter: { x: 19, y: 13 } };

export function campNpc(kind: keyof typeof NPC_SPOTS): ResourceNode {
  return new ResourceNode({ ...NPC_SPOTS[kind] }, kind);
}

/** A built camp structure, at its fixed spot. */
export function campStructure(id: StructureId): ResourceNode {
  return new ResourceNode({ ...STRUCTURE_BY_ID[id].pos }, id);
}

export function generateCamp(
  slayerUnlocked = false, armourerUnlocked = false, enchanterUnlocked = false, built: StructureId[] = [],
): { map: FloorMap; nodes: ResourceNode[] } {
  const tiles = new Uint8Array(CAMP_WIDTH * CAMP_HEIGHT);
  const map: FloorMap = {
    width: CAMP_WIDTH, height: CAMP_HEIGHT, tiles, depth: 0, rooms: [],
    spawn: { x: 13, y: 10 }, stairs: { x: 13, y: 2 },
  };
  for (let y = 1; y < CAMP_HEIGHT - 1; y++) {
    for (let x = 1; x < CAMP_WIDTH - 1; x++) setTile(map, x, y, Tile.Floor);
  }
  // Rocky pillars to break up the space.
  for (const [x, y] of [[4, 3], [21, 3], [4, 12], [21, 12], [9, 13], [16, 13]]) setTile(map, x, y, Tile.Wall);
  setTile(map, map.stairs.x, map.stairs.y, Tile.StairsDown);

  const nodes = [
    new ResourceNode({ x: 7, y: 6 }, 'mentor'),
    new ResourceNode({ x: 19, y: 6 }, 'toolsmith'),
    // The Armourer and Slayer master only show up once unlocked.
    ...(armourerUnlocked ? [campNpc('armourer')] : []),
    ...(slayerUnlocked ? [campNpc('slayer_master')] : []),
    ...(enchanterUnlocked ? [campNpc('enchanter')] : []),
    new ResourceNode({ x: 13, y: 12 }, 'fire'),
    new ResourceNode({ x: 10, y: 4 }, 'builder'),
    new ResourceNode({ x: 16, y: 2 }, 'quest_board'),
    ...built.map(campStructure),
  ];
  for (const n of nodes) setTile(map, n.pos.x, n.pos.y, Tile.Object);
  return { map, nodes };
}
