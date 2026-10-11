/** Visual and monster theme of a floor; changes every 5 floors and cycles. */
export interface ThemeDef {
  id: string;
  name: string;
  floorKeys: string[];
  wallKeys: string[];
  /** Tints to mute bright tiles so floors and walls stay easy to tell apart. */
  floorTint?: number;
  wallTint?: number;
}

export const THEMES: ThemeDef[] = [
  { id: 'dungeon', name: 'the Dungeon', floorKeys: ['floor_0', 'floor_1', 'floor_2', 'floor_3'], wallKeys: ['wall_0', 'wall_1', 'wall_2', 'wall_3'], floorTint: 0xb0a088 },
  { id: 'crypt', name: 'the Crypt', floorKeys: ['crypt_floor_0', 'crypt_floor_1'], wallKeys: ['crypt_wall_0', 'crypt_wall_1', 'crypt_wall_2', 'crypt_wall_3'] },
  { id: 'volcanic', name: 'the Volcanic depths', floorKeys: ['volcanic_floor_0', 'volcanic_floor_1', 'volcanic_floor_2', 'volcanic_floor_3'], wallKeys: ['volcanic_wall_0', 'volcanic_wall_1', 'volcanic_wall_2', 'volcanic_wall_3'], wallTint: 0x8a5a50 },
  { id: 'frozen', name: 'the Frozen caverns', floorKeys: ['frozen_floor_0', 'frozen_floor_1', 'frozen_floor_2', 'frozen_floor_3'], wallKeys: ['frozen_wall_0', 'frozen_wall_1'], wallTint: 0x9aaabb },
];

/** Floors 1-5 Dungeon, 6-10 Crypt, 11-15 Volcanic, 16-20 Frozen, then around again. */
export function themeForDepth(depth: number): ThemeDef {
  return THEMES[Math.floor((Math.max(1, depth) - 1) / 5) % THEMES.length];
}
