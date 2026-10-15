// region.mjs: the world's region and entity files as bytes (6.60), the readable form of them, and searching a world folder.
// No sockets and no server: lib/world.mjs writes and reads the world with it, the server's command line has view, unpack,
// pack and find (lib/files.mjs), and the server window loads this file from the server version it runs.
//
// A region file (region/<dim>/r.<rx>.<rz>.dcr) and an entity file (entities/<dim>/r.<rx>.<rz>.dce) hold exactly what the
// JSON files before them held (the same document: decodeFile gives it back, docText prints it the way 6.12 to 6.59 wrote
// it), packed for size and nothing else. Nothing is compressed: every byte is read straight off the file.
//
//   the head      "DCR" or "DCE", then the format (1), then the dimension (text) and the region's place (rx, rz)
//   a number      7 bits a byte, low bits first, the top bit set on every byte but the last ("uv"); a signed one is
//                 zigzagged first (0, -1, 1, -2 ... as 0, 1, 2, 3 ...: "sv")
//   text          its length in bytes (uv), then UTF-8
//   region body   the chunks in order of their place in the region (cz * 32 + cx, each as the step from the last one):
//                 the changed blocks, as runs of cells in a row (cell = y * 256 + z * 16 + x) that hold the same block
//                 (id | meta << 8); each run is uv(gap * 2 + more), uv(length - 2) if more, uv(block), where gap is the
//                 cells skipped since the last run. Then the block entities (chests, furnaces ...), each by its cell (as
//                 the step from the last one) and a value. Then a value with anything the packed form has no place for
//                 (a key that is not a plain cell, a block that is not a number): null when there is none.
//   entity body   three values: the dropped items, the mobs, the vehicles
//   a value       one tag byte, and after it what the tag says (the tags are TAG below). Small whole numbers are the tag
//                 itself (0 to 223); a number with up to 6 decimals is that many decimals' worth of whole number; text
//                 seen before in the file is its place in the file's list of texts; an object whose keys (in the same
//                 order) were seen before is that key set's place in the list of shapes, then its values alone; a list
//                 that is mostly empty (a chest) is its length, then only the slots that hold something.
// Values are what JSON can hold, and what JSON would make of anything else (undefined keys left out, NaN as null).
// Older forms are still read: r.<rx>.<rz>.json, and the .json.br the server wrote from 6.53 to 6.59 (Brotli). The server
// writes them out in the new form the first time it starts with them.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const FORMAT = 1;
export const REGION = 32;                     // chunks along one side of a region
export const CHUNK = 16;                      // blocks along one side of a chunk
const MAGIC = { region: 'DCR', entities: 'DCE' };
const EXT = { region: '.dcr', entities: '.dce' };
const KIND_OF_MAGIC = { DCR: 'region', DCE: 'entities' };
const TAG = { NULL: 0, FALSE: 1, TRUE: 2, UINT: 3, NEG: 4, F64: 5, DEC: 6 /* 6..11: 1..6 decimals */, STR: 12, SREF: 13, ARR: 14, SPARSE: 15, OBJ: 16, OREF: 17, SMALL: 32 };
const SMALL_MAX = 255 - TAG.SMALL;            // 223
const MAX_SAFE = 2 ** 52;                     // whole numbers past this are written as float64
const DEPTH = 64;
const Y_MAX = 4096;                          // a block higher than this is kept, but not as a cell

/* ---- writing ---- */
class Out {
  constructor() { this.b = Buffer.alloc(4096); this.n = 0; this.strs = new Map(); this.shapes = new Map(); }
  room(k) { if (this.n + k > this.b.length) { const nb = Buffer.alloc(Math.max(this.b.length * 2, this.n + k)); this.b.copy(nb, 0, 0, this.n); this.b = nb; } }
  byte(v) { this.room(1); this.b[this.n++] = v; }
  uv(v) { this.room(10); while (v >= 128) { this.b[this.n++] = (v % 128) | 128; v = Math.floor(v / 128); } this.b[this.n++] = v; }
  sv(v) { this.uv(v < 0 ? -2 * v - 1 : 2 * v); }
  text(s) { const b = Buffer.from(s, 'utf8'); this.uv(b.length); this.room(b.length); b.copy(this.b, this.n); this.n += b.length; }
  str(s) { const i = this.strs.get(s); if (i !== undefined) { this.byte(TAG.SREF); this.uv(i); } else { this.byte(TAG.STR); this.text(s); this.strs.set(s, this.strs.size); } }
  num(v) {
    if (!Number.isFinite(v)) return this.byte(TAG.NULL);                         // as JSON would have it
    if (Number.isInteger(v) && !Object.is(v, -0) && Math.abs(v) <= MAX_SAFE) {
      if (v >= 0 && v <= SMALL_MAX) return this.byte(TAG.SMALL + v);
      if (v >= 0) { this.byte(TAG.UINT); return this.uv(v); }
      this.byte(TAG.NEG); return this.uv(-v - 1);
    }
    for (let k = 1, p = 10; k <= 6; k++, p *= 10) {
      const s = Math.round(v * p);
      if (Math.abs(s) <= MAX_SAFE && s / p === v) { this.byte(TAG.DEC + k - 1); return this.sv(s); }
    }
    this.byte(TAG.F64); this.room(8); this.b.writeDoubleLE(v, this.n); this.n += 8;
  }
  value(v, depth) {
    if (depth > DEPTH) throw new Error('a value is nested too deep to write');
    if (v === null || v === undefined || typeof v === 'function' || typeof v === 'symbol') return this.byte(TAG.NULL);
    if (typeof v === 'boolean') return this.byte(v ? TAG.TRUE : TAG.FALSE);
    if (typeof v === 'number') return this.num(v);
    if (typeof v === 'bigint') throw new Error('a world file cannot hold a BigInt');
    if (typeof v === 'string') return this.str(v);
    if (typeof v.toJSON === 'function') return this.value(v.toJSON(), depth);
    if (Array.isArray(v)) {
      let filled = 0;
      for (const x of v) if (x !== null && x !== undefined && typeof x !== 'function') filled++;
      if (v.length >= 4 && filled * 2 < v.length) {                             // mostly empty: only the slots that hold something
        this.byte(TAG.SPARSE); this.uv(v.length); this.uv(filled);
        let last = -1;
        for (let i = 0; i < v.length; i++) { const x = v[i]; if (x === null || x === undefined || typeof x === 'function') continue; this.uv(i - last - 1); last = i; this.value(x, depth + 1); }
        return;
      }
      this.byte(TAG.ARR); this.uv(v.length);
      for (const x of v) this.value(x, depth + 1);
      return;
    }
    const keys = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function' && typeof v[k] !== 'symbol');
    const shape = JSON.stringify(keys), si = this.shapes.get(shape);
    if (si !== undefined) { this.byte(TAG.OREF); this.uv(si); for (const k of keys) this.value(v[k], depth + 1); return; }
    this.byte(TAG.OBJ); this.uv(keys.length);
    for (const k of keys) { this.str(k); this.value(v[k], depth + 1); }
    this.shapes.set(shape, this.shapes.size);
  }
  done() { return Buffer.from(this.b.subarray(0, this.n)); }
}

/* ---- reading ---- */
class In {
  constructor(buf, name) { this.b = buf; this.p = 0; this.name = name || 'the file'; this.strs = []; this.shapes = []; }
  bad(why) { throw new Error(`${this.name} is damaged (${why} at byte ${this.p})`); }
  byte() { if (this.p >= this.b.length) this.bad('it ends too soon'); return this.b[this.p++]; }
  uv() {
    let v = 0, m = 1;
    for (let i = 0; i < 8; i++) { const c = this.byte(); v += (c & 127) * m; if (c < 128) return v; m *= 128; }
    return this.bad('a number is too long');
  }
  sv() { const u = this.uv(); return u % 2 ? -(u + 1) / 2 : u / 2; }
  count(min) { const n = this.uv(); if (n * (min || 1) > this.b.length - this.p) this.bad('a count is larger than the file'); return n; }
  text() { const n = this.count(1), s = this.b.toString('utf8', this.p, this.p + n); this.p += n; return s; }
  key() {
    const t = this.byte();
    if (t === TAG.STR) { const s = this.text(); this.strs.push(s); return s; }
    if (t === TAG.SREF) { const i = this.uv(); if (i >= this.strs.length) this.bad('a text it has not seen'); return this.strs[i]; }
    return this.bad('a key that is not text');
  }
  value(depth) {
    if (depth > DEPTH) this.bad('values nested too deep');
    const t = this.byte();
    if (t >= TAG.SMALL) return t - TAG.SMALL;
    switch (t) {
      case TAG.NULL: return null;
      case TAG.FALSE: return false;
      case TAG.TRUE: return true;
      case TAG.UINT: return this.uv();
      case TAG.NEG: return -this.uv() - 1;
      case TAG.F64: { if (this.p + 8 > this.b.length) this.bad('it ends too soon'); const v = this.b.readDoubleLE(this.p); this.p += 8; return v; }
      case TAG.STR: case TAG.SREF: this.p--; return this.key();
      case TAG.ARR: { const n = this.count(1), a = new Array(n); for (let i = 0; i < n; i++) a[i] = this.value(depth + 1); return a; }
      case TAG.SPARSE: {
        const len = this.uv(), n = this.count(2);
        if (len > 1 << 20 || n > len) this.bad('a list that cannot be');
        const a = new Array(len).fill(null);
        let last = -1;
        for (let i = 0; i < n; i++) { const at = last + 1 + this.uv(); if (at >= len) this.bad('a slot past the end of its list'); a[at] = this.value(depth + 1); last = at; }
        return a;
      }
      case TAG.OBJ: {
        const n = this.count(2), o = {}, keys = [];
        for (let i = 0; i < n; i++) { const k = this.key(); keys.push(k); o[k] = this.value(depth + 1); }
        this.shapes.push(keys);
        return o;
      }
      case TAG.OREF: {
        const i = this.uv();
        if (i >= this.shapes.length) this.bad('an object shape it has not seen');
        const o = {};
        for (const k of this.shapes[i]) o[k] = this.value(depth + 1);
        return o;
      }
      default:
        if (t >= TAG.DEC && t < TAG.DEC + 6) return this.sv() / 10 ** (t - TAG.DEC + 1);
        return this.bad('an unknown tag ' + t);
    }
  }
  end() { if (this.p !== this.b.length) this.bad((this.b.length - this.p) + ' bytes left over'); }
}

/* ---- a region ---- */
const INT = /^(0|-?[1-9]\d*)$/;
const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isBlock = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_SAFE;
/* "cx,cz" of a chunk inside region (rx, rz), as its place there (cz * 32 + cx), or -1 */
function chunkSlot(ck, rx, rz) {
  const c = ck.split(',');
  if (c.length !== 2 || !INT.test(c[0]) || !INT.test(c[1])) return -1;
  const lx = +c[0] - rx * REGION, lz = +c[1] - rz * REGION;
  return lx >= 0 && lx < REGION && lz >= 0 && lz < REGION ? lz * REGION + lx : -1;
}
/* "lx,y,lz" as written by the game (no signs, no leading zeros, x and z under 16, y under Y_MAX) as its cell, or -1 */
function cellOf(lk) {
  const n = lk.length, p = [0, 0, 0];
  let i = 0;
  for (let part = 0; part < 3; part++) {
    const st = i;
    let v = 0;
    for (; i < n; i++) { const ch = lk.charCodeAt(i); if (ch === 44) break; if (ch < 48 || ch > 57) return -1; v = v * 10 + ch - 48; }
    if (i === st || i - st > 4 || (i - st > 1 && lk.charCodeAt(st) === 48)) return -1;
    p[part] = v;
    if (part < 2) { if (i >= n) return -1; i++; }
  }
  if (i !== n || p[0] >= CHUNK || p[2] >= CHUNK || p[1] >= Y_MAX) return -1;
  return p[1] * 256 + p[2] * CHUNK + p[0];
}
/* "x,y,z" of a block entity inside chunk (cx, cz), as its cell, or -1 */
function beCell(bk, cx, cz) {
  const p = bk.split(',');
  if (p.length !== 3 || !p.every((s) => INT.test(s))) return -1;
  const lx = +p[0] - cx * CHUNK, y = +p[1], lz = +p[2] - cz * CHUNK;
  return lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK && y >= 0 && y < Y_MAX ? y * 256 + lz * CHUNK + lx : -1;
}
const cellKey = (i) => (i % CHUNK) + ',' + Math.floor(i / 256) + ',' + (Math.floor(i / CHUNK) % CHUNK);

/* the region document ({dimension, region: [rx, rz], blocksFrom, chunks: {"cx,cz": {blocks, blockEntities}}}) as bytes */
export function encodeRegion(doc) {
  const o = new Out(), [rx, rz] = doc.region;
  o.room(4); o.b.write(MAGIC.region, 0, 'latin1'); o.n = 3; o.byte(FORMAT);
  o.text(String(doc.dimension)); o.sv(rx); o.sv(rz);
  const slots = [], extra = {};
  for (const ck of Object.keys(doc.chunks || {})) {
    const c = doc.chunks[ck] || {}, s = chunkSlot(ck, rx, rz);
    if (s < 0 || !plainObj(c)) { extra[ck] = c; continue; }
    slots.push([s, ck, c]);
  }
  slots.sort((a, b) => a[0] - b[0]);
  o.uv(slots.length);
  let lastSlot = -1;
  for (const [s, ck, c] of slots) {
    o.uv(s - lastSlot - 1); lastSlot = s;
    const [cx, cz] = ck.split(',').map(Number), odd = {};
    /* the changed blocks, as runs */
    /* each cell with its place in vals, as one number (cell * 2^21 + place), so a plain numeric sort puts them in order */
    let keys = new Float64Array(64), nc = 0;
    const vals = [];
    if (plainObj(c.blocks)) for (const lk of Object.keys(c.blocks)) {
      const v = c.blocks[lk], i = isBlock(v) ? cellOf(lk) : -1;
      if (i < 0) { (odd.blocks || (odd.blocks = {}))[lk] = v; continue; }
      if (nc === keys.length) { const g = new Float64Array(nc * 2); g.set(keys); keys = g; }
      keys[nc++] = i * 2097152 + vals.length; vals.push(v);
    }
    else if (c.blocks !== undefined && c.blocks !== null) odd.blocks = c.blocks;
    keys = keys.subarray(0, nc).sort();
    const cells = new Int32Array(nc), val = new Array(nc);
    for (let i = 0; i < nc; i++) { const k = keys[i]; cells[i] = Math.floor(k / 2097152); val[i] = vals[k % 2097152]; }
    let runs = 0;
    for (let i = 0; i < nc; i++) if (i === 0 || cells[i] !== cells[i - 1] + 1 || val[i] !== val[i - 1]) runs++;
    o.uv(runs);
    let end = 0;
    for (let i = 0; i < nc;) {
      const at = cells[i], v = val[i];
      let j = i;
      while (j + 1 < nc && cells[j + 1] === cells[j] + 1 && val[j + 1] === v) j++;
      const len = j - i + 1;
      o.uv((at - end) * 2 + (len > 1 ? 1 : 0)); if (len > 1) o.uv(len - 2); o.uv(v);
      end = at + len; i = j + 1;
    }
    /* the block entities, by cell */
    const bes = [];
    if (plainObj(c.blockEntities)) for (const bk of Object.keys(c.blockEntities)) { const i = beCell(bk, cx, cz); if (i >= 0 && bk === `${cx * CHUNK + (i % CHUNK)},${Math.floor(i / 256)},${cz * CHUNK + (Math.floor(i / CHUNK) % CHUNK)}`) bes.push([i, c.blockEntities[bk]]); else (odd.blockEntities || (odd.blockEntities = {}))[bk] = c.blockEntities[bk]; }
    else if (c.blockEntities !== undefined && c.blockEntities !== null) odd.blockEntities = c.blockEntities;
    bes.sort((a, b) => a[0] - b[0]);
    o.uv(bes.length);
    let lastCell = -1;
    for (const [i, v] of bes) { o.uv(i - lastCell - 1); lastCell = i; o.value(v, 0); }
    /* anything else the chunk had */
    for (const k of Object.keys(c)) if (k !== 'blocks' && k !== 'blockEntities') odd[k] = c[k];
    o.value(Object.keys(odd).length ? odd : null, 0);
  }
  o.value(Object.keys(extra).length ? extra : null, 0);
  return o.done();
}

/* the bytes after a region file's head (r is at its region's place) -> the region document */
function decodeRegionBody(r, dimension) {
  const rx = r.sv(), rz = r.sv(), chunks = {};
  const n = r.count(1);
  let slot = -1;
  for (let k = 0; k < n; k++) {
    slot += 1 + r.uv();
    if (slot >= REGION * REGION) r.bad('a chunk outside its region');
    const cx = rx * REGION + (slot % REGION), cz = rz * REGION + Math.floor(slot / REGION), blocks = {}, blockEntities = {};
    const runs = r.count(2);
    let end = 0;
    for (let i = 0; i < runs; i++) {
      const g = r.uv(), at = end + Math.floor(g / 2), len = g % 2 ? r.uv() + 2 : 1, v = r.uv();
      if (at + len > Y_MAX * 256) r.bad('a run of blocks past the top of the world');
      for (let j = at; j < at + len; j++) blocks[cellKey(j)] = v;
      end = at + len;
    }
    const nb = r.count(2);
    let cell = -1;
    for (let i = 0; i < nb; i++) { cell += 1 + r.uv(); if (cell >= Y_MAX * 256) r.bad('a block entity past the top of the world'); blockEntities[`${cx * CHUNK + (cell % CHUNK)},${Math.floor(cell / 256)},${cz * CHUNK + (Math.floor(cell / CHUNK) % CHUNK)}`] = r.value(0); }
    const c = { blocks, blockEntities }, odd = r.value(0);
    if (plainObj(odd)) for (const key of Object.keys(odd)) {
      if ((key === 'blocks' || key === 'blockEntities') && plainObj(odd[key])) Object.assign(c[key], odd[key]); else c[key] = odd[key];
    }
    chunks[cx + ',' + cz] = c;
  }
  const extra = r.value(0);
  if (plainObj(extra)) for (const ck of Object.keys(extra)) chunks[ck] = extra[ck];
  return { dimension, region: [rx, rz], blocksFrom: [rx * REGION * CHUNK, rz * REGION * CHUNK], chunks };
}

/* ---- an entity file ---- */
export function encodeEntities(doc) {
  const o = new Out(), [rx, rz] = doc.region;
  o.room(4); o.b.write(MAGIC.entities, 0, 'latin1'); o.n = 3; o.byte(FORMAT);
  o.text(String(doc.dimension)); o.sv(rx); o.sv(rz);
  o.value(doc.items || {}, 0); o.value(doc.mobs || [], 0); o.value(doc.vehicles || [], 0);
  return o.done();
}
/* the bytes after an entity file's head -> the entity document */
function decodeEntitiesBody(r, dimension) {
  const rx = r.sv(), rz = r.sv(), items = r.value(0), mobs = r.value(0), vehicles = r.value(0);
  return { dimension, region: [rx, rz], items: plainObj(items) ? items : {}, mobs: Array.isArray(mobs) ? mobs : [], vehicles: Array.isArray(vehicles) ? vehicles : [] };
}

/* ---- either kind ---- */
export function encodeFile(kind, doc) { return kind === 'region' ? encodeRegion(doc) : encodeEntities(doc); }
/* bytes of any form (packed, JSON, Brotli'd JSON) -> { kind, form, doc }. name is for the error message */
export function decodeFile(buf, name) {
  name = name || 'the file';
  const head = buf.length >= 4 ? buf.toString('latin1', 0, 3) : '';
  if (KIND_OF_MAGIC[head]) {
    const r = new In(buf, name);
    r.p = 3;
    const f = r.byte();
    if (f > FORMAT) throw new Error(`${name} was written by a newer server (file format ${f}; this one reads up to ${FORMAT})`);
    const dim = r.text(), kind = KIND_OF_MAGIC[head];
    const doc = kind === 'region' ? decodeRegionBody(r, dim) : decodeEntitiesBody(r, dim);
    r.end();
    return { kind, form: 'packed', doc };
  }
  /* JSON (perhaps saved by Notepad: a byte-order mark first), else the Brotli of 6.53 to 6.59 */
  let text = null, form = 'json';
  if (!/^(\uFEFF)?\s*\{/.test(buf.toString('utf8', 0, Math.min(buf.length, 64)))) {
    try { text = zlib.brotliDecompressSync(buf).toString('utf8'); form = 'brotli'; } catch { text = null; }
  }
  if (text === null) text = buf.toString('utf8');
  text = text.replace(/^\uFEFF/, '');
  let doc;
  try { doc = JSON.parse(text); } catch (e) { throw new Error(`${name} is damaged (${e.message})`); }
  if (!plainObj(doc)) throw new Error(`${name} is damaged (not one JSON object)`);
  const kind = 'chunks' in doc ? 'region' : 'entities';
  if (kind === 'region') {
    /* 6.53 to 6.59: a cold region kept its blocks as runs (text) */
    for (const ck of Object.keys(doc.chunks || {})) { const c = doc.chunks[ck]; if (plainObj(c) && typeof c.runs === 'string') { c.blocks = { ...decodeRuns(c.runs), ...(plainObj(c.blocks) ? c.blocks : {}) }; delete c.runs; } }
  }
  return { kind, form, doc };
}
/* 6.53 to 6.59: the runs of a cold region ("<start>[+<length>]=<block>" in base 36, separated by spaces) back into blocks */
export function decodeRuns(text) {
  const out = {};
  for (const r of String(text || '').split(' ')) {
    const m = /^([0-9a-z]+)(?:\+([0-9a-z]+))?=([0-9a-z]+)$/.exec(r);
    if (!m) continue;
    const s = parseInt(m[1], 36), n = m[2] ? parseInt(m[2], 36) : 1, v = parseInt(m[3], 36);
    for (let i = s; i < s + n && i < CHUNK * CHUNK * 256; i++) out[cellKey(i)] = v;
  }
  return out;
}

/* ---- the readable form: the document as 6.12 to 6.59 wrote it (one thing per line) ---- */
const line = (v) => JSON.stringify(v);
/* an object as one "key": value pair per line, each value on a single line: readable, diffable, and not a page per chest */
function lines(obj, indent) {
  const keys = Object.keys(obj);
  return keys.length ? '{\n' + keys.map((k) => indent + '  ' + line(k) + ': ' + line(obj[k])).join(',\n') + '\n' + indent + '}' : '{}';
}
/* a document as the text a person reads (and unpack writes, and pack and the server read back) */
export function docText(kind, doc) {
  if (kind === 'region') {
    const body = Object.keys(doc.chunks || {}).map((ck) => {
      const { blocks, blockEntities, ...rest } = doc.chunks[ck] || {};
      return '    ' + line(ck) + ': {\n      "blocks": ' + line(blocks || {}) + ',\n      "blockEntities": ' + lines(blockEntities || {}, '      ') +
        Object.keys(rest).map((k) => ',\n      ' + line(k) + ': ' + line(rest[k])).join('') + '\n    }';
    }).join(',\n');
    return `{\n  "dimension": ${line(doc.dimension)},\n  "region": ${line(doc.region)},\n  "blocksFrom": ${line(Array.isArray(doc.region) ? doc.region.map((v) => v * REGION * CHUNK) : doc.blocksFrom)},\n  "chunks": {\n${body}\n  }\n}\n`;
  }
  const listText = (arr) => (arr.length ? '[\n' + arr.map((m) => '    ' + line(m)).join(',\n') + '\n  ]' : '[]');
  return `{\n  "dimension": ${line(doc.dimension)},\n  "region": ${line(doc.region)},\n  "items": ${lines(doc.items || {}, '  ')},\n  "mobs": ${listText(doc.mobs || [])},\n  "vehicles": ${listText(doc.vehicles || [])}\n}\n`;
}

/* ---- names: what the ids are called (names.json, made from the game by npm run names) ---- */
let NAMES = null;
/* the table, read once ({ ids: { id: name }, mobs: [type] }; empty if the file is missing) */
export function names() {
  if (NAMES) return NAMES;
  try { NAMES = JSON.parse(fs.readFileSync(new URL('./names.json', import.meta.url), 'utf8')); } catch { NAMES = { version: '', ids: {} }; }
  return NAMES;
}
/* a block value (id | meta << 8) as words: "Water (meta 3)" */
export function blockName(v) {
  const id = v & 255, meta = Math.floor(v / 256), n = names().ids[id];
  return (n || 'block ' + id) + (meta ? ' (meta ' + meta + ')' : '');
}
/* an item id as words */
export function itemName(id) { return names().ids[id] || 'item ' + id; }

/* ---- a world folder ---- */
const WORLD_KINDS = ['region', 'entities'];
const FILE_RE = /^r\.(-?\d+)\.(-?\d+)\.(dcr|dce|json|json\.br)$/;
/* every region and entity file of a world, [{ rel, kind, dim, rx, rz, form, bytes }], sorted. Where a region has a file in
   an older form beside the packed one (a conversion that was cut short), only the packed one is listed; with all, the
   others are listed too, marked shadowed. */
export function listWorldFiles(dir, all) {
  const out = [], shadowed = [];
  for (const kind of WORLD_KINDS) {
    let dims = [];
    try { dims = fs.readdirSync(path.join(dir, kind), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { continue; }
    for (const dim of dims.sort()) {
      const byPlace = new Map();
      let files = [];
      try { files = fs.readdirSync(path.join(dir, kind, dim)); } catch { continue; }
      for (const n of files) {
        const m = FILE_RE.exec(n);
        if (!m) continue;
        const form = m[3] === 'json' ? 'json' : m[3] === 'json.br' ? 'brotli' : 'packed', rel = kind + '/' + dim + '/' + n;
        let bytes = 0;
        try { bytes = fs.statSync(path.join(dir, rel)).size; } catch { continue; }
        const f = { rel, kind, dim, rx: +m[1], rz: +m[2], form, bytes }, k = m[1] + '.' + m[2], had = byPlace.get(k);
        const better = !had || (form === 'packed') > (had.form === 'packed') || (form === 'json' && had.form === 'brotli');
        if (better) { if (had) shadowed.push({ ...had, shadowed: true }); byPlace.set(k, f); } else shadowed.push({ ...f, shadowed: true });
      }
      out.push(...[...byPlace.values()].sort((a, b) => a.rx - b.rx || a.rz - b.rz));
    }
  }
  return all ? out.concat(shadowed) : out;
}
export const fileName = (kind, rx, rz) => `r.${rx}.${rz}${EXT[kind]}`;

/* read one file of a world (rel as listWorldFiles gives it) -> { kind, form, doc } */
export function readWorldFile(dir, rel) {
  const full = path.resolve(dir, rel);
  if (!full.startsWith(path.resolve(dir) + path.sep)) throw new Error('not a file of this world: ' + rel);
  return decodeFile(fs.readFileSync(full), rel);
}

/* a short account of one file: how many chunks, changed blocks, block entities, items, mobs and vehicles */
export function summary(kind, doc) {
  if (kind === 'region') {
    let blocks = 0, bes = 0;
    const chunks = Object.keys(doc.chunks || {});
    for (const ck of chunks) { const c = doc.chunks[ck] || {}; blocks += Object.keys(c.blocks || {}).length; bes += Object.keys(c.blockEntities || {}).length; }
    return { chunks: chunks.length, blocks, blockEntities: bes };
  }
  return { items: Object.keys(doc.items || {}).length, mobs: (doc.mobs || []).length, vehicles: (doc.vehicles || []).length };
}

/* a document as tables a person reads, with names: [{ title, head: [column], rows: [[cell]] }]. A region: for each chunk
   what its blocks were changed to (how many of each) and what its chests and furnaces hold; an entity file: the dropped
   items, the mobs, the vehicles. */
export function describeDoc(kind, doc) {
  const out = [], at = (x, y, z) => [x, y, z].map((v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : '?')).join(' ');
  /* what a chest (or anything) holds, the same item added up: "24 x Arrow, Steak, coal (fuel)" */
  const holds = (v) => {
    const sum = new Map();
    for (const st of stacksIn(v, '', [], 0)) { const k = itemName(st.id) + (st.at && !/^inv\.\d+$/.test(st.at) ? ' (' + st.at + ')' : ''); sum.set(k, (sum.get(k) || 0) + st.count); }
    return [...sum].map(([k, n]) => (n > 1 ? n + ' x ' : '') + k).join(', ');
  };
  if (kind === 'region') {
    const place = (ck) => ck.split(',').map(Number);
    const keys = Object.keys(doc.chunks || {}).sort((a, b) => { const p = place(a), q = place(b); return p[1] - q[1] || p[0] - q[0]; });
    for (const ck of keys) {
      const c = doc.chunks[ck] || {}, [cx, cz] = place(ck), counts = new Map();
      for (const lk of Object.keys(c.blocks || {})) { const v = c.blocks[lk], n = Number.isInteger(v) ? blockName(v) : 'not a block: ' + JSON.stringify(v); counts.set(n, (counts.get(n) || 0) + 1); }
      const title = Number.isFinite(cx) && Number.isFinite(cz) ? `Chunk ${ck}: x ${cx * CHUNK} to ${cx * CHUNK + 15}, z ${cz * CHUNK} to ${cz * CHUNK + 15}` : 'Chunk ' + ck;
      if (counts.size) out.push({ title, head: ['Changed to', 'Blocks'], rows: [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([n, k]) => [n, k]) });
      const bes = Object.keys(c.blockEntities || {});
      if (bes.length) out.push({ title: (counts.size ? 'Chests, furnaces and the like' : title + ': chests, furnaces and the like'), head: ['At', 'What', 'Holds'], rows: bes.map((bk) => { const be = c.blockEntities[bk]; return [bk.split(',').join(' '), be && typeof be === 'object' && typeof be.t === 'string' ? be.t : '?', holds(be) || 'nothing']; }) });
    }
    return out;
  }
  const items = Object.keys(doc.items || {});
  if (items.length) out.push({ title: 'Dropped items', head: ['Item', 'At', 'Lying there for'], rows: items.map((id) => { const it = doc.items[id] || {}; return [holds(it.item) || '?', at(it.x, it.y, it.z), (it.ageSeconds || 0) + ' s']; }) });
  if ((doc.mobs || []).length) out.push({ title: 'Mobs', head: ['Type', 'Name', 'At', 'Health'], rows: doc.mobs.map((m) => [m.type, m.name || '', at(m.x, m.y, m.z), m.health]) });
  if ((doc.vehicles || []).length) out.push({ title: 'Vehicles', head: ['Type', 'At', 'Health'], rows: doc.vehicles.map((v) => [v.type, at(v.x, v.y, v.z), v.health]) });
  return out;
}

/* ---- searching ----
   find(query) -> a test. The query is words: an id ("#31" or "31"), or a name or part of one ("diamond", "oak log"), or a
   mob or vehicle type ("zombie"). Matching ignores case. */
export function matcher(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  const idm = /^#?(\d{1,5})$/.exec(q);
  if (idm) { const id = +idm[1]; return { id: (v) => v === id, text: () => false }; }
  const ids = new Set();
  const all = names().ids;
  for (const k of Object.keys(all)) if (String(all[k]).toLowerCase().includes(q)) ids.add(+k);
  return { id: (v) => ids.has(v), text: (s) => typeof s === 'string' && s.toLowerCase().includes(q) };
}
/* every item stack inside a value (a chest's slots, a furnace's input, fuel and output ...): [{ id, count, path }] */
function stacksIn(v, at, out, depth) {
  if (!v || typeof v !== 'object' || depth > 12) return out;
  if (!Array.isArray(v) && Number.isInteger(v.id) && Number.isInteger(v.count)) { out.push({ id: v.id, count: v.count, at, st: v }); return out; }
  for (const k of Object.keys(v)) stacksIn(v[k], at ? at + '.' + k : k, out, depth + 1);
  return out;
}
const bePos = (bk) => bk.split(',').map(Number);
const GROUP = 8;
/* search one file's document. what: { blocks, items, mobs } (true = look for that kind). Each hit is
   { kind: 'block' | 'item' | 'mob' | 'vehicle', in: 'changed block' | 'chest' ... | 'dropped' | 'world', at: [x, y, z], id?, count?, name } */
export function searchDoc(kind, doc, m, what) {
  const hits = [];
  if (kind === 'region') {
    for (const ck of Object.keys(doc.chunks || {})) {
      const c = doc.chunks[ck] || {}, [cx, cz] = ck.split(',').map(Number);
      const bl = c.blocks || {}, found = new Set();
      if (what.blocks) {
        /* each spot, unless a chunk has more than GROUP of one block (a dug-out cave): then one line for them all */
        const byId = new Map();
        for (const lk of Object.keys(bl)) {
          const v = bl[lk];
          if (!Number.isInteger(v) || !m.id(v & 255)) continue;
          const p = lk.split(',').map(Number);
          (byId.get(v) || byId.set(v, []).get(v)).push([cx * CHUNK + p[0], p[1], cz * CHUNK + p[2]]);
          found.add(lk);
        }
        for (const [v, spots] of byId) {
          if (spots.length > GROUP) hits.push({ kind: 'block', in: 'changed blocks in chunk ' + ck + ', the first at', at: spots[0], id: v & 255, count: spots.length, name: blockName(v), chunk: ck });
          else for (const at of spots) hits.push({ kind: 'block', in: 'changed block', at, id: v & 255, count: 1, name: blockName(v), chunk: ck });
        }
      }
      for (const bk of Object.keys(c.blockEntities || {})) {
        const be = c.blockEntities[bk], t = be && typeof be === 'object' && typeof be.t === 'string' ? be.t : 'block entity', at = bePos(bk);
        /* a chest found as a block is not listed again as a chest (one that was never placed by hand, in a village, is) */
        if (what.blocks && m.text(t) && !found.has((at[0] - cx * CHUNK) + ',' + at[1] + ',' + (at[2] - cz * CHUNK))) hits.push({ kind: 'block', in: t, at, count: 1, name: t, chunk: ck });
        if (what.items) for (const s of stacksIn(be, '', [], 0)) if (m.id(s.id)) hits.push({ kind: 'item', in: t + (s.at ? ', ' + s.at.replace(/^inv\.(\d+)$/, 'slot $1') : ''), at, id: s.id, count: s.count, name: itemName(s.id), chunk: ck });
      }
    }
  } else {
    if (what.items) for (const id of Object.keys(doc.items || {})) {
      const it = doc.items[id] || {};
      for (const s of stacksIn(it.item, '', [], 0)) if (m.id(s.id)) hits.push({ kind: 'item', in: 'dropped', at: [it.x, it.y, it.z], id: s.id, count: s.count, name: itemName(s.id) });
    }
    if (what.mobs) {
      for (const mob of doc.mobs || []) if (mob && (m.text(mob.type) || m.text(mob.name))) hits.push({ kind: 'mob', in: 'health ' + mob.health, at: [mob.x, mob.y, mob.z], count: 1, name: mob.type + (mob.name ? ' "' + mob.name + '"' : ''), health: mob.health });
      for (const v of doc.vehicles || []) if (v && m.text(v.type)) hits.push({ kind: 'vehicle', in: 'health ' + v.health, at: [v.x, v.y, v.z], count: 1, name: v.type, health: v.health });
    }
  }
  return hits;
}
/* the players' files: what they carry and wear (playerdata/<name>.json; a .json.br from 6.53 to 6.59 too) */
export function searchPlayers(dir, m) {
  const hits = [], pdir = path.join(dir, 'playerdata');
  let files = [];
  try { files = fs.readdirSync(pdir).filter((n) => /\.json(\.br)?$/.test(n)); } catch { return hits; }
  for (const n of files.sort()) {
    let p;
    try { const raw = fs.readFileSync(path.join(pdir, n)); p = JSON.parse(n.endsWith('.br') ? zlib.brotliDecompressSync(raw).toString('utf8') : raw.toString('utf8')); } catch { continue; }
    if (!plainObj(p)) continue;
    const who = typeof p.player === 'string' ? p.player : n.replace(/\.json(\.br)?$/, ''), at = [p.x, p.y, p.z].map((v) => (typeof v === 'number' ? Math.round(v) : v));
    for (const [list, label] of [[p.inv, 'inventory'], [p.armor, 'armour']]) {
      if (!Array.isArray(list)) continue;
      list.forEach((st, slot) => { for (const s of stacksIn(st, '', [], 0)) if (m.id(s.id)) hits.push({ kind: 'item', in: who + "'s " + label + ' (slot ' + slot + ')', at, id: s.id, count: s.count, name: itemName(s.id), player: who, dim: typeof p.dim === 'string' ? p.dim : '', rel: 'playerdata/' + n }); });
    }
  }
  return hits;
}
/* search a world. opts: { query, files: [rel, or 'playerdata'] (none or empty = every file), blocks, items (in chests and
   on the ground), mobs (and vehicles), players (what they carry): false = do not look; limit (most hits, 2000), onFile
   (rel, done, total) }. Returns { hits, files, truncated, errors } */
export async function searchWorld(dir, opts) {
  const m = matcher(opts.query);
  if (!m) return { hits: [], files: 0, truncated: false, errors: [] };
  const what = { blocks: opts.blocks !== false, items: opts.items !== false, mobs: opts.mobs !== false };
  const pick = opts.files && opts.files.length ? new Set(opts.files) : null, limit = opts.limit || 2000;
  const list = listWorldFiles(dir).filter((f) => !pick || pick.has(f.rel)), hits = [], errors = [];
  let n = 0;
  for (const f of list) {
    if (opts.onFile) opts.onFile(f.rel, n, list.length);
    try { const { kind, doc } = readWorldFile(dir, f.rel); for (const h of searchDoc(kind, doc, m, what)) hits.push({ ...h, dim: f.dim, rel: f.rel }); }
    catch (e) { errors.push(e.message); }
    n++;
    if (hits.length >= limit) break;
    if (n % 8 === 0) await new Promise((r) => setImmediate(r));                  // let the window breathe
  }
  if (opts.players !== false && hits.length < limit && (!pick || pick.has('playerdata'))) hits.push(...searchPlayers(dir, m));
  return { hits: hits.slice(0, limit), files: n, truncated: hits.length >= limit, errors };
}
