# Roadmap

The restructure had four steps. Steps 1 and 2 are done: the project is a git-ready repository, and the game is built
from real per-system source files with a byte-identical result. Steps 3 and 4 are planned here and not
started; the first round of smaller cleanups shipped in Release 1.0.

Every item below changes the game's bytes, so each one starts with a version bump (`npm run bump`) and ends with a green
gate. The suites are the safety net that makes these changes boring.

---

## 0. First post-split cleanups (Release 1.0)

Small things that v6.3's byte freeze would not let us touch. Release 1.0 (game versions 6.4 to 6.9) did them:

- **Done: the in-game "brain is not running" hint** in `src/ai_players/a8_mind.js` and `a9_ui.js` no longer names the
  old project folder, and `tests/repo/r_build.js` no longer allows it.
- **Done: the logo's metadata chunks** (`eXIf`, then `pHYs` and `sRGB`) were stripped from `assets/logo.png`: it now holds
  only `IHDR`, `IDAT` and `IEND`, and the pixels are unchanged.
- **Done: the v5.9 patch note** that wrote `<player>` literally now writes `&lt;player&gt;`.
- **Done: the IP and privacy pass**: the purgatory cast and every other borrowed name or design were replaced, the model
  credits are in [THIRD_PARTY.md](../THIRD_PARTY.md), one privacy edit was made to the jumpscares
  (`src/features/part48.js`), and the brain's media route is gone.
- **Done: the legacy path comments.** Release 1.0 reworded the old path comments in the code, and its repack rewrote the
  packed-asset header lines. The art workspaces are named only by their environment variables (`docs/ASSETS.md`); what
  still mentions the pre-repository layout is the legacy-path mapping in `tools/art/dcpaths.py`, the tests that make sure
  nothing looks it up, and one comment in the frozen `tests/core/smoke.js`.
- **Done: three.js is bundled** (Release 1.0, game 6.7): `assets/vendor/three.r128.min.js` is inlined by the build, the
  game plays offline, and the `t?_real` suites run against it in the gate.
- Optional: make the gate parallel by default once flake rates are measured, and a runtime "texture packs inert" switch if
  a true compiled-out baseline is wanted again for og_trace.

## 1. Lazy external textures (step 3): done in 6.62

**Done (game 6.62).** The page is 5.9 MB; the Hyperreal art is `art/hyperreal-<n>-<hash>.js` beside it, loaded by
`hrArtLoad` the first time Hyperreal is switched on. Script files rather than `.webp` files, so one build works opened
from disk (Chrome refuses `file://` images to WebGL, but not `file://` scripts), from the multiplayer server (`GET /art/`)
and in the desktop client: no second build profile was needed. Not moved: the title panorama (1.9 MB, shown at once in
both packs), `TOOL3D`, `WPN3D` and the logo. The plan as it was:

**Why.** The html is 42.5 MB (game 6.7), of which about 37 MB is the Hyperreal art as base64, and the cap is 45 MB:
there is about 2.5 MB of headroom left. Every page load parses all of it, even in OG, and the art cannot grow.

**Plan.**

- Two build profiles:
  - `single`: today's file, everything embedded, works from `file://`;
  - `web`: the html plus a `textures/` folder of `.webp` files beside it, loaded on demand per pack and quality tier.
- Over `file://`, Chrome refuses to upload images from local files to WebGL, so the `web` profile needs http. Both the
  brain and `npm run serve` already serve the game over http.
- Keep `hrAssets()`/`hrAssetMeta()`/`hrMgAssets()` as the interface, make them able to answer asynchronously, and make
  Hyperreal's enable step wait for its art.
- Move the other big embedded data the same way: the title panorama (about 1.9 MB of WebP faces in `head.html`),
  `TOOL3D` (29 KB), `WPN3D` (220 KB, one line) and the logo.

**Proof.** The og_trace goldens are unchanged (OG never touches the Hyperreal art), the Hyperreal browser QA sheets match,
and the `web` profile gets its own size budget in `scripts/guards.json`.

## 2. ES modules

Today the game is one classic script with about 3,500 shared top-level names (none duplicated). Moving to modules is
worth it for tooling and for contributors, but it has to be done in careful steps:

1. **Lint first, no runtime change.** Add ESLint `no-undef` and `no-redeclare` with a generated list of globals. This
   turns the cross-file dependency map into something enforced.
2. **Replace the rebound functions with hook registries.** Seven functions are wrapped by later code (`playS` a dozen
   times, `musicTick` three times, `damagePlayer`, `hurtMob`, `cutCam`/`updateSky` at runtime, and two purgatory door
   functions). Imports are read-only, so these become explicit registries. About 64 module-level `let`s that other files
   write (`P`, `HIT_BY`, `timeOfDay`, `soundOn`, `DIM`, `SEED`...) move into a shared `state` object or get setters.
3. **Convert one leaf package at a time**, starting with the texture packs or the Creativity Update (fewest inbound core
   references, clean facades), through a bundler (esbuild) that emits **one IIFE inside the single html**. The output must
   still open from `file://`, where ES modules do not load, so a bundler is required for any module step.
4. **Expose a deliberate `window` facade** for the one inline `onclick="closeModal()"` and for the QA rigs that set bare
   globals (`soundOn`, `AC`).

## 3. A newer three.js (step 4)

The game uses three.js r128, bundled from `assets/vendor/`. Upgrading needs step 2 first: recent three releases ship only
as ES modules (the classic `three.min.js` build went away; check the exact release when the time comes).

- Renames to handle: `outputEncoding` → `outputColorSpace`, `physicallyCorrectLights` → its successor,
  `DataTexture2DArray` → `DataArrayTexture`.
- Re-validate the shader-chunk names that Hyperreal patches in `onBeforeCompile`, and the rules for when a light change
  forces a shader recompile.
- Replace `assets/vendor/three.r128.min.js` and its licence file together, and keep the `t?_real` suites green against it.
- **Proof:** the Hyperreal browser QA, plus og_trace re-blessed with a stated reason.

## 4. Multiplayer: the server runs the game

The goal is a server that works the way a Minecraft server does: it runs the world, and a player's game sends what the
player does and draws what it is told. Steps 1 to 5 are released (game 6.13 to 6.17). Step 6 is what is left.

**Done**

| step | version | what the server now does |
|---|---|---|
| storage | 6.12 | the world is a folder of readable JSON: `level.json`, `region/`, `entities/`, `playerdata/` |
| 1 | 6.13 | runs its own headless copy of the game in a worker thread; that game spawns, moves and saves the Overworld's mobs |
| 2 | 6.14 | keeps vehicles; everyone sees what flies (projectiles are announced, not server-owned: see 6c) |
| 3 | 6.15 | runs water, fire, falling blocks and furnaces; loot is rolled once |
| 4 | 6.16 | keeps what the world remembers (found structures, dead bosses, spawners, nukes, one stock market) under `data/` |
| 5 | 6.17 | one game per dimension: Overworld, Nether, Aether. Puppet Purgatory stays per player |

### Step 6a. Accounts (done in 6.49)

The owner chose passwords, made by an operator, over tokens: each server keeps its own accounts (anyone can run one,
with nobody else involved), the password sits in plain text at the top of `playerdata/<name>.json` (the game warns the
player), and the server password is gone. Logins, `/account`, `/setskin`, the three locks (per player and for everyone)
and the server window's Accounts table are in `server/README.md` ("Accounts"); `tests/net/n_accounts.js` covers them.

Left for later, from the old token plan:

- **`usercache.json`** next to `server.json`: name, first seen, last seen, last address.
- **Split `ops.json`, `whitelist.json`, `banned-players.json`** out of `server.json`, as Minecraft has them.

### Step 6b. The server decides inventory and damage

**Read this first (2026-10-14, after 6.55).** This step cannot be shipped one kind of action at a time. A server copy of
an inventory that follows only pickups and drops drifts from the truth after the first crafted item (and then refuses
real drops), and any check against the inventory a game reports in its `save` stops nobody: a modified game simply
reports the item first. Today a modified game can still give itself anything, and drop anything for others (the
server takes any well-formed `drop`). The only real fix is the whole of item 1 and 2 together: the server's own game
works out each inventory from actions it can check, and `save` stops carrying `inv`/`armor`. The owner chose to leave
it for now: with accounts (6.49), nobody can be someone else, which on a server for friends is the main protection.


Today each player's game decides what they hold and what hurts them, and the server stores the result unread. This is
the largest change to how the game feels, because that is why the game responds instantly.

1. **Server-held inventory.** The player's stand-in on the server's game already has an inventory object. Fill it from
   `playerdata` at join and make it the copy of record.
2. **Intentions instead of results**, one kind of action at a time, each with the game predicting the outcome and the
   server correcting it when it disagrees:
   - picking up and dropping items (the server already decides pickup);
   - moving items in chests and furnaces (replaces the chest lock's "trust the holder" rule);
   - crafting and smelting;
   - breaking and placing blocks: reach, the right tool, and the block actually being in the inventory;
   - eating, armour, tool wear.
3. **Damage on the server.** Mob hits, falls, drowning, fire and PvP are applied to the stand-in's health; the game is
   told its health. Needs the stand-in to follow the player's real movement, so do it after 4.
4. **Movement checks.** Speed and teleport limits per pose, with a correction sent back. Creative and vehicles exempt.
5. **Reject and correct.** Any refused action sends the server's copy back (edits, inventory slots, position), so a
   game that disagrees is put right instead of silently diverging. Spawn protection needs this too (a refused edit is
   not sent back today).
6. **The world lists** (`wd`): a structure "found" or a boss "dead" should be checked against the server's own game
   (the player is near it; the boss it ran did die) instead of believed.

Do 1 and 2 first and release them; 3 and 4 as a second release.

### Step 6c. Loose ends from steps 1 to 5

Smaller, independent, any order.

- **Projectiles as server entities.** They are owned by the shooter's game and only announced. Make the server's game
  own them once 6b lets it trust where a player is aiming.
- **Fortress bosses**: done in 6.71. Where the server runs the Nether or Aether, its game runs `processNether` /
  `processAether` once a second for each player there: one Infernis or Valkyra (shared: `ntMobShared` lets a `cellId`
  through on the server's game, saved with `ci`), its guards and its chests for everyone; players' games skip them.
- **Structure chests**: done. 6.69 the buried dungeons and spawner vaults, 6.71 the Nether fortresses and Aether
  shrines: on a dimension the server runs, its game processes them (`ntHostTick`) and players' games do not.
- **Creativity works** are saved per player; a work handed to another player does not show. Needs world-wide numbering.
- **Disasters**: done in 6.72 (the starter's game runs one and announces it, `dis`; the players within 160 blocks watch
  the same one: timer, wind, a tornado copy that pulls them in, lava bombs that burn them; blocks travel as the starter's
  edits). **The Snail** stays each player's own by design: everyone has their own, saved with them (`snl`).
- **A boss fights one player**: done in 6.70. On the server's game a boss goes for whoever hit it last (15 s, `e.aggro`,
  `ntHostAim`), and the Stone Titan's slam hits every player in it (`ntHostArea`). The dungeon boss is spawned once by the
  server's game since 6.69 (the dungeon's seen-mark is its record); a Titan is summoned, so it needs none.
- **Furnace progress**: done in 6.68. The server's game stamps each furnace it sends with the world clock (`ct`) and the
  player's game cooks it on to now with `furnaceCatch` (`ntApplyBE`; a stamp over 4 s old is a stored copy and is ignored).
- **A server game that crashes**: done in 6.55 (the Overworld's restarts after 5 s, at most 3 times in 10 minutes).
- **Idle dimension games**: paused since 6.46, and since 6.55 a paused Nether or Aether game is stopped after
  `stopWhenEmpty` minutes.

### Verification debt

Checked on 2026-10-14 (game 6.53):

- **Every suite**: done. Each of 6.46 to 6.53 ran the whole suite list (`gate.mjs --once --keep-going`); 6.52 and 6.53
  were fully green. The one recurring failure is p1_smoke's chunk-meshing time limit on a loaded machine (the 6.49
  build failed it the same way at that moment).
- **The `n_host.js` flake**: found and fixed. Parallel copies shared `out/net/host_data` and wiped each other's
  world; each run now has its own folder (4 of 4 pass, twice).
- **TLS**: works with a self-signed certificate: https and wss on one port, plain http refused, an account login
  over wss. Not yet tried with a certificate from a real authority.
- **The Aether's server game**: starts with the first player there and spawns its own cherubs. A cherub handed
  over at a made-up spot did not come back: unconfirmed (probably the spot), worth a look.

Still to do:

- a muted two-browser session per `docs/QA.md` (join, log in, mobs, a vehicle, a portal trip, reconnect). The QA
  rigs need Chrome or Chromium, which the owner's Linux machine does not have;
- **the Electron client**: started for the first time on 2026-10-14 (muted, its own profile): loads, asks for a login on
  an accounts server, logs in and plays. It also found the spawn-over-a-ravine bug (fixed in 6.54);
- 14 textures of the removed AI-player models are still packed into the html (about 2 MB): needs a repack from the art
  sources;
- Purgatory and Malgorath still carry unreachable "is this target an AI player" branches.

---

## Open questions for the owner

- The brain falls back to a key exported in the shell when the repo has no `.env` key. Keep that, or go file-only?
  (See [BRAIN.md](BRAIN.md).)
- Whether to publish the minimum source-art set as a release archive, so other people can repack ([ASSETS.md](ASSETS.md)).
