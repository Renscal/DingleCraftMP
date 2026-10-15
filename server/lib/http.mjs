// http.mjs: the two web pages. The same port that carries the game connection also answers plain HTTP:
//   GET /         the game itself (the html found by findGame), or a short text note when there is none to hand out.
//                 The page is the file byte for byte except for one line added at the top of its <head>, which tells the
//                 game it is a server's (window.DC_SERVER = 1): that game has no worlds of its own, only this server's.
//                 The same file opened from disk, or in the desktop client, is the whole game.
//                 6.63: it carries an ETag, so a browser that already has this exact page is told "not modified" (304)
//                 instead of fetching it again on every refresh, and it is sent compressed (br or gzip, whichever the
//                 browser takes) once the server has compressed it, off the main thread, the first time it was asked for.
//   GET /art/<file>   (6.62) the Hyperreal art: the files in the art/ folder next to the game html, which the game asks for
//                 the first time Hyperreal is switched on. Their names carry their content's hash, so a browser keeps them.
//   GET /status   a small JSON readout: name, version, who is online
// Everything else is a 404. Nothing here can change the world.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
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

/* ---- 6.63: the page, compressed once ---- */
/* the page's version: its size, when it changed, and whether it carries the served line */
const etagOf = (st, at) => '"' + st.size.toString(36) + '-' + Math.round(st.mtimeMs).toString(36) + (at >= 0 ? '-s' : '-w') + '"';
/* Z[enc]: { etag, buf } once compressed; busy[enc]: being compressed. Only the encodings browsers ask for are made. */
const Z = { gzip: null, br: null }, busy = { gzip: '', br: '' };
/* make the compressed page for one encoding, in the background (zlib's own threads): read, add the served line, compress */
function compressPage(file, at, etag, enc) {
  if (busy[enc] === etag || (Z[enc] && Z[enc].etag === etag)) return;
  busy[enc] = etag;
  fs.readFile(file, (err, raw) => {
    if (err) { busy[enc] = ''; return; }
    const body = at >= 0 ? Buffer.concat([raw.subarray(0, at), SERVED_TAG, raw.subarray(at)]) : raw;
    const done = (e, z) => { if (busy[enc] === etag) busy[enc] = ''; if (!e) Z[enc] = { etag, buf: z }; };
    if (enc === 'br') zlib.brotliCompress(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } }, done);
    else zlib.gzip(body, { level: 6 }, done);
  });
}
/* the best encoding a request takes that is ready now (null: send it plain); any it would rather have is made meanwhile */
function pickEncoding(req, file, at, etag) {
  /* what the browser takes: "gzip, deflate, br", each perhaps with ;q=<weight> (0 means no) */
  const take = new Set(String(req.headers['accept-encoding'] || '').split(',').map((t) => t.trim().split(';')).filter(([, q]) => !q || !/^\s*q\s*=\s*0(\.0*)?\s*$/i.test(q)).map(([e]) => e.trim().toLowerCase()));
  const want = ['br', 'gzip'].filter((e) => take.has(e));
  let pick = null;
  for (const e of want) { if (Z[e] && Z[e].etag === etag) pick = pick || e; else compressPage(file, at, etag, e); }   /* a better one not made yet is made for next time */
  return pick;
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
      const etag = etagOf(st, at), inm = String(req.headers['if-none-match'] || '');
      if (inm && inm.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) { res.writeHead(304, { etag, 'cache-control': 'no-cache' }); return res.end(); }
      const enc = pickEncoding(req, S.gameFile, at, etag);
      if (enc) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': enc, 'content-length': Z[enc].buf.length, etag, vary: 'accept-encoding', 'cache-control': 'no-cache' });
        return res.end(req.method === 'HEAD' ? undefined : Z[enc].buf);
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': st.size + (at >= 0 ? SERVED_TAG.length : 0), etag, vary: 'accept-encoding', 'cache-control': 'no-cache' });
      if (req.method === 'HEAD') return res.end();
      if (at < 0) return fs.createReadStream(S.gameFile).pipe(res);    // streamed, never held in memory
      const top = fs.createReadStream(S.gameFile, { start: 0, end: at - 1 });
      top.on('error', () => res.destroy());
      top.on('end', () => { res.write(SERVED_TAG); fs.createReadStream(S.gameFile, { start: at }).on('error', () => res.destroy()).pipe(res); });
      return top.pipe(res, { end: false });
    }
    /* 6.62: one art file, by its plain name, from the art/ folder beside the game file and nowhere else */
    const art = /^\/art\/([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.js)$/.exec(url);
    if (art && S.gameFile) {
      const file = path.join(path.dirname(S.gameFile), 'art', art[1]);
      let st = null;
      try { st = fs.statSync(file); } catch { /* not there: 404 below */ }
      if (st && st.isFile()) {
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': st.size, 'cache-control': 'public, max-age=31536000, immutable' });
        if (req.method === 'HEAD') return res.end();
        return fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
      }
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
  };
}
