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
| `O` | Settings: volume, toggles (auto-pickup, labels, warnings, toasts), zoom, keybinds |
| Touch | Tap = left-click, long-press = right-click menu; small screens scale the layout to fit |
| `M` | Mute sound |
| `H` | Show controls in chat |
| `Esc` | Close windows |

## How a run works

- **Daily contracts** (quest board): three new goals every day (kill a monster type, reach a floor, gather, cook,
  thieve...), each paying tokens that scale with your best floor, plus a bonus for all three.
- **The Abyss** (floor 21+): a new theme with abyssal fiends, shadow reapers, soul eaters and tormentors (plus a new
  Slayer category). Past floor 20, monsters keep getting 4% stronger per floor, so there's always further to go.
  Bosses: the Lich (floor 25) and the Ancient Wyrm (floor 30), then ever-stronger Wyrms.
- **Tokens from coins**: 20 coins = 1 token up to 2,000 coins; bigger piles taper off, so hoarding can't flood the economy.
- **Floor events** (from floor 3, about 1 in 4 non-boss floors): Gilded Halls (double coins, tougher monsters),
  Infested (more monsters, +1 token per kill), Cursed (monsters hit harder, +2 tokens per kill), Darkness (short sight,
  +50% XP), Blessed Ground (slow prayer drain, slow healing) and the Treasure Goblin (catch it before it escapes).
- **Skill mastery** (K, or click a skill): every level you gain in a run adds permanent mastery points to that
  skill. 10 mastery levels per skill (50 to 4,000 points), each a small bonus (e.g. +2% mining success, 3% less
  burning, 0.5% dodge chance from Agility).
- **Mentor's skill tree**: 106 perks in 11 branches (Melee, Ranged, Magic, Mastery, Defence, Survival, Prayer,
  Gathering, Crafting, Rogue, Fortune). Tiers open as you put ranks into a branch; each branch ends in a capstone.
  Perks give levels, bonuses and new mechanics, never gear. The full tree costs about 427,000 tokens.
- **Camp**: talk to the **Mentor** (skill tree perks) and the **Toolsmith** (pickaxe, axe, fishing gear,
  hammer, tinderbox). Climb down the ladder to start a run. A new save has no tools.
- **Armourer** (camp, unlocked by the Mentor's Veteran's Kit perk): permanent starting-gear tiers: melee, ranged
  (with arrows) and magic (with runes) weapons; melee (platebodies), ranged (leather to blue d'hide) and magic (wizard
  robe to Ahrim's) armour; and shields. Pick a starting style and you start in its weapon and armour; gear above your
  level starts in your pack until you can wield it. (Mentor perks give levels and bonuses; the Armourer gives gear.)
- **Enchanter** (camp, arrives after your first TzTok-Jad kill): one enchantment per Armourer gear line, ranks I-III.
  Weapons: Keen, Brutal, Leeching, Flaming, Slayer's. Armour: Fortified, Thorns, Renewal, Blessed. Switching costs a fee.
- **Fletching** (needs a knife from the Toolsmith): use logs to fletch shortbows, or a bar + logs to fletch 15 arrows.
- **Thieving**: pickpocket goblins, dark wizards, mummies, infernal mages and dark archers (getting caught stuns and
  hurts you; pockets run dry after 3 picks), and pick the locks of locked chests for double loot (fail = trap).
- **Agility**: cracked walls, narrow gaps and loose rocks are shortcuts through walls that save a long walk.
  Higher Agility = fewer slips.
- **Special attacks**: rare weapons (dragon dagger, granite maul, magic shortbow, ancient staff, dragon warhammer,
  dragon claws) have a special move. Click the spec bar or press E to arm it; energy refills 10% every 30 seconds.
- **Builder** (camp): spend tokens plus timber and metal (from the logs, ores and bars you carry when a run ends) on
  camp structures: Bank chest (keeps your best carried items for the next run), Herb garden (start with potions),
  Trophy room (+max hit per boss beaten), Workbench (+crafting XP), Relic altar (start with a relic you've found)
  and Pet kennel (your pet gives a bonus that grows with the floors it comes along for).
- **Quest board** (camp): 12 quests from the camp folk (reach floors, bring home logs and ores, beat bosses, Slayer
  tasks, building, thieving, agility, fletching). Lifetime progress counts. Rewards are tokens, materials and four
  quest-only relics (Fire Cape, Thieves' Gloves, Boots of Lightness, Fletcher's Kit) that join the relic pool.
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
- **Achievements**: 85 goals in Easy / Medium / Hard / Elite tiers (lifetime milestones, bosses, depth and in-run
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
