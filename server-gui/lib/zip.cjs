// zip.cjs: reads a zip (deflate or stored), so the window can take a server release (DINGLECRAFT-Server-v<X.Y>.zip) as it
// was downloaded. The window's own copy of the reader in scripts/lib/zip.mjs: the window ships apart from the repository.
//   readZip(buf) -> [{ name, data, mode }]     (throws on anything it cannot read, or a bad CRC)
// 1.3.0: a world's backups are zips too, packed as hard as deflate goes (level 9):
//   zipFolder(dir, file, when) -> { files, bytes }   every file under dir, written to file a piece at a time
//   unzipTo(file, dir) -> files                      a zip unpacked into dir; nothing may land outside it
'use strict';
const fs = require('fs');
const path = require('path');
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

/* the DOS time and date words (local time, as a file manager shows them) */
function dosStamp(d) {
  return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];
}
/* every file under dir, as zip names ('region/over/r.0.0.dcr'), sorted so the same folder packs the same way */
function filesUnder(dir, pre) {
  const out = [];
  for (const n of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const rel = pre ? pre + '/' + n.name : n.name, p = path.join(dir, n.name);
    if (n.isDirectory()) out.push(...filesUnder(p, rel));
    else if (n.isFile()) out.push(rel);
  }
  return out;
}
/* Pack a folder into one zip at file. Files are read and written one at a time (a world can be large); the central
   directory, a few dozen bytes a file, is kept until the end. A zip without the 64-bit extension holds at most 4 GB:
   past that it throws, and nothing is left behind. */
function zipFolder(dir, file, when) {
  const [tm, dt] = dosStamp(when || new Date()), central = [], names = filesUnder(dir, '');
  const fd = fs.openSync(file, 'w');
  let off = 0, raw = 0;
  try {
    const put = (b) => { fs.writeSync(fd, b); off += b.length; };
    for (const n of names) {
      const data = fs.readFileSync(path.join(dir, ...n.split('/'))), name = Buffer.from(n, 'utf8'), z = zlib.deflateRawSync(data, { level: 9 });
      const stored = z.length >= data.length, body = stored ? data : z, crc = crc32(data), at = off;
      if (at + 30 + name.length + body.length > 0xffffffff || names.length > 0xffff) throw new Error('This world is too big for a zip backup (over 4 GB, or over 65535 files).');
      const h = Buffer.alloc(30);
      h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(stored ? 0 : 8, 8);
      h.writeUInt16LE(tm, 10); h.writeUInt16LE(dt, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(body.length, 18);
      h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
      put(h); put(name); put(body);
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(stored ? 0 : 8, 10); c.writeUInt16LE(tm, 12); c.writeUInt16LE(dt, 14); c.writeUInt32LE(crc, 16);
      c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28);
      c.writeUInt32LE(((0o644 | 0o100000) << 16) >>> 0, 38); c.writeUInt32LE(at, 42);
      central.push(c, name);
      raw += data.length;
    }
    const cd = Buffer.concat(central), cdAt = off, end = Buffer.alloc(22);
    if (cdAt + cd.length > 0xffffffff) throw new Error('This world is too big for a zip backup (over 4 GB, or over 65535 files).');
    put(cd);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10);
    end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(cdAt, 16);
    put(end);
  } catch (e) {
    try { fs.closeSync(fd); } catch { /* already closed */ }
    fs.rmSync(file, { force: true });
    throw e;
  }
  fs.closeSync(fd);
  return { files: names.length, bytes: raw };
}
/* a name from a zip that may be written under dir: plain relative parts, no '..', no drive or root, no backslash */
function safeName(n) {
  if (typeof n !== 'string' || !n || n.length > 400 || /[\\:\0]/.test(n) || n.startsWith('/')) return false;
  return n.replace(/\/$/, '').split('/').every((p) => p && p !== '.' && p !== '..');
}
/* Unpack a zip into dir (made if missing). Every name is checked before anything is written, and each path must
   resolve inside dir: a zip that tries to write elsewhere is refused whole. Returns how many files were written. */
function unzipTo(file, dir) {
  const entries = readZip(fs.readFileSync(file)), root = path.resolve(dir);
  for (const e of entries) {
    const to = path.resolve(root, ...e.name.split('/'));
    if (!safeName(e.name) || (to !== root && !to.startsWith(root + path.sep))) throw new Error('A backup with a file that would land outside its world (' + String(e.name).slice(0, 80) + ') is not restored.');
  }
  fs.mkdirSync(root, { recursive: true });
  let n = 0;
  for (const e of entries) {
    const to = path.resolve(root, ...e.name.split('/'));
    if (e.name.endsWith('/')) { fs.mkdirSync(to, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, e.data);
    n++;
  }
  return n;
}
module.exports = { readZip, crc32, zipFolder, unzipTo, safeName };
