# DINGLECRAFT MULTIPLAYER

A multiplayer fork of [DINGLECRAFT](https://github.com/dandingle/dinglecraft), the fan-made, Minecraft-style voxel sandbox
that ships as **one HTML file**. Punch trees, build a house, then find out the game also has a casino, a stock market,
rideable dragons, a microtransaction store that sells "Remove Ads" (there are no ads), walking Nuke Kegs, a photoreal
texture pack, a trip to Puppet Purgatory and a sixteen-metre demon who has taken a bite out of the world.

This fork adds a real multiplayer server that runs the world itself, accounts, farming, flowing water, proper lighting,
skins, difficulty and DingleCore, and a lot more: the full list is in
[What this fork adds](#what-this-fork-adds-to-the-original). The original game is Release 1.0 (game version 6.9); this
fork is Release 1.1, game version 6.10 and up.

> DINGLECRAFT is an independent fan-made game. NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH
> MOJANG OR MICROSOFT. Other names belong to their owners.
>
> DINGLECRAFT MULTIPLAYER is a fan-made modification of DINGLECRAFT. It has not been checked or reviewed by Dan Dingle,
> who therefore carries no responsibility for how it works. Free to play and tinker with, not to redistribute: see
> [LICENSE](LICENSE).

The original README opens with this note from its author, and it holds here too:

> *The only part of this entire project not written by AI is the paragraph you're reading right now. If you don't
> understand anything, neither do I. [...] I cannot provide technical support if you do not know what you're doing.*

---

## Contents

- [Play it](#play-it)
- [How to play](#how-to-play)
- [Joining a server](#joining-a-server)
- [Hosting a server](#hosting-a-server)
- [HTTPS with Let's Encrypt](#https-with-lets-encrypt)
- [What this fork adds to the original](#what-this-fork-adds-to-the-original)
- [Building from source](#building-from-source)
- [Project map and documentation](#project-map-and-documentation)
- [Licence](#licence)

---

## Play it

**Single player:** download [`DINGLECRAFT.html`](DINGLECRAFT.html) (the newest build, about 42 MB: open it on GitHub and
press the download button) and double-click it. That is the whole game, on Windows, macOS or Linux, and it works offline:
three.js and every texture are inside the file. It is developed and tested in Chrome, so an up-to-date Chrome or Edge is
the safest bet. You need WebGL (WebGL2 for the Hyperreal texture pack).

Every version has a page under [**Releases**](https://github.com/Renscal/DingleCraftMP/releases) with these downloads:

| download | what it is |
|---|---|
| `DINGLECRAFT-Server-v<version>.zip` | the multiplayer server, with the game inside it. Start here to host |
| `DINGLECRAFT-ServerGUI-v<version>.zip` | the same server as a desktop program with a window (optional) |
| `DINGLECRAFT-Client-v<version>.zip` | the game as a desktop app (optional: the html does the same) |

Releases cut from the `Experimental` branch are betas, published for testing without the full test run.

**Your worlds** are saved in the browser, per address: the html opened from disk and a page served from
`http://127.0.0.1:8643` each have their own list. Clearing your browsing data deletes them, so use **Export World** in
the pause menu to keep a copy, and **Import World** on the title screen to bring one back.

## How to play

**Starting out.** On the title screen choose **Create New World**. Pick survival or creative, a difficulty, and the game
rules (mob spawning, fire spread, keep inventory, figurine drops, whether the Nether, the Aether and Puppet Purgatory are
open, and more). The rules can be changed later per world, except DingleCore (below).

**The first day** lasts twenty minutes: ten of daylight, a sunset, seven of night and a sunrise. Monsters appear in the
dark, wherever no torch or daylight reaches, so build a shelter and light it before night falls. Punch a tree for wood,
make a crafting table, then tools.

**Difficulty.** Easy, Normal or Hard, plus **DingleCore**: Hard with one life, chosen when the world is made and never
changed afterwards. Die in DingleCore and you can only spectate.

### Controls

The full list is in **Help & Controls** on the title screen.

| | |
|---|---|
| Move, jump, sneak | W A S D, Space, Shift (sneaking will not fall off edges) |
| Sprint | double-tap W, or hold Ctrl |
| Mine / attack | hold left mouse (hit while falling for a critical hit) |
| Place / use / eat | right mouse |
| Hotbar | 1-9 or the scroll wheel |
| Inventory, drop | E; Q drops one, Ctrl+Q the stack |
| Camera | F cycles first person, third person and front view |
| Fly (creative) | double-tap Space |
| Laser Eyes | hold L |
| Powers menu | P |
| Chat, commands | T or Enter; `/` for commands, `/msg <player>` to whisper |
| Player list | hold Tab (shows everyone's ping on a server) |
| Screenshot, replay | F2 saves a PNG; F8 saves the last 30 seconds as a video |
| Debug screen | F3; F3 + B hitboxes, F3 + G chunk borders |
| Pause | Esc (on a server the world keeps going) |

**In an inventory window:** drag left to share a stack out evenly, drag right to place one in each slot, double-click to
gather, Shift-drag to quick-move a row of slots, the wheel moves one item, 1-9 swaps with the hotbar, Q throws, click
outside the window to throw what you hold. In creative, middle-click gives a full stack.

### Settings

- **Your skin:** a 64 x 64 PNG (the older 64 x 32 works too), under 50 KB. Kept in your browser; on a server, everyone
  sees it.
- **Texture pack:** **OG** (16 px, the classic look) or **Hyperreal** (photoreal, needs WebGL2).
- **UI Scale**, field of view, mouse sensitivity, sound and music volume.
- **Your account** (only while on a server with accounts): change your username or password.

### Some things to try

- **Farming:** till grass with a hoe, water the farmland with a watering can (filled from still water), plant wheat
  seeds (from tall grass) or carrots. Three wheat make bread. The paler, purple-spotted "carrot" is hemlock.
- **Poison:** a Hemlock Root and a Glass Bottle make a Jar of Poison. Craft it with a sword for ten poisoned hits, or
  with food for one poisoned piece that looks exactly like the rest of the stack.
- **Trees:** leaves drop saplings (oak, birch, spruce) and, rarely, apples. Plant a sapling on grass or dirt in the
  light and it grows into a full tree.
- **Water and lava flow.** Two water sources make an infinite pool; water on lava makes obsidian, cobblestone or stone,
  so you can build a cobblestone generator.
- **Mob farms work.** Spawning, light levels, despawning, spawners and fall damage follow the classic rules closely
  enough that a farm built from a tutorial should work.

## Joining a server

There are two ways in:

1. **Open the server's address in a browser:** `http://<server address>:40162/` (or `https://` if the server has a
   certificate). The server hands you its own copy of the game, so your version always matches. That page has only
   **Multiplayer**: your single-player worlds stay in the html file and the desktop client.
2. **Use your own copy** of the game (the html or the desktop client): choose **Multiplayer** on the title screen and type
   `<server address>:40162`, or `wss://<server address>:40162` for a server with a certificate.

On a server with accounts (the default for a new server), the server asks for a username and password before you spawn.
The server's owner makes your account and gives it to you. The game remembers your username per server, and your
password too if you tick **Remember the password**.

> **Passwords are stored in plain text on the server**, where its owner can read them. Never reuse a password you care
> about. Without a certificate ([below](#https-with-lets-encrypt)) they also travel unencrypted.

If the connection drops, the game reconnects by itself (five tries over about 25 seconds) and you come back where the
server last saw you.

## Hosting a server

The server has no dependencies. It needs [Node.js](https://nodejs.org) 20 or newer and nothing else.

1. Download `DINGLECRAFT-Server-v<version>.zip` from [Releases](https://github.com/Renscal/DingleCraftMP/releases) and
   unpack it.
2. Start it: double-click **`Start Server.bat`** on Windows, or run **`./start-server.sh`** on Linux and macOS. On Windows,
   allow Node through the firewall when it asks (private networks).
3. The window prints the addresses to hand out. Players on your network use the local one. Players elsewhere need your
   public address and **TCP port 40162** forwarded to your computer on your router.
4. Make yourself an operator: type `op <your name>` in the server window. Then make accounts for your friends:
   `/account add <name> <password>`.
5. Stop the server with `stop` or Ctrl+C. The world is saved first (and every 30 seconds while it runs).

From a checkout instead of the zip:

```sh
npm run build                         # makes dist/dinglecraft_v<version>.html, which the server hands out
node server/dinglecraft-server.mjs    # on Windows you can double-click server/Start Server.bat
```

**Settings.** The first start writes `data/server.json` next to the server. Stop the server, edit it, and start it again.
The most useful ones:

| setting | default | |
|---|---|---|
| `port` | 40162 | the port for the game page and the game connection |
| `name`, `motd` | | the server name and a line shown on joining |
| `accounts` | `true` | players log in with an account; `false` lets anyone join by name |
| `maxPlayers` | 8 | |
| `mode`, `pvp`, `rules` | survival, on | what new players start in, player-versus-player, the world's game rules |
| `ops`, `whitelist`, `allow`, `bans` | | operators, and who may join |
| `spawnProtection` | 16 | blocks around spawn that only operators may change |
| `cert`, `key` | | a TLS certificate and key: see [HTTPS with Let's Encrypt](#https-with-lets-encrypt) |
| `simulationDistance` | 8 | chunks around each player that the server simulates (lower it on a small machine) |
| `pauseWhenEmpty`, `stopWhenEmpty` | 60 s, 10 min | an empty dimension is paused, then shut down to free memory |

**Commands** (in the server window, or in chat for an operator): `/tp`, `/give`, `/gamemode`, `/time`, `/gamerule`,
`/kick`, `/ban`, `/whitelist`, `/op`, `/setworldspawn`, `/account ...`, `/setskin`, `/export` (the whole world as one
file that single player can import), and for everyone `/msg`, `/me`, `/list`, `/help`.

**The world on disk** is a readable folder: `level.json`, `region/` (changed blocks, chests and furnaces), `entities/`,
`playerdata/<name>.json` and `data/`. Land and players nobody has visited for a week are compressed automatically.

**Memory.** The server runs a copy of the game for each dimension someone is in: about 110 MB each.

**The server window.** If you prefer buttons to a terminal, `DINGLECRAFT-ServerGUI` manages several servers with a
dashboard, console, player list, settings and game-rule forms, world switching, backups and a scheduler. Unpack it, run
`npm install` and `npm start` ([server-gui/README.md](server-gui/README.md)).

Every setting, command and limit is in [server/README.md](server/README.md).

## HTTPS with Let's Encrypt

Out of the box the server speaks plain `http://` and `ws://`. That is fine on a home network, but on the internet your
players' passwords cross it unencrypted. Give the server a certificate and it speaks `https://` and `wss://` on the same
port instead. [Let's Encrypt](https://letsencrypt.org) gives out certificates for free.

You need a **domain name** that points at your server's public address (a free dynamic-DNS name works), because the
certificate must be for the address your players type. You also need **port 80** reachable from the internet while the
certificate is issued and renewed (or use a DNS challenge instead; see the
[certbot documentation](https://eff-certbot.readthedocs.io)).

**On Linux** with [certbot](https://certbot.eff.org):

```sh
sudo certbot certonly --standalone -d play.example.com
```

The certificate lands in `/etc/letsencrypt/live/play.example.com/`. Those files are readable only by root, so copy them
into the server's data folder for the user that runs the server:

```sh
sudo install -o "$USER" -m 600 /etc/letsencrypt/live/play.example.com/fullchain.pem  server/data/fullchain.pem
sudo install -o "$USER" -m 600 /etc/letsencrypt/live/play.example.com/privkey.pem    server/data/privkey.pem
```

Then point `server/data/server.json` at them (paths are relative to the data folder unless they are full paths):

```json
"cert": "fullchain.pem",
"key": "privkey.pem"
```

Restart the server. It now says it is encrypted, and players use `https://play.example.com:40162/` in a browser, or
`wss://play.example.com:40162` from their own copy of the game.

**Renewal.** Let's Encrypt certificates last 90 days and certbot renews them by itself. The server reads the certificate
only when it starts, so a renewal needs the copy and a restart. Put both in a certbot deploy hook, for example
`/etc/letsencrypt/renewal-hooks/deploy/dinglecraft.sh` (make it executable, and change the paths and user to yours):

```sh
#!/bin/sh
D=/path/to/server/data
install -o dinglecraft -m 600 "$RENEWED_LINEAGE/fullchain.pem" "$D/fullchain.pem"
install -o dinglecraft -m 600 "$RENEWED_LINEAGE/privkey.pem"   "$D/privkey.pem"
systemctl restart dinglecraft   # or however you run the server
```

If you run the server by hand rather than as a service, restart it yourself after a renewal (certbot emails you before a
certificate expires if you gave it an address).

**On Windows**, [win-acme](https://www.win-acme.com) does the same job: choose to store the certificate as PEM files, set
its output folder to the server's `data` folder, and add a script step that restarts the server.

**Things to know:**

- A page served over `https://` cannot talk to a plain `ws://` server. Once the server is on TLS, players must use
  `wss://` from their own copy of the game.
- `origins` in `server.json` limits which web pages may connect (empty means any). The server's own page, a game opened
  from a file and the desktop client are always let in.

## What this fork adds to the original

The original repository ([dandingle/dinglecraft](https://github.com/dandingle/dinglecraft)) ends at **Release 1.0, game
version 6.9** (replays and screenshots). Everything below came after, in game versions 6.10 to 6.55. Each version's own
patch notes are in [CHANGELOG.md](CHANGELOG.md).

### Multiplayer

- **A multiplayer server** (6.10) with no dependencies, only Node.js: `Start Server.bat` / `start-server.sh`, a
  **Multiplayer** button on the title screen, and the game handed out by the server to anyone who opens its address.
- **Shared world:** blocks in every dimension, chests and furnaces (one player at a time), dropped items (thrown items
  land for everyone, and only one player wins a contested pickup), chat, the player list, time of day, game rules.
- **Players see each other** with name tags (drawn through walls, dimmed when hidden, hidden behind walls when sneaking),
  their skins, armour and vehicles, the sound and dust of their digging, and their Laser Eyes.
- **Player-versus-player combat** (swords, arrows, bullets, TNT), with a server-side range check and a switch to turn it off.
- **Sleeping is a vote** (`sleepPercent`); death messages written by the server.
- **The server remembers you:** inventory, armour, health, hunger, XP, Dingle Bucks, spawn point and position, saved
  within a second of any change and on the way out.
- **Operators and slash commands:** `/tp` (across dimensions, 6.32), `/give`, `/gamemode` (including spectator),
  `/time`, `/gamerule`, `/kick`, `/ban`, `/whitelist`, `/op`, `/setworldspawn`, `/export`, `/account`, `/setskin`, plus
  `/msg`, `/me`, `/list`, `/help`. Spawn protection.
- **Accounts** (6.49): per-server usernames and passwords, made by operators; players can change their own name and
  password; operators can lock names, passwords and skins. They replace the old server password.
- **A sturdier connection** (6.11): compressed messages, a heartbeat every 2 s, automatic reconnection, chunks, chests and
  drops sent by range, per-message rate limits, optional TLS (`https`/`wss`) and an `origins` list.
- **The server runs the game itself** (6.13 to 6.17): a headless copy of the game per dimension (Overworld, Nether,
  Aether) runs the mobs, villagers and bosses, vehicles, flowing water, fire, falling sand and gravel, furnaces, spawners,
  structures and the stock market, so everything happens once and the same for everyone. Projectiles (arrows, bullets,
  grenades, TNT, fireballs, XP orbs) are visible to all players.
- **The world remembers** (6.16): found villages, killed dimension bosses and one shared stock market; your paintings and
  songs travel with your player.
- **The world is a folder** (6.12): `level.json`, `region/`, `entities/`, `playerdata/`, `data/`, saving only what changed;
  old single-file worlds are converted on first start, and `/export` turns a server world back into a single-player save.
- **A server's page is that server's game** (6.18): only Multiplayer, no local worlds (the `singlePlayer` setting brings
  them back).
- **Lights out when nobody is home** (6.46): an empty dimension pauses after a minute and uses no CPU; an idle Nether or
  Aether is shut down after 10 minutes (6.55); a crashed Overworld game restarts itself.
- **Farms at full range** (6.55): the server simulates 128 blocks around each player (`simulationDistance`).
- **Cold files** (6.53): land and players unvisited for a week are written compressed (about 3% of the size).
- **The server window** (6.41): an Electron program to manage several servers, with a dashboard, console, players,
  settings, game rules, worlds, backups and a scheduler.
- **The desktop client:** an Electron wrapper around the same html, with single player and Multiplayer.
- **Release downloads:** a server zip, a server-window zip and a client zip for every version.

### Gameplay

- **Farming** (6.39): hoes in five materials, a watering can, farmland that needs watering, wheat, bread, carrots, and
  wild hemlock that looks like a carrot. The hoe tills by dragging (6.44).
- **Poison** (6.40): Hemlock Root, Glass Bottle, Jar of Poison, poisoned blades (ten hits) and poisoned food that is
  indistinguishable from the rest of its stack.
- **Saplings** (6.43): oak, birch and spruce saplings that grow into full trees; leaves wither when their tree is cut and
  drop saplings and apples; leaves you place never wither.
- **Flowing liquids** (6.25): water and lava spread, slope, fall and dry up; infinite water sources; obsidian, cobblestone
  and stone where they meet; running water carries items, mobs and you.
- **Lava is a liquid** (6.28): you can look and build through it, a placed block plugs it, sand sinks in it.
- **Real block light** (6.26): every torch lights the world (no more six-torch limit); lava, glowstone and lamps glow;
  light goes round corners and stops at walls.
- **Sky light and classic mob spawning** (6.44, 6.48): monsters spawn by real light levels, need room to stand, come in
  packs, and despawn by distance; caps scale with the loaded area; dungeon spawners and fall damage work as in the classic
  game, so mob farms work.
- **A twenty-minute day** (6.31): ten minutes of daylight, proper sunsets and sunrises, a seven-minute night.
- **The world keeps time** (6.50): crops, saplings and furnaces catch up on the time nobody was there, including while
  the game was closed.
- **Difficulty** (6.38): Easy, Normal and Hard, and **DingleCore**: one life, then spectator mode.
- **Critical hits** (6.30): strike while falling for half as much again, with gold sparks.
- **Dimension switches** (6.33): game rules to close the Nether, the Aether or Puppet Purgatory.
- **Figurine Drops** is a game rule (6.51).
- **No more tool swapping** (6.19): switching tools mid-block restarts the block.
- **Throws wait** (6.21): you cannot pick up your own thrown item for 2 seconds.
- **Bullets go through** leaves, doors and water, not lava or glass (6.47).
- **Laser Eyes** fire with **L**, aim where you look, and work in mid-air (6.52).
- **Safe spawns** (6.54): a new world never starts you over a ravine.

### Looks and controls

- **Player skins** (6.24): a proper blocky figure with a second layer, your own 64 x 64 PNG, seen by everyone on a server.
- **Your own arm** (6.37) in first person, wearing your skin.
- **Fitted armour** (6.36): helmets with a face opening, chestplates with straps, drawn per metal, your skin showing
  through.
- **An armour bar** (6.35) above the hearts. The icons are trousers.
- **Inventory handling** (6.23): drag to share or place one each, double-click to gather, Shift-drag to quick-move, the
  wheel, number keys, Q and Ctrl+Q over a slot, click outside to throw, middle-click in creative.
- **A full debug screen** (6.22): position, block, facing, chunk, biome, memory and local difficulty; F3 + B hitboxes and
  F3 + G chunk borders.
- **Water has an underside** (6.20): the surface is visible from below.
- **A new logo:** DINGLECRAFT MULTIPLAYER, and the title shows the game version (6.50).

### Removed

- **The AI players** (6.10). BunkerBrad, xx_lilcreepah_xx and honeybee_mc, their brain server (`brain/`,
  `Start AI Brain.command`) and their bunker are gone: multiplayer brought real ones. Old worlds still load. The chat box,
  the player list and the Player Compass stayed, and the compass points at real players.
- **The mouse-button change** from 6.27 was undone at the owner's request in 6.39.

## Building from source

You need [Node.js](https://nodejs.org) 20 or newer (22 is what we use; see `.nvmrc`). Nothing else.

```sh
npm run build     # about 1 second: writes dist/dinglecraft_v<version>.html
npm run serve     # optional: serves dist/ at http://127.0.0.1:8643/
```

`scripts/build.mjs` joins `src/` (in `src/ORDER.txt` order) into one script, `html/` into the page around it, and the
packed art in `assets/packed/` into the file, checking order files, syntax, size caps, version strings and asset hashes on
the way. A version that has already shipped is frozen: the build warns you to bump the version first. Full contract:
[docs/BUILD.md](docs/BUILD.md).

| command | what | time |
|---|---|---|
| `npm run test:quick` | build, repo checks, static suites, core logic, UI suites, one og_trace session | a few minutes |
| `npm test` | every suite once | about 23 minutes (faster with `--jobs 3`) |
| `npm run gate` | the release gate: every suite, smokes repeated to catch flakes | about 20 minutes |

Every suite is a plain Node script that boots the real game against stubs and prints `N passed, M failed`: no test
framework, no network. Browser checks are always muted ([docs/QA.md](docs/QA.md)).

"Release 1.0" and "Release 1.1" are public labels, not game versions: Release 1.0 is game versions 6.4 to 6.9, Release 1.1
starts at 6.10.

## Project map and documentation

```
src/          the game, one file per system, joined in src/ORDER.txt order
  core/ world/ entities/ ui/ features/   the original sandbox (PARTs 1-53)
  texpacks/   OG and Hyperreal          purgatory/   Puppet Purgatory
  creativity/ easels, record players    malgorath/   the Malgorath Update
  net/        multiplayer: the client, and the parts the server's own game runs
html/         the page shell: CSS per system, DOM by region
assets/       logo, title panorama, three.js r128, the packed Hyperreal art
server/       the multiplayer server (dinglecraft-server.mjs + lib/), its launchers and README
server-gui/   the server as a window (Electron)
client/       the desktop client (Electron)
scripts/      build, serve, bump, release, package, gate, changelog
tests/        every suite, fixtures, the repo's own checks
tools/        art tools, muted browser QA rigs, secret scans, git hooks
docs/         how everything works
```

| | |
|---|---|
| [server/README.md](server/README.md) | running a server: every setting, command, the world folder, accounts, limits |
| [server-gui/README.md](server-gui/README.md) | the server window |
| [client/README.md](client/README.md) | the desktop client |
| [CHANGELOG.md](CHANGELOG.md) | what every version changed |
| [CONTRIBUTING.md](CONTRIBUTING.md) | how to make a change, write tests, bump the version |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | how the game is put together |
| [docs/BUILD.md](docs/BUILD.md), [docs/TESTING.md](docs/TESTING.md), [docs/QA.md](docs/QA.md) | build, tests, browser checks |
| [docs/RELEASING.md](docs/RELEASING.md) | versions, patch notes, releases and their downloads |
| [docs/ROADMAP.md](docs/ROADMAP.md) | what comes next |
| [docs/LANDMINES.md](docs/LANDMINES.md) | things that have bitten before |
| [docs/ASSETS.md](docs/ASSETS.md), [docs/PARITY.md](docs/PARITY.md), [docs/LEGACY.md](docs/LEGACY.md) | the art, the byte-for-byte move into the repository, where old files went |
| [CLAUDE.md](CLAUDE.md) | the guide for AI coding sessions in this repository |
| [THIRD_PARTY.md](THIRD_PARTY.md) | third-party code and models, with their licences |

## Licence

Source-available, no redistribution: you may play it, read it, tinker with it and make videos of it, but not hand it out
or sell it. The full terms are in [LICENSE](LICENSE). Third-party components keep their own licences.
