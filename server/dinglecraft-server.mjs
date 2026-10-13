#!/usr/bin/env node
// DINGLECRAFT multiplayer server (game 6.11 and up). No dependencies: plain Node 20+, on Windows, macOS or Linux.
//
//   node server/dinglecraft-server.mjs [--port 40162] [--world file] [--game file.html] [--seed text] [--mode s|c]
//                                      [--name text] [--password text] [--max 8] [--no-pvp] [--data dir]
//   Windows: double-click "Start Server.bat" next to this file.
//
// What it is: the keeper of one shared world. It owns the seed, the game rules, the time of day, every block edit, every
// chest and furnace, every dropped item, and each player's inventory and position (by name); it relays positions, chat
// and hits between players. It also serves the game's html on the same port, so friends only need http://<your address>:<port>/ .
// What it is not: it does not run the game. Mobs, vehicles and bosses are simulated by each player's own
// game and are not shared (server/README.md has the full list).
//
// The world file is a normal DINGLECRAFT save (.vxw.json) with a "players" and a "drops" table added, so --world accepts a
// world exported from the game's pause menu, and the server's file can be imported back into single player.
//
// This file is only the front door. The server itself is in lib/:
//   lib/config.mjs      settings, limits, the game rules, the command line          (no state)
//   lib/world.mjs       the world as data: new, load, apply settings, save, validate
//   lib/websocket.mjs   the WebSocket wire format                                    (knows nothing about the game)
//   lib/protocol.mjs    what every game message means                                (knows nothing about sockets)
//   lib/commands.mjs    the slash commands, for operators and for the server window
//   lib/http.mjs        the game page and /status
//   lib/server.mjs      createServer: puts the above together
//   lib/cli.mjs         the program: server.json, the banner, the console commands
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
