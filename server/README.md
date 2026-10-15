# The DINGLECRAFT multiplayer server

No dependencies and nothing to install: `dinglecraft-server.mjs` plus the `lib/` folder beside it. It needs [Node.js](https://nodejs.org) 20 or newer and a game build of 6.31 or newer.

## Start it

**Windows:** double-click `Start Server.bat`. If Node.js is missing it says so and tells you where to get it. Windows
Firewall will ask once whether Node may accept connections: allow it on private networks.

**Anything else (or a terminal on Windows):** `./start-server.sh` next to it, or

```sh
node server/dinglecraft-server.mjs
```

The window prints the addresses to hand out. Stop it with `stop` or Ctrl+C; the world is saved first.

## How players join

- If the server found a game file, players just open `http://<your address>:40162/` in a browser. The server hands them
  the game, the Multiplayer screen already has the address filled in, and everyone is guaranteed to run the same version.
  The game a server hands out is that server's game (6.18): it has no Create New World, Load World, Continue or Import
  World, only Multiplayer. Single player is in the stand-alone game: the same html opened from a file, or the desktop
  client. (The server adds one line to the page it serves to say so; the file itself is not changed.)
  A browser keeps its worlds per address, so single-player worlds a player made earlier at this server's address are
  still in their browser but can no longer be opened from it. To get them out, set `"singlePlayer": true` in
  `server.json`, restart, and have the player use Export World in the pause menu; then set it back.
- Otherwise each player opens their own copy of the game, chooses **Multiplayer** on the main menu and types
  `<your address>:40162`.

The server looks for a game file named `dinglecraft_v<version>.html` (6.10 or newer) in `data/`, next to the server, and
in the repo's `dist/` (so `npm run build` is enough in a checkout). `--game <file>` names one directly.

Friends on the same network use your local address (the window lists it). Friends elsewhere need your public address and
TCP port 40162 forwarded to your computer on your router.

A page served over `https://` cannot talk to a plain `ws://` server (browsers forbid it). Open the game from the server's
own `http://` address, or from a file on disk, and it works.

**Encryption.** Out of the box the server speaks plain `http://` and `ws://`: fine on a home network, but the players' passwords
travel in the clear. Give it a certificate (`cert` and `key` below, PEM files) and it speaks `https://` and `wss://`
instead, on the same port. The certificate must be for the address players type. A player using their own copy of the game
then enters `wss://<address>:40162`.

**A dropped connection** is retried by the game by itself, five times over about 25 seconds, and the player comes back
where the server last saw them. A kick, a ban or a server shutdown is not retried.

## The server as a window

[`../server-gui`](../server-gui/README.md) is a desktop program that runs this same server: a list of servers down the left, and for
the one you pick a dashboard, a console, players, settings, game rules, worlds, backups and a scheduler. It is one program for
every version: import this server's release zip (`DINGLECRAFT-Server-v<version>.zip`) into it, and each server in its list
runs the version it is set to. It is optional; the
terminal server here works exactly as before. It talks to the server through `--ipc`: started that way by a parent
process, the server reports status, log lines and players with `process.send` and takes commands from
`process.on('message')` (`lib/admin.mjs` lists the messages). There is no Windows `.exe` yet: it runs with `npm install`
and `npm start`; when an exe is built it will be unsigned, so Windows SmartScreen will warn the first time.

## Settings

The first run writes `data/server.json`. Edit it and restart, or pass the same things on the command line (which wins):

| setting | option | default | |
|---|---|---|---|
| `port` | `--port` | 40162 | TCP port for both the game page and the game connection |
| `name` | `--name` | A DINGLECRAFT Server | shown to players when they join |
| `motd` | `--motd` | | one line shown in chat on joining |
| `accounts` | | `true` for a new server | players log in with an account an operator made (see "Accounts" below). `false`: anyone joins by name, as before 6.49, except as a name that is an account. A `server.json` from before 6.49 gets `true` if it had a `password` (gone in 6.49) and `false` if players have already played on it |
| `lockNames`, `lockPasswords`, `lockSkins` | | `false` | nobody may change their own name, password or skin (an operator still can). The same locks can be set for one player: `/account lock` |
| `maxPlayers` | `--max` | 8 | |
| `seed` | `--seed` | random | only for a new world |
| `mode` | `--mode` | `s` | `s` survival or `c` creative: what new players start in (an operator can give one player another with `/gamemode`); applied on every start |
| `pvp` | `--no-pvp` | true | whether players can hurt each other |
| `rules` | | see below | the world's game rules; applied on every start |
| `world` | `--world` | `world` | the world folder, inside the data folder unless it is a full path. A name ending in `.json` is a world file from before 6.12 or an exported save: it is read once into a folder of the same name |
| `game` | `--game` | found automatically | the game html to hand out |
| | `--data` | `data/` next to the server | where `server.json` and the world live |
| `ops` | | `[]` | the operators, by name: they may use every command and build at spawn |
| `whitelist`, `allow` | | `false`, `[]` | with the whitelist on, only the names in `allow` (and the operators) may join |
| `bans` | | `[]` | names (or addresses) that may not join |
| `spawnProtection` | | 16 | blocks around the world spawn that only operators may change. Like Minecraft, it only applies once the server has an operator; 0 turns it off |
| `sleepPercent` | | 100 | how many of the players online must be in bed to skip the night |
| `viewChunks` | | 12 | how far around a player the server sends block changes, chests and dropped items, for a game that does not say (the game asks for its own draw distance + 3) |
| `cert`, `key` | `--cert`, `--key` | | a TLS certificate and its private key (PEM files, looked for in the data folder unless a full path). With both, the server is `https://` and `wss://` |
| `simulate` | | `true` | the server runs the Overworld's mobs itself (see "The server runs the mobs"). `false`: the players' games do |
| `simulationDistance` | | `8` | how far round each player, in chunks, the server's own game runs the world: it builds those chunks, spawns mobs in them (Minecraft's spawn range is 8, 128 blocks) and moves the mobs in them. Measured with 4 players apart: about 7% of a CPU core at 5, 15% at 8, 16% at 10 |
| `stopWhenEmpty` | | `10` | minutes a paused Nether or Aether game waits before it is stopped, freeing its memory; the next player there starts it again. The Overworld's is never stopped (a crash restarts it after 5 s, at most 3 times in 10 minutes). `0`: never |
| `catchUpMax` | | `0` | the most time, in minutes, that crops, saplings and furnaces catch up on at once when their land is run again (after the server was off, paused, or nobody was near). `0`: no limit |
| `pauseWhenEmpty` | | `60` | seconds after the last player leaves a dimension before the server's game for it is paused: no CPU, and its time, mobs, water, fires and furnaces stand still until someone comes back (the whole world is saved first when the server empties). `0`: never pause |
| `singlePlayer` | | `false` | `true`: the page the server hands out is the whole game, with Create New World and Load World (as before 6.18). Worlds made there live in the player's browser, under this server's address |
| `origins` | | `[]` | web addresses whose pages may connect, e.g. `["https://play.example"]`. Empty: any page may (needed for "open your own copy of the game"). The server's own page, a game opened from a file and the desktop client are always let in |

`data/` is ignored by git: the world, the settings and the accounts stay on your machine.

### World settings

`server.json` holds the world's settings, and the file decides: `mode` and everything under `rules` are applied to the
world each time the server starts. Stop the server, edit the file, start it again.

```json
"mode": "s",
"rules": {
  "keepInv": false,
  "god": false,
  "mobGrief": true,
  "mobSpawn": true,
  "dayCycle": true,
  "fireTick": true,
  "fallDmg": true,
  "snail": true,
  "jsc": 0,
  "instaKill": false,
  "freezeMobs": false,
  "ghosts": true,
  "figDrops": true,
  "fbOK": true,
  "store": true,
  "powers": true,
  "cheats": false,
  "nether": true,
  "aether": true,
  "puppet": true,
  "difficulty": "normal"
}
```

| rule | |
|---|---|
| `keepInv` | keep your items when you die |
| `god` | no damage from anything (survival) |
| `mobGrief` | explosions from mobs break blocks |
| `mobSpawn` | natural mob spawning (spawner blocks ignore this); `false` is a peaceful world |
| `dayCycle` | `false` stops the sun where it stands |
| `fireTick` | fire spreads and burns out |
| `fallDmg` | fall damage |
| `snail` | the Eternal Snail |
| `jsc` | jumpscare chance, a number from 0 (never) to 100 |
| `instaKill` | any hit kills a mob outright |
| `freezeMobs` | every mob stops where it stands |
| `ghosts` | guilt ghosts |
| `figDrops` | slain mobs sometimes drop a figurine of themselves |
| `fbOK` | players may use the Fullbright setting |
| `store` | the Dingle Store in the pause menu |
| `powers` | superpowers (the P menu) |
| `nether` | `false` switches the Nether off: its frames do not light, its portals lead nowhere, `/tp` will not go there, the server starts no game for it, and a player found inside is put back at their Overworld spawn |
| `aether` | the same for the Aether |
| `puppet` | `false`: the Stage Door to Puppet Purgatory never arrives, and one already standing stays shut |
| `difficulty` | `"easy"`, `"normal"`, `"hard"` or `"dinglecore"`. Easy: mobs hit for half plus one and hunger stops at 10 health. Hard: mobs hit half as hard again and hunger can kill. DingleCore is Hard with one life: a player who dies becomes a spectator on this server, by name, until an operator runs `/gamemode survival <player>`. `/gamerule difficulty` switches between the first three; DingleCore is set here and needs a restart |
| `cheats` | the debug menu, for every player. Off by default on a server: with it on, anyone can change the rules and give themselves things |

- The server writes this block itself: on the first run, and into an older `server.json` that does not have it yet.
- A rule left out of the file keeps the value the world already has.
- If `cheats` is on and a player changes a rule from the game's debug menu, the server writes the new value back into
  `server.json`, so the file always shows what the world is running with.
- A first run next to an existing world file (one exported from single player, say) takes that world's mode and rules as
  the starting values.
- `seed` only matters when the world is created. To start over with a new seed, stop the server and delete (or rename)
  the world folder.

## The world folder

The world is a folder laid out like a Minecraft world. What fills it (the regions and the entities) is packed for size
(6.60); everything else is JSON a person can read and edit (with the server stopped):

```
data/
  server.json                       the settings (above)
  world/
    level.json                      the world itself: name, seed, mode, time of day, world spawn, game rules
    region/
      over/r.0.0.dcr                the Overworld, region 0,0: changed blocks, chests and furnaces
      over/r.-1.0.dcr
      nether/r.0.0.dcr              one folder per dimension: over, nether, aether, puppet
    entities/
      over/r.0.0.dce                what lies, walks or is parked in that region: dropped items, mobs, vehicles
    playerdata/
      dan.json                      one file per player who has ever joined
    data/
      structures.json               which villages, dungeons, parks and roosts have been found; where the spawners stand
      bosses.json                   which dimension bosses are dead
      nukes.json                    where a mega nuke went off
      market.json                   what the stocks cost
```

- **A region** is 32 x 32 chunks (512 x 512 blocks) and is named after its place in the world: `r.<x>.<z>`, so
  `r.0.0` holds blocks 0 to 511 and `r.-1.0` holds -512 to -1 (`blocksFrom` in its JSON says where it starts). Inside,
  each chunk lists its changed `blocks` (`"x,y,z in the chunk": block id`; the untouched terrain is not stored, it comes
  from the seed; a number of 256 or more is flowing water or lava: the id is the remainder after dividing by 256, the
  level is the quotient) and its `blockEntities` (chests, furnaces, terrariums, display stands) by their place in the world.
- **`entities`** follows the same regions: each dropped item with its position, the item itself and its age in seconds,
  each of the Overworld's mobs with its type, position, health, a villager's name and the spot a structure spawned
  it at (`origin`), and each vehicle with its type, position and health.
- **`playerdata`** holds each player's position, dimension, health, hunger, spawn point, XP, Dingle Bucks, game mode,
  `armor` and `inv` (one slot per line; `0` is an empty slot). The file is named after the player in lower case, with
  unusual characters spelled as `%xx`.
- **`data`** (6.16) holds what the world remembers besides its blocks. Each file starts with an `about` line saying what
  is in it. A structure listed as found is not populated again, for anyone; a boss listed as dead stays dead.
- Only the files that changed are rewritten on a save, each through a `.tmp` file and a rename, and a region file whose
  content is gone is removed. A file that cannot be parsed stops the server with its name; it is never overwritten.
- A world from before 6.12 (`data/world.vxw.json`) is converted to a folder on the first start. The old file is left
  where it was and is not used again: delete it once you are happy.
- A world from 6.12 to 6.59 (`r.<x>.<z>.json` regions, and the `.json.br` files 6.53 to 6.59 compressed) is written in
  the packed form on the first start of 6.60, and the old files are removed. Nothing is compressed any more.

### Looking inside the files

A region or entity file is the same JSON as before, packed: every number in as few bytes as it needs, a row of the same
block written once, a chest's empty slots left out, a name or a key the file has seen before written as a reference to it.
It is nothing but packing (no compression), so a file is read straight off the disk, and a built-up region takes about a
tenth of its JSON. To read or search one, nothing has to be running:

```
node dinglecraft-server.mjs view data/world/region/over/r.0.0.dcr       the file as JSON
node dinglecraft-server.mjs unpack data/world/region/over/r.0.0.dcr     the same, into r.0.0.json (here)
node dinglecraft-server.mjs pack r.0.0.json                             back into r.0.0.dcr (next to it)
node dinglecraft-server.mjs files                                       every file of the world, with what is in it
node dinglecraft-server.mjs find diamond                                where a block, item or mob is
```

`find` takes a name or part of one (`oak log`), an id (`#31`) or a mob type (`zombie`), and looks in the changed blocks,
the chests and furnaces, the dropped items, the mobs and vehicles and what each player carries; `--blocks`, `--items`,
`--mobs` and `--players` narrow it, `--in region/over/r.0.0.dcr` searches one file, `--world` and `--data` pick another
world, `--max` raises the 200 hits it stops at. To change a file by hand: stop the server, `unpack` it, edit the JSON,
`pack` it, and put the packed file back in place of the old one. The server window has the same (its World files tab:
every file with what is in it, a file as tables with names or as JSON, and a search over all of them or the ticked ones).

## Commands

The server window takes commands, and so does the game's chat for a player who is an operator (type `/` first there).
The first operator is made from the server window (`op <name>`) or by adding the name to `ops` in `server.json`.

| command | who | |
|---|---|---|
| `/help`, `/list` | everyone | what you may run; who is online |
| `/msg <player> <text>` (or `/w`, `/tell`) | everyone | a whisper only the two of you see |
| `/me <action>` | everyone | `* Dan waves` |
| `/tp [who] <player \| x y z>` | operators | teleport yourself or someone else: to a player wherever they are (not into or out of Puppet Purgatory), or to a place in your own dimension |
| `/give <player> <item id> [count]` | operators | items by number: the server does not know their names |
| `/gamemode <survival \| creative> [player]` | operators | one player's mode, remembered with the player |
| `/defaultgamemode <survival \| creative>` | operators | what new players start in |
| `/time <day \| noon \| night \| midnight \| 0..1>` | operators | |
| `/gamerule <rule> [value]` | operators | read or change one of the world's rules |
| `/setworldspawn [x y z]` | operators | where new players appear (and what spawn protection surrounds) |
| `/kick <player> [reason]`, `/ban <player> [reason]`, `/pardon <player>`, `/banlist` | operators | |
| `/whitelist <on \| off \| add \| remove \| list> [player]` | operators | |
| `/op <player>`, `/deop <player>` | operators | |
| `/say <text>`, `/seed`, `/save` | operators | |
| `/export` | operators | writes the whole world as one file (`world.export.vxw.json`, next to the world folder) that the game's Import World reads |
| `/account add <name> <password>` | operators | make an account (for a name that has played here before: everything they had is theirs) |
| `/account password <name> <password>`, `/account rename <name> <new name>` | operators | |
| `/account remove <name>` | operators | the login goes; what they had is kept |
| `/account lock <name \| *> <name \| password \| skin> [on \| off]` | operators | stop one player (or, with `*`, everyone) changing their own name, password or skin |
| `/account list` | operators | every account; the server window and console are also shown the passwords |
| `/setskin <player> reset` | operators | back to the default skin. From the console: `/setskin <player> <file.png>` (a path from the data folder). The server window has a Set skin button |
| `stop` | the server window only | saves and stops |

Changes to the operators, the bans, the whitelist, the locks and the default mode are written back into `server.json`.

## Accounts

Since 6.49 each server keeps its own accounts. Nothing is central: whoever runs a server makes the accounts on it.

1. An operator makes one: `/account add <name> <password>` in the console or the game's chat, or Add account on the
   server window's Players tab. Give the player the name and the password.
2. The player opens Multiplayer and joins. The server asks for the username and password before they spawn. Five wrong
   tries and the connection is closed; one try a second. The game remembers the username per server, and the password
   only if the player ticks "Remember the password" (in that browser).
3. The account is the player's record: `playerdata/<name>.json`. The password is its second line, **in plain text**, so the
   owner can read it. The game says so where the player changes it (Settings, while online). Players should not reuse a
   password they use anywhere else.
4. Logging in to an account that is already online closes the older connection ("logged in from another location").
5. Operators are names on a list, so with accounts on an operator's rights can no longer be taken by typing their name.

The password never goes back to a game (not in the welcome, not in `/status`, not in `/export`) and is hidden in the log
of an `/account` command typed in the game.

## Hosting a single-player world

Export the world from the game's pause menu (Export World), save the file as `server/data/world.vxw.json` and start the
server: it is read once and becomes the folder `server/data/world/`. The seed, the game rules, every block edit and every chest come along. The exporter's own inventory does not (a
player's things are stored per name once they have joined), and neither do that world's mobs or vehicles.

To take a server's world back into single player, run `/export` (or `export` in the server window) and import the file
it writes.

## The server runs the mobs

Since 6.13 the server runs part of the game itself, the way a Minecraft server does. When it has a game file to hand out,
it also loads that game without a screen, in a thread of its own, and that copy spawns, moves and saves every ordinary
mob, villager, Nuke Keg and plain boss in the Overworld. The players' games only draw them.

- Mobs spawn around every player (each with their own cap), go for the nearest player, and keep going while a player
  has a menu open. A mob with nobody within 72 blocks waits where it is.
- A mob hits a player through that player's own game, which applies their armour. What it drops and the XP it leaves
  come from the server.
- Whatever a player's game spawns (a spawn egg, a jar, a village being populated, a spawner) is handed to the server on
  the spot. A village or a boss room gets one set of inhabitants however many players visit it.
- Mobs are saved with the world: `entities/` lists each one with its type, place and health, and a restarted server puts
  them back. Villagers and bosses stay where they are when everybody leaves; ordinary mobs still despawn.
- It costs about 110 MB of memory with nobody on, and a few MB more for the land around each player. Each further
  dimension a player has visited since the server started costs about the same again.
- `"simulate": false` in `server.json` turns it off (so does having no game file). Then the players' games run the
  mobs between them, as before 6.13.
- **Vehicles** (6.14) are the server's too: a car, boat, plane, cart or skateboard placed in the Overworld is kept, moved
  and saved by the server's game, and everyone sees it where it stands. Getting on makes it yours for the ride (your game
  drives it; a second player is told someone else is driving); getting off gives it back. Breaking one breaks it for
  everyone and drops one item.
- **Water, fire and falling blocks** (6.15) are the server's in the Overworld. Its game flows the water and drops the sand
  and gravel; a player's game does neither, and is shown the block falling. A fire a player's game would start is lit by
  the server, which tells everyone where the flames are and burns the blocks down once.
- **Furnaces** (6.15, every dimension) are cooked by one game: the player's who has the window open, otherwise the
  server's. A furnace keeps smelting with nobody near it and nobody's game racing another's.
- **Every dimension** (6.17): the Nether and the Aether each get a game of their own, started the moment the first
  player goes there (and restarted the same way if one ever stops). Everything above applies in them. Each costs about
  as much memory as the Overworld's. Puppet Purgatory stays each player's own: it is built around one player's progress.

## What is shared, and what is not

Shared by everyone, kept by the server and saved every 30 seconds:

- every block placed or broken, in every dimension
- chests, furnaces, terrariums and display stands. One player at a time: the second one to open a chest is told who is in it
- dropped items: thrown, mined, spilled from a broken chest or left where someone died. Everyone sees the same ones, the
  server decides who picks one up (the first to reach it), and they lie there for 5 minutes like in single player
- the time of day and the game rules. A bed is a vote: the night is skipped when `sleepPercent` of the players online are
  in bed. The clock and the rules can only be changed by an operator (or by anyone, if you turn `cheats` on)
- ordinary mobs: zombies, skeletons, boomers, spiders, pigs, cows, sheep and the Nether and Aether locals. Each one is run
  by the game of the player nearest to it (so that is who it chases) and everyone nearby sees the same mob, can hit it and
  can loot it. When another player gets clearly closer, it changes hands
- since 6.11 also the villagers, the Nuke Kegs, and the dungeon boss, the Stone Titan and the Nether and Aether bosses.
  A boss fights the player whose game runs it and stays with that game while its player is within 40 blocks; everyone
  else sees it and can hurt it. A village or a boss room is populated once, not once per player standing there
- explosions (everyone nearby is hurt, not just the player whose game set it off), and arrows and bullets between players
- each player's inventory, armour, XP, Dingle Bucks, spawn point, position and game mode, by name
- the world spawn, where new players appear (the first player's game finds it; `/setworldspawn` moves it)
- what the world remembers (6.16): which structures have been found and populated, which dimension bosses are dead,
  where spawners stand and mega nukes went off. One game finding a village finds it for everyone
- the stock market (6.16): one market, run by the server's game. Each player's shares and balance are their own
- chat, the player list (with each player's ping), players' positions, what they hold, the armour they wear and the car,
  boat, plane, cart or skateboard they are riding, punches and sword hits between players
- the sound and the dust of a block another player places or breaks nearby
- what flies (6.14): arrows, bullets, grenades, lit TNT, a boss's rocks and fireballs, XP orbs. Each still belongs to one
  game, which decides what it hits; everyone nearby sees a copy that looks the same and touches nothing. That includes
  the arrows of skeletons the server runs

Not shared yet: each player's own game still plays these by itself, so two players standing together do not see the same ones.

- dragons (tamed and ridden by one player), snakes, blocklings and the Puppet Purgatory and Malgorath casts.
  What a mob drops when you kill it is shared like any other dropped item; the XP goes to the player whose game ran it
- vehicles in Puppet Purgatory, or on a server with `simulate` off: you see one under the player riding it; an empty
  one is only in the game that placed it
- the dungeon boss and the Stone Titan have no record of their own: the dungeon boss is covered by its dungeon being
  marked as found, the Titan is summoned by hand
- paintings and records from the Creativity Update: each player's works are saved with that player (6.16), but a work
  handed to another player does not show for them

Loot is rolled once (6.15): a chest the world already has can only be changed by the player who has it open, so a later
visitor's game cannot refill a structure's chest with loot of its own. Outside the
three hosted dimensions (and on a server with `simulate` off) mobs are not saved with the world: when the last player near one leaves, it is gone. When a player leaves or loses their connection, the
mobs their game was running go to the nearest other player (they stand still for a moment first). A game that is paused
(a menu open) hands its mobs to the nearest other player. Where the server does not run the world (other dimensions, or
`simulate` off), water is flowed by one game per area (the lowest-numbered player nearby) and fire and falling blocks
run in every game, so now and then an item knocked loose by one of those can appear once per player nearby. Dropped items of the same kind do not merge into
one pile on a server, and they only grow old while someone is online.

Two players who both kept the default name can both join: the second is called `Dan_2`. If the first has gone silent (a
dropped connection the server has not noticed yet), the newcomer takes the name and its inventory instead, and the old
connection is closed.

## How much to trust it

This is a server for friends. With accounts on (the default for a new server, see "Accounts") a player is whoever has
the password; with them off, whoever types the name, which is also all an operator is. The server has no terrain and does not run the
game, so it checks what it can without one: who may change the time and the rules, that a hit came from within reach,
that you are standing by the item you pick up, that only one player writes to a chest, that nobody but an operator
builds at spawn, and it writes the death messages itself. It validates everything it stores (block keys, ids, sizes),
limits how many messages of each kind a player may send in a second, and drops clients that send oversized or malformed
data or keep flooding it. A player who goes silent is given up after 20 seconds. What it cannot do is stop a modified game from giving itself
diamonds or walking through walls: inventories and movement are still each player's own game being honest. Do not put it
on the open internet for strangers.
