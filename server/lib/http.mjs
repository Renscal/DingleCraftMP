// http.mjs: the two web pages. The same port that carries the game connection also answers plain HTTP:
//   GET /         the game itself (the html found by findGame), or a short text note when there is none to hand out
//   GET /status   a small JSON readout: name, version, who is online
// Everything else is a 404. Nothing here can change the world.
import fs from 'node:fs';
import { PROTO, MIN_GAME } from './config.mjs';

/* what /status says (also used by the suites) */
export function statusOf(S) {
  return { name: S.o.name, motd: S.o.motd, version: S.gameVersion, proto: PROTO,
    players: [...S.clients.values()].filter((c) => c.ready).map((c) => c.name), max: S.o.maxPlayers, password: !!S.o.password };
}

/* the request handler for http.createServer */
export function pageHandler(S) {
  return (req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    if (url === '/status') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
      return res.end(JSON.stringify(statusOf(S)));
    }
    if (url === '/' || url === '/index.html') {
      if (!S.gameFile) {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        return res.end(`${S.o.name}\nThis DINGLECRAFT server is running, but it has no game file to hand out.\nOpen your own copy of the game (${MIN_GAME} or newer), choose Multiplayer and enter this address.\n`);
      }
      let st;
      try { st = fs.statSync(S.gameFile); } catch { res.writeHead(500); return res.end('game file missing'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': st.size, 'cache-control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(S.gameFile).pipe(res);    // 42 MB: streamed, never held in memory
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  };
}
