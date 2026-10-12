import Phaser from 'phaser';
import { ITEMS, item } from '../data/items';
import { settings } from '../save/settings';

/** CC0 Dungeon Crawl tiles copied into public/assets/tiles (see CREDITS.txt there). */
const TILE_KEYS = [
  'floor_0', 'floor_1', 'floor_2', 'floor_3', 'wall_0', 'wall_1', 'wall_2', 'wall_3',
  'grass_0', 'grass_1', 'grass_2', 'herb_patch', 'item_attack_potion', 'item_strength_potion', 'item_defence_potion',
  'item_super_attack', 'item_super_strength', 'item_super_defence', 'item_ranging_potion', 'item_magic_potion',
  'item_vial_of_water', 'armourer', 'enchanter', 'builder', 'wanderer', 'bank_chest', 'trophy_room', 'pet_kennel', 'chest_locked', 'shrine', 'chest', 'chest_open', 'merchant', 'npc_mimic', 'stairs', 'ladder', 'water', 'boulder', 'tree', 'fire', 'altar',
  'mentor', 'toolsmith',
  'npc_rat', 'npc_goblin', 'npc_giant_rat', 'npc_zombie',
  'npc_ghoul', 'npc_wight', 'npc_mummy', 'npc_hellhound', 'npc_fire_elemental', 'npc_salamander',
  'npc_ice_beast', 'npc_frost_giant', 'npc_freezing_wraith', 'slayer_master',
  'crypt_floor_0', 'crypt_floor_1', 'crypt_wall_0', 'crypt_wall_1', 'crypt_wall_2', 'crypt_wall_3',
  'volcanic_floor_0', 'volcanic_floor_1', 'volcanic_floor_2', 'volcanic_floor_3',
  'volcanic_wall_0', 'volcanic_wall_1', 'volcanic_wall_2', 'volcanic_wall_3',
  'frozen_floor_0', 'frozen_floor_1', 'frozen_floor_2', 'frozen_floor_3',
  'frozen_wall_0', 'frozen_wall_1', 'frozen_wall_2', 'frozen_wall_3', 'npc_skeleton', 'npc_giant_spider', 'npc_hill_giant', 'npc_moss_giant',
  'npc_lesser_demon', 'npc_greater_demon', 'npc_dark_wizard', 'npc_skeleton_archer', 'npc_infernal_mage',
  'npc_dark_archer', 'npc_goblin_warlord', 'npc_tztok_jad', 'npc_chaos_elemental', 'npc_demonic_gorilla', 'npc_lich', 'npc_ancient_wyrm', 'npc_abyssal_fiend', 'npc_shadow_reaper', 'npc_soul_eater', 'npc_tormentor',
  'abyss_wall_0', 'abyss_wall_1', 'abyss_wall_2', 'abyss_wall_3', 'abyss_floor_0', 'abyss_floor_1', 'abyss_floor_2', 'abyss_floor_3',
  'pd_base', 'pd_plate', 'pd_dagger', 'pd_sword', 'pd_scimitar', 'pd_wooden_shield', 'pd_kiteshield',
  'item_coins', 'item_bones', 'item_prayer_potion', 'item_dagger', 'item_sword', 'item_scimitar',
  'item_platebody', 'item_wooden_shield', 'pd_jacket',
  'item_shortbow', 'item_arrow', 'item_staff', 'item_elemental_staff', 'item_mystic_staff', 'item_robe',
  'item_leather_body', 'item_dhide_body', 'pd_bow', 'pd_staff', 'pd_elemental_staff', 'pd_mystic_staff',
  'pd_wizard_robe', 'pd_mystic_robe', 'pd_leather_body', 'pd_dhide_body',
  'pd_hardleather_body', 'pd_studded_body', 'pd_blue_dhide_body', 'pd_splitbark_body', 'pd_infinity_top', 'pd_ahrims_robetop',
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
  bronze: 0xe0a070, iron: 0xb8b8b8, steel: 0xeeeef8, mithril: 0x8090ff, adamant: 0x70d070, rune: 0x70e8ff, dragon: 0xff5040,
};

const metalOf = (id: string) => METAL_TINT[id.split('_')[0]];

const WOOD_TINT: Record<string, number> = { oak: 0xffe0b0, willow: 0xf0f0a0, maple: 0xffb080, yew: 0xd09070 };
const woodOf = (id: string) => WOOD_TINT[id.split('_')[0]];

const ELEMENT_TINT: Record<string, number> = { air: 0xf0f0ff, water: 0x80a0ff, earth: 0xc0a070, fire: 0xff8060 };
/** "staff_of_fire" / "mystic_fire_staff" -> fire tint. */
const elementOf = (id: string) => ELEMENT_TINT[Object.keys(ELEMENT_TINT).find((e) => id.includes(e)) ?? ''];

/** Ranged and magic gear, shared by inventory icons and the paperdoll. */
function rangedMagicSprite(id: string, layer: 'item' | 'pd'): SpriteRef | null {
  if (id.endsWith('shortbow')) return { key: layer === 'item' ? 'item_shortbow' : 'pd_bow', tint: woodOf(id) };
  if (id === 'staff') return { key: `${layer}_staff` };
  if (id.startsWith('staff_of_')) return { key: `${layer}_elemental_staff`, tint: elementOf(id) };
  if (id.startsWith('mystic_') && id.endsWith('_staff')) return { key: `${layer}_mystic_staff`, tint: elementOf(id) };
  if (id === 'wizard_robe') return { key: layer === 'item' ? 'item_robe' : 'pd_wizard_robe' };
  if (id === 'mystic_robe_top') return layer === 'item' ? { key: 'item_robe', tint: 0x9090ff } : { key: 'pd_mystic_robe' };
  if (id === 'leather_body') return { key: `${layer}_leather_body` };
  if (id === 'green_dhide_body') return { key: `${layer}_dhide_body` };
  if (id === 'black_dhide_body') return layer === 'pd' ? { key: 'pd_dhide_body', tint: 0x505050 } : { key: 'item_dhide_body', tint: 0x404040 };
  if (id === 'ancestral_top') return layer === 'pd' ? { key: 'pd_mystic_robe', tint: 0x8060c0 } : { key: 'item_robe', tint: 0x6040a0 };
  if (id === 'staff_of_light') return { key: `${layer}_mystic_staff`, tint: 0xfff0a0 };
  if (id === 'dark_bow') return { key: layer === 'item' ? 'item_shortbow' : 'pd_bow', tint: 0x404050 };
  if (id === 'wyrmhide_body') return layer === 'pd' ? { key: 'pd_blue_dhide_body' } : { key: 'item_dhide_body', tint: 0x6a6a9a };
  if (id === 'staff_of_the_dead') return { key: `${layer}_mystic_staff`, tint: 0x70c070 };
  // Newer armour: own paperdoll sprites; inventory icons reuse a tinted base icon.
  const pd: Record<string, [string, number]> = {
    hardleather_body: ['leather_body', 0x9a7050], studded_body: ['leather_body', 0xb0a090], blue_dhide_body: ['dhide_body', 0x80a0ff],
    splitbark_body: ['robe', 0xa07848], infinity_top: ['robe', 0xf0f0ff], ahrims_robetop: ['robe', 0x806070],
  };
  if (pd[id]) return layer === 'pd' ? { key: `pd_${id}` } : { key: `item_${pd[id][0]}`, tint: pd[id][1] };
  return null;
}

export function itemSprite(id: string): SpriteRef {
  if (id === 'coins') return { key: 'item_coins' };
  if (id === 'bones' || id === 'big_bones') return { key: 'item_bones' };
  if (id === 'prayer_potion') return { key: 'item_prayer_potion' };
  if (POTION_SPRITES.has(id)) return { key: `item_${id}` };
  if (id === 'wooden_shield') return { key: 'item_wooden_shield' };
  if (id.endsWith('_kiteshield')) return { key: 'gen_kiteshield', tint: metalOf(id) };
  if (id.endsWith('_arrow')) return { key: 'item_arrow', tint: metalOf(id) };
  const rm = rangedMagicSprite(id, 'item');
  if (rm) return rm;
  for (const kind of ['dagger', 'sword', 'scimitar', 'platebody']) {
    if (id.endsWith(`_${kind}`)) return { key: `item_${kind}`, tint: metalOf(id) };
  }
  return { key: `gen_${id}` };
}

/** Monsters swapped for a brown blob in arachnophobia mode. */
const SPIDERS = new Set(['giant_spider']);

export function npcSprite(npcId: string): string {
  if (settings.arachnophobia && SPIDERS.has(npcId)) return 'npc_blob';
  if (npcId === 'treasure_goblin') return 'npc_goblin';
  return `npc_${npcId}`;
}

/** Arachnophobia mode's stand-in: a round brown blob with a friendly face. */
function makeBlob(scene: Phaser.Scene): void {
  if (scene.textures.exists('npc_blob')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 0.25).fillEllipse(16, 27, 22, 6);
  g.fillStyle(0x5a3a1e, 1).fillEllipse(16, 19, 24, 18);
  g.fillStyle(0x7a5230, 1).fillEllipse(15, 17, 20, 13);
  g.fillStyle(0x9a6a40, 1).fillEllipse(12, 14, 7, 4);
  g.fillStyle(0xffffff, 1).fillCircle(12, 18, 2.5).fillCircle(20, 18, 2.5);
  g.fillStyle(0x101010, 1).fillCircle(12, 18.5, 1.2).fillCircle(20, 18.5, 1.2);
  g.generateTexture('npc_blob', 32, 32);
  g.destroy();
}

/** Paperdoll layers for the player's equipment (DCSS player tiles share one 32x32 frame). */
export function weaponLayer(id: string | undefined): SpriteRef | null {
  if (!id) return null;
  const rm = rangedMagicSprite(id, 'pd');
  if (rm) return rm;
  for (const kind of ['dagger', 'sword', 'scimitar']) {
    if (id.endsWith(`_${kind}`)) return { key: `pd_${kind}`, tint: metalOf(id) };
  }
  return null;
}

/** Platebody if worn, otherwise a plain leather jacket. */
export function bodyLayer(id: string | undefined): SpriteRef {
  if (!id) return { key: 'pd_jacket' };
  return rangedMagicSprite(id, 'pd') ?? { key: 'pd_plate', tint: metalOf(id) };
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

const POTION_SPRITES = new Set([
  'attack_potion', 'strength_potion', 'defence_potion', 'super_attack', 'super_strength', 'super_defence',
  'ranging_potion', 'magic_potion', 'vial_of_water',
]);

const LEAF = [
  '', '', '',
  '.........oo',
  '........oxxo',
  '.......oxXxo',
  '...oo.oxXxxo',
  '..oxxooxXxo',
  '..oxXxoxxxo',
  '...oxXxxxo',
  '....oxxxo',
  '.....odo',
  '....odo',
  '...odo',
  '...oo',
];

const BERRY = [
  '', '', '', '', '',
  '.....oo..oo',
  '....oXxooXxo',
  '....oxxooxxo',
  '.....oooooo',
  '....oXxooXxo',
  '....oxxooxxo',
  '.....oo..oo',
];

const ROOT = [
  '', '', '', '',
  '......oooo',
  '.....oXxxxo',
  '....oxXxxxdo',
  '....oxxxxxdo',
  '.....oxxxdo',
  '......oxdo',
  '.......odo',
  '......odo',
  '.......oo',
];

const JUG = [
  '', '', '',
  '......oooo',
  '......oddo',
  '.....oxxxxo',
  '....oxXxxxxo',
  '....oxXxxxxo',
  '....oxxxxxxo',
  '....oxxxxxdo',
  '.....oxxxdo',
  '......oooo',
];

const RUNE = [
  '', '', '',
  '.....oooooo',
  '...oommmmmmoo',
  '..ommmmmmmmmmo',
  '..ommmxxxxmmmo',
  '.ommmxmmmmxmmmo',
  '.ommmxmmmmxmmmo',
  '.ommmmxxxxmmmmo',
  '.ommmmmxxmmmmmo',
  '..ommmmxxmmmmo',
  '..oddmmmmmmddo',
  '...ooddddddoo',
  '.....oooooo',
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
  makeBlob(scene);
  for (const def of Object.values(ITEMS)) {
    const c = def.color;
    const tones = { o: 0x1a1612, x: c, X: shade(c, 1.35), d: shade(c, 0.65), k: 0x101010, l: 0xd8b880 };
    if (def.herblore && !POTION_SPRITES.has(def.id)) {
      const pattern = def.stackable
        ? (def.id === 'wine_of_zamorak' ? JUG : ['eye_of_newt', 'white_berries'].includes(def.id) ? BERRY : ROOT)
        : LEAF;
      paint(scene, `gen_${def.id}`, pattern, tones);
    } else if (def.id.endsWith('_rune')) paint(scene, `gen_${def.id}`, RUNE, { o: 0x1a1a1a, m: 0x8a8a92, d: 0x5a5a62, x: c });
    else if (def.id.endsWith('_ore') || def.id === 'coal') paint(scene, `gen_${def.id}`, ORE, { ...ROCK, x: c, X: shade(c, 1.4) });
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
