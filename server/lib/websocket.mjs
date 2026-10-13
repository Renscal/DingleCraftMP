// websocket.mjs: just enough of the WebSocket protocol (RFC 6455) for JSON text messages, on Node's own sockets.
// It knows nothing about the game. A "connection" here is a plain object the caller owns:
//   { sock, buf, parts, partLen, closed, deflate, zip }   (newConn makes one; the game adds its own fields beside these)
// Compression is the standard permessage-deflate extension (RFC 7692), offered by every browser. Both sides are asked to
// forget their window after each message (no_context_takeover), so a message is squeezed and opened on its own: no
// per-connection compressor to keep, and one encoded broadcast can go to every player.
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';   // fixed by the RFC
export const PING = Buffer.from([0x89, 0x00]);
export const CLOSE = Buffer.from([0x88, 0x00]);

const TAIL = Buffer.from([0x00, 0x00, 0xff, 0xff]);       // what a sync flush ends with; the extension leaves it off the wire
/* messages shorter than this go out as they are: squeezing a pose saves nothing */
export const DEFLATE_MIN = 512;

/* answer an HTTP upgrade request. false (and the socket destroyed) if it is not a WebSocket handshake; otherwise
   { deflate } : whether this connection agreed to compressed messages. */
export function acceptUpgrade(req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return false; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  const deflate = /(?:^|,)\s*permessage-deflate\b/i.test(String(req.headers['sec-websocket-extensions'] || ''));
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept +
    (deflate ? '\r\nSec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover' : '') + '\r\n\r\n');
  sock.setNoDelay(true);
  return { deflate };
}

/* the parsing state for one socket (deflate: it agreed to compressed messages; zip: the message arriving now is one) */
export function newConn(sock, deflate) {
  return { sock, buf: Buffer.alloc(0), parts: null, partLen: 0, closed: false, deflate: !!deflate, zip: false };
}

/* one unmasked text frame (servers never mask). deflate: squeeze it if the connection agreed and it is worth it. */
export function textFrame(str, deflate) {
  let body = Buffer.from(str, 'utf8'), op = 0x81;
  if (deflate && body.length >= DEFLATE_MIN) {
    const z = zlib.deflateRawSync(body, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    if (z.length - 4 < body.length) { body = z.subarray(0, z.length - 4); op = 0xc1; }   // RSV1: this message is compressed
  }
  const n = body.length;
  let head;
  if (n < 126) head = Buffer.from([op, n]);
  else if (n < 65536) { head = Buffer.alloc(4); head[0] = op; head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[0] = op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  return Buffer.concat([head, body]);
}

/* Feed bytes from the socket. Calls onText(string) for each complete text message (fragments joined), answers pings,
   and calls onFail(reason) once, then stops, on a close frame or anything a browser would never send (an unmasked frame,
   a binary frame, a message over maxLen). The caller sets c.closed to stop the loop from inside onText. */
export function readFrames(c, chunk, maxLen, onText, onFail) {
  c.buf = c.buf.length ? Buffer.concat([c.buf, chunk]) : chunk;
  for (;;) {
    const b = c.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0, rsv1 = (b[0] & 0x40) !== 0, op = b[0] & 0x0f, masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; const big = b.readBigUInt64BE(2); if (big > BigInt(maxLen)) return onFail('message too big'); len = Number(big); off = 10; }
    if (!masked) return onFail('bad frame');
    if (len > maxLen) return onFail('message too big');
    if (b.length < off + 4 + len) return;                  // the rest of this frame has not arrived yet
    const mask = b.subarray(off, off + 4);
    const pay = Buffer.allocUnsafe(len);
    for (let i = 0; i < len; i++) pay[i] = b[off + 4 + i] ^ mask[i & 3];
    c.buf = b.subarray(off + 4 + len);
    if (op === 0x8) return onFail('quit');                 // close
    if (op === 0x9) { const h = Buffer.from([0x8a, Math.min(pay.length, 125)]); c.sock.write(Buffer.concat([h, pay.subarray(0, 125)])); continue; }   // ping -> pong
    if (op === 0xa) continue;                              // pong
    if (op === 0x2) return onFail('binary not supported');
    if (op === 0x1 || op === 0x0) {                        // text, or the continuation of one
      if (op === 0x1) { c.parts = []; c.zip = rsv1; if (rsv1 && !c.deflate) return onFail('bad frame'); } else if (!c.parts) return onFail('bad frame');
      c.parts.push(pay);
      c.partLen = (op === 0x1 ? 0 : c.partLen) + pay.length;
      if (c.partLen > maxLen) return onFail('message too big');
      if (!fin) continue;
      let all = Buffer.concat(c.parts);
      c.parts = null;
      if (c.zip) {                                         // opened with a ceiling, so a small message cannot unfold into a huge one
        try { all = zlib.inflateRawSync(Buffer.concat([all, TAIL]), { finishFlush: zlib.constants.Z_SYNC_FLUSH, maxOutputLength: maxLen }); }
        catch { return onFail('message too big'); }
      }
      const text = all.toString('utf8');
      onText(text);
      if (c.closed) return;
    }
  }
}
