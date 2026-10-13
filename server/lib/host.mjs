// host.mjs: the server's own game. Since 6.13 the server runs the Overworld's mobs itself, the way a Minecraft server
// does, and it does it with the game's own code: the script inside the game html is loaded headless in a worker thread
// (host_worker.cjs, with the hollow browser of headless.cjs) and told to be "the host" (src/net/n8_host.js).
// To the protocol the host is a player with id 0 who is never listed, never drawn and never counted:
//   S.hosts.get(dimension) = { c, post, stop, ready }    c is that player (lib/protocol.mjs handles what it sends)
// One game holds one dimension, so there is one host per dimension (6.17): the Overworld's from the start, the others
// from the moment a player first goes there.
// What it costs: one thread, and the memory of a game with no pictures (about 150 MB plus the chunks around the players).
// "simulate": false in server.json turns it off; so does having no game html. Then the players' games run the mobs
// between them, as they did before 6.13.
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/* where the game's script ends and its packed art begins, inside the html */
const ART = '/* PART 54 ASSETS - GENERATED';

/* The game's script as a file the worker can load. A .js file is used as it is (a repo checkout's build/game.js).
   An html has the script cut out of it (from the last <script> before the art to the art) into the cache folder, once
   per build. Returns the path, or null if this file holds no game script. */
export function gameScript(gameFile, cacheDir) {
  if (/\.c?js$/i.test(gameFile)) return gameFile;
  const st = fs.statSync(gameFile);
  const out = path.join(cacheDir, `game_${path.basename(gameFile).replace(/[^A-Za-z0-9._-]/g, '_')}_${st.size}.cjs`);
  if (fs.existsSync(out)) return out;
  const html = fs.readFileSync(gameFile, 'utf8');
  const end = html.indexOf(ART), start = end < 0 ? -1 : html.lastIndexOf('<script>\n', end);
  if (start < 0) return null;
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const n of fs.readdirSync(cacheDir)) if (/^game_.*\.cjs$/.test(n)) fs.rmSync(path.join(cacheDir, n), { force: true });   // an older build's
  fs.writeFileSync(out + '.tmp', html.slice(start + 9, end));
  fs.renameSync(out + '.tmp', out);
  return out;
}

/* Start the host of one dimension for server S. handle(c, message, size) is the protocol's handler; log prints a line.
   Returns the host object at once; it takes a second or two to be ready, and what is sent to it meanwhile waits. */
export function startHost(S, script, handle, log, dim = 'over') {
  const { edits, be, players, drops, mobs, vehicles, ...level } = S.world;
  const c = { id: 0, name: '#server', host: true, hdim: dim, ready: true, closed: false, addr: 'host', pose: null, sent: null, rate: {},
    seen: Date.now(), poseT: 0, chatT: 0, chatN: 0, hitT: 0, lastHit: null, sleepT: 0, sleepAt: null, gm: null, ms: 0, rd: 0 };
  const waiting = [];
  const H = { c, ready: false, stopped: false, post(m) { if (H.stopped) return; if (H.ready) worker.postMessage(m); else waiting.push(m); },
    stop() { H.stopped = true; return worker.terminate().catch(() => {}); } };
  c.h = H;
  const here = (list) => (Array.isArray(list) ? list.filter((x) => (x.d || 'over') === dim) : []);
  const worker = new Worker(path.join(HERE, 'host_worker.cjs'), { workerData: { game: script, world: { ...level, edits, be }, mobs: here(mobs), vehs: here(vehicles), dim, primary: dim === 'over' } });
  const gone = (why) => {
    if (H.stopped) return;
    H.stopped = true; H.ready = false; c.closed = true;
    if (S.hosts.get(dim) === H) S.hosts.delete(dim);
    log('THE SERVER GAME FOR ' + dim.toUpperCase() + ' STOPPED (' + why + '). It is started again when a player next enters that dimension.');
  };
  worker.on('message', (m) => {
    if (typeof m === 'string') { let o; try { o = JSON.parse(m); } catch { return; } try { handle(c, o, m.length); } catch (e) { log('error handling a message from the server game: ' + e.message); } return; }
    if (m && m.ready) { H.ready = true; log(`the server game for ${dim} is running (v${m.version}; ${m.mobs} saved mob${m.mobs === 1 ? '' : 's'} and vehicle${m.mobs === 1 ? '' : 's'} put back)`); for (const w of waiting.splice(0)) worker.postMessage(w); }
    else if (m && m.log) log(m.log);
    else if (m && m.error) gone(m.error);
  });
  worker.on('error', (e) => gone(e.message));
  worker.on('exit', () => gone('its thread ended'));
  worker.unref();
  return H;
}
