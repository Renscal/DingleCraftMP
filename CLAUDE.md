# CLAUDE.md: working on DINGLECRAFT

You are working on **DINGLECRAFT**, an original fan-made Minecraft-style voxel sandbox that ships as **one HTML file**
(three.js r128, no framework, no game dependencies), with its Hyperreal art in an `art/` folder beside it since 6.62. It has grown feature by feature for a long time under a strict
test-first, surgical-edit discipline. This file hands that discipline to you. Read it fully before touching code, then
read the doc for the area you are working in.

The owner talks casually and loves absurd features (a casino, a microtransaction-store parody, walking Nuke Kegs, a
16-metre demon in a 16 px world, Puppet Purgatory). Match that energy in patch notes. Be rigorous in the code. Keep it
original: no real characters, brands or trademarks in names, art or text (the IP scan in `tests/repo/` enforces the list).
("Dan" in the code and the suites is the engine's name for the local player, e.g. `HIT_BY='Dan'`; it is not the owner.)

---

## 0. Hard rules (never break these)

1. **Testing is always muted.** The owner may be at the machine. In any browser: your own off-screen browser (headless
   Chrome, or where there is no Chrome the client's Electron through `tools/qa/lib/electron.mjs`) with `--mute-audio`, `vx_vox_settings` merged with `{snd:0,mus:0,tp:'og'}` before the page runs (merge, never wipe), and
   `soundOn=false; if(AC)AC.suspend()` after every load. Never turn sound on. Verify audio offline only. Put `tp:'og'`
   back when done. Details: `docs/QA.md`.
2. **Secrets.** Never read, print, copy, create or commit a `.env` file or any key. Secret scans report `path:line` and a
   rule name, never a value.
3. **No paid API calls.** Never run `tools/art/fal.mjs` or any art driver, with any key, real or fake.
4. **Shipped versions are frozen.** If `GAME_VERSION` is in `tests/fixtures/shipped.json`, the build must reproduce it
   byte for byte. Bump first (`npm run bump`) for anything that changes output. Never overwrite a `dist/` html the owner may be
   playing; never modify a shipped html anywhere. "Release 1.0" is a public LABEL (`RELEASE_LABEL`), not a game version:
   Release 1.0 is game versions 6.4 (the preview) to 6.9. Never set `GAME_VERSION` or `package.json` to a label;
   `GAME_VERSION` only goes up ([CONTRIBUTING.md](CONTRIBUTING.md), "Versions and release labels").
5. **The core suites are frozen.** Never edit `tests/core/{stubs,test,smoke}.js`. New behaviour, new suites.
   (Three owner-made exceptions: 6.8 removed `smoke.js`'s Watcher check with the Watcher, 6.10 deleted `botsmoke.js`
   with the AI players it tested, and 6.57 turned `smoke.js`'s "the plane flies where you look" into a check of the new
   plane controls; `r_gate.js` pins the bytes of what is left.)
6. **Never print big generated text**: `build/hrassets.js`, `build/*.gen.js`, `dist/*.html`, `DINGLECRAFT.html`, the art files
   (`art/`, `build/art/`, `dist/art/`: `hyperreal-*.js`), `assets/packed/**`. Their
   lines run to megabytes. Search with `tools/grep-safe.sh <pattern> [paths]`, which skips build output, generated
   asset scripts and `.env` files, rather than a raw recursive grep over the repo.
7. **Public-repo hygiene.** No absolute paths, usernames, machine names, private folder or company names, or email
   addresses in any repo file, and no local timezone in commit metadata: commit with `TZ=UTC0` (the pre-commit hook in
   `tools/hooks/`, installed with `npm run hooks`, refuses anything else). Code that needs a path computes it from its own
   location or reads an environment variable. The owner's private words live in the untracked
   `tools/private_terms.local.txt`, never in a tracked file; `npm run scan` and `npm run scan:history` check against it.

## 1. Layout

```
src/            the game, about 200 files, joined in src/ORDER.txt order (the only source of order)
  core/ world/ entities/ ui/ features/   PARTs 1-52 (the original sandbox, every update's core hooks folded in)
  ui/p53_chat.js PART 53 (chat, the Tab list; the AI players it came with were removed in 6.10)
  texpacks/ PART 54 (+ models/, loaders/)      purgatory/ PART 55
  creativity/   PART 56      malgorath/ PART 57 (+ hr/: the PART 57 HR block)     boot/export_boot.js
  net/          PART 58 (the multiplayer client, game 6.10)
html/           head.html in 18 pieces (html/ORDER.txt) + tail.html; css/ per system, dom/ by region
assets/         logo.png, title/ (menu panorama), vendor/ (three.js r128, inlined), packed/{hr,mg}/ (429 WebP + sidecars +
                manifests), pack-inputs/
scripts/        build.mjs serve.mjs bump.mjs release.mjs package.mjs package-gui.mjs gate.mjs changelog.mjs names.mjs
                guards.json lib/
tests/          core/ (frozen) core2/ (the k* suites: later core features) net/ (the server and the multiplayer client)
                lib/ (boot chain, paths.js) texpacks/ purgatory/ pilot/ creativity/ malgorath/ ui/ repo/ fixtures/ gate.json
tools/          art/ (packers, fal client: PAID) assets/ (unpack, repack) qa/ (muted browser rigs; lib/electron.mjs where there
                is no Chrome) prof/ (summary.mjs: a CPU profile as a table) hooks/ (git hooks) scan_secrets.mjs
                scan_history.mjs grep-safe.sh lib/private_terms.cjs
server/         the multiplayer server: dinglecraft-server.mjs (the front door) + lib/ (config, world, websocket, protocol,
                commands, http, host, server, cli, region, files; headless.cjs + host_worker.cjs are the thread its own game runs in), no dependencies; Start Server.bat; its data/ is gitignored. The world on disk is a
                folder (level.json, region/, entities/, playerdata/, data/; the layout is in lib/world.mjs and server/README.md;
                the region and entity files are packed since 6.60: lib/region.mjs)
client/         the desktop client: an Electron wrapper (main.js) around the same html; optional, nobody needs it to play
server-gui/     the server as a window (Electron), one program for every server version (its own version and release:
                npm run package:gui, tag server-gui-v<ver>): a library of imported Server zips (versions/<X.Y>/), each
                server in its list runs one as a child in the server's --ipc mode (server/lib/admin.mjs: add messages, never
                change one); lib/store.cjs is its file handling (servers, versions, backups, tasks), tested by n_admin.
                A new server setting (config DEFAULTS) or game rule (RULES) needs a line in SETTINGS_FORM / RULES_FORM in
                server/lib/admin.mjs (label, kind, limits): the window builds its forms from it, and n_admin enforces it
docs/           ARCHITECTURE BUILD TESTING QA ASSETS RELEASING PARITY ROADMAP LEGACY LANDMINES
DINGLECRAFT.html, art/   the newest release (npm run release copies both: the page and its Hyperreal art)
build/ dist/ out/   gitignored outputs
```

`dist/dinglecraft_v<VER>.html` = `build/head.html + game.js + hrart.js + tail.html`, and since 6.62 the Hyperreal art is
files beside it, `dist/art/hyperreal-<n>-<hash>.js`, which the page loads the first time Hyperreal is switched on
(`hrArtLoad`; `art/` beside `DINGLECRAFT.html` and in the server and client zips). `build/hrassets.js` (the art as one
script) is still built for the suites. Build with `npm run build` (about 1 s). The split is byte-exact: head ends with
`<script>\n`, game.js and hrart.js end with `\n`, tail begins with `</script>`.

## 2. The golden workflow (per feature)

1. **Bump if output will change**: `npm run bump -- X.Y "Title"`.
2. **Recon before editing.** Grep (safely) for the exact lines you will change and read them (`sed -n 'A,Bp' file`).
   Never assume a signature, a variable name or what a branch does. Read `docs/LANDMINES.md` for the area.
3. **Edit `src/` directly** with surgical, unique-anchor edits (section 3). Core integrations are normal edits at the
   call site. New systems go in their own file or their own update folder ([CONTRIBUTING.md](CONTRIBUTING.md)).
4. **Exports.** Everything testable goes into `__vox` (core names in `src/boot/export_boot.js`) or the update's export
   object (`TPEX`, `PGEX`, `CREX`, `MGEX`).
5. **Tests.** Statics and smokes for every feature, registered in `tests/gate.json` (section 6).
6. **Run repeatedly.** `npm run test:quick` while iterating, the full suite before committing (the owner's choice:
   `node scripts/gate.mjs --once --keep-going`, about 12 min: since 6.63 it runs 3 suites at once by default, the
   real-clock ones on a lane of their own; a timing check that fails is re-run alone before it is believed, and its whole
   output is in `out/gate_fail/<suite>.log`), and repeat the relevant smokes
   4-6 times. Flakes are real and almost always rig bugs (`docs/TESTING.md`, the field manual). A red test stops the
   line.
7. **HTML.** UI markup and CSS in `html/`; if it adds a key or a mouse action, a row in the right section of the Controls screen
   (`html/dom/help.html`, controls only, no feature blurbs), keys as `<kbd data-k="<action>">`; a new key is an entry in `KB_ACTS`
   (`ui/p06h_keybinds.js`) so players can move it (`docs/LANDMINES.md`, "Keys can be moved").
8. **Look at it**, muted, in a real browser, in OG and Hyperreal, if it is visual (`docs/QA.md`).
9. **Ship.** Patch notes, `npm run gate`, `npm run release`, commit with `TZ=UTC0`, tag (`docs/RELEASING.md`).
   **Every update is pushed**: work on the `Experimental` branch, and after each finished update (tests green) commit and
   push it to the DingleCraftMP repository on GitHub (`git push mp Experimental`). `main` moves only when the owner says so.
   **Every version gets a GitHub release**, cut from `Experimental`, with two downloads, a server zip and a client zip
   (`npm run package`, then the `gh release create` line it prints, with `-R <owner>/DingleCraftMP` added (the repository the `mp`
   remote points at): the `origin` remote is a different repository, and `gh` run from a worktree picks it; `docs/RELEASING.md` step 6). These are betas for
   players to test: the owner releases them without the gate (`npm run release -- --no-gate`; the quick tier still runs,
   about 4.5 min). The access token lives in the machine's git credentials, never in this file or any other repo file (hard
   rule 2: a token in a tracked file is published with the next push, and GitHub revokes it on sight).
   **The server window** (`server-gui/`) is released only when it changes: raise its `package.json` version, `npm run
   package:gui`, then build its Windows installer from that zip unpacked in a scratch folder (`npm install`, `npm run dist`;
   Wine is installed here), check it (`file`: Nullsoft; its ProductVersion), and publish both on `server-gui-v<ver>`.
10. **Announce** with playful per-feature patch notes, plus the test counts `npm run release` prints (the in-game
    patch-notes screen is retired; `PATCH_LOG` is the data behind `CHANGELOG.md`).

## 3. Editing discipline

Make scripted edits with an exact, unique anchor, all or nothing:

```js
// a scratch script, run with node (never leave it in the repo)
const fs = require('fs'); const f = 'src/entities/p05d_mobs.js'; let s = fs.readFileSync(f, 'utf8');
function rep(a, b) { const n = s.split(a).length - 1; if (n !== 1) throw new Error('anchor found ' + n + 'x: ' + a.slice(0, 70)); s = s.replace(a, () => b); }
rep(`...exact unique old text...`, `...new text...`);
fs.writeFileSync(f, s);                          // reached only if every rep() succeeded
```

- **The uniqueness check is sacred.** If it fires, nothing was written: fix the anchor and rerun the whole batch. Never
  fuzzy-match. Use `() => b` so `$` in the new text is not treated as a replacement pattern.
- **Anchors that look unique often are not**: `if(mt==='alien'){` exists three times. After inserting, grep the new text
  and read the surrounding lines.
- **Unicode:** most strings use `◆`-style escapes, some contain real characters (em dashes). If an anchor will not
  match, inspect the bytes. In Python never put surrogate-pair escapes like `🎰` in source (use the real
  character or `\U0001F3B0`).
- Never re-indent, reformat or "tidy" code you are not changing; never touch the marker lines or the blank lines between
  files. Bytes are pinned.
- `npm run build` runs `node --check` on everything; run it after every edit batch.

## 4. Architecture in one screen

Full map: `docs/ARCHITECTURE.md` (PART-to-file table, systems index, how each update hooks in, ID ledger, persistence).

- **One classic script**: `'use strict'` at the top of `core/p01a_prologue.js` covers all; ~3,500 shared top-level names,
  none duplicated; function declarations hoist across files. Never split into separate script tags.
- **Load order ≠ PART order**: core 1-52, 53, then updates newest first (58, 57, 56, 55, 54), the PART 57 HR block, the cast
  loaders, the export branch. Names from later-loading (older) updates are runtime-only and `typeof`-guarded. New
  updates go immediately before `malgorath/m0_contract.js` in `src/ORDER.txt`, with a section guard in
  `scripts/guards.json`.
- **Constants:** `CH=16`, `WH=80` (nothing above y≈76 works: `setBlock` silently no-ops), `SEA=30`. Blocks are a
  `Uint8Array` (ids < 256), with a second byte per block beside it since 6.25 (`ch.mt`, "meta": a liquid's level,
  bits 0-2, and its falling bit, 8). `setBlock(x,y,z,id,meta)`; `getMeta`. In a save, on the wire and in a region file a
  block is one number, `id | meta << 8`: anything that reads an edit as an id must mask with `& 255`.
  A third per-chunk array since 6.26 is block light (`ch.lt`, 0-15, never saved; since 6.44 the server's game keeps it too, because monsters spawn by it):
  `setBlock` keeps it up (`lightEdit`), the mesher bakes it into a `blight` vertex attribute for whatever faces a block
  has (`bufLight`, a pass after the mesh is built), and the world materials add it (`blightObc`). A new light-giving
  block only needs `light:true` in its def.
- **Conventions the engine forces:** forward is `(-sin(yaw), -cos(yaw))`; **positive pitch looks up**; mob faces are on
  the +z box face (material index 4); `def()` fields are `tiles`/`toolClass`.
- **Frame:** `frame(t)` in `core/p07h_boot_loop.js` runs one long gated line of per-system ticks; append new ones there.
- **UI panels** follow the store pattern (overlay div, `xOpen`, `openX/closeX/renderX`, `modalOpen()`, the Esc chain,
  top-level button wiring).
- **Updates talk to the core through registries** (`PREG`, `CRREG`, `MGREG`, `tpRegister`, `HR.MODELS`) and keep state in
  one saved object each (`MP`, `save.cr`, `save.mg`), written only when it differs from the default.
- **Multiplayer** (PART 58, `src/net/`: `n0_contract` state and the map, `n1_link` connection and messages, `n2_world`
  blocks, chests and their locks, `n3_drops`, `n4_self` this player and the frame tick, `n5_players`, `n6_menu`,
  `n7_mobs` shared mobs and explosions, `n8_host` the server's own game, `n9_ents` what flies and what you ride, `na_data` what the world remembers): 44 core
  hooks, 37 behind `NET.on` (or `e.pup`) and 7 behind `NET.host`, all of which only PART 58 sets, so single player is byte-for-byte the old behaviour.
  **The server runs the game** (6.13, first step): `server/lib/host.mjs` loads the html's own script headless in a worker
  thread and that game ("the host", player id 0) spawns, runs and saves the Overworld's shared mobs. The game knows one
  player, so the host points `P` at the nearest real player before each entity update (`ntHostAim`); anything a brain
  does TO `P` must be forwarded, never applied (`damagePlayer` -> `ntHostHurt`). Players' games hand over whatever they
  spawn (`ntMobHeir` returns the host) and spawn nothing natural where the server does (`ntHosted`). Vehicles work the
  same way (6.14): the host keeps them, the rider's game runs one for the length of the ride (`vtake` / `vgive`). Things
  that fly stay in the game that made them and are only announced (`fx`), so others see a copy that touches nothing: a
  new projectile kind needs an entry in `NT_FX` (and `FX_KINDS` in the server) or nobody else sees it. Since 6.15 the host
  also runs the Overworld's water, fire and falling blocks and every furnace nobody has open; a player's game skips them
  where `ntHosted()` (`ntSimHere`, `checkFalling`, `ntIgnite`, `ntNoTick`). When the host applies a player's edit it
  sends what follows from it (`NET.apd`, not `NET.ap`): a new simulation that reacts to block edits works on the host for free.
  Since 6.17 there is one host per dimension (`S.hosts`: Overworld from the start and the only one that cooks furnaces and
  runs the market, `NET.hprim`; Nether and Aether on first entry; never Purgatory), and "player 0" is the host of the
  sender's dimension, so nothing in host code may assume the Overworld (`ntHosted()` and `c.hdim`, never `'over'`).
  The page a server serves has one line added (`window.DC_SERVER=1`, `server/lib/http.mjs`), which sets `NET.served`: that
  game has no local worlds (`startNewWorld`, `loadWorldByName`, `importWorldFile` return at once, their buttons are
  hidden). The stand-alone html and the desktop client never have it set.
  World-level save fields are the server's since 6.16: a new one that should be shared goes in `NT_WD` (and
  `WORLD_LISTS` and `DATA_FILES` in the server) if it is a list, and a new per-player one in the four keys `ntSave` adds. The server owns blocks, block entities (one player in a chest at a
  time), dropped items, time, rules, rights (ops, bans, the whitelist, spawn protection, slash commands in
  `server/lib/commands.mjs`) and players-by-name. Outside the Overworld (or with `simulate` off) it does not run the game: there an ordinary mob (`NT_MOBS`) is simulated by the
  game of the nearest player and shown to the others as a puppet (since 6.11 also villagers, Nuke Kegs and the plain
  bosses; a structure-spawned one is deduplicated by its spawn spot); dragons, parked vehicles and the Purgatory and
  Malgorath casts stay local to each client. The line itself (6.11): messages are compressed (permessage-deflate), every
  message type has a per-second limit (`RATE` in `server/lib/config.mjs`: a new message type needs an entry), the game
  pings every 2 s and reconnects by itself after a lost connection, and chests and drops are sent by range like edits. Anything that writes blocks must go through `setBlock`, anything that drops an item through `spawnDrop`,
  and anything that hurts a mob through `hurtMob`, or it will not reach other players.
  **Since 6.46** (protocol 6 since 6.49):
  - **Accounts (6.49):** with `accounts` on, `hello` is answered with `login` until a username and password match a
    playerdata record's `password` (6.61: a scrypt hash, `scrypt$N$r$p$salt$hash`, checked off the main thread by
    `checkPassword`, so `hello` runs again when it is done; plain text is still read and hashed on start; never sent to a
    game, `/status`, `/export` or the window; a `save` cannot set it). `passwordSecurity` (none/medium/high,
    `passwordProblem`) is checked wherever a password is set. The helpers (`checkPassword`, `hashPassword`, `passwordProblem`, `accountOf`, `locksOf`, `renameAccount`, `setSkin`) live in
    `commands.mjs`, because `commands.mjs` may not import `protocol.mjs` (the layering rule in `n_static`). Messages
    `login`, `acct`, `rename`. Locks `lockNames`/`lockPasswords`/`lockSkins`, global or per player.
  - **Pausing (6.46, 6.55):** a dimension's game nobody is in is paused after `pauseWhenEmpty` s (`{t:'pause'}` to its
    worker); a paused Nether or Aether is stopped after `stopWhenEmpty` min; a crashed Overworld game restarts.
    `simulationDistance` (8) is how far round each player the host builds chunks and moves entities (`NT_HOSTR`).
  - **The world clock (6.50):** `CATCH.clock` (`features/p53h_catchup.js`) runs with the land; the server keeps it in
    `level.json` with `savedAt`, runs it while empty, sends it as `{t:'clock'}`; crops, saplings and furnaces catch up
    on gaps. Use the clock, never `Date.now`, on a per-frame path (a save and a load each read `Date.now` once).
  - **Packed world files (6.60, replacing the cold `.json.br` files of 6.53):** `region/<dim>/r.x.z.dcr` and
    `entities/<dim>/r.x.z.dce` are the old JSON documents packed (`server/lib/region.mjs`: varints, runs, sparse chest
    slots, repeated texts and key sets as references; no compression). Every older form is still read and rewritten packed
    on the first start. Names come from `server/lib/names.json` (`npm run names` after a build; `n_files` fails when it
    is stale). A new field in a region or entity document needs nothing: unknown values are kept as tagged values.
    `node dinglecraft-server.mjs view|unpack|pack|files|find` (`lib/files.mjs`) and the window's World files tab read them.
  - **The server does not own inventories:** read ROADMAP step 6b before trying; it cannot be done one action at a time.

**ID ledger** (`docs/ARCHITECTURE.md` section 7): grep before allocating. Next free (unchanged through 6.64): **no block id is left**
(212 stays undefined on purpose; farming took 217-219 and 248, saplings 249: new blocks must share an id and use meta); item ids 309, 339, then 382+. Purgatory ids are assigned only in
`purgatory/p0_contract.js`, creativity's only in `c0_contract.js`, Malgorath's only in `m0_contract.js`.

**Persistence triple:** player fields need a default in `newPlayer`, a line in `snapshot()` and a restore with a default
in `applySave`; world state also needs a reset in `resetWorld`. Stacks keep `ench`/`dur` through every copy. Old saves
must always load.

## 5. The build and its guards

`docs/BUILD.md` has the contract. The build fails on: an orphan, missing or duplicate ORDER entry; a bad marker line;
`\r`, `</script` or `<!--` in JS; a section over its guard; mismatched version strings; an asset hash mismatch; a syntax
error; an html over 12,000,000 bytes (about 6 MB since 6.62) or an art file over 25,000,000 (`scripts/guards.json`;
`ART_SPLIT` in `scripts/lib/assets.mjs` cuts the art into files of at most 20 MB, so the art can grow). Under `--strict` (gate, release) a
shipped version that changed bytes also fails.

## 6. Testing

`docs/TESTING.md` has everything. Essentials:

- Suites are plain node scripts: one process, one boot (`tests/lib/{hr,pg,c,mg}_boot.js`), `ok(name,cond)`, last line
  `N passed, M failed`, exit 1 on failure, skips as `(k skipped: reason)`.
- Paths only from `tests/lib/paths.js` (`BUILD`, `SRC`, `FIX`, `OUT`, `readSrc`). Never read outside the repo; write only
  under `out/`.
- Smokes: `stepper(base)` with strictly increasing timestamps (40-60 ms gaps; base >= 700000 for Malgorath), ~160
  warm-up frames, settle >= 25 frames after any teleport, purge hostiles before damage-sensitive phases, assert item
  totals not entity counts, never cache `V.P`, `boot.detClock(V)` for long timing-sensitive runs, seed `Math.random`.
- Commands: `npm run test:quick` (~4.5 min), `npm test` (~12 min, 3 suites at once by default since 6.63), `npm run gate` (longer: smokes repeated; run it in the background, never
  two heavy gates at once), one suite: `npm run build && node tests/<group>/<suite>.js`.
- og_trace compares the OG game with golden recordings; re-bless (`--bless <file> --reason "..."`) only for a deliberate
  OG change, after proving the divergence comes only from it (put the old behaviour back in a scratch copy of
  `build/game.js`, check the golden matches, restore): the reason goes into the file.
- Rig lessons from 6.46-6.55: seed suites with mulberry32 (`Math.imul`), never a float LCG (it falls into short cycles);
  a suite that may run beside a copy of itself writes to its own folder (`out/net/host_data_<pid>`); the server's
  `dirty` flag is internal, so a test changes something real (`S.setTime`) to make `saveWorld` write; the test THREE is
  a stand-in without 3D maths (load `assets/vendor/three.r128.min.js` for a real check).
- Rig lessons from 6.63-6.64 (four flakes, all the rig's): the game drops chunks farther than the view distance + 2
  every 180 frames, so force them again right before building somewhere Dan is not; the game autosaves every 60 s of
  game time and online that is a `save` too (`V.autoSaveT(0)` before a window that counts saves); wait for the server
  to have handled a message (`until(...)`), never a fixed sleep; light a room before clearing its monsters, or the game
  spawns into the frames the clearing steps; the clock runs on, so compare times within a tolerance.
- **Timing checks measure the machine** (`p1_smoke`'s chunk speed, anything in real ms): look at `/proc/loadavg` before
  believing one. With the owner's video or browser running (load ~7 on 4 cores) they fail even alone: say so, re-run
  later, never loosen the check to make it pass.

**Debugging protocol:** instrument, do not theorise past two guesses. Insert a temporary probe
(`if(typeof __xProbe!=='undefined')__xProbe({...});`), define `global.__xProbe` in the test, read the truth, then strip
every probe (grep `Probe` and `/*DBG*/`) before committing.

## 7. Browser QA

Your own Chrome on your own port (`tools/qa/chrome.sh <port> [profile]`, prints the PID to kill), your own server on
port+100 (`node scripts/serve.mjs --port <p>`, which sends no-store), the shared driver `tools/qa/lib/cdp.mjs` (mutes on
every document, freezes rAF so `frameStep` does not stack loops). Quick check: `node
tools/qa/boot_check.mjs --launch --port <p>` (starts and stops its own Chrome and server). Verify WebGL2 first; built-in
editor browser panes have none. Review frames as 5×6 contact sheets, not one image at a time. Put `tp:'og'` back at the
end.
**No Chrome on this machine:** `node tools/qa/boot_check.mjs --launch --electron --port <p>` uses the client's Electron
(`npm install` in `client/`), off-screen, muted, its own profile under `out/qa/`. For anything else, a scratch Electron
`main.js` in the scratchpad: `BrowserWindow({show:false, webPreferences:{offscreen:true}})`, `setAudioMuted(true)`, the
settings merged before the page runs, `webContents.capturePage()` for screenshots, and `executeJavaScript` wrapped in a
try/catch that returns the error (a bare one only says "Script failed to execute"). The server window can be driven the
same way with `BrowserWindow` and `Tray` replaced before its `main.js` loads (no window, no tray icon on the desktop).

## 8. Landmines (the top of `docs/LANDMINES.md`)

- `doUse` branch order: anything below the eat branch loses food to hunger.
- `explode(...,byMob)` must be `true` from mob sources or `mobGriefing` breaks.
- `storage.get` can reject on a missing key (the test stub does): always try/catch.
- Texture packs: every hook guarded, OG branch untouched character for character; never null `scene.fog`/`background`;
  light-count/shadow/tone-mapping changes only in enable/disable/setQuality; no THREE constructors, `Math.random`,
  `Date.now`, `performance.now` or `fetch` at update top level or on an OG per-frame path; exports in `TPEX`, never `TPX`.
- Purgatory: mobs never saved; all state in `MP`; timers on `MP.clock`.
- Creativity: works are 1/1, data is the item id, never a per-stack field, never duplicate a work in a rig.
- Malgorath: his entities route to `mgMobMesh`/`mgBrain`/`mgPreHurt` (always -1); spawn only via `mgSpawnBoss`; damage
  needs an attacker (`V.mgHitAs`); M1 owns every block write in the Bite; `BufferAttribute`, never
  `Float32BufferAttribute`, for geometry rewritten in place.
- Nobody can hear the game's audio: verify offline (`c2_audio`, `m2_audio`, the parity rigs). The audio clock starts
  with the first sound, so a check timed in frames can depend on which sound came first.
- A mesh pointed at something uses `lookAt`, not `rotation.y`/`rotation.x`: in three's default Euler order those go wrong
  once yaw and pitch are both set (the laser before 6.52 was off in 90 of 112 directions).
- The spawn finder stands on the real ground (`findSpawn` builds the chunk): caves and ravines are cut after the land is
  shaped, so `colInfo` heights can be over a hole.
- Shared chests open only when the server answers (`ntBeAsk`): anything a click does next must not assume the window is
  open (6.51: a held block was placed against it).
- The Hyperreal art is not in the page (6.62): `hrAssets()` is null and `hrMgAssets()` empty until `hrArtLoad()` has
  loaded `art/` (`tpEnable` waits for it). Never cache an art table before `hrArtReady()`. `hrart.js` must keep its first
  line `/* PART 54 ASSETS - GENERATED`: `server/lib/host.mjs` cuts the game script out of the html there.
- A chest label (`be.lbl`, 6.63) is an item id, never an item: never put it in `be.inv`, a slot or a drop. The label slot
  (`#mlabel`) has its own click handler on purpose; built with `mkSlot` it would be reachable by shift-click and dragging.

## 9. Voice

Patch notes (top `PATCH_LOG` entry in `src/ui/p28_patch_notes.js`) are per-feature: confident, playful, a little absurd,
honest. Players no longer see them in game (the screen is retired); they become `CHANGELOG.md`, and the announcement adds
the test counts. Lines are single-quoted JS strings rendered as HTML: no raw `'`, `<` or `>`
(use `’`, `&#x27;`, `&lt;`, `&gt;`). The game is satire-friendly (the store sells "Remove Ads"; there are no ads), but
the engineering underneath is straight-faced. Keep both. `npm run changelog` turns released notes into `CHANGELOG.md`.

## 10. Where to look

| for | read |
|---|---|
| how a system works, where it lives | `docs/ARCHITECTURE.md` |
| what bit people before | `docs/LANDMINES.md` |
| build, guards, order files | `docs/BUILD.md` |
| suites, gate, writing tests, flakes | `docs/TESTING.md` |
| browser checks | `docs/QA.md` |
| art and repacking | `docs/ASSETS.md` |
| version bumps and releases | `docs/RELEASING.md` |
| where a pre-repository file went | `docs/LEGACY.md` |
| what is planned | `docs/ROADMAP.md` |
