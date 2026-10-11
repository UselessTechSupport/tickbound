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
| `O` | Settings: volume, toggles (auto-pickup, labels, warnings, toasts), zoom, keybinds |
| Touch | Tap = left-click, long-press = right-click menu; small screens scale the layout to fit |
| `M` | Mute sound |
| `H` | Show controls in chat |
| `Esc` | Close windows |

## How a run works

- **Camp**: talk to the **Mentor** (skill tree perks) and the **Toolsmith** (pickaxe, axe, fishing gear,
  hammer, tinderbox). Climb down the ladder to start a run. A new save has no tools.
- **Armourer** (camp, unlocked by the Mentor's Veteran's Kit perk): permanent starting-gear tiers for melee, ranged (with arrows), magic (with runes), body and
  shield. Pick a starting style; gear above your level starts in your pack until you can wield it.
- **Enchanter** (camp, arrives after your first TzTok-Jad kill): one enchantment per Armourer gear line, ranks I-III.
  Weapons: Keen, Brutal, Leeching, Flaming, Slayer's. Armour: Fortified, Thorns, Renewal, Blessed. Switching costs a fee.
- **Resume**: a run in progress is saved in your browser (every few seconds and when you close the tab), so a
  refresh or closed tab picks up where you left off.
- **Starting a run**: the ladder offers floor 1, a skip to the floor after any boss you've beaten (with catch-up
  levels and supplies), or autoplay to your best floor (the bot plays fast, then hands over; it can die). Skipped or
  autoplayed floors pay half tokens and don't count toward run challenges. Autoplay can be turned off in Settings.
- **Floors**: find the stairs. Every 5th floor a boss guards them; the way down is sealed until it dies.
  Floors get harder and food drops get rarer, so fishing, cooking and smithing keep you alive.
- **Prayer**: bury bones to level it. Protection prayers block a whole attack style; ranged and magic hits are
  checked when the projectile *lands*, so you can switch in time. Bosses show their current style as a
  coloured outline (red melee, green ranged, blue magic). Recharge at altars, with potions, or partly on
  each descent.
- **Combat styles**: melee, ranged (bows + arrows, which you can pick back up) or magic (staffs + runes, autocast from
  the Magic tab). Monsters have weaknesses (examine them); plate armour hurts magic and ranged accuracy.
- **Relics**: after every boss, and at the occasional glowing relic shrine, pick 1 of 3 run-long boons
  (lifesteal, recoil, auto-burying bones, bonus XP and more). The game pauses while you choose.
- **Merchants & chests**: some floors have a wandering merchant (buy supplies and gear, sell loot; the game pauses
  while trading) and treasure chests. Careful: about 1 in 10 chests from floor 3 down is a Mimic.
- **Forfeit** any time with the [Forfeit run] button (bottom of the side panel); it asks first and banks tokens the
  same as dying.
- **Themed floors**: every 5 floors the dungeon changes (the Crypt from floor 6, the Volcanic depths from 11, the
  Frozen caverns from 16), each with its own monsters.
- **Slayer** (unlocks after your first Goblin Warlord kill): the Slayer master at camp gives a kill task that carries across runs. Task kills give Slayer XP (which
  boosts your accuracy and max hit against task monsters) and finishing pays tokens.
- **Herblore**: pick herbs from herb patches or loot them, then Mix them (right-click the herb) with a secondary
  ingredient and a vial of water into Attack/Strength/Defence/Prayer potions, Super versions, Ranging and Magic
  potions. Potions boost your levels (shown in green) and fade by 1 a minute.
- **Elite monsters** (floor 3+): Brutal, Armoured, Swift, Vampiric or Savage variants in a gold aura. Tougher, but
  they roll their loot twice, always drop a herb and give bonus tokens.
- **Achievements**: 62 goals in Easy / Medium / Hard / Elite tiers (lifetime milestones, bosses, depth and in-run
  challenges like "beat a boss without taking damage"), each paying 10 / 25 / 60 / 150 tokens once.
- **Collection log**: every notable drop from bosses, monsters and chests, with kill counts. Bosses have a 1/50
  pet drop; choose which pet follows you from the log.
- **Death** ends the run and banks tokens: 15 per floor, 1 per kill, 25 per boss, plus carried coins.

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
