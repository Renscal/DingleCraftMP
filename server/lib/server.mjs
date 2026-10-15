// server.mjs: createServer puts the pieces together. One call makes one server: it opens (or generates) the world, accepts
// connections, hands each message to the protocol, runs the clocks, and returns a small object to drive it with.
//
//   const S = createServer({ port, data, world, seed, mode, rules, name, motd, accounts, maxPlayers, pvp, game, ... });
//   await S.listen();   ...   await S.close();
//
// Options are the settings of data/server.json (lib/config.mjs DEFAULTS) plus a few for programs and tests:
//   data      the folder the world lives in (default: data/ next to the server)
//   world     the world folder's name inside it (lib/world.mjs has the layout); a name ending in .json is a world file from
//             before 6.12 or an exported save, read once into a folder of the same name; '' = never write anything
//   memory    true = a throwaway world, no disk at all
//   noGame    true = do not look for a game html to hand out                  quiet   true = no log lines
//   onRules   called with the rules when a player changes one in the game
//   onSettings called when a command changed the ops, the bans, the whitelist or the default game mode
//   cert, key a TLS certificate and its private key (PEM files, inside the data folder unless a full path): with both, the
//             server speaks https:// and wss:// instead of http:// and ws://
//   simulate  false = the server does not run the Overworld's mobs itself (lib/host.mjs); the players' games do, as before 6.13
//   hostGame  the game script for that, when it is not to be taken from the game html (the suites pass build/game.js)
//   origins   web addresses whose pages may connect, besides the server's own page and a game opened from a file
//             ([] = any page may, which is what "open your own copy of the game" needs)
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { DEFAULTS, LIMITS, SERVER_DIR, cleanRules, cleanList, findGame } from './config.mjs';
import { openWorld, applySettings, writeWorld, worldPlace, exportWorld } from './world.mjs';
import { acceptUpgrade, newConn, textFrame, readFrames, PING, CLOSE } from './websocket.mjs';
import { handleMessage, worldTick, forget, playerKey, setSkin } from './protocol.mjs';
import { runCommand } from './commands.mjs';
import { pageHandler, statusOf } from './http.mjs';
import { startHost, gameScript } from './host.mjs';

/* what the server's own game is told along with the players (the rest is not its business, or goes to it by name) */
const HOST_WANTS = new Set(['join', 'leave', 'pose', 'be', 'drop', 'undrop', 'time', 'gr', 'wd']);

/* make one server (not yet listening). Throws if the world file exists but cannot be read. */
export function createServer(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  for (const k of ['ops', 'allow', 'bans']) o[k] = cleanList(o[k]);   // names are compared in lower case
  o.whitelist = o.whitelist === true;
  /* every logged line also goes to o.onLog, if there is one (the --ipc mode's parent: lib/admin.mjs) */
  const log = (...a) => {
    if (typeof o.onLog === 'function') { try { o.onLog(new Date().toTimeString().slice(0, 8) + ' ' + a.join(' ')); } catch { /* a listener must never stop the server */ } }
    if (!o.quiet) console.log(new Date().toTimeString().slice(0, 8), ...a);
  };
  const dataDir = path.resolve(o.data || path.join(SERVER_DIR, 'data'));
  const place = o.world && !o.memory ? worldPlace(dataDir, o.world) : null;   // null: nothing is ever written (tests)
  const worldDir = place ? place.dir : null;
  const game = o.noGame ? null : findGame(o.game, dataDir);
  o.origins = cleanList(o.origins).map((s) => s.replace(/\/+$/, ''));
  /* TLS: read once, at start. A file that is named but cannot be read stops the server rather than quietly serving in the clear. */
  const tls = o.cert && o.key ? { cert: fs.readFileSync(path.resolve(dataDir, o.cert)), key: fs.readFileSync(path.resolve(dataDir, o.key)) } : null;

  /* ---- the world ---- */
  const { world, isNew, seen, stale } = openWorld(place, o, log);
  delete world.rvisit;                  // 6.51 to 6.59: when each region was last visited (for the compressed files 6.60 dropped)
  /* 6.50: the world's clock (lib/protocol.mjs worldTick; the games catch up crops and furnaces by it) went on while the
     server was off: the time since the last save is added, at most catchUpMax minutes if that is set. A single-player
     world brings the moment its save was written as "wall". */
  { const at = typeof world.savedAt === 'number' ? world.savedAt : typeof world.wall === 'number' ? world.wall : 0;
    delete world.wall;
    if (typeof world.clock !== 'number' || !Number.isFinite(world.clock)) world.clock = 0;
    const gap = at && Date.now() > at ? (Date.now() - at) / 1000 : 0;
    world.clock += o.catchUpMax > 0 ? Math.min(gap, o.catchUpMax * 60) : gap; }
  applySettings(world, o.rules, opts.mode);    // opts, not o: a mode nobody asked for must not override the world file's

  /* ---- the server's state, shared with lib/protocol.mjs and lib/http.mjs ---- */
  const S = {
    o, log, world,
    dirty: true,                        // the world differs from the file (true at start: the settings were just applied)
    clients: new Map(),                 // id -> a player who has said hello
    locks: new Map(),                   // block key -> the id of the player using that chest or furnace
    hosts: new Map(),                   // dimension -> the server's own game for it (lib/host.mjs), once it has been started
    hdims: [],                          // the dimensions the server can run a game for ([]: it runs none)
    vown: new Map(),                    // vehicle id -> the id of the player riding it (the rest are the server's game's)
    nextId: 1,
    editCount: 0,
    gameFile: game ? game.file : null,
    gameVersion: game ? game.version : null,   // every player must run this version; without a game file, the first player's
  };
  const pending = new Set();            // every open socket, joined or not (for timeouts and shutdown)

  /* 6.50: savedAt goes into level.json with the clock, so the next start knows how long the server was off */
  function saveWorld(why) {
    if (!worldDir || !S.dirty) return false;
    try { world.savedAt = Date.now(); const n = writeWorld(worldDir, world, seen); S.dirty = false; if (why) log(`world saved (${why}: ${n} file${n === 1 ? '' : 's'} changed)`); return true; }
    catch (e) { log('WORLD SAVE FAILED: ' + e.message); return false; }
  }
  S.saveWorld = saveWorld;              // the /save command
  /* the /export command: the whole world as the one file the game can import, next to the world folder */
  S.exportWorld = () => {
    if (!worldDir) return null;
    const file = worldDir + '.export.vxw.json';
    fs.writeFileSync(file + '.tmp', exportWorld(world)); fs.renameSync(file + '.tmp', file);
    return file;
  };
  if (isNew && worldDir) saveWorld('new world: ' + worldDir);   // on disk before anyone joins
  else if (stale && worldDir) saveWorld(`${stale} file${stale === 1 ? '' : 's'} from an older server written in the 6.60 form`);

  /* ---- sending ---- */
  function sendRaw(c, buf) {
    if (c.closed) return;
    if (c.sock.writableLength > LIMITS.backlog) return drop(c, 'too far behind');
    c.sock.write(buf);
  }
  const send = (c, m) => (c.host ? c.h.post(m) : sendRaw(c, textFrame(JSON.stringify(m), c.deflate)));
  /* to every player who has finished joining, except one (usually the sender); onlyIf(client) narrows it further */
  function broadcast(m, except, onlyIf) {
    const bufs = [null, null];                          // encoded once per kind of connection (plain, compressed), and only if someone gets it
    let json = null;
    for (const c of S.clients.values()) if (c !== except && c.ready && (!onlyIf || onlyIf(c))) {
      const i = c.deflate ? 1 : 0;
      sendRaw(c, bufs[i] || (bufs[i] = textFrame(json || (json = JSON.stringify(m)), c.deflate)));
    }
    if (HOST_WANTS.has(m.t)) for (const h of S.hosts.values()) if (except !== h.c) h.post(m);
  }
  /* end a connection. tell = send the reason first (a refusal or a kick), so the player's game can show it. */
  function drop(c, why, tell) {
    if (c.closed || c.host) return;
    if (tell) { try { c.sock.write(textFrame(JSON.stringify({ t: 'kick', why }))); } catch { /* gone */ } }
    c.closed = true;
    try { c.sock.write(CLOSE); c.sock.end(); } catch { /* gone */ }
    setTimeout(() => { try { c.sock.destroy(); } catch { /* gone */ } }, 500).unref();
    if (c.id && S.clients.get(c.id) === c) {
      S.clients.delete(c.id);
      forget(S, net, c);
      log(`- ${c.name} left (${why}); ${S.clients.size} online`);
      broadcast({ t: 'leave', id: c.id });
      broadcast({ t: 'sys', txt: c.name + ' left the game' });
    }
  }
  const net = { send, broadcast, drop };

  /* ---- receiving ---- */
  /* may a page from this web address open a connection? Always: the server's own page, a game opened from a file (or the
     desktop client), and anything that is not a browser. Other pages only when the settings list none, or list them. */
  function originOK(req) {
    const og = String(req.headers.origin || '').toLowerCase().replace(/\/+$/, '');
    if (!o.origins.length || !og || og === 'null' || og.startsWith('file:')) return true;
    const host = og.replace(/^[a-z]+:\/\//, '');
    return host === String(req.headers.host || '').toLowerCase() || o.origins.includes(og) || o.origins.includes(host);
  }
  function onText(c, text) {
    /* every message counts toward one budget per second; a few seconds in a row over it is a flood, not a game */
    const now = Date.now();
    if (now - c.msgT >= 1000) { c.flood = c.msgN > LIMITS.msgsPerSec ? c.flood + 1 : 0; c.msgT = now; c.msgN = 0; }
    if (++c.msgN > LIMITS.msgsPerSec) { if (c.flood >= LIMITS.floodSecs) drop(c, 'Too many messages.', true); return; }
    let m;
    try { m = JSON.parse(text); } catch { return drop(c, 'bad message'); }
    try { handleMessage(S, net, c, m, text.length); } catch (e) { log('error handling a message from ' + (c.name || c.addr) + ': ' + e.message); }
  }

  /* ---- the server's own game ---- */
  if (o.simulate !== false && (o.hostGame || game)) {
    try {
      const script = o.hostGame || gameScript(game.file, path.join(dataDir, '.cache'));
      if (script) {
        /* one game per dimension. The Overworld's starts now (it also cooks the furnaces and runs the market); the
           Nether's and the Aether's start when the first player goes there. Puppet Purgatory stays each player's own. */
        S.hdims = ['over', 'nether', 'aether'];
        S.startHost = (dim) => {
          if (!S.hdims.includes(dim) || S.hosts.has(dim) || world.gr[dim] === false) return;   // 6.33: a dimension the rules switch off has no game
          const h = startHost(S, script, (c, m, size) => handleMessage(S, net, c, m, size), log, dim);
          S.hosts.set(dim, h);
          /* a game started late missed the players who are already here: tell it who they are and where (it waits until it is ready) */
          for (const p of S.clients.values()) if (p.ready) { h.post({ t: 'join', id: p.id, name: p.name }); if (p.pose) h.post({ t: 'pose', id: p.id, ...p.pose }); }
        };
        S.startHost('over');
        /* 6.46: a dimension's game that nobody has been in for pauseWhenEmpty seconds is paused (Minecraft's
           pause-when-empty-seconds): no ticks, so no CPU, and its clock, mobs, water and fires stand still. The first
           player into it wakes it at once (the pose handler in lib/protocol.mjs); the once-a-second clock below puts it
           to sleep. When the whole server is empty the world is saved first. */
        S.wakeHost = (dim) => {
          const h = S.hosts.get(dim);
          if (!h) return;
          h.emptyT = 0;
          h.pausedT = 0;
          if (h.paused) { h.post({ t: 'clock', v: world.clock, max: (o.catchUpMax || 0) * 60 }); h.paused = false; h.post({ t: 'resume' }); log('the server game for ' + dim + ' is running again'); }
        };
      }
      else log('the game html holds no script the server can run: the players\' games will run the mobs between them');
    } catch (e) { log('the server game could not be started (' + e.message + '): the players\' games will run the mobs between them'); }
  }

  const srv = tls ? https.createServer(tls, pageHandler(S)) : http.createServer(pageHandler(S));
  srv.on('upgrade', (req, sock) => {
    if (!originOK(req)) { sock.destroy(); return; }
    const up = acceptUpgrade(req, sock);
    if (!up) return;
    /* a client: the socket's parsing state plus what the game protocol keeps about a player */
    const c = Object.assign(newConn(sock, up.deflate), { addr: sock.remoteAddress || '?', id: 0, name: '', ready: false,
      seen: Date.now(), born: Date.now(), pose: null, poseT: 0, chatT: 0, chatN: 0, ms: 0, msgT: 0, msgN: 0, flood: 0, skin: '',
      rd: o.viewChunks, sent: null, sk: '', farT: 0, hitT: 0, lastHit: null, sleepT: 0, sleepAt: null, gm: null, rate: {} });
    pending.add(c);
    sock.on('data', (d) => {
      c.seen = Date.now();
      try { readFrames(c, d, LIMITS.frame, (text) => onText(c, text), (why) => drop(c, why)); } catch (e) { drop(c, 'error: ' + e.message); }
    });
    sock.on('close', () => { drop(c, 'connection closed'); pending.delete(c); });
    sock.on('error', () => drop(c, 'connection lost'));
  });

  /* ---- clocks ---- */
  let lastTick = Date.now();
  const beats = { time: 0, drops: 0 };
  const tick = setInterval(() => {
    const now = Date.now(), dt = Math.min(5, (now - lastTick) / 1000); lastTick = now;
    worldTick(S, net, beats, now, dt);
    if ((beats.clock = (beats.clock || 0) + dt) >= 5) { beats.clock = 0; for (const h of S.hosts.values()) h.post({ t: 'clock', v: world.clock, max: (o.catchUpMax || 0) * 60 }); }   // 6.50: the games follow the world's clock
    if (o.pauseWhenEmpty > 0) for (const [dim, h] of S.hosts) {
      /* 6.55: a Nether or Aether game paused for stopWhenEmpty minutes is stopped, which frees its memory; the next player
         there starts it again from the saved world (the Overworld's stays paused: it holds the furnaces and the market) */
      if (h.paused && dim !== 'over' && o.stopWhenEmpty > 0 && (h.pausedT = (h.pausedT || 0) + dt) >= o.stopWhenEmpty * 60) {
        S.hosts.delete(dim); h.stop();
        log('nobody has been in ' + dim + ' for ' + o.stopWhenEmpty + ' min: its server game is stopped (it starts again when someone goes there)');
        continue;
      }
      if (h.paused) continue;
      if ([...S.clients.values()].some((p) => p.ready && (p.pose ? p.pose.dim : 'over') === dim)) { h.emptyT = 0; continue; }
      if ((h.emptyT = (h.emptyT || 0) + dt) < o.pauseWhenEmpty) continue;
      if (![...S.clients.values()].some((p) => p.ready)) saveWorld('nobody online');
      h.paused = true; h.post({ t: 'pause' });
      log('nobody has been in ' + dim + ' for ' + o.pauseWhenEmpty + ' s: its server game is paused until someone comes');
    }
    for (const c of pending) {          // quiet sockets: ping after 5 s, give up after 20 s; 15 s to say hello
      if (c.closed) continue;
      if (!c.ready && now - c.born > (c.helloM ? 120000 : 15000)) drop(c, c.helloM ? 'did not log in' : 'never said hello', !!c.helloM);   // 6.49: two minutes to type a login
      else if (now - c.seen > LIMITS.quietDrop) drop(c, 'timed out');
      else if (now - c.seen > LIMITS.quietPing) { try { c.sock.write(PING); } catch { /* gone */ } }
    }
  }, 1000);
  const autosave = setInterval(() => saveWorld(), 30000);
  tick.unref(); autosave.unref();

  /* ---- what the caller gets ---- */
  const api = {
    opts: o, secure: !!tls, host: (dim) => S.hosts.get(dim || 'over') || null, riders: () => S.vown, world: () => world, rules: () => cleanRules(world.gr), status: () => statusOf(S), gameFile: S.gameFile, worldDir, saveWorld, exportWorld: S.exportWorld, log,
    get port() { const a = srv.address(); return a && typeof a === 'object' ? a.port : o.port; },
    players: () => [...S.clients.values()],
    say(txt) { broadcast({ t: 'sys', txt: '[Server] ' + txt }); log('[Server] ' + txt); },
    kick(name, why) { const c = [...S.clients.values()].find((p) => playerKey(p.name) === playerKey(name)); if (c) drop(c, why || 'Kicked by the server.', true); return !!c; },
    setTime(v) { world.time = ((v % 1) + 1) % 1; S.dirty = true; broadcast({ t: 'time', v: world.time }); },
    command: (line) => runCommand(S, net, null, line),   // a console command: the reply as a string
    setSkin: (name, png) => setSkin(S, net, name, png),   // 6.49: an operator dresses a player (lib/protocol.mjs)
    stats: () => ({ edits: S.editCount, chunks: Object.keys(world.edits).length, be: Object.keys(world.be).length, drops: Object.keys(world.drops).length }),
    listen() {
      return new Promise((resolve, reject) => {
        srv.once('error', reject);
        srv.listen(o.port, () => { srv.off('error', reject); resolve(api); });
      });
    },
    close() {                           // tell everyone, save, stop
      clearInterval(tick); clearInterval(autosave);
      for (const c of [...pending]) drop(c, 'The server is shutting down.', true);
      const hs = [...S.hosts.values()]; S.hosts.clear(); S.startHost = null;
      saveWorld('shutdown');
      return Promise.all([...hs.map((h) => h.stop()), new Promise((resolve) => { srv.close(() => resolve()); srv.closeAllConnections?.(); })]).then(() => {});
    },
  };
  return api;
}
