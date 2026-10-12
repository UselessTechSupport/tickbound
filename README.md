# Tickbound

**Play it: https://uselesstechsupport.github.io/tickbound/**

An Old School RuneScape–inspired roguelike that runs in the browser. Dive into procedurally generated
dungeon floors on the OSRS 0.6s game tick, level 1–99 skills, fight with prayers and gear, and die.
Then spend Dungeoneering tokens at camp on tools and a skill tree, and go deeper next time.

## Play

```bash
npm install
npm run dev        # then open http://localhost:5173
```

## Controls

| Input | Action |
|---|---|
| Left-click | Walk / attack / take / use (the top option of the menu) |
| Right-click | OSRS-style "Choose Option" menu |
| Minimap click | Walk there |
| `1` `2` `3` | Protect from Magic / Missiles / Melee |
| `Q` | Quick-prayers (choose them with "Set up quick-prayers" in the Prayer tab) |
| `R` | Toggle run (2 tiles per tick) / walk (1 tile) |
| Examine a monster / chest | Drop table: every drop, quantity and chance (with your bonuses), log status; chest odds and Mimic chance |
| Hover an item | Stats tooltip: speed, range, bonuses, requirements, comparison with what you wear, value |
| Drag an item | Move it to another inventory slot |
| `Shift` + click item | Drop it (left-click option becomes Drop while Shift is held) |
| `A` / `L` | Achievements / Collection log (also buttons at the bottom of the side panel) |
| Mouse wheel | Zoom |
| `G` | Walk to the stairs once found (also a button under the minimap) |
| `F` | Quick-eat: the food that best fits your missing HP |
| `P` | Pause / resume |
| `E` | Arm your weapon's special attack |
| `K` | Skill mastery |
| `J` | Progress journal: completion of every long-term system |
| `B` | Bestiary: kill 10 / 100 / 1,000 of each monster for tokens |
| `O` | Settings: volume, toggles (auto-pickup, labels, warnings, toasts), zoom, keybinds |
| Touch | Tap = left-click, long-press = right-click menu; small screens scale the layout to fit |
| `M` | Mute sound |
| `H` | Show controls in chat |
| `Esc` | Close windows |

## How the game works

### The basics
- **Camp** is the hub between runs. Climb down the ladder to start; a new save has no tools.
- **Floors**: find the stairs. Every 5th floor a boss guards them. Themes change every 5 floors (Dungeon, Crypt,
  Volcanic depths, Frozen caverns), and from floor 21 it's **the Abyss**, where monsters keep getting 4% stronger
  per floor, so there's always further to go.
- **Death** ends the run and banks Dungeoneering tokens: 15 per floor, 1 per kill, 25 per boss, plus carried coins
  (20 coins = 1 token up to 2,000 coins, tapering after). **Forfeit** any time to bank early.
- **Resume**: a run in progress is saved in your browser, so a refresh or closed tab picks up where you left off.
- **Starting a run**: floor 1, a skip past any boss you've beaten (catch-up levels and supplies, half tokens for
  skipped floors), or autoplay to your best floor (the bot plays fast, then hands over; if it dies, no rewards).
- **Run modifiers** (after the Goblin Warlord): optional handicaps for more tokens: Hardened, Frenzied, Fragile,
  Famished, Relicless, Ironman (+10% to +30% each, stacking).

### Combat
- **Styles**: melee, ranged (bows + arrows you can pick back up) or magic (staffs + runes; strikes to Surges).
  Monsters have weaknesses; plate armour hurts magic and ranged accuracy.
- **Prayer**: 22 prayers up to Piety, Rigour and Augury. Protection prayers block a style; ranged and magic hits are
  checked when they *land*. Recharge at altars, with potions, or partly on each descent.
- **Special attacks**: rare weapons (dragon dagger, granite maul, magic shortbow, ancient staff, dragon warhammer,
  dragon claws). Click the spec bar or press E.
- **Bosses**: Goblin Warlord (5, calls guards), TzTok-Jad (10), Chaos Elemental (15, throws you around), Demonic
  gorilla (20, prays against a style you repeat), the Lich (25, raises skeletons), Ancient Wyrm (30, dragonfire
  through prayers), Hollow King (35, drains prayer), Void Titan (40, summons void spawn), then ever-stronger Titans.
  Each has a 1/50 pet; the deep ones drop unique gear.
- **Elite monsters** (floor 3+): Brutal, Armoured, Swift, Vampiric, Savage, Regenerating or Splitting, in a gold
  aura. Tougher, but double loot and bonus tokens.

### During a run
- **Relics**: pick 1 of 3 run-long boons after bosses and at relic shrines (26 relics, 4 of them quest rewards).
- **Dark shrines** (floor 4+): a relic for a curse (Frailty, Exposure, Famine or Unrest).
- **Floor events** (about 1 in 4 floors from floor 3): Gilded Halls, Infested, Cursed, Darkness, Blessed Ground,
  Merchant Caravan, Elite Den, Overgrown, or a Treasure Goblin to chase.
- **Merchants, chests and wanderers**: buy and sell; chests can be Mimics or locked (Thieving); wandering
  adventurers trade supplies for relics, tokens or coins.
- **Treasure maps** (rare drops): every floor you carry one to has buried treasure; dig it up.

### Skills
- 18 skills on the OSRS XP curve, reset every run: combat, Prayer, Mining, Woodcutting, Fishing, Cooking, Smithing,
  Herblore, Fletching, Thieving, Agility, Crafting and Slayer.
- **Gathering and crafting** keep you alive: fish and cook (up to sharks and manta rays), mine and smith (up to dragon),
  chop and fletch (up to magic logs, the magic shortbow and dragon arrows), mix potions (up to super combat), cut gems
  into amulets (new amulet slot). Tools come from the Toolsmith.
- **Thieving**: pickpocket humanoids and pick locked chests. **Agility**: shortcuts through walls.
- **Slayer** (after the Goblin Warlord): kill tasks from the Slayer master that carry across runs, plus permanent
  Slayer rewards (longer tasks, elite task monsters, treasure maps, restoration).

### Camp and long-term progression
- **Mentor's skill tree**: 113 perks in 11 branches; tiers open as you invest in a branch; each ends in a capstone.
  Perks give levels, bonuses and mechanics, never gear. The full tree costs about 427,000 tokens.
- **Toolsmith**: pickaxes and axes (bronze to dragon), fishing gear, hammer, tinderbox, knife, chisel.
- **Armourer** (Veteran's Kit perk): permanent starting gear for every style, weapons, armour and off-hands, with a
  final dragon-era tier after the Ancient Wyrm. You start in your chosen style's gear.
- **Enchanter** (after TzTok-Jad): enchant Armourer gear (Keen, Brutal, Leeching, Flaming, Slayer's, Fortified,
  Thorns, Renewal, Blessed), ranks I-III.
- **Builder**: camp structures from tokens plus timber and metal (logs, ores and bars you carry home): Bank chest,
  Herb garden, Trophy room, Workbench, Relic altar, Pet kennel, Library.
- **Skill mastery** (K, or click a skill): levels gained in runs become permanent mastery points; 10 mastery levels per
  skill, each a small bonus.
- **Quest board**: 20 quests from the camp folk, plus three **daily contracts**.
- **Goals and rewards**: 93 achievements, a collection log with milestone rewards, a bestiary (B) with kill-count
  rewards, depth-record bonuses, a first-run-of-the-day bonus, and the progress journal (J) to see it all.

## Development

```bash
npm test           # unit tests (vitest)
npm run sim        # balance simulator: bot plays many runs per progression stage
npm run sim -- 100 # more runs per stage
npm run build      # static site in dist/ (works from any subpath, e.g. itch.io)
```

- `src/game/GameState.ts`: all game rules, no rendering, unit-tested.
- `src/data/`: items, monsters, bosses, prayers, recipes, resources, tools, skill tree, balance knobs.
- `src/scenes/`: Phaser rendering (`DungeonScene`) and HUD (`UIScene`).
- `src/sim/bot.ts`: the autopilot used by `npm run sim` to tune difficulty.

Balance reference (`npm run sim`, 20 runs each): fresh save reaches floor ~4, early unlocks ~5,
mid (~800 tokens spent) ~9, late (~3000) ~11.

## Credits

Tiles: Dungeon Crawl Stone Soup 32x32 tiles, CC0 (see `public/assets/tiles/CREDITS.txt`).
Sound effects are synthesised in code. Inspired by Old School RuneScape; not affiliated with Jagex.
