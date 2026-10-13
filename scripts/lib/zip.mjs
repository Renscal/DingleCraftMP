// A small zip writer and reader (deflate, UTF-8 names, unix file modes), so packaging needs nothing but node.
// writeZip(entries) -> Buffer     entries: [{ name: 'dir/file', data: Buffer, mode: 0o644 }]
// readZip(buf)      -> [{ name, data, mode }]   (used by scripts/package.mjs to check what it wrote)
import zlib from 'node:zlib';

const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
/** CRC-32 of a buffer. */
export function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** The DOS time and date words for a Date (UTC, so the same sources pack the same anywhere). */
function dosStamp(d) {
  return [(d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1),
    ((Math.max(1980, d.getUTCFullYear()) - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()];
}

/** Build a zip from entries. `when` stamps every file (default now). */
export function writeZip(entries, when = new Date()) {
  const [tm, dt] = dosStamp(when), parts = [], central = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), raw = e.data, z = zlib.deflateRawSync(raw, { level: 9 });
    const store = z.length >= raw.length, body = store ? raw : z, crc = crc32(raw);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(store ? 0 : 8, 8);
    h.writeUInt16LE(tm, 10); h.writeUInt16LE(dt, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18);
    h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(store ? 0 : 8, 10); c.writeUInt16LE(tm, 12); c.writeUInt16LE(dt, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE((((e.mode || 0o644) | 0o100000) << 16) >>> 0, 38); c.writeUInt32LE(off, 42);
    parts.push(h, name, body); central.push(c, name);
    off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

/** Read a zip written by writeZip back (throws on a bad CRC). */
export function readZip(buf) {
  const end = buf.length - 22;
  if (end < 0 || buf.readUInt32LE(end) !== 0x06054b50) throw new Error('not a zip written by writeZip');
  const n = buf.readUInt16LE(end + 10), out = [];
  let p = buf.readUInt32LE(end + 16);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28);
    const mode = (buf.readUInt32LE(p + 38) >>> 16) & 0o777, off = buf.readUInt32LE(p + 42), name = buf.toString('utf8', p + 46, p + 46 + nlen);
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28), body = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(body) : Buffer.from(body);
    if (crc32(data) !== crc) throw new Error('bad CRC: ' + name);
    out.push({ name, data, mode });
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return out;
}
