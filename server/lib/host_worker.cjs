/* host_worker.cjs: the server's own game, in a thread of its own (started by lib/host.mjs).
   It loads the stand-in browser (headless.cjs), then the game's script, and tells the game to become the host
   (ntHostStart, src/net/n8_host.js): from then on the game runs the Overworld's mobs for every player.
     the thread's data     { game: the script file, world: the server's world, mobs and vehs: the saved mobs and vehicles of
                           this dimension, dim: which one, primary: it also cooks the furnaces and runs the market }
     from the server       a protocol message (an object), handed to the game's ntMsg exactly like one from a socket
     to the server         a protocol message (JSON text, as the game's socket would send it), or {ready}, {log}, {error}
   The game is ticked 20 times a second, in steps of at most 50 ms (the game's own limit), a few at once if it fell behind. */
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const say = (o) => parentPort.postMessage(o);
try {
  require('./headless.cjs');
  const realLog = console.log;
  console.log = () => {};                                  // the game is chatty at start-up; none of it is for the server window
  require(workerData.game);
  console.log = realLog;
  const V = global.__vox;
  if (!V || typeof V.ntHostStart !== 'function') throw new Error('this game build cannot be a host (it needs 6.13 or newer)');
  V.NET.ws = { readyState: 1, send: (text) => say(text), close() {} };
  const n = V.ntHostStart(workerData.world, workerData.mobs, workerData.vehs, workerData.dim, workerData.primary);
  parentPort.on('message', (m) => { try { V.ntMsg(m); } catch (e) { say({ log: 'the server game could not take a ' + (m && m.t) + ' message: ' + e.message }); } });
  let last = Date.now(), bad = 0;
  setInterval(() => {
    const now = Date.now(), steps = Math.max(1, Math.min(5, Math.round((now - last) / 50)));
    last = now;
    try { for (let i = 0; i < steps; i++) V.ntHostTick(0.05); bad = 0; }
    catch (e) { if (++bad === 1 || bad % 200 === 0) say({ log: 'the server game stumbled: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
  }, 50);
  say({ ready: true, mobs: n, version: V.GAME_VERSION });
} catch (e) {
  say({ error: e && e.message ? e.message : String(e) });
}
