#!/usr/bin/env node
// DINGLECRAFT multiplayer server (game 6.25 and up). No dependencies: plain Node 20+, on Windows, macOS or Linux.
//
//   node server/dinglecraft-server.mjs [--port 40162] [--world file] [--game file.html] [--seed text] [--mode s|c]
//                                      [--name text] [--max 8] [--no-pvp] [--data dir]
//   Windows: double-click "Start Server.bat" next to this file.
//
// What it is: the keeper of one shared world. It owns the seed, the game rules, the time of day, every block edit, every
// chest and furnace, every dropped item, and each player's inventory and position (by name); it relays positions, chat
// and hits between players. It also serves the game's html on the same port, so friends only need http://<your address>:<port>/ .
// Since 6.13 it also runs part of the game: the Overworld's mobs are spawned, moved and saved by the server's own copy of
// the game, running headless in a thread (lib/host.mjs), and the players' games only draw them. Everything else that
// moves (projectiles, vehicles, water) is still each player's game; server/README.md has the full list.
//
// The world is a folder (level.json, region/, entities/, playerdata/: lib/world.mjs). What fills it is packed (6.60:
// lib/region.mjs); the rest is readable JSON. --world also accepts a world exported from the game's pause menu, and /export
// writes one file the game can import again.
//
//   node server/dinglecraft-server.mjs view|unpack|pack|files|find ...   the world's files, without starting a server
//                                                                        (lib/files.mjs: view <file> prints one as JSON,
//                                                                        find diamond searches the world)
//
// This file is only the front door. The server itself is in lib/:
//   lib/config.mjs      settings, limits, the game rules, the command line          (no state)
//   lib/world.mjs       the world as data: new, load, apply settings, save, validate
//   lib/region.mjs      the packed region and entity files, their readable form, and searching a world
//   lib/files.mjs       view, unpack, pack, files and find, from the command line
//   lib/websocket.mjs   the WebSocket wire format                                    (knows nothing about the game)
//   lib/protocol.mjs    what every game message means                                (knows nothing about sockets)
//   lib/commands.mjs    the slash commands, for operators and for the server window
//   lib/http.mjs        the game page and /status
//   lib/host.mjs        the server's own game: starts it in a thread (lib/host_worker.cjs, with the hollow browser of
//                       lib/headless.cjs) and passes messages to and from it
//   lib/server.mjs      createServer: puts the above together
//   lib/cli.mjs         the program: server.json, the banner, the console commands
//   lib/admin.mjs       --ipc: the server run and watched by another program (the window in server-gui/), and the
//                       check server.json's values must pass
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from './lib/cli.mjs';

/* for programs and the test suites: import { createServer } from this file */
export { createServer } from './lib/server.mjs';
export { PROTO, RULES } from './lib/config.mjs';

/* run only when started directly (not when a test imports it). Windows paths compare without case: C:\ and c:\ are one drive. */
const isMain = (() => {
  try {
    const a = fs.realpathSync(process.argv[1]), b = fs.realpathSync(fileURLToPath(import.meta.url));
    return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch { return false; }
})();
if (isMain) main();
