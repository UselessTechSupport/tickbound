import Phaser from 'phaser';
import { ITEMS, item } from '../data/items';

/** CC0 Dungeon Crawl tiles copied into public/assets/tiles (see CREDITS.txt there). */
const TILE_KEYS = [
  'floor_0', 'floor_1', 'floor_2', 'floor_3', 'wall_0', 'wall_1', 'wall_2', 'wall_3',
  'grass_0', 'grass_1', 'grass_2', 'stairs', 'ladder', 'water', 'boulder', 'tree', 'fire', 'altar',
  'mentor', 'toolsmith',
  'npc_rat', 'npc_goblin', 'npc_giant_rat', 'npc_zombie', 'npc_skeleton', 'npc_giant_spider', 'npc_hill_giant', 'npc_moss_giant',
  'npc_lesser_demon', 'npc_greater_demon', 'npc_dark_wizard', 'npc_skeleton_archer', 'npc_infernal_mage',
  'npc_dark_archer', 'npc_goblin_warlord', 'npc_tztok_jad', 'npc_chaos_elemental', 'npc_demonic_gorilla',
  'pd_base', 'pd_plate', 'pd_dagger', 'pd_sword', 'pd_scimitar', 'pd_wooden_shield', 'pd_kiteshield',
  'item_coins', 'item_bones', 'item_prayer_potion', 'item_dagger', 'item_sword', 'item_scimitar',
  'item_platebody', 'item_wooden_shield', 'pd_jacket',
];

export function preloadSprites(scene: Phaser.Scene): void {
  for (const key of TILE_KEYS) scene.load.image(key, `assets/tiles/${key}.png`);
}

export interface SpriteRef {
  key: string;
  tint?: number;
}

/** Brighter versions of the metal colours: tint multiplies, so dark tints would muddy the art. */
const METAL_TINT: Record<string, number> = {
  bronze: 0xe0a070, iron: 0xb8b8b8, steel: 0xeeeef8, mithril: 0x8090ff, adamant: 0x70d070, rune: 0x70e8ff,
};

const metalOf = (id: string) => METAL_TINT[id.split('_')[0]];

export function itemSprite(id: string): SpriteRef {
  if (id === 'coins') return { key: 'item_coins' };
  if (id === 'bones' || id === 'big_bones') return { key: 'item_bones' };
  if (id === 'prayer_potion') return { key: 'item_prayer_potion' };
  if (id === 'wooden_shield') return { key: 'item_wooden_shield' };
  if (id.endsWith('_kiteshield')) return { key: 'gen_kiteshield', tint: metalOf(id) };
  for (const kind of ['dagger', 'sword', 'scimitar', 'platebody']) {
    if (id.endsWith(`_${kind}`)) return { key: `item_${kind}`, tint: metalOf(id) };
  }
  return { key: `gen_${id}` };
}

export function npcSprite(npcId: string): string {
  return `npc_${npcId}`;
}

/** Paperdoll layers for the player's equipment (DCSS player tiles share one 32x32 frame). */
export function weaponLayer(id: string | undefined): SpriteRef | null {
  if (!id) return null;
  for (const kind of ['dagger', 'sword', 'scimitar']) {
    if (id.endsWith(`_${kind}`)) return { key: `pd_${kind}`, tint: metalOf(id) };
  }
  return null;
}

/** Platebody if worn, otherwise a plain leather jacket. */
export function bodyLayer(id: string | undefined): SpriteRef {
  return id ? { key: 'pd_plate', tint: metalOf(id) } : { key: 'pd_jacket' };
}

export function shieldLayer(id: string | undefined): SpriteRef | null {
  if (!id) return null;
  if (id === 'wooden_shield') return { key: 'pd_wooden_shield' };
  return { key: 'pd_kiteshield', tint: metalOf(id) };
}

// ---- Generated pixel art for things the tileset doesn't have ----
// 16x16 patterns drawn at 2x. Letters map to shades of the item's colour.

const ORE = [
  '', '', '',
  '.....oooooo',
  '...oommmmmmoo',
  '..ommmlmmxmmmo',
  '..omlmmmxXxmmo',
  '.ommmmmmmxmmmmo',
  '.omxmmmmmmmmlmo',
  '.omXxmmmdmmmmmo',
  '.ommxmmmmmxmmdo',
  '..odmmmmmxXmddo',
  '..oddmmmmmmddo',
  '...ooddddddoo',
  '.....oooooo',
];

const BAR = [
  '', '', '', '', '',
  '.....oooooooooo',
  '....oXXXXXXXXxo',
  '...oXXXXXXXXxxo',
  '..oxxxxxxxxxxxo',
  '.oxxxxxxxxxxxdo',
  '.oxxxxxxxxxxddo',
  '.oxxxxxxxxxxdo',
  '.odddddddddddo',
  '..ooooooooooo',
];

const LOGS = [
  '', '', '',
  '....ooooooo',
  '...oxxxxxxxoo',
  '..oXxxxxxxxolo',
  '..oxxxxxxxxolo',
  '..odddddddooo',
  '...ooooooooooo',
  '..oxxxxxxxxxolo',
  '..oXxxxxxxxxolo',
  '..oxxxxxxxxxolo',
  '..odddddddddoo',
  '...oooooooooo',
];

const FISH = [
  '', '', '', '',
  '..........oo',
  '....oooooooxo..o',
  '...oXXXXXXXxxoxo',
  '..oXkXxxxxxxxxxo',
  '..oxxxxxxxxxxoxo',
  '...oddddddddo..o',
  '....ooooooooo',
];

const SHRIMP = [
  '', '', '', '',
  '......ooo',
  '.....oxxxo',
  '....oxXxxxo',
  '....oxxooxo',
  '....oxo..oxo',
  '.....o...oxo.oo',
  '.........oxxoxo',
  '..........oxxo',
  '...........oo',
];

const FURNACE = [
  '..oooooooooooo',
  '..odmmdmmdmmdo',
  '..ommmmmmmmmmo',
  '..odmmdmmdmmdo',
  '..ommmmmmmmmmo',
  '..omdooooooodo',
  '..ommoFFFFFomo',
  '..odmoFYYYFodo',
  '..ommoFYYYFomo',
  '..odmoFFFFFodo',
  '..ommoooooooomo',
  '..odmmdmmdmmdo',
  '..ommmmmmmmmmo',
  '..oooooooooooo',
];

const ANVIL = [
  '', '', '', '', '',
  '..oooooooooooo',
  '.olllllllllllllo',
  '..ommmmmmmmmmmo',
  '....odmmmmdo',
  '.....odmmdo',
  '.....ommmmo',
  '....ommmmmmo',
  '...oddddddddo',
  '...oooooooooo',
];

/** Greyscale so metal tints colour it cleanly. */
const KITE = [
  '', '',
  '...oooooooooo',
  '..ollllllllmmo',
  '..olmmmmmmmmdo',
  '..olmmmlmmmmdo',
  '..olmmmlmmmmdo',
  '..olmllllllmdo',
  '..olmmmlmmmmdo',
  '...olmmlmmmdo',
  '...olmmlmmmdo',
  '....olmmmmdo',
  '.....olmmdo',
  '......oddo',
  '.......oo',
];

const STUMP = [
  '', '', '', '', '', '', '', '',
  '.....oooooo',
  '....olXlXlXlo',
  '....odxxxxxdo',
  '....odxxxxxdo',
  '...oodxxxxxdoo',
  '..ooooooooooooo',
];

function shade(color: number, f: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f)));
  return Phaser.Display.Color.GetColor(adj(c.red), adj(c.green), adj(c.blue));
}

function paint(scene: Phaser.Scene, key: string, rows: string[], palette: Record<string, number>): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 32, 32)!;
  const ctx = tex.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]];
      if (color === undefined) continue;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x * 2, y * 2, 2, 2);
    }
  });
  tex.refresh();
}

const ROCK = { o: 0x2a2622, m: 0x7a746c, l: 0x9a948c, d: 0x55504a };

/** Builds every generated texture; call once after preload. */
export function generateSprites(scene: Phaser.Scene): void {
  for (const def of Object.values(ITEMS)) {
    const c = def.color;
    const tones = { o: 0x1a1612, x: c, X: shade(c, 1.35), d: shade(c, 0.65), k: 0x101010, l: 0xd8b880 };
    if (def.id.endsWith('_ore') || def.id === 'coal') paint(scene, `gen_${def.id}`, ORE, { ...ROCK, x: c, X: shade(c, 1.4) });
    else if (def.id.endsWith('_bar')) paint(scene, `gen_${def.id}`, BAR, tones);
    else if (def.id.endsWith('logs')) paint(scene, `gen_${def.id}`, LOGS, tones);
    else if (def.id.includes('shrimps')) paint(scene, `gen_${def.id}`, SHRIMP, tones);
    else if (def.heal || def.id.startsWith('raw_') || def.id === 'burnt_fish') paint(scene, `gen_${def.id}`, FISH, tones);
  }
  paint(scene, 'gen_furnace', FURNACE, { o: 0x1a1210, m: 0x8a3a2a, d: 0x6a2a1a, F: 0xff8020, Y: 0xffd040 });
  paint(scene, 'gen_anvil', ANVIL, { o: 0x101010, l: 0x9a9aa4, m: 0x5a5a64, d: 0x3a3a44 });
  paint(scene, 'gen_kiteshield', KITE, { o: 0x202020, l: 0xf0f0f0, m: 0xc0c0c0, d: 0x808080 });
  paint(scene, 'gen_stump', STUMP, { o: 0x2a1a0a, x: 0x8a5a2a, X: 0xd8b880, l: 0xb08850, d: 0x5a3a1a });
}

/** Item name → texture, falling back to a plain swatch if nothing matches. */
export function ensureItemTexture(scene: Phaser.Scene, id: string): SpriteRef {
  const ref = itemSprite(id);
  if (!scene.textures.exists(ref.key)) {
    paint(scene, ref.key, ['', '', '', '', '....oooooooo', ...Array(6).fill('....oxxxxxxo'), '....oooooooo'],
      { o: 0x101010, x: item(id).color });
  }
  return ref;
}
