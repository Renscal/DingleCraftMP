// server.mjs: createServer puts the pieces together. One call makes one server: it opens (or generates) the world, accepts
// connections, hands each message to the protocol, runs the clocks, and returns a small object to drive it with.
//
//   const S = createServer({ port, data, world, seed, mode, rules, name, motd, password, maxPlayers, pvp, game, ... });
//   await S.listen();   ...   await S.close();
//
// Options are the settings of data/server.json (lib/config.mjs DEFAULTS) plus a few for programs and tests:
//   data      the folder for the world file (default: data/ next to the server)
//   world     the world file's name inside it; '' = never write anything      memory  true = a throwaway world, no disk at all
//   noGame    true = do not look for a game html to hand out                  quiet   true = no log lines
//   onRules   called with the rules when a player changes one in the game
//   onSettings called when a command changed the ops, the bans, the whitelist or the default game mode
import http from 'node:http';
import path from 'node:path';
import { DEFAULTS, LIMITS, SERVER_DIR, cleanRules, cleanList, findGame } from './config.mjs';
import { openWorld, applySettings, writeWorld } from './world.mjs';
import { acceptUpgrade, newConn, textFrame, readFrames, PING, CLOSE } from './websocket.mjs';
import { handleMessage, worldTick, forget, playerKey } from './protocol.mjs';
import { runCommand } from './commands.mjs';
import { pageHandler, statusOf } from './http.mjs';

/* make one server (not yet listening). Throws if the world file exists but cannot be read. */
export function createServer(opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  for (const k of ['ops', 'allow', 'bans']) o[k] = cleanList(o[k]);   // names are compared in lower case
  o.whitelist = o.whitelist === true;
  const log = o.quiet ? () => {} : (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
  const dataDir = path.resolve(o.data || path.join(SERVER_DIR, 'data'));
  const worldFile = o.world ? path.resolve(dataDir, o.world) : null;   // null: nothing is ever written (tests)
  const game = o.noGame ? null : findGame(o.game, dataDir);

  /* ---- the world ---- */
  const { world, isNew } = openWorld(worldFile, o, log);
  applySettings(world, o.rules, opts.mode);    // opts, not o: a mode nobody asked for must not override the world file's

  /* ---- the server's state, shared with lib/protocol.mjs and lib/http.mjs ---- */
  const S = {
    o, log, world,
    dirty: true,                        // the world differs from the file (true at start: the settings were just applied)
    clients: new Map(),                 // id -> a player who has said hello
    locks: new Map(),                   // block key -> the id of the player using that chest or furnace
    nextId: 1,
    editCount: 0,
    gameFile: game ? game.file : null,
    gameVersion: game ? game.version : null,   // every player must run this version; without a game file, the first player's
  };
  const pending = new Set();            // every open socket, joined or not (for timeouts and shutdown)

  function saveWorld(why) {
    if (!worldFile || !S.dirty) return false;
    try { writeWorld(worldFile, world); S.dirty = false; if (why) log(`world saved (${why})`); return true; }
    catch (e) { log('WORLD SAVE FAILED: ' + e.message); return false; }
  }
  S.saveWorld = saveWorld;              // the /save command
  if (isNew && worldFile) saveWorld('new world: ' + worldFile);   // on disk before anyone joins

  /* ---- sending ---- */
  function sendRaw(c, buf) {
    if (c.closed) return;
    if (c.sock.writableLength > LIMITS.backlog) return drop(c, 'too far behind');
    c.sock.write(buf);
  }
  const send = (c, m) => sendRaw(c, textFrame(JSON.stringify(m)));
  /* to every player who has finished joining, except one (usually the sender); onlyIf(client) narrows it further */
  function broadcast(m, except, onlyIf) {
    let buf = null;                                     // encoded once (and only if someone gets it), written to each
    for (const c of S.clients.values()) if (c !== except && c.ready && (!onlyIf || onlyIf(c))) sendRaw(c, buf || (buf = textFrame(JSON.stringify(m))));
  }
  /* end a connection. tell = send the reason first (a refusal or a kick), so the player's game can show it. */
  function drop(c, why, tell) {
    if (c.closed) return;
    if (tell) { try { c.sock.write(textFrame(JSON.stringify({ t: 'kick', why }))); } catch { /* gone */ } }
    c.closed = true;
    try { c.sock.write(CLOSE); c.sock.end(); } catch { /* gone */ }
    setTimeout(() => { try { c.sock.destroy(); } catch { /* gone */ } }, 500).unref();
    if (c.id && S.clients.get(c.id) === c) {
      S.clients.delete(c.id);
      forget(S, c);
      log(`- ${c.name} left (${why}); ${S.clients.size} online`);
      broadcast({ t: 'leave', id: c.id });
      broadcast({ t: 'sys', txt: c.name + ' left the game' });
    }
  }
  const net = { send, broadcast, drop };

  /* ---- receiving ---- */
  function onText(c, text) {
    let m;
    try { m = JSON.parse(text); } catch { return drop(c, 'bad message'); }
    try { handleMessage(S, net, c, m, text.length); } catch (e) { log('error handling a message from ' + (c.name || c.addr) + ': ' + e.message); }
  }

  const srv = http.createServer(pageHandler(S));
  srv.on('upgrade', (req, sock) => {
    if (!acceptUpgrade(req, sock)) return;
    /* a client: the socket's parsing state plus what the game protocol keeps about a player */
    const c = Object.assign(newConn(sock), { addr: sock.remoteAddress || '?', id: 0, name: '', ready: false,
      seen: Date.now(), born: Date.now(), pose: null, poseT: 0, chatT: 0, chatN: 0,
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
    for (const c of pending) {          // quiet sockets: ping after 15 s, give up after 45 s; 15 s to say hello
      if (c.closed) continue;
      if (!c.ready && now - c.born > 15000) drop(c, 'never said hello');
      else if (now - c.seen > 45000) drop(c, 'timed out');
      else if (now - c.seen > 15000) { try { c.sock.write(PING); } catch { /* gone */ } }
    }
  }, 1000);
  const autosave = setInterval(() => saveWorld(), 30000);
  tick.unref(); autosave.unref();

  /* ---- what the caller gets ---- */
  const api = {
    opts: o, world: () => world, rules: () => cleanRules(world.gr), status: () => statusOf(S), gameFile: S.gameFile, worldFile, saveWorld, log,
    get port() { const a = srv.address(); return a && typeof a === 'object' ? a.port : o.port; },
    players: () => [...S.clients.values()],
    say(txt) { broadcast({ t: 'sys', txt: '[Server] ' + txt }); log('[Server] ' + txt); },
    kick(name, why) { const c = [...S.clients.values()].find((p) => playerKey(p.name) === playerKey(name)); if (c) drop(c, why || 'Kicked by the server.', true); return !!c; },
    setTime(v) { world.time = ((v % 1) + 1) % 1; S.dirty = true; broadcast({ t: 'time', v: world.time }); },
    command: (line) => runCommand(S, net, null, line),   // a console command: the reply as a string
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
      saveWorld('shutdown');
      return new Promise((resolve) => { srv.close(() => resolve()); srv.closeAllConnections?.(); });
    },
  };
  return api;
}
