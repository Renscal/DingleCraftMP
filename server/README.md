# The DINGLECRAFT multiplayer server

No dependencies and nothing to install: `dinglecraft-server.mjs` plus the `lib/` folder beside it. It needs [Node.js](https://nodejs.org) 20 or newer and a game build of 6.10 or newer.

## Start it

**Windows:** double-click `Start Server.bat`. If Node.js is missing it says so and tells you where to get it. Windows
Firewall will ask once whether Node may accept connections: allow it on private networks.

**Anything else (or a terminal on Windows):**

```sh
node server/dinglecraft-server.mjs
```

The window prints the addresses to hand out. Stop it with `stop` or Ctrl+C; the world is saved first.

## How players join

- If the server found a game file, players just open `http://<your address>:40162/` in a browser. The server hands them
  the game, the Multiplayer screen already has the address filled in, and everyone is guaranteed to run the same version.
- Otherwise each player opens their own copy of the game, chooses **Multiplayer** on the main menu and types
  `<your address>:40162`.

The server looks for a game file named `dinglecraft_v<version>.html` (6.10 or newer) in `data/`, next to the server, and
in the repo's `dist/` (so `npm run build` is enough in a checkout). `--game <file>` names one directly.

Friends on the same network use your local address (the window lists it). Friends elsewhere need your public address and
TCP port 40162 forwarded to your computer on your router.

A page served over `https://` cannot talk to a plain `ws://` server (browsers forbid it). Open the game from the server's
own `http://` address, or from a file on disk, and it works.

## Settings

The first run writes `data/server.json`. Edit it and restart, or pass the same things on the command line (which wins):

| setting | option | default | |
|---|---|---|---|
| `port` | `--port` | 40162 | TCP port for both the game page and the game connection |
| `name` | `--name` | A DINGLECRAFT Server | shown to players when they join |
| `motd` | `--motd` | | one line shown in chat on joining |
| `password` | `--password` | | if set, players must type it |
| `maxPlayers` | `--max` | 8 | |
| `seed` | `--seed` | random | only for a new world |
| `mode` | `--mode` | `s` | `s` survival or `c` creative: what new players start in (an operator can give one player another with `/gamemode`); applied on every start |
| `pvp` | `--no-pvp` | true | whether players can hurt each other |
| `rules` | | see below | the world's game rules; applied on every start |
| `world` | `--world` | `world.vxw.json` | the world file, inside the data folder unless it is a full path |
| `game` | `--game` | found automatically | the game html to hand out |
| | `--data` | `data/` next to the server | where `server.json` and the world live |
| `ops` | | `[]` | the operators, by name: they may use every command and build at spawn |
| `whitelist`, `allow` | | `false`, `[]` | with the whitelist on, only the names in `allow` (and the operators) may join |
| `bans` | | `[]` | names (or addresses) that may not join |
| `spawnProtection` | | 16 | blocks around the world spawn that only operators may change. Like Minecraft, it only applies once the server has an operator; 0 turns it off |
| `sleepPercent` | | 100 | how many of the players online must be in bed to skip the night |
| `viewChunks` | | 12 | how far around a player the server sends block changes, for a game that does not say (the game asks for its own draw distance + 3) |

`data/` is ignored by git: the world, the settings and the password stay on your machine.

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
  "fbOK": true,
  "store": true,
  "powers": true,
  "cheats": false
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
| `fbOK` | players may use the Fullbright setting |
| `store` | the Dingle Store in the pause menu |
| `powers` | superpowers (the P menu) |
| `cheats` | the debug menu, for every player. Off by default on a server: with it on, anyone can change the rules and give themselves things |

- The server writes this block itself: on the first run, and into an older `server.json` that does not have it yet.
- A rule left out of the file keeps the value the world already has.
- If `cheats` is on and a player changes a rule from the game's debug menu, the server writes the new value back into
  `server.json`, so the file always shows what the world is running with.
- A first run next to an existing world file (one exported from single player, say) takes that world's mode and rules as
  the starting values.
- `seed` only matters when the world is created. To start over with a new seed, stop the server and delete (or rename)
  the world file.

## Commands

The server window takes commands, and so does the game's chat for a player who is an operator (type `/` first there).
The first operator is made from the server window (`op <name>`) or by adding the name to `ops` in `server.json`.

| command | who | |
|---|---|---|
| `/help`, `/list` | everyone | what you may run; who is online |
| `/msg <player> <text>` (or `/w`, `/tell`) | everyone | a whisper only the two of you see |
| `/me <action>` | everyone | `* Dan waves` |
| `/tp [who] <player \| x y z>` | operators | teleport yourself or someone else (within one dimension) |
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
| `stop` | the server window only | saves and stops |

Changes to the operators, the bans, the whitelist and the default mode are written back into `server.json`.

## Hosting a single-player world

Export the world from the game's pause menu (Export World), save the file as `server/data/world.vxw.json` and start the
server. The seed, the game rules, every block edit and every chest come along. The exporter's own inventory does not (a
player's things are stored per name once they have joined), and neither do that world's mobs or vehicles.

The server's world file is still a normal save with a `players` table added, so it can be imported back into the game.

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
- explosions (everyone nearby is hurt, not just the player whose game set it off), and arrows and bullets between players
- each player's inventory, armour, XP, Dingle Bucks, spawn point, position and game mode, by name
- the world spawn, where new players appear (the first player's game finds it; `/setworldspawn` moves it)
- chat, the player list, players' positions and what they hold, punches and sword hits between players

Not shared yet: each player's own game still plays these by itself, so two players standing together do not see the same ones.

- the special mobs: bosses, dragons, villagers, snakes, blocklings, titans and the Puppet Purgatory and Malgorath casts.
  What a mob drops when you kill it is shared like any other dropped item; the XP goes to the player whose game ran it
- vehicles, and arrows as things you can see (the hit arrives, the arrow in the air is only in the archer's game)
- paintings and records from the Creativity Update (the works are stored per player)
- the stock market

Things that follow from that: loot chests in a structure refill the first time each player visits it. Mobs are not saved
with the world: when the last player near one leaves, it is gone, and a mob whose owner loses their connection vanishes
after a few seconds. A game that is paused (a menu open) hands its mobs to the nearest other player. Water is flowed by
one game per area (the lowest-numbered player nearby); fire and falling blocks still run in every game, so now and then
an item knocked loose by one of those can appear once per player nearby. Dropped items of the same kind do not merge into
one pile on a server, and they only grow old while someone is online.

Two players who both kept the default name can both join: the second is called `Dan_2`. If the first has gone silent (a
dropped connection the server has not noticed yet), the newcomer takes the name and its inventory instead, and the old
connection is closed.

## How much to trust it

This is a server for friends. There are no accounts: a player is whoever types that name, which is also all an operator
is, so use the password (and the whitelist) if the address gets around. The server has no terrain and does not run the
game, so it checks what it can without one: who may change the time and the rules, that a hit came from within reach,
that you are standing by the item you pick up, that only one player writes to a chest, that nobody but an operator
builds at spawn, and it writes the death messages itself. It validates everything it stores (block keys, ids, sizes) and
drops clients that send oversized or malformed data. What it cannot do is stop a modified game from giving itself
diamonds or walking through walls: inventories and movement are still each player's own game being honest. Do not put it
on the open internet for strangers.
