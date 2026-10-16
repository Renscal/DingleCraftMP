# How DINGLECRAFT is put together

This is the map. It covers what the shipped file is made of, the order things load in, which source file holds which
system, the conventions that only make sense once you know the whole game is one script, and how each big update plugs
into the original sandbox. The ID ledger and the persistence rules are at the end, because you will need them.

---

## 1. One file, one script

The shipped game is one HTML file, built by plain concatenation, and since 6.62 an `art/` folder beside it:

```
dinglecraft_v<VER>.html = head.html + game.js + hrart.js + tail.html
art/hyperreal-<n>-<hash>.js        the Hyperreal art, loaded the first time Hyperreal is switched on
```

| part | built from | what it is |
|---|---|---|
| `head.html` | `html/` (18 pieces, `html/ORDER.txt`) + `assets/logo.png`, `assets/title/` (the menu panorama) and `assets/vendor/three.r128.min.js` | doctype, all CSS, every UI panel, the help screen, the title panorama as JSON, three.js r128 inlined, and an opening `<script>` |
| `game.js` | `src/` (192 pieces, `src/ORDER.txt`) | the entire game, about 41,000 lines |
| `hrart.js` | `assets/packed/` (6.62) | the art's stand-in: `hrAssetMeta()`, and `hrAssets()` / `hrMgAssets()` that answer once `hrArtLoad()` has added the `art/` files as script tags (`tpEnable` asks; they load from `file://` too). Before that they answer null / `{}` |
| (`art/`, beside the page) | `assets/packed/` | the Hyperreal art: 429 WebP images as base64 data URIs, in files of at most 20 MB, each `hrArtArrived(name, hr, mg)`. The suites load `build/hrassets.js`, the same payloads as one script with the old `hrAssets()` / `hrMgAssets()` |
| `tail.html` | `html/tail.html` | `</script></body></html>` (26 bytes) |

`game.js` and `hrart.js` share **one classic `<script>` element** (the art files are scripts of their own). That single fact explains most of the rules in
this document:

- `'use strict'` on line 15 of `src/core/p01a_prologue.js` covers everything, including the asset functions.
- Every top-level `function`, `const`, `let` and `var` in every file is in **one shared scope**. There are about 3,500
  of them, and no name is declared twice.
- Function declarations are hoisted across the whole script. `boot()` runs from `src/boot/export_boot.js`, before
  `hrart.js` has been read, and it still finds `hrAssets()`.
- **Never load `src/` files as separate `<script>` tags**, not even for a quick experiment. Later files would lose
  strict mode, and four load-time export tables that read functions declared in later files would throw.

The only runtime dependency is three.js r128 (MIT), bundled: the build inlines `assets/vendor/three.r128.min.js` into
`html/99_scripts.html`'s `{{THREE_JS}}` as its own classic script, which defines the global `THREE`. The game needs no
network at all.

## 2. Load order is not PART order

The original game was written as numbered `PART`s, 1 to 52. Every big update since then was added as a new PART
**inserted before the previous update**, so in the file the newest update loads first:

```
src/core, world, entities, ui, features   PARTs 1-52    the original sandbox (v1.0 to v5.8), with every update's core hooks in place
src/ui/p53_chat.js                        PART 53       chat, the Tab list, shared helpers (the AI players of v5.9 were removed in v6.10)
src/net/                                  PART 58       multiplayer (v6.10)                <- newest update
src/malgorath/                            PART 57       the Malgorath Update (v6.3)
src/creativity/                           PART 56       the Creativity Update (v6.2)
src/purgatory/                            PART 55       Puppet Purgatory (v6.1, recast in Release 1.0)
src/texpacks/t*.js                        PART 54       texture packs (v6.0)
src/malgorath/hr/                         PART 57 HR    Malgorath's Hyperreal block + his model loader
src/texpacks/loaders + models/            PART 54       hrLoadModels() (the cast) and hrLoadPModels() (the purgatory cast)
src/boot/export_boot.js                   -             node test exports, or window.__vox + boot() in the browser
```

Consequences:

- A later update may use anything from PARTs 1-53 at load time. Names from updates that load **after** it in the file
  (older updates) are "runtime-only" there and are `typeof`-guarded. For example, PART 57 code checks
  `typeof MP!=='undefined'` before touching Puppet Purgatory.
- A new update goes **immediately before** `malgorath/m0_contract.js` in `src/ORDER.txt`. The section guards in
  `scripts/guards.json` check that each update sits right before the one it was inserted ahead of.
- The Hyperreal models (the 28 in `src/texpacks/models/` plus Malgorath's `src/malgorath/hr/models/mg_malgorath.js`)
  are not top-level code: they live inside `hrLoadModels(){ ... }`, `hrLoadPModels(){ ... }` and
  `hrLoadMModels(){ ... }`, whose opening and closing lines are the small files in `src/texpacks/loaders/` and
  `src/malgorath/hr/loaders/`. Each model is an IIFE that registers itself in `window.HR.MODELS`.

## 3. Where everything lives (the PART map)

Line ranges are where each piece sat in the shipped v6.3 `game.js`, handy when an old note says "game.js line 4293".

### The original sandbox (PARTs 1-52)

| PART | what | src file(s) | v6.3 lines |
|---|---|---|---|
| 1 | header, constants, RNG and noise, block ids, items, crafting, inventory | `core/p01a_prologue.js`, `core/p01b_rng_noise.js`, `core/p01c_blocks_items.js`, `core/p01d_crafting_inventory.js` | 1-284 |
| 2 | texture atlas, icons | `core/p02_atlas_icons.js` | 285-602 |
| 3 | world generation, chunk store, mesher | `world/p03a_terrain.js`, `world/p03b_dimkeys_genchunk.js`, `world/p03c_chunk_store.js`, `world/p03d_mesher.js` | 603-1088 |
| 4 | physics, raycast, player | `core/p04a_physics.js`, `core/p04b_raycast.js`, `core/p04c_player.js`, `core/p04d_player_update.js` | 1089-2024 |
| 5 | entities: drops, falling blocks, arrows, TNT, particles, mobs, spawning | `entities/p05a_entities_drops.js`, `p05b_falling_arrows_tnt.js`, `p05c_particles.js`, `p05d_mobs.js`, `p05e_spawning_tick.js` | 2025-2743 |
| 6 | HUD, input, touch, modals and inventory; the UI scale (6e, new in Release 1.0) | `ui/p06a_hud.js`, `ui/p06b_input.js`, `ui/p06c_touch.js`, `ui/p06d_modal_inventory.js`, `ui/p06e_ui_scale.js` | 2744-3488 |
| 7 | rendering and sound, furnace, sky and lights, hand and camera, saves, world lifecycle, menus, boot and the main loop | `core/p07a_render_sound.js`, `p07b_furnace.js`, `p07c_sky_lights.js`, `p07d_hand_camera.js`, `p07e_save_load.js`, `p07f_world_lifecycle.js`, `ui/p07g_menus.js`, `ui/p07g_title.js` (the title menu and its background, 7g2, new in Release 1.0), `core/p07h_boot_loop.js` | 3489-4310 |
| 8 | wall torches, weapons, vehicles, music | `features/p08_torches_weapons_vehicles_music.js` | 4311-4784 |
| 9 | Critter Jars (catch a mob, throw it back out) | `entities/p09_critter_jars.js` | 4785-4904 |
| 10 | doors, skateboards | `features/p10_doors_skateboards.js` | 4905-5192 |
| 11 | third person, lava, disaster spheres | `features/p11_thirdperson_lava_disasters.js` | 5193-5705 |
| 12 | ramps, trick score, the stock exchange | `features/p12_ramps_tricks_stocks.js` | 5706-6002 |
| 13 | alien villages, dialogue, romance | `world/p13_alien_villages.js` | 6003-6370 |
| 14 | THE DINGLE CASINO | `features/p14_casino.js` | 6371-6603 |
| 15 | rails, carts, theme parks, the disaster chooser | `features/p15_rails_parks_dsel.js` | 6604-7004 |
| 16 | XP, enchanting, spawners, THE DUNGEON, boss bar | `features/p16_xp_enchanting_dungeon.js` | 7005-7447 |
| 17 | beds and better nights | `features/p17_beds.js` | 7448-7505 |
| 18 | armour, boats, flowing water, quality of life | `features/p18_armor_boats_water_qol.js` | 7506-7727 |
| 19 | dragons | `entities/p19_dragons.js` | 7728-7842 |
| 20 | buried dungeons and lone spawner vaults | `world/p20_buried_dungeons_vaults.js` | 7843-8022 |
| 21 | THE DINGLE STORE | `features/p21_store.js` | 8023-8272 |
| 22 | superpowers | `features/p22_superpowers.js` | 8273-8398 |
| 23 | the Dragon King and the Stone Titan | `entities/p23_bosses_titan_roosts.js` | 8399-8554 |
| 24 | cutscenes and the YOU WIN screen (and the `DEMON` state; the old boss fight itself was replaced by PART 57) | `ui/p24_cutscene_win.js` | 8555-8695 |
| 25 | the structure compass | `features/p25_compass.js` | 8696-8826 |
| 26 | Nuke Kegs and spawn eggs | `entities/p26_nuke_kegs_eggs.js` | 8827-9073 |
| 27 | debug menu, game rules, settings memory | `ui/p27_debug_gamerules_settings.js` | 9074-9208 |
| 28 | the patch notes (`PATCH_LOG`: data for `CHANGELOG.md` since the in-game panel was retired in Release 1.0) | `ui/p28_patch_notes.js` | 9209-9385 |
| 29 | 3D tool models (`TOOL3D`) | `features/p29_tool_models.js` | 9386-9447 |
| 30 | 3D weapon models and model-rendered icons (`WPN3D`) | `features/p30_weapon_models_icons.js` | 9448-9553 |
| 31 | pretty shaders | `features/p31_shaders.js` | 9554-9588 |
| 32 | settings panel | `ui/p32_settings_panel.js` | 9589-9612 |
| 33 | the SUBSCRIBE button, shadows | `features/p33_subscribe_shadows.js` | 9613-9741 |
| 34 | armour on the player model | `features/p34_armor_model.js` | 9742-9775 |
| 35 | DEEP DIRT 2D (the game inside the game) and help | `features/p35_deepdirt_help.js` | 9776-10341 |
| 36 | X-ray | `ui/p36_xray.js` | 10342-10395 |
| 37 | dimensions: the Nether and the Aether | `world/p37_dimensions.js` | 10396-10688 |
| 38 | liquid chemistry, portals | `world/p38_liquids_portals.js` | 10689-10837 |
| 39 | gadgets | `features/p39_gadgets.js` | 10838-10928 |
| 40 | living blocks | `entities/p40_living_blocks.js` | 10929-10996 |
| 41 | fishing | `features/p41_fishing.js` | 10997-11058 |
| 42 | snakes | `entities/p42_snakes.js` | 11059-11143 |
| 43 | figurines and displays | `features/p43_figurines.js` | 11144-11209 |
| 44 | guard turf | `features/p44_guard_turf.js` | 11210-11279 |
| 45 | DINGLE CINEMA | `features/p45_cinema.js` | 11280-11486 |
| 46 | the Fortune Orb | `features/p46_fortune_orb.js` | 11487-11495 |
| 47-50 | the horror features: THE ETERNAL SNAIL (47), jumpscares (48), guilt ghosts (49), "the others" (50) (see below) | `features/part47.js`, `part48.js`, `part49.js`, `part50.js` | 11496-11933 |
| 51 | the prop plane | `features/p51_prop_plane.js` | 11934-12016 |
| 52 | THE BIG DINGLE | `features/p52_big_dingle.js` | 12017-12335 |

### The updates (PARTs 53-57)

| PART | update | src | v6.3 lines |
|---|---|---|---|
| 53 | what is left of AI players (v5.9; the bots themselves were removed in v6.10) | `ui/p53_chat.js` (chat, the Tab list, the Player Compass, the biome flowers, damage attribution, the mob-spawner helpers) | 12336-16352 held ten files then |
| 57 | the Malgorath Update (v6.3) | `malgorath/m0_contract.js`, `m1_*` the Bite, `m2_*` the fight, `m3_*` the OG model and effects | 16353-20577 |
| 56 | the Creativity Update (v6.2) | `creativity/c0_contract.js`, `c1_*` paintings, `c2_*` music | 20578-22058 |
| 55 | Puppet Purgatory (v6.1) | `purgatory/p0_*` contract, entry, guide; `p1_*` audio, rules, world; `p2_*` craft, gear, items, tiles; `p3_*` mobs, NPCs, rig, spawn; `p4_*` arena and the three headliners; `p5_bots.js` | 22059-30218 |
| 54 | texture packs (v6.0) | `texpacks/t0_contract.js`, `tA_*` world and assets, `tB_*` light and post, `tC_*` the cast | 30219-31965 |
| 57 HR | Malgorath in Hyperreal | `malgorath/hr/m4_*.js` + `hr/loaders/` + `hr/models/mg_malgorath.js` | 31966-32702 |
| 54 | the Hyperreal cast and the purgatory cast | `texpacks/loaders/*` + `texpacks/models/*.js` (rig, Dan, seven mobs, fifteen `pg_*`) | 32703-41009 |
| - | export branch and boot | `boot/export_boot.js` | 41010-41029 |

Every file of PARTs 54-57 starts with a marker line such as `/* ---- PART 55: p0_contract.js ---- */`. The markers are
part of the shipped bytes, many suites find sections by them, and the build checks that each one names its own file.
The AI-player files and the core files have no markers.

### The horror files (PARTs 47-50)

`src/features/part47.js` to `part50.js` hold the horror features. They are ordinary source files:

- **47, THE ETERNAL SNAIL** (`SNL`, `SNL_ON`, `spawnSnail`, `tickSnail`, `updateSnail`): slow, touch = death, follows
  you across dimensions and reappears 50 blocks out if left behind; game rule `GR.snail`.
- **48, jumpscares** (`SCARE`, `triggerScare`, `tickScare`; the art and sound are drawn and synthesised in engine, no files):
  `GR.jsc` is the chance per frame in percent, 0 by default.
- **49, guilt ghosts** (`GHOST_CHANCE`, `spawnGhost`, `updateGhost`): 10% of kills come back to talk; game rule
  `GR.ghosts`.
- **50, "the others"** (`HRR`, `tickHorror`): a night-time torch blackout in the Overworld that ends with a knock, a
  brief doppelganger that appears underground, and rare creepy toasts. The Watcher and the Reaper were removed in v6.8.

The core calls into them from the main loop (`tickSnail`, `tickScare`, `tickHorror`), the entity tick (`updateSnail`,
`updateGhost`), `killMob` (`spawnGhost`), saves (`SNL_ON`) and the game rules. Until v6.8 the four files were kept
unread and md5-pinned as "the opaque files"; the owner lifted that rule in v6.8.

## 4. The core systems

Grep the names (with `tools/grep-safe.sh`) to find the code.

- **Constants** (`core/p01a_prologue.js`): `CH=16` chunk size, `WH=80` world height (nothing above y≈76 works:
  `setBlock` silently does nothing up there), `SEA=30`, `GAME_VERSION`, `GRAV`, `REACH`. The save format comment at
  the top of that file is a promise: old saves load forever.
- **Blocks and items** (`core/p01c_blocks_items.js`): `B` (block ids), `IT` (item ids), `DEFS`, defined with
  `def(id,{name,tiles,hard,toolClass,req,...})` and `idef(...)`. The fields are `tiles` and `toolClass`, not `tile` and
  `tool`: the wrong keys crash the recipe-book icon renderer. Recipes are `RECIPES` (`core/p01d_crafting_inventory.js`).
  Define an ingredient item before any recipe that uses it.
- **Textures** (`core/p02_atlas_icons.js`): `buildAtlas()` paints every 16 px tile procedurally into one atlas;
  `tile(name)` gives a slot.
- **World** (`world/`): `chunks` (a Map), `genChunk` builds terrain then stamps structures, `getBlock`/`setBlock`,
  `colInfo(x,z)` (deterministic height and biome), per-chunk edits in `ch.edits`, `updateChunks` meshes around the
  player.
- **Structures** all follow one pattern: a deterministic cell function (`vCell` villages, `pCell` theme parks, `wdCell`
  buried dungeons, `lsCell` spawner vaults, `rstCell` dragon roosts), a stamp step inside `genChunk`, and a SEEN set +
  PEND queue that a frame-chain `process*` drains once (spawners into `SPW`, chests via `lootFill`, mobs and bosses),
  with SEEN saved. The fixed site at X 1000, Z 1000 belongs to Malgorath (PART 57).
- **Mobs** (`entities/p05d_mobs.js`): the `MOBT` table (hp, size, speed, damage, flags such as hostile, boom, nuke, fly,
  boss), `spawnMob`, `makeMobMesh` (generic humanoid plus special branches), `updateMob` (generic brain with early
  routing to special brains), `hurtMob`, `killMob`. Mob textures put the face on the +z face (material index 4);
  `boxMesh(w,h,d,color,faceCanvas)`.
- **Player** (`core/p04c_player.js`, `p04d_player_update.js`): `P`, `newPlayer`, `updatePlayer` (frozen while a cutscene
  runs), `doMine`/`doUse`. **The order of the `doUse` branches matters**: early right-click branches sit above the eat
  branch, and anything below it loses food items to hunger. Forward is `(-sin(yaw), -cos(yaw))`; **positive pitch looks
  up**.
- **Saves** (`core/p07e_save_load.js`): `snapshot()`, `applySave()`, `resetWorld()`; storage goes through the
  `window.storage` shim (keys `vxw:<world>`, `vxwlast`, `vox_settings`, stored in `localStorage` with a `vx_` prefix).
  See section 8.
- **Sound** (`core/p07a_render_sound.js`): `audio()`, `playS(name)`, all synthesised in code; music is `musicTick`
  (`features/p08_...`), started by `boot()` after every update has wrapped it.
- **UI panels** all follow the store pattern: an overlay `div` in `html/dom/*.html`, a `let xOpen=false`,
  `openX/closeX/renderX` (render guards `typeof list.querySelectorAll==='function'` so it works headless), a line in
  `modalOpen()`, a place in the Escape chain, and button wiring in a top-level `{ const b=$('id'); if(b)b.onclick=... }`
  block.
- **Systems index**: enchanting `ENCH_DEFS`, XP `spawnXP`, casino `casSpin`, disasters `startDisaster`, coasters
  `railAt`/`updateCart`, boats `updateBoat`, water `tickFlow` (spreads down always, sideways only from a 2-deep source
  or into a cell with air below: this containment rule is load-bearing), armour `armorAbsorb`, store `storeBuy` and hats
  `buildHat`, powers `POW`/`powActive`, bosses `bossLoot`, boss bar `updateBossBar`, cutscenes `CUT`/`startCut`/`cutCam`,
  win screen `openWin`/`winHome`, compass `cmpFind`, nukes `nukeExplode`, spawn eggs `EGG_BASE`/`EGG_MOBS`, game rules
  `GR`/`GR_DEF`, settings `saveSettings`/`loadSettings`, toasts `showToast`, drops `spawnDrop`, entities `entities`/
  `removeEnt`, the UI scale `UIS`/`uiAutoScale`/`uiApply`/`uiCv` (CSS zoom through `--uiz` and `--uih`, saved as `ui` in
  `vox_settings`), the title menu `TM`/`tmBoot`/`tmKey` and its background `TBG`/`tbgStart`/`tbgStop`, the HUD layout `hudLayout`/`hlSpot`
  (toasts clear of menus; F3 and the player list clear of the HUD).

### The frame

`frame(t)` in `src/core/p07h_boot_loop.js` updates the player, chunks, sky, camera and screen shake, then runs **one
long gated line** of per-system ticks (`if(playing&&!paused){processVillages(dt); ... }`), which includes the update
ticks (`processPuppet`, `processCrea`, `tickMalg`) and Hyperreal's `tpFrame`, then renders (`hrRender` when Hyperreal is
live). The order of that line is load-bearing. A new per-frame system is appended to it.

## 5. Global-scope conventions

Because everything shares one scope, the codebase runs on conventions instead of imports:

- **Prefixes own names.** Each update declares names only with its own prefixes: `tp*`,
  `hr*`, `HR*`, `TP*` (texture packs), `mp*`, `pi*`, `pm*`, `pg*`, `PG*` and friends (purgatory), `cr*`/`CR*`
  (creativity), `mg*`/`MG*` (Malgorath). The update statics enforce this.
- **Contracts.** Each update has a contract file (`t0_contract.js`, `p0_contract.js`, `c0_contract.js`,
  `m0_contract.js`) that declares its ids, saved state, registry and export object, and states its load rules at the top.
  Contracts are "frozen": additive changes only.
- **Registries instead of scattered hooks.** The core calls a small number of dispatcher functions per update, and the
  update's packages register into a registry: `PREG` (purgatory: brain, mesh, hurt, loot, tick, onBreak, onDeath...),
  `CRREG` (creativity: ui, thumb, mesh, tile, tick, onBE, onLoad...), `MGREG` (Malgorath: stamp, layoutAt, world, fight,
  music, rig, mesh, fx), `tpRegister` + `TP.mods` (texture-pack modules), `HR.MODELS` (cast models).
- **Export objects for tests.** `TPEX`, `PGEX`, `CREX`, `MGEX` are spread into `window.__vox` (and the node export) in
  `src/boot/export_boot.js`, before the core names, so core keys win a clash. Everything a test needs goes there.
  (`TPEX`, not `TPX`: `TPX` is the atlas tile size, 16.)
- **`typeof` guards** (about 380 of them) protect references to names that load later or might be absent.
- **Wrapped functions.** Some functions are re-bound by later code that wraps the previous binding: `playS` (a dozen
  wrappers, purgatory's is outermost), `musicTick` (creativity, purgatory, Malgorath), `damagePlayer` and `hurtMob`
  (purgatory), and at runtime `cutCam`/`updateSky` (Malgorath) and two purgatory door functions. Calling the bare name
  always gets the whole chain.
- **Hook globals declared first.** `HIT_HOW`, `EXPL_BY` and `TP` are declared on lines 19-20 of the prologue so any hook
  can read them at any time.
- **Load-time purity.** No THREE constructors, `Math.random`, `Date.now`, `performance.now` or `fetch` at the top level
  of an update or on an OG per-frame path: the node stubs lack them, and the deterministic suites (og_trace)
  would drift.
- **Global facades the browser relies on**: `window.__vox` (tests and QA rigs), `window.storage` (saves),
  `window.HR` (models), `THREE`. QA rigs also set bare globals such as
  `soundOn` and `AC` through the devtools protocol.

## 6. How each update hooks in

All five updates were originally applied by text-substitution "hooks" at build time. Those hooks are now **folded in**:
the core files simply contain the calls, and the update files contain everything else. When you change an update, the
places it touches in the core are ordinary code you can grep for.

### Chat, the player list and shared helpers (PART 53, `src/ui/p53_chat.js`)

PART 53 was the AI Players update (v5.9): three bots with their own brains, run by a local server. Multiplayer (v6.10)
brought real players and the bots were removed, with their brain server, their suites and their hooks. What the rest of
the game had come to rely on stayed, in one file: the chat box and its log (`CHAT`, `chatPush`, `sysMsg`,
`chatSubmit`), the Tab player list (`renderTab`), the Player Compass (item 284, which now tracks the other players on a
server), the nine biome flowers (block ids 140-148: worldgen places them), positional sound (`playSAt`), mob display
names (`MOB_NAME`), the mob spawner's `mobAnchor` / `mobFarFromAll` / `mobClearOfPlayers`, and damage attribution:
`HIT_BY`, `ACTOR`, `HIT_HOW`, `EXPL_BY` and `LASTDMG` (a new object for every hurt).

Old saves still carry a `bots` table and four `bot*` game rules; `applySave` ignores the first and deletes the rest.
Purgatory's headliner code still has branches for "the target is a bot body" (`t.bot`, `a.pgrab`): nothing sets those
any more, so they never run.

### Texture packs (PART 54, `src/texpacks/`)

Settings → Texture pack **OG | Hyperreal**, with quality Auto/Low/Medium/High/Ultra (saved as `tp`/`tq` in
`vox_settings`). `t0_contract` defines `TP`, `setPack`/`setQuality` and the module protocol (`tpRegister({name, order,
supported, prepare, enable, disable, setQuality, frame})`). Three modules: `world` (`tA_*`: the art as two texture arrays,
the chunk shader, material swap, cube drops), `light` (`tB_*`: sun and moon shadows, torch and lava lights, sky, presets
per dimension, the bloom/SSAO/tone-mapping chain), `ents` (`tC_*`: the cast models for eight mobs, Dan, the fist and
and corpses). The art comes from `hrAssets()` (the `art/` files, 6.62; `hrassets.js` in the suites).

In the core, every hook is guarded (`TP.hr`, `HRW.on`, `HRL.on`, `HRE.on`, `e.hrM`...) and its OG branch is the original
code, character for character: mesher (`tpEmit`), drops (`tpCubeDrop`), mob meshes and ticks (`hrMobMesh`, `hrMobTick`,
corpses), the hand (`hrFistAttach`), third person (`hrPlayerModel`), sky and torches (`hrSky`, `hrTorches`), shadows,
and the renderer (`tpFrame`, `hrRender`, `hrResize`). **OG must stay identical**: the og_trace suite plays a scripted
session and compares digests with a golden recording ([TESTING.md](TESTING.md)). `tB_light.js` also carries three small
Malgorath hunks (`hrMgGrade`, `hrMgSun`, a light mirror).

### Puppet Purgatory (PART 55, `src/purgatory/`)

A Stage Door appears in the overworld; inside is a whole dimension with its own blocks, items, crafting, mobs, NPCs,
three headliner bosses and an exit. All state is one saved object `MP` (plus `ENT_STASH`), written only once it differs
from `mpDefault()`. Every purgatory timer runs on `MP.clock`, never on wall time. Purgatory mobs (`pmob:1`) are never
saved. Packages: P0 contract, entry and guide; P1 world, rules and audio; P2 items, crafting, gear and tiles; P3 mobs and
NPCs; P4 the headliners and the Strike.

In the core: block break and place (`mpOnBreak`, `mpOnPlace`, `mpPlaceOK`), death and respawn (`mpOnDeath`,
`mpRespawn`), mobs (`mpBrain`, `mpMobMesh`, `mpPreHurt`, `mpOnKill`, `mpAmbient`), physics tweaks (`piSpeed`, `piLand`,
`piVertical`), crafting (`piBuildRecipeList`, `piRecipeSet`, `piTake`), sky and lights (`mpSky`, `mpLightsNear`), saves
(`mpSaveFields`, `mpLoad`, `mpReset`, `mpSnapMob`), the compass (`mpCmpDoor`, `mpCmpTuned`), boss loot, and the
`PREG` registry. Purgatory's Hyperreal cast is `texpacks/models/pg_*.js` (loaded by `hrLoadPModels()`).

### The Creativity Update (PART 56, `src/creativity/`)

Easels (paintings), record players (songs) and jukeboxes. Every painting and disc is unique: its item id is dynamic
(`10000+n`) and its data lives in the work registry `CRW`, saved as `save.cr`, never in a stack field. Packages: c0
contract (ids, registry, block entities, the editor shell, saves, `CREX`), C1 paintings (`c1_art`, `c1_mesh`, `c1_ui`),
C2 music (`c2_song`, `c2_synth`, `c2_juke`, `c2_ui`), C3 found works (`c3_found`, game 6.7). Songs are rendered by a
pure-JS synth, deterministic and seeded. Nothing runs per frame until the first creativity block entity or editor exists.

Found works (`c3_found.js`): Dan's own paintings and discs (`CR_FOUND`, md5-pinned data, credited `CRFC.BY`, "Dan
Dingle") turn up as rare loot. `lootFill` (`features/p16_xp_enchanting_dungeon.js`) calls `crFoundRoll(be,x,y,z)` last
for every chest it fills; the roll is a hash of the world seed and the chest cell (1 in `CRFC.RATE` = 40), never
`Math.random`, and never in purgatory. A find mints a fresh 1/1 work through the registry (`crNew` + `crFinish`), so it
hangs, plays and saves like any other. The player's chosen name never replaces that credit (`pnText` skips "Dan Dingle").

In the core: atlas tiles (`crTiles`), meshing (`crMesh`), right-click and placement (`crInteract`, `crUseHeld`,
`crOnPlace`), keyboard (`crKey`, `crOn` in `modalOpen`), drops that never despawn (`crKeepDrop`), death scatter
(`crScatter`, `crOrphan`), saves (`crSaveFields`, `crLoad`, `crReset`), and the `CRREG` registry.

Replays and screenshots (`features/replay.js`, game 6.9, bundled right after `part50.js`): `recFrame` runs
once per rendered frame (p07h, right after the render), copies the canvas into a 2D canvas at up to 720p and feeds
WebCodecs (`VideoEncoder`, H.264, a key frame a second), keeping the last 30 s (`RP.ch`). The sound is tapped after the
volume buses (`AC.__sfx`, `AC.__mus`) by an AudioWorklet loaded from a `data:` URL (a `file://` page cannot load one from
`blob:`), laid down gaplessly by sample index (`rpPcm`). F8 (`rpSave`) encodes the audio (AAC) and packs an MP4 with the
built-in muxer `rpMux`; F2 (`rpShotNow`) saves a PNG. Settings `s_replay`, the one-time intro `#rpintro`
(`html/dom/replay.html`, `rpIntro`), storage key `vox_replay`.

### The Malgorath Update (PART 57, `src/malgorath/`, plus `src/malgorath/hr/`)

The boss at X 1000, Z 1000, rebuilt: the Bite (a 77 m hole in the world), a three-round fight, scenes, loot. State is one
object `MALG` saved as `save.mg` (only when it differs from `mgDefault()`); the fight itself (`MG2`) is rebuilt from the
checkpoint `MALG.round`. Packages: m0 contract (`MALG`, `MGREG`, the telegraph channel `mgDraw`, saves, migration), M1
the Bite (layouts, a 250-cells-per-frame write queue, the summon), M2 the fight (rounds, waves, scenes, loot, HUD,
audio), M3 the OG model and effects, M4 Hyperreal (the `hr/` block: grading, the skinned model, effects).

In the core: world stamping (`mgStampChunk`), protection of his site (`MGP_ON`, `mgProtected`, `mgProtect`,
`mgNoSpawn`, `mgNoPortal`, `mgNoStruct`), mobs (`makeMobMesh` routes `'demon'` and every `T.mg` type to `mgMobMesh`,
`updateMob` to `mgBrain`, `hurtMob` to `mgPreHurt`, which always returns -1), player hooks (`mgUse`, `mgEggUse`,
`mgPlaceOK`, `mgSteal`, `mgSwingMiss`, `mgOnDie`, `mgOnRespawn`), saves (`mgSaveFields`, `mgLoad`, `mgLoadDemon`,
`mgReset`, `mgEditsSave`), the boot (`mgBoot`) and a handful of gadget and weapon guards.

### Multiplayer (PART 58, `src/net/`, plus `server/`)

| file | what |
|---|---|
| `n0_contract.js` | the protocol number, the `NET` state object (every field explained), `NTEX`, the map of hooks and messages |
| `n1_link.js` | the connection: `ntConnect`, `ntDown`, `ntLeave`, every incoming message (`ntMsg`), entering the world (`ntEnter`) |
| `n2_world.js` | block edits (`ntEdit`, `ntFlush`, `ntApplyEdit`) and block entities (`ntBeScan`, `ntApplyBE`) |
| `n3_drops.js` | dropped items |
| `n4_self.js` | this player: `ntSave`, the pose, chat, death, and `ntFrame` (the per-frame tick) |
| `n5_players.js` | the other players: bodies and name tags, the Tab list rows, melee (`ntMelee`) |
| `n6_menu.js` | the Multiplayer screen on the title; since 6.49 the login box (asked for by `login`), the remembered logins (`vox_mpl`) and the account box in Settings |
| `n7_mobs.js` | shared mobs (owner and puppet, the hand-over), explosions that reach other players |

Eight small files on the client, and on the server a dependency-free Node program: `server/dinglecraft-server.mjs` is the
front door (and what tests import), `Start Server.bat` starts it on Windows, and the code is in `server/lib/`:

| module | what | depends on |
|---|---|---|
| `config.mjs` | settings, limits, key regexes, the game rules (`RULES`), the command line, `findGame` | nothing |
| `world.mjs` | the world as data: new, load, apply the settings file, atomic save, validators (`cleanStack`, `num`) | config, region |
| `region.mjs` | (6.60) the packed region (`.dcr`) and entity (`.dce`) files: `encodeRegion`/`encodeEntities`, `decodeFile` (every form: packed, JSON, the Brotli of 6.53 to 6.59), `docText` (the JSON a person reads), `describeDoc`, `searchWorld`; the names of the ids from `names.json` (`npm run names`). The server window imports it from a server version | nothing |
| `files.mjs` | (6.60) `view`, `unpack`, `pack`, `files`, `find` on the command line (`node dinglecraft-server.mjs find diamond`) | config, region |
| `websocket.mjs` | the WebSocket wire format (handshake, frames) | nothing; knows nothing about the game |
| `protocol.mjs` | what every game message means (`handleMessage`), the join sequence, the checks (reach, rights, chest locks), the once-a-second `worldTick` | config, world, commands; knows nothing about sockets |
| `commands.mjs` | the slash commands, for operators in the game and for the server window (`runCommand`), `isOp`, spawn protection's radius; since 6.49 the accounts (`passOK`, `accountOf`, `locksOf`, `renameAccount`, `setSkin`, which `protocol.mjs` uses for logins) | config, world; knows nothing about sockets |
| `http.mjs` | the game page at `/` and `/status` | config |
| `server.mjs` | `createServer`: state, sending, connections, clocks | all of the above |
| `cli.mjs` | the program: `server.json`, the banner, console commands; hands `view`/`unpack`/`pack`/`files`/`find` to `files.mjs` | config, server, files |

Its own [README](../server/README.md) covers running it. They speak JSON text frames over one WebSocket
(`NT_PROTO` in the game, `PROTO` in the server; `n_static` checks they match).

**The server is a keeper, not a simulator.** It never runs the game. It holds one world in the save format
(`{seed, mode, time, gr, edits, be, ...}` plus a `players` table keyed by lower-case name), so `--world` accepts a file
exported from the pause menu, and it relays the rest. On join it sends `welcome` (world meta, your saved player or null,
who is online), `perm` (your rights, the world spawn), the edits of the chunks around you in batches, the block entities,
the dropped items, then `ready`; the client builds a save-shaped object and calls `applySave`, so joining is literally
loading a save.

**It has no terrain, so it checks what it can without one.** It cannot tell whether a block was really there, but it does
check: who may change the time and the rules (operators, or anyone with Cheats on), that a PvP hit came from within reach
and outside the cooldown, that a player is standing by the item they pick up, that only the holder of a chest's lock
writes to it, that an edit is not inside the protected spawn square, and it words every death message itself. Everything
else is still each player's own game being honest.

**Interest.** Each connection has the set of chunk keys it has been sent (`c.sent`). A pose that crosses into a new chunk
makes `syncAround` send the edits of every chunk newly within `rd` chunks (the client's draw distance + 3) as
`{t:'edits', s:1}`; the client applies an `s:1` edit in a loaded chunk straight into the block array (`ntApplyEdit`'s
`raw`), so old news never makes sand fall or water flow. Live edits go only to connections that have the chunk. Poses go
at full rate to players within 128 blocks in the same dimension, and once a second (and on a change of dimension) to
everyone else, which is what the Tab list needs. Chests and dropped items travel the same way since 6.11: `syncAround`
sends the ones in each newly visible chunk as `bes` / `drops` with `add:1`, the set of sent chunks is trimmed as the
player travels, and a `be` about a chunk the player has not been sent is ignored.

**The line (6.11).** Messages are compressed per message by the standard WebSocket extension (`permessage-deflate`,
negotiated in `lib/websocket.mjs`, no context kept on either side). Every message type has a per-second limit (`RATE`
in `lib/config.mjs`, or its own counter in `lib/protocol.mjs`) and all of them together another (`msgsPerSec`): a new
message type needs a `RATE` entry. The game pings every 2 s (`ntPing`: the round trip is the ping in the Tab list) and
closes a line that has been silent for 12 s; the server gives a silent player up after 20 s. A line that was lost, not
refused, is retried from the title (`ntRetry`: 5 tries, 1 to 8 s apart). When a connection ends, `forget` moves the
player's saved place to their last pose (same dimension only) and names the nearest other player heir to their mobs
(`mheir` -> `ntMobAdopt`). TLS (`cert`, `key`) and an `origins` list are optional server settings.

| shared (server-owned) | how |
|---|---|
| block edits, all dimensions | `setBlock` queues `[ckey, "lx,y,lz", id]`; `ntFlush` sends about 15 times a second; `ntApplyEdit` applies a received edit through `setBlock` under `NET.ap` (so it is not sent back), or straight into `chunkEdits` when the chunk is not loaded |
| chests, furnaces, terrariums, displays | `ntBeScan` once a second compares each block entity with its last sent signature (`ntBeSig`: a furnace's timers are left out, each client ticks its own copy); `ntApplyBE` updates the object in place so an open window keeps working |
| dropped items | every drop made while connected gets an id (`ntDropSpawned`, the tail of `spawnDrop`) and is sent once with its velocity; `NET.drops` is the client's copy of the server's table, in every dimension. A drop has a body (an ordinary `'drop'` entity tagged `e.nid`) only while its chunk is loaded here (`ntDropsScan`, once a second and on a dimension change); each client runs the physics of its own copy. Pickup is asked of the server (`ntDropTake` -> `take` -> `took` for one player, `undrop` for the rest), so nothing is duplicated. Drops spawned while a remote edit is being applied (`NET.ap`) are suppressed, networked drops never go into `ENT_STASH`, and drops do not merge online |
| time of day, game rules | the server's clock is sent every 5 s; a local jump (the debug menu) is sent up and `GR` is polled once a second, and the server takes either only from an operator or with Cheats on, otherwise it sends its own value back. A bed sends `sleep`: a vote that lasts 30 s, counted against `sleepPercent` |
| chest locks | `openModal` asks first (`ntBeAsk` sends `open`); the server answers with the latest contents and `lock`; `ntLockTick` sends the contents and `close` the frame the window shuts. A holder who left or walked 12 blocks away has let go |
| ordinary mobs (`NT_MOBS`) | one owner each: the nearest player's game runs the mob (so its brain, which only knows the local player, chases the nearest player) and sends `mobs` 8 times a second; everyone else has a puppet (`e.pup`: `ntMobPup` instead of `updateMob`, and `hurtMob` forwards the hit as `mhit`). Twice a second an owner hands a mob to a clearly nearer player (`mgive`), or to anyone in range while its own game is paused. A puppet silent for 3 s is removed. Never saved |
| explosions, arrows, bullets | `explode` tells the players nearby (`boom`: the bang and the damage; the holes are ordinary edits); the player's own arrows and bullets test other players (`ntShot`) and send a `hit` |
| flowing water | `tickFlow` asks `ntSimHere`: of the players within 48 blocks of a cell, the lowest id flows it, and the result reaches the others as edits |
| rights and commands | `perm` carries op, the protected radius and the world spawn; `doMine` and `doUse` ask `ntGuard`; a chat line starting with `/` goes to the server as `cmd`; the server answers with `sys`, or `tp` / `give` / `mode` to the player concerned |
| players | a pose 15 times a second (position, look, dimension, held item, health, flags; flag 32 = this game is paused); peers are drawn by `ntPeerMesh` and eased in `ntPeersTick`. Each has their own game mode (`gm` in the players table, over the world's default) |
| each player's own state | `saveToStorage` is redirected to `ntSave` (the `player` part of a snapshot, the dimension, the purgatory state): the autosave, Save World and quitting all go to the server, and a server world never touches local storage |
| chat, PvP | `chatSubmit` to `ntChat`; `doMine` asks `ntMelee` whether another player is the nearest thing on the look ray |

**The server's own game (6.13).** `server/lib/host.mjs` cuts the game script out of the html it serves, loads it in a
worker thread behind a hollow browser (`headless.cjs`, the same stand-ins the suites boot with) and calls
`ntHostStart` (`src/net/n8_host.js`). That game is "the host": a player with id 0 whose socket is a function call. It
owns every shared mob in the Overworld, never hands one over, and is sent `join`, `leave`, `pose`, `edits`, `be`,
`drop`, `undrop`, `time`, `gr` and the `mgive` / `mhit` addressed to player 0. Each tick (20 a second, `ntHostTick`):
chunks are built 5 around every player (blocks only, no meshes), `mobsTick` runs for one player in turn with `P`
pointed at them, `updateEntities` runs with `P` pointed at the nearest player per entity (`ntHostAim`; nobody within
72 blocks or no chunk: the entity waits), and mobs go out as `mobs` from 0, which the server passes to each player
with only the ones in range. Damage a brain does to `P` is forwarded as `hurt`, collected XP as `xp`. Every 5 s the
host reports all its mobs (`hsnap`), which is what `entities/` saves and `ntHostRestore` puts back. A player's game
on a hosted server hands every shared mob it spawns to the host (`ntMobFull` carries name, spawn spot and velocity) and
skips natural spawning. Not hosted yet: other dimensions, projectiles, vehicles, water, fire, falling blocks.

**What flies and what you ride (6.14, `src/net/n9_ents.js`).** A projectile (`NT_FX`: arrow, bullet, grenade, lit TNT,
boss rock and fireball, plane bomb, XP orb) stays in the game that made it. `ntFxTick` scans the entity list every
frame, gives each new one an id and announces it (`fx`: kind, position, velocity, gravity, lifetime), and reports it
gone (`fxgone`). Receivers build a copy flagged `e.pup` (the real constructor for arrows, bullets and TNT, a plain box
for the rest) that `ntFxPup` flies with the same gravity and that touches nothing. Vehicles (`NT_VEH`), only where
`ntHosted()`: the host owns every vehicle nobody rides and streams the parked ones (`vehs` from 0); a player's game
hands over a vehicle it creates (`vgive`), claims the one its player mounts (`vtake`, optimistic; the server keeps
`S.vown` id -> rider and answers `vno` to a second claimant), reports it while riding (`vehs`) and gives it back on
dismount. `hitCar` on a puppet forwards the hit (`vhit`) to whoever runs it. One hook serves both kinds: in
`updateEntities`, `e.pup && e.t !== 'mob'` goes to `ntEntPup`. The dimension stash skips anything with `e.pup` or `e.vid`.

**The world the server runs (6.15).** In a hosted Overworld the host is the only game that flows water (`ntSimHere`
is true on the host, false on a hosted player's game), drops gravity blocks (`checkFalling` returns at once on a hosted
player's game; the host's `fall` entity is announced as an `fx` of kind `fall` with its block id) and burns
(`igniteAt` -> `ntIgnite`: a player's game sends the cell as `ign`, the host lights it and announces `fire`; players
keep the flames for show and for the sting, and `updateFires` burns nothing there). The host applies a player's edit
under `NET.apd`, not `NET.ap`: drops are still held back (the editing game makes them), but the writes that follow from
the edit are queued and sent, and only the echo of the edited cell is removed. Furnaces: `furnaceTick` asks
`ntNoTick`, so a player's game cooks only the furnace it has open and the host cooks the rest and reports the burning
ones every 2 s (`ntHostBeScan`); the server refuses the host's write while a player holds the lock and sends it the
holder's copy. Chests: a `be` that would rewrite an existing chest is refused unless the sender holds its lock.

**What the world remembers (6.16, `src/net/na_data.js`).** The save's world-level lists (`NT_WD`: the structure SEEN
sets, `infkill`, `valkill`, `spw`, `nukes`) are the server's. Every game, the host included, diffs its own copy against
the last agreed one once a second and sends additions (`wd`; removals only for `spw`); the server unions them into the
world, stores them under `data/` and passes them on, and `ntWdIn` writes them into the game's own sets. Joining players
get them inside `welcome.world`, which `applySave` already reads. The host runs the spawners (`tickSpawners` returns
on a hosted player's game) and the stock market (`updateStocks` returns where `NET.hosted`; the host sends `mkt` every
2 s; since 6.64 every price carries a +2% a game day trend, `MKT_TREND`, with swings scaled by `MKT_CALM` = 0.1, so a
spread portfolio ends most game days up; `tests/core2/k27_market.js`). Four save fields are the player's and ride in `save`: `snl`,
`mg`, `demon`, `cr`.

**One host per dimension (6.17).** A game holds one dimension (`DIM`, the chunk keys, the entity list), so the server
runs one worker per hosted dimension: `S.hosts` maps `over` / `nether` / `aether` to a host, each started by
`S.startHost(dim)` (the Overworld's at start, the others from the `pose` handler when a player first shows up there,
and again if one has stopped). A late host is sent `join` and `pose` for everyone already online. `welcome` carries
`hdims`, and `ntHosted()` is "is my dimension in it". Messages to player 0 go to the host of the sender's dimension
(`peerOf`); what a host sends is scoped to `c.hdim`. Every host receives all `edits`, `be`, `drop`, `time`, `gr` and
`wd`. Only the Overworld's host (`primary`, `NET.hprim`) cooks furnaces and runs the market. `hsnap` replaces only the
sender's dimension in `world.mobs` / `world.vehicles`, which carry `d` outside the Overworld and are written to
`entities/<dimension>/`. On a dimension change the client sends its pose first, so everything after it is routed to the
new dimension's host.

**Liquids with levels (6.25, `src/features/p18_armor_boats_water_qol.js`).** Water and lava carry a level in the chunk's
meta byte (0 a source, 1 to 7 flowing, 8 falling). Nothing ticks until a block changes: `setBlock` calls `liqWake`, which
puts the liquid cells at and around the change in `LIQ.w` / `LIQ.l`; `tickFlow` runs `liqStep` on each list at its own
interval (`liqRule`: water 0.25 s, lava 1.5 s, Nether lava 0.5 s), at most 600 cells a tick. `liqCell` first recomputes
a flowing cell from its neighbours (so a stream with no source dries up; two water sources make a third), then moves it:
down first, sideways toward the nearest drop (`liqDirs`), hardening lava where it meets water (`lavaWaterCheck`,
`liqHarden`) and washing out torches, flowers and grass (`liqCanEnter`, `liqPut`). The mesher draws a liquid with
`addLiquid`: corner heights averaged over the four cells sharing the corner (6.67: only when a face shows; and `meshChunk` skips a block buried inside its chunk, opaque on six sides or water among water and opaque blocks, before asking about faces; `tests/core2/k30_meshbury.js` pins the output to 6.66). A new block that draws something even when fully enclosed must be one of the special shapes above that test (`d.cross`, `d.rail`, ...) or lava. `liqTop` and `liqFlow` feed the swim checks
and the push on the player, mobs and drops. On a hosted dimension only the host runs it (`ntSimHere`, unchanged).

**Block light (6.26, `src/world/p03e_light.js`).** Each chunk has a light map `ch.lt` (0 to 15 a cell): emitters from
`lightEmit` (torches and `light:true` blocks 14, lava and glowstone 15), spreading through non-opaque cells losing 1 a
block. `lightChunk` (from `createChunk`) floods a new chunk from its own emitters and its neighbours' edges;
the floods find a cell's chunk through `lightCh`, which remembers the last two (6.65; `tests/core2/k28_lightmem.js`);
`lightEdit` (from `setBlock`) un-floods what a changed cell gave and re-floods from what is left (`LGT.rq`, `LGT.q`), at
most `LGT.cap` cells a call, the rest in `lightTick` (from `updateChunks`). `bufLight` runs over a finished mesh
buffer and writes `b.l`: for each vertex, the average light of the non-opaque cells meeting at it on the face's open
side, skipping everything above `ch.ltTop`. `applyMesh` uploads it as `blight`; `blightObc` patches the three OG
materials to add `diffuseColor * blight^1.6 * uBlCol` before fog, and `hrWPatch` adds the same to the Hyperreal
emissive term. `uBlCol` is the warm colour times `1 - 0.75 * daylight`, set every frame, so the hour changes nothing
in the meshes. Since 6.44 the light map is also what "dark" means to the spawner (`spawnDark`, `src/entities/p05e_spawning_tick.js`:
block light 0 and not daylit, `skyLit` being a short flood to open sky), so the server's own game keeps the map as well (no meshes,
no uniforms). The OG pool of six point lights (`TLIGHTS`) stays allocated but is lit only in Puppet Purgatory. Mobs get
an emissive tint from the cell they stand in. Not on the host; not in saves; not on the wire. A chunk whose light changed
because a neighbour was built is marked `dirty=2`, not `true`: `updateChunks` builds every missing chunk before it redraws
those (without that, lava country loads a fifth slower and the frozen Nether smoke fails).

**Shared since 6.11:** villagers, Nuke Kegs and the bosses that are plain mobs (`boss`, `titan`, `infernis`,
`valkyra`), through the same owner/puppet path. A boss is not handed over while its owner is within 40 blocks. The kinds a
structure spawns (`NT_UNIQ`) carry their spawn spot, and two of a kind from one spot are one mob (`ntMobTwin`), so a
village is populated once, not once per client. A pose also carries armour (`ar`) and the vehicle being ridden
(`rv`, `ry`, `rh`), drawn by `ntPeerArmor` and `ntPeerRide`; an edit made by the player's own hand is marked (`ntGuard`
sets `NET.act`, `ntEdit` spends it) so other clients play its sound and dust.

**Not shared:** parked vehicles, dragons, snakes, blocklings, a boss's projectiles, the Purgatory and Malgorath casts, the
XP orbs, the stock market and the structure SEEN sets (so a dead boss returns for a player who was not there). Each client simulates
those itself. Fire, falling blocks and structure processing also still run on every client: their block writes travel as
ordinary edits and converge on the last writer. Since 6.69 the buried dungeons and spawner vaults are the exception on a
dimension the server runs: a player's game empties `WDPEND`/`LSPEND` unprocessed, and the server's game runs `processWD`
and `processCells` in `ntHostTick`, so it marks them seen, fills their chests (`lootFill` sends each one) and spawns
their mobs and boss itself (`n_host` section 17). Creativity works (6.73) are the world's: the server keeps the
registry (`crw`, `data/works.json`; `grantWorks` hands each game three numbers ahead of need, `takeWork` checks every
change: owner, size, a finished work never changes, the author's name signed by the server), the `crNew` hook takes a
handed number (`ntCrTake`), `ntCrWork` listens on `CRREG.onWork` and sends changes (edits once a second), `ntCrIn` takes
others'; easels, record players, jukeboxes and paintings are shared block entities (`ntCrApplyBE` waits for the block
before `crIndex`, `ntCrDropBE` removes one broken elsewhere without a second drop). A disaster (6.72) runs in the game of the player who started it;
`ntDisOut` announces it twice a second (`{t:'dis'}`: kind, centre, time, its tornado) and the players within 160 blocks
watch it (`DIS.remote`, `ntDisIn`, `ntDisWatch`): timer and wind, a twister copy (`e.remote`) that follows and pulls but
shreds nothing, and `lavab` copies that burn (`n_disaster`). 6.71 does the same for the Nether fortresses and Aether shrines
(`processNether`/`processAether`, run by the Nether's and Aether's server games once a second for each player there):
one boss for everyone, shared, saved with its fortress (`ci`), and their chests (`n_host` section 18).

In the core: `setBlock` (`ntEdit`), `saveToStorage` (`ntSave`), `quitToTitle` (`ntLeave`), the frame (`ntFrame`, which
also runs while paused), `doMine` (`ntMelee`), `die` (`ntDied`), `chatSubmit` (`ntChat`), `renderTab` (`ntTabRows`),
`spawnDrop` (`ntDropSpawned`), `updateDrop` (`ntDropTake`, plus `!NET.on` on the merge), `chatSubmit` again (`ntCmd`),
`doSleep` (`ntSleep`), `openModal` (`ntBeAsk`), `doMine` and `doUse` (`ntGuard`), `updateEntities` (`ntMobPup`),
`hurtMob` (`ntMobHit`), `explode` (`ntBoom`), `updateArrow` and `updateBullet` (`ntShot`), `tickFlow` (`ntSimHere`),
`stashEnts` (`!e.nid`, and puppets are dropped), the title (`#tmp`, `tmEls`) and `NTEX` in the exports. Every one is
behind `NET.on`, or behind `e.pup` / `e.nid`, which only PART 58 sets. `n_static` counts them: 21 calls.

**The next steps.** The special casts (bosses, dragons, villagers, vehicles) each need their own state on the wire before
they can be puppets: `mpSnapMob` and the save code's entity records are the starting shapes. A mob whose owner drops off
the server is lost after 3 s; the server could reassign it instead. Mobs are not saved with the server's world. The
server still trusts each game about its own inventory and movement: moving the inventory to the server (slot-level
chest moves instead of the lock) is the change that would let it run for strangers.

## 7. ID ledger

An id collision once silently broke a gun for two versions. **Grep before you allocate**, and record new ids here.

- **Blocks:** GRASS 1, DIRT 2, STONE 3, GLASS 16, COAL_ORE 17, IRON_ORE 18, GOLD_ORE 19, DIA_ORE 20, BEDROCK 21,
  WATER 22, TORCH 33, ICE 38, doors 43+, LAVA 59, RAMP 60-63, PC 64, ALIENM 65, ALIENL 66, CASINO 67, RAIL 68,
  RAILUP 69-72, SBRICK 73, SPAWNER_Z 74, SPAWNER_S 75, ENCH 76, BED 77, TCORE 78, TERM 79, NETHROCK 80, SOULSAND 81,
  GLOWSTONE 82, NBRICK 83, OBSIDIAN 84, PORTAL_N 85, CLOUDSTONE 86, SKYGRASS 87, AMBRO 88, ABRICK 89, PORTAL_A 90,
  TRAMP 91, SHELF 92, JAR 93, LAWN 94, CINEMA 95, SCREEN 96. There is no `B.GOLD` block: gold is the item `IT.GOLD`
  and the ore.
- **Items:** tools `toolId(m,t)=120+m*4+t` (m: 0 wood ... 3 diamond, 4 golden; t: pick, axe, shovel, sword); DIAMOND 104,
  GUNPOWDER 107; BULLET 190, SHELL 191, GRENADE 192, WHEEL 193, CAR 194, Critter Jars 195/196 (`ball:true`), DOOR 197, SKATE 198, DSPH 199;
  **guns 200-219 reserved** (`gunId=200+m*4+t`); VEGG 220, CART 221, DEGG 222, BOAT 223, DSCALE 224, CRYSTAL 225,
  COMPASS 226, SUBBTN 227, BUCKET 228, BUCKET_W 229; armour 230-245 (`armorId(m,s)=230+m*4+s`); BUCKET_L 246; spawn
  eggs 250-264 (`EGG_BASE` + index in `EGG_MOBS`); gadgets 265-274; ROD 275, ROD_R 276, FISH 277, FISH_C 278,
  FIGURINE 279, POPCORN 280, M8BALL 281 (the Fortune Orb).
- **Farming (6.39, `src/features/p53e_farming.js`):** blocks FARMLAND 217, WHEAT 218, CARROTS 219, HEMLOCK 248; items hoes
  366-370 (`IT.HOE + m`), WCAN 371, SEEDS 372, WHEAT 373, BREAD 374, CARROT 375, HROOT 376. Its tiles and recipes are
  registered at boot (`farmTiles`, from `buildAtlas` after `crTiles`) so no older tile or recipe moves. State is in
  the meta byte: farmland 8 = watered, 0-7 = harvests left; a crop 0-7 = stages still to grow (0 is ripe, so a generated
  wild plant is ripe). `farmNote` (from `setBlock`) keeps the list of growing crops; `farmTick` (from `tickFlow`) grows
  them where `ntSimHere`. A block whose look depends on meta gives `topM` or `crossM` in its def. The only free block
  id left is 249.
  6.63: a ripe harvest is wheat 1 + 1-3 seeds, carrots 2-3, hemlock 2-3 (`cropYield`); a hoe has its own enchantment
  class (`enchClassOf` -> 'hoe': Unbreaking, Fortune), and Fortune on the hoe that breaks a ripe crop multiplies every stack by
  1 + level/3.
- **Chest labels (6.63, `src/features/p53i_chest_labels.js`):** `be.lbl` on a chest is an item id, never an item (not in
  `be.inv`, never dropped). The chest window's slot `#mlabel` (beside `#mclose`, the X's size, its own click handler, not
  `mkSlot`) sets it from the cursor without taking the item, or clears it. `tickChestLabels` (every 30 frames) keeps four
  pictures (`iconTex`) on the sides of each labelled chest within 48 blocks in `CHLM`. Saved and shared with the chest.
- **Puppet Purgatory** (assigned only in `purgatory/p0_contract.js`, symbolic names `B.PG_*` / `IT.PG_*`): blocks 149-189,
  99, 117-119, 247 (never 212-219; 248 and 249 are spare); items 285-308, 310-338, 340-364 (309 and 339 spare). The
  atlas is 32×32 tiles (1024 slots); purgatory tiles are pinned at slots 222-284. Mob types `pg*` (`pmob:1`).
- **The Creativity Update** (assigned only in `creativity/c0_contract.js`): blocks 213 Easel, 214 Record Player,
  215 Jukebox, 216 Hung Painting; 217-219 spare; 212 stays undefined on purpose. No static item ids: every work is a
  dynamic id 10001-19999. Its atlas tiles register at boot, after purgatory's.
- **The Malgorath Update** (assigned only in `malgorath/m0_contract.js`): no new block, no new tile; item 365
  Malgorath's Jaw; mob type `'demon'` kept, plus never-saved `mgeye`, `mgpart`, `mgmorsel`, `mghusk`, `mgbloat`.
- **Next free** (measured on the v6.3 build: blocks and items share one id space, and block ids must stay below 256):
  block ids 217, 218, 219, 248, 249 (212 stays undefined on purpose); item ids 309, 339, then 366 and up. Everything
  else from 1 to 365 is taken, including the 97-148 range the older notes called free.

## 8. Persistence

Anything stateful has to be wired into **three places**, or it silently vanishes:

- **Player fields:** a default in `newPlayer` (the `P={...}` literal), written in `snapshot()`, restored in `applySave`
  with a backward-compatible default.
- **World state** (SEEN sets, `DEMON`, `GR`, `SPW`, ...): written in `snapshot()`, restored in `applySave`, and **reset
  in `resetWorld`** so a new world does not inherit it.
- **Stacks** keep `ench`/`dur` through every copy (inventory, drops, splits, saves): follow the existing
  `...(s.ench?{ench:{...s.ench}}:{})` pattern for any new per-stack field.
- Game rules `GR` are per world (set on Create New World, changed later with the right-click rules editor `tgrOpen` /
  `tgrSave` in `ui/p07g_title.js`); client settings (render distance, texture pack, sound, the FOV, sensitivity and volume
  sliders, the player's name `pn`) are global, in `vox_settings`. `loadSettings` is async: the title waits for its promise
  (`SETTINGS_P`) before it asks for a name or starts the menu music.
- The updates each save **one object, only when it is not the default**: `MP`/`ENT_STASH` (purgatory), `save.cr`
  (creativity, restored by `crLoad` right after `resetWorld()` inside `applySave`), `save.mg` (Malgorath, `mgLoad` then
  `mgLoadDemon`). A world that never used an update saves exactly like the version before it.
- **Old saves must always load.** `applySave` defaults every missing field. Each update's patch notes tell players to keep
  newer worlds on newer versions, because an older build drops fields it does not know when it autosaves.
