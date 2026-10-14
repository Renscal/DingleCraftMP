// zip.cjs: reads a zip (deflate or stored), so the window can take a server release (DINGLECRAFT-Server-v<X.Y>.zip) as it
// was downloaded. The window's own copy of the reader in scripts/lib/zip.mjs: the window ships apart from the repository.
//   readZip(buf) -> [{ name, data, mode }]     (throws on anything it cannot read, or a bad CRC)
'use strict';
const zlib = require('zlib');

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/* the end-of-central-directory record: the last one in the file (a zip comment may follow it) */
function findEnd(buf) {
  for (let p = buf.length - 22; p >= Math.max(0, buf.length - 22 - 65535); p--) if (buf.readUInt32LE(p) === 0x06054b50) return p;
  throw new Error('not a zip file');
}
function readZip(buf) {
  const end = findEnd(buf), n = buf.readUInt16LE(end + 10), out = [];
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('a damaged zip (central directory)');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28);
    const mode = (buf.readUInt32LE(p + 38) >>> 16) & 0o777, off = buf.readUInt32LE(p + 42);
    const name = buf.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nlen);
    if (method !== 0 && method !== 8) throw new Error('a zip packed in a way this program cannot read (' + name + ')');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), body = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
    if (crc32(data) !== crc) throw new Error('a damaged zip (bad CRC: ' + name + ')');
    out.push({ name, data, mode });
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}
module.exports = { readZip, crc32 };
