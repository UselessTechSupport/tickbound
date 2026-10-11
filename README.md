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
| `R` | Toggle run (2 tiles per tick) / walk (1 tile) |
| `M` | Mute sound |
| `H` | Show controls in chat |
| `Esc` | Close windows |

## How a run works

- **Camp**: talk to the **Mentor** (skill tree perks) and the **Toolsmith** (pickaxe, axe, fishing gear,
  hammer, tinderbox). Climb down the ladder to start a run. A new save has no tools.
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
