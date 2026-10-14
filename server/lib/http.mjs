// http.mjs: the two web pages. The same port that carries the game connection also answers plain HTTP:
//   GET /         the game itself (the html found by findGame), or a short text note when there is none to hand out.
//                 The page is the file byte for byte except for one line added at the top of its <head>, which tells the
//                 game it is a server's (window.DC_SERVER = 1): that game has no worlds of its own, only this server's.
//                 The same file opened from disk, or in the desktop client, is the whole game.
//   GET /status   a small JSON readout: name, version, who is online
// Everything else is a 404. Nothing here can change the world.
import fs from 'node:fs';
import { PROTO, MIN_GAME } from './config.mjs';

/* what /status says (also used by the suites) */
export function statusOf(S) {
  return { name: S.o.name, motd: S.o.motd, version: S.gameVersion, proto: PROTO,
    players: [...S.clients.values()].filter((c) => c.ready).map((c) => c.name), max: S.o.maxPlayers, accounts: !!S.o.accounts };
}

/* the line a served page gets */
const SERVED_TAG = Buffer.from('<script>window.DC_SERVER=1</script>\n');
const cut = { file: '', size: -1, at: -1 };
/* where in the file that line goes (right after <head>; -1: no <head> in the first 4 KB, serve the file as it is).
   Looked up once per file size, so a replaced html is noticed. */
function headCut(file, size) {
  if (cut.file === file && cut.size === size) return cut.at;
  let at = -1;
  try {
    const fd = fs.openSync(file, 'r'), buf = Buffer.alloc(Math.min(4096, size));
    fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
    const i = buf.indexOf('<head>');
    if (i >= 0) at = i + 6 + (buf[i + 6] === 10 ? 1 : 0);
  } catch { /* unreadable: the stream below will say so */ }
  cut.file = file; cut.size = size; cut.at = at;
  return at;
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
      const at = S.o.singlePlayer === true ? -1 : headCut(S.gameFile, st.size);   // "singlePlayer": true hands out the whole game, worlds of its own included
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': st.size + (at >= 0 ? SERVED_TAG.length : 0), 'cache-control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      if (at < 0) return fs.createReadStream(S.gameFile).pipe(res);    // 42 MB: streamed, never held in memory
      const top = fs.createReadStream(S.gameFile, { start: 0, end: at - 1 });
      top.on('error', () => res.destroy());
      top.on('end', () => { res.write(SERVED_TAG); fs.createReadStream(S.gameFile, { start: at }).on('error', () => res.destroy()).pipe(res); });
      return top.pipe(res, { end: false });
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  };
}
