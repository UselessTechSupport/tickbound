/**
 * The in-game changelog ("What's new", N or Settings). Newest first. Bump `id` for each
 * entry: players who've seen an older one get the window once when they next reach camp.
 */

export interface ChangelogEntry {
  id: number;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: 7,
    date: '2026-10-12',
    title: 'Ranged and magic balance',
    items: [
      'Monsters now sometimes drop supplies for the style you fight with: arrows like the ones you fire, or runes for your spell (not the ones your staff gives). Elites and bosses always do.',
      "Armourer gear you can't wield yet now comes with the best tier you can, so archers and mages always have a bow or staff to train with.",
      'Added this changelog (N, or from Settings).',
    ],
  },
  {
    id: 6,
    date: '2026-10-12',
    title: 'Fixes and quality of life',
    items: [
      'Magic: a splash gives no XP; a landed spell gives half its base XP plus damage. Magic was levelling 2-4x faster than melee or ranged.',
      'Fragile and the Frailty curse now take a true share of max HP all run, rather than a few HP at the start.',
      'Sanctuary heals once per altar (prayer still recharges every time). The Warding Charm now soaks a hit before Undying is used.',
      'Death screen: "Dive again" goes straight back to the ladder.',
      'Daily contracts refresh at midnight even while you wait at camp.',
      "Fires are never lit where they'd wall off a corridor. Game hotkeys do nothing while a window is open.",
      'Trap disarms have their own counter, and a new Trap Expert achievement.',
    ],
  },
  {
    id: 5,
    date: '2026-10-12',
    title: 'Hidden rooms and mobile play',
    items: [
      'Hidden rooms: about 1 floor in 5 has a glinting cracked wall leading to a sealed room with a cache, a relic shrine or a stash of supplies.',
      'Phones: the layout fills a landscape screen, pinch to zoom, on-screen Eat / Pause / Zoom / Fullscreen buttons, and it can be added to your home screen.',
      'Dying on an autoplayed run pays no tokens at all: forfeit to bank them.',
      'Fixed runs saved before an update restoring with the player stuck out of bounds.',
    ],
  },
  {
    id: 4,
    date: '2026-10-11',
    title: 'The deep dungeon',
    items: [
      'The Abyss: floors 21+ have their own theme and monsters, and keep getting harder.',
      'New bosses: the Lich (25), Ancient Wyrm (30), Hollow King (35) and Void Titan (40). Bosses have signature moves.',
      'Floor events, dark shrines, wandering adventurers, treasure maps, hidden traps, run modifiers and six new relics.',
      'Top-end skilling: sharks and manta rays, magic trees, dragon smithing, dragon arrows, super potions, Piety / Rigour / Augury, Wave and Surge spells.',
    ],
  },
  {
    id: 3,
    date: '2026-10-11',
    title: 'Long-term progression',
    items: [
      'The skill tree grew to 113 perks in 11 branches, with perks for every skill.',
      'Skill mastery (K), the progress journal (J), the bestiary (B), collection log milestones and daily contracts.',
      'Camp building (Builder), the quest board, the Enchanter and the Crafting skill with amulets.',
    ],
  },
  {
    id: 2,
    date: '2026-10-11',
    title: 'Skills, specials and saves',
    items: [
      'Fletching, Thieving, Agility and Herblore; special attacks; elite monsters.',
      'The Armourer, skip-ahead and autoplay run starts.',
      'Runs are saved, so a refresh or closed tab picks up where you left off.',
    ],
  },
  {
    id: 1,
    date: '2026-10-11',
    title: 'Tickbound launches',
    items: [
      'Procedural floors on the OSRS game tick, melee / ranged / magic combat, prayers, bosses, skilling, relics, merchants and chests.',
      'Camp between runs: spend Dungeoneering tokens at the Mentor and the Toolsmith. Achievements, a collection log, boss pets and Slayer.',
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0].id;
