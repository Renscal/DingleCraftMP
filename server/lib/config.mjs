// config.mjs: everything that is a setting, a limit or a constant. No state, no sockets.
//
//   PROTO, DAY_LEN         must match the game (NT_PROTO in src/net/n0_contract.js, DAY_LEN in src/core/p01a_prologue.js)
//   LIMITS, the key regexes what the server accepts from a client
//   RULES, cleanRules      the world's game rules, as server.json lists them
//   DEFAULTS               the settings a fresh server.json starts with
//   parseArgs, HELP        the command line
//   findGame, cmpVer       which game html to hand out
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* the multiplayer protocol version: a game and a server with different numbers refuse each other */
export const PROTO = 3;
/* seconds per in-game day */
export const DAY_LEN = 600;
/* the oldest game build that can talk to this server */
export const MIN_GAME = '6.13';
/* the folder the server lives in (one up from lib/): data/ and a dropped-in game html are looked for here */
export const SERVER_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const LIMITS = {
  frame: 2 * 1024 * 1024,        // biggest message a client may send, in bytes
  backlog: 32 * 1024 * 1024,     // a client with this much unsent data queued is dropped
  editsPerMsg: 8192,             // block edits in one message
  playerBlob: 512 * 1024,        // a saved player (inventory and all)
  beBlob: 64 * 1024,             // one chest or furnace
  dropBlob: 4096,                // one dropped item
  rulesBlob: 4096,               // a game-rules change
  drops: 4000,                   // dropped items the world holds at once
  dropLife: 300,                 // seconds before a dropped item disappears (the game's own lifetime)
  syncBatch: 4000,               // block edits per message while a player joins
  hitReach: 6,                   // blocks between two players for a melee hit to count
  shotReach: 96,                 // ... and for an arrow or a bullet
  hitGap: 250,                   // milliseconds between two hits from one player
  takeReach: 10,                 // blocks between a player and a dropped item they pick up
  goneReach: 256,                // ... and one their game says was destroyed
  lockReach: 12,                 // a chest stays locked to a player only while they stand this close
  poseNear: 128,                 // players this close (same dimension) see each other at full rate; the rest once a second
  mobRange: 128,                 // how far a player's mobs and explosions are passed on
  mobsPerMsg: 64,                // mobs in one update
  mobBlob: 8192,                 // one mob update
  sleepVote: 30,                 // seconds a "sleeping" vote lasts
  msgsPerSec: 300,               // messages of every kind from one player in a second (a busy game sends about 40)
  floodSecs: 3,                  // ... and this many seconds in a row over it ends the connection
  cellsPerSec: 60000,            // block edits from one player in a second (a nuke is a few thousand)
  quietPing: 5000,               // milliseconds of silence before the server pings a player
  quietDrop: 20000,              // ... and before it gives up on them
  sentSlack: 8,                  // chunks beyond a player's view the server still counts as "they have it"
  mobs: 4000,                    // mobs the world file holds at once
  fxRange: 96,                   // how far something that flies is announced
  vehRange: 128,                 // ... and how far a vehicle is
};

/* messages from one player per second, by type (pose, chat, cmd, hit, mobs, mhit and boom keep their own counters in
   lib/protocol.mjs). Over the limit, a message is dropped without a word: a real game never gets near these. */
export const RATE = { edits: 40, be: 60, open: 20, close: 20, drop: 80, dropAt: 80, take: 80, save: 4, rd: 4, time: 10, gr: 4, sleep: 6, death: 20,
  spawn: 2, mgone: 20, mgive: 200, ping: 4, fx: 70, fxgone: 70, vehs: 30, vgive: 20, vtake: 20, vfree: 20, vgone: 20, vhit: 20 };

/* the save format's own keys, checked before anything is stored under them */
export const CK_RE = /^(?:[a-z];)?-?\d{1,7},-?\d{1,7}$/;            // chunk key: optional dimension prefix + cx,cz
export const LK_RE = /^\d{1,2},\d{1,3},\d{1,2}$/;                   // local block key: lx,y,lz
export const BK_RE = /^(?:[a-z];)?-?\d{1,9},-?\d{1,3},-?\d{1,9}$/;  // block key: optional dimension prefix + x,y,z
export const DROP_ID_RE = /^[a-z0-9]{1,12}\.[a-z0-9]{1,8}$/;        // a dropped item's id, made by the game that dropped it
export const DIMS = new Set(['over', 'nether', 'aether', 'puppet']);
/* the save format's chunk-key prefix for each dimension (dimPfx in src/world/p03b_dimkeys_genchunk.js) */
export const DIM_PFX = { over: '', nether: 'n;', aether: 'a;', puppet: 'm;' };

/* The world's game rules, as server.json's "rules" lists them. Names and defaults are the game's own (GR_DEF in
   src/ui/p27_debug_gamerules_settings.js) with one difference: Cheats (the debug menu) is off unless the host turns it on.
   tests/net/n_static.js keeps this in step. */
export const RULES = { keepInv: false, god: false, mobGrief: true, mobSpawn: true, dayCycle: true, fireTick: true, fallDmg: true, snail: true, jsc: 0,
  instaKill: false, freezeMobs: false, ghosts: true, fbOK: true, store: true, powers: true, cheats: false };

/* only rules the game knows, each with the right type (numbers 0..100) */
export function cleanRules(r) {
  const out = {};
  if (r && typeof r === 'object') for (const k of Object.keys(RULES)) if (typeof r[k] === typeof RULES[k] && (typeof r[k] !== 'number' || (Number.isFinite(r[k]) && r[k] >= 0 && r[k] <= 100))) out[k] = r[k];
  return out;
}

/* a fresh data/server.json (rules is filled in from the world on the first run: lib/cli.mjs) */
export const DEFAULTS = { port: 40162, name: 'A DINGLECRAFT Server', motd: '', password: '', maxPlayers: 8, seed: '', mode: 's', pvp: true, world: 'world', game: '', rules: null,
  ops: [], whitelist: false, allow: [], bans: [], spawnProtection: 16, sleepPercent: 100, viewChunks: 12, cert: '', key: '', origins: [], simulate: true };

/* a list of player names (or addresses) from the settings: lower case, no blanks, no repeats */
export function cleanList(v) {
  return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 500) : [];
}

/* the command line -> a partial settings object (only what was given); throws on anything it does not know */
export function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => { if (i + 1 >= argv.length) throw new Error('missing value after ' + a); return argv[++i]; };
    if (a === '--port') o.port = Number(val());
    else if (a === '--world') o.world = val();
    else if (a === '--game') o.game = val();
    else if (a === '--seed') o.seed = val();
    else if (a === '--mode') o.mode = val();
    else if (a === '--name') o.name = val();
    else if (a === '--motd') o.motd = val();
    else if (a === '--password') o.password = val();
    else if (a === '--max') o.maxPlayers = Number(val());
    else if (a === '--no-pvp') o.pvp = false;
    else if (a === '--data') o.data = val();
    else if (a === '--cert') o.cert = val();
    else if (a === '--key') o.key = val();
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('unknown option ' + a);
  }
  return o;
}

export const HELP = 'DINGLECRAFT multiplayer server\n\n  node dinglecraft-server.mjs [options]\n\n' +
  '  --port <n>        port to listen on (default ' + DEFAULTS.port + ')\n  --name <text>     the server name players see\n  --motd <text>     a line shown to players when they join\n' +
  '  --password <text> require this password to join\n  --max <n>         most players at once (default 8)\n  --seed <text>     seed for a NEW world (blank = random)\n' +
  '  --mode s|c        survival or creative (applied on every start)\n  --no-pvp          players cannot hurt each other\n' +
  '  --world <name>    the world folder (default "world" in the data folder). Name an exported single-player world\n' +
  '                    (a .json file) and it is read once into a folder of the same name\n' +
  '  --game <file>     the game html to hand out at http://<address>:<port>/\n  --data <dir>      where the world and server.json live (default: data/ next to the server)\n' +
  '  --cert <file> --key <file>   a TLS certificate and its private key (PEM): the server then speaks https:// and wss://\n\n' +
  'The same settings live in data/server.json (the command line wins), and so do the world\'s game rules:\n' +
  '  "rules": { ' + Object.keys(RULES).map((k) => `"${k}": ${RULES[k]}`).join(', ') + ' }\n' +
  'Edit the file and restart the server. The rules and the mode in the file are applied to the world on every start.';

/* compare two "6.10"-style versions: negative, zero or positive */
export function cmpVer(a, b) {
  const A = String(a).split('.').map(Number), B = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(A.length, B.length); i++) { const d = (A[i] || 0) - (B[i] || 0); if (d) return d; }
  return 0;
}

/* the newest multiplayer-capable build we can find: the data folder, next to the server, or dist/ in a repo checkout.
   Returns {file, version} or null. An explicit path is used as given (version read from its name when it has one). */
export function findGame(explicit, dataDir) {
  const ver = (n) => { const m = /dinglecraft_v(\d+\.\d+)\.html$/i.exec(n); return m ? m[1] : null; };
  if (explicit) return fs.existsSync(explicit) ? { file: path.resolve(explicit), version: ver(explicit) } : null;
  let best = null;
  for (const dir of [dataDir, SERVER_DIR, path.join(SERVER_DIR, '..', 'dist')]) {
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const n of names) {
      const v = /^dinglecraft_v/i.test(n) ? ver(n) : null;
      if (v && cmpVer(v, MIN_GAME) >= 0 && (!best || cmpVer(v, best.version) > 0)) best = { version: v, file: path.join(dir, n) };
    }
  }
  return best;
}
