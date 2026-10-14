// world.mjs: the world as data. Making one, adopting a save file, applying the settings file, reading and writing the world
// folder, and the small validators for things that get stored in it. No sockets.
//
// In memory the world is a normal DINGLECRAFT save (what the game's Export World writes) plus the server's own tables:
//   { f, v, name, seed, mode, time, gr (game rules), edits {chunkKey: {localKey: blockId}}, be {blockKey: blockEntity},
//     players {lowercase name: saved player (+ gm, that player's own game mode)}, drops {id: {dim, x, y, z, st, age}},
//     mobs [{t, x, y, z, yaw, hp, name?, ox?, oz?}] (the Overworld's mobs as the server's own game last reported them),
//     vehicles [{t, x, y, z, yaw, hp}] (its cars, boats, planes, carts and skateboards, likewise),
//     spawn {x, y, z} (where new players start), ...whatever else the save carried }
//
// On disk it is a folder, laid out like a Minecraft world and written as JSON a person can read and edit (6.12):
//   <world>/
//     level.json                        the world itself: name, seed, mode, time, spawn, rules, and whatever else a save carried
//     region/<dimension>/r.<rx>.<rz>.json    the changed blocks and the chests and furnaces of one region: 32 x 32 chunks
//                                            (512 x 512 blocks), named after its place in the world
//     entities/<dimension>/r.<rx>.<rz>.json  everything that lies or walks in that region: the dropped items and the mobs
//     playerdata/<name>.json            one file per player who has ever joined: position, health, hunger, spawn point,
//                                       inventory, armour, XP, game mode
//     data/structures.json              which villages, dungeons, parks and roosts have been found (so each is populated
//                                       once), and where the spawners stand
//     data/bosses.json                  which dimension bosses are dead
//     data/nukes.json                   where a mega nuke went off
//     data/market.json                  what the stocks cost
// Only what changed since the last save is written (each file through a .tmp and a rename), and a file whose region
// emptied out is removed. A world from before 6.12 (one world.vxw.json) is read once and written out as a folder; the old
// file is left where it was. exportWorld turns the folder back into that one file, which the game can import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { RULES, DIM_PFX, LIMITS, cleanRules } from './config.mjs';

/* the game's hashSeed (src/core/p07f_world_lifecycle.js): a number as typed, words hashed, blank = random */
export function hashSeed(str) {
  str = String(str || '').trim();
  if (!str) return crypto.randomInt(1, 2147483647);
  if (/^-?\d+$/.test(str)) return parseInt(str, 10) | 0;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

/* players are remembered by lower-case name */
export const playerKey = (name) => String(name || '').toLowerCase();

/* a number from a client, clamped; d when it is not a finite number */
export const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/* a player name: printable ASCII, single spaces, at most 16 characters */
export function cleanName(n) {
  return String(n == null ? '' : n).replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
}

/* one line of text from a client: no control characters, trimmed, at most max characters */
export function cleanText(t, max) {
  return String(t == null ? '' : t).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}

/* an item stack as the game saves one: {id, count, dur?, ench?, mob?}; null for anything else */
export function cleanStack(st) {
  if (!st || typeof st !== 'object' || !Number.isInteger(st.id) || st.id < 1 || st.id > 19999 || !Number.isInteger(st.count) || st.count < 1 || st.count > 999) return null;
  const out = { id: st.id, count: st.count };
  if (typeof st.dur === 'number' && Number.isFinite(st.dur)) out.dur = st.dur;
  for (const k of ['psn', 'pz']) if (Number.isInteger(st[k]) && st[k] > 0 && st[k] <= 999) out[k] = st[k];   // 6.40: poisoned pieces in a food stack, poisoned hits left on a blade
  for (const k of ['ench', 'mob']) {
    const v = st[k];
    if (v == null) continue;
    if ((typeof v === 'string' || (typeof v === 'object' && !Array.isArray(v))) && JSON.stringify(v).length <= 600) out[k] = v; else return null;
  }
  return out;
}

/* the mobs of a world, each {t, x, y, z, yaw, hp, name?, ox?, oz?} with sane values; anything else is left out */
export function cleanMobs(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (const m of list) {
    if (!m || typeof m !== 'object' || typeof m.t !== 'string' || !/^[a-z]{1,16}$/.test(m.t) || ![m.x, m.y, m.z].every(Number.isFinite)) continue;
    const o = { t: m.t, x: m.x, y: m.y, z: m.z, yaw: num(m.yaw, -1e4, 1e4, 0), hp: num(m.hp, 0, 1e6, 1) };
    if (typeof m.name === 'string' && m.name) o.name = cleanText(m.name, 24);
    if (Number.isFinite(m.ox) && Number.isFinite(m.oz)) { o.ox = m.ox; o.oz = m.oz; }
    if (typeof m.d === 'string' && m.d !== 'over' && m.d in DIM_PFX) o.d = m.d;   // which dimension (the Overworld is not spelled out)
    out.push(o);
    if (out.length >= 4000) break;
  }
  return out;
}

/* an empty world from the settings (seed, mode, name) */
export function newWorld(o) {
  return { f: 1, v: null, name: o.name, seed: hashSeed(o.seed), mode: o.mode === 'c' ? 'c' : 's', time: 0.3, gr: {}, edits: {}, be: {}, players: {}, drops: {}, mobs: [], vehicles: [], spawn: null };
}

/* a save from the game (or our own file) -> the server's world. Per-client things are dropped: the exporter's own player
   and that save's local mobs and vehicles (and the AI players and their rules, which saves from 5.9 to 6.9 still carry). */
export function adoptWorld(d, o) {
  if (!d || typeof d !== 'object' || typeof d.seed !== 'number') throw new Error('not a DINGLECRAFT world file');
  const w = { ...d };
  w.f = d.f || 1;
  w.seed = d.seed | 0;
  w.mode = d.mode === 'c' ? 'c' : 's';
  w.time = Number.isFinite(+d.time) ? ((+d.time % 1) + 1) % 1 : 0.3;
  w.gr = d.gr && typeof d.gr === 'object' ? { ...d.gr } : {};
  w.edits = d.edits && typeof d.edits === 'object' ? d.edits : {};
  w.be = d.be && typeof d.be === 'object' ? d.be : {};
  w.players = d.players && typeof d.players === 'object' ? d.players : {};
  w.drops = d.drops && typeof d.drops === 'object' && !Array.isArray(d.drops) ? d.drops : {};
  w.mobs = cleanMobs(d.mobs);
  w.vehicles = cleanMobs(d.vehicles);
  /* a dropped item's age is counted in seconds played, not by the wall clock (a file from before that starts again at 0) */
  for (const id of Object.keys(w.drops)) { const dr = w.drops[id]; if (dr && typeof dr === 'object') { if (!Number.isFinite(dr.age)) dr.age = 0; delete dr.born; } }
  const sp = d.spawn;
  w.spawn = sp && typeof sp === 'object' && [sp.x, sp.y, sp.z].every(Number.isFinite) ? { x: sp.x, y: sp.y, z: sp.z } : null;
  w.name = o.name || d.name || 'world';
  delete w.player; delete w.dim; delete w.ents; delete w.bots;
  for (const k of ['bots', 'botPvP', 'botGrief', 'botPurg']) delete w.gr[k];
  return w;
}

/* ---- the world folder ---- */
export const REGION = 32;             // chunks along one side of a region file
const CHUNK = 16;                     // blocks along one side of a chunk (the game's CH)
const LAYOUT = 1;                     // the folder layout's own version number, in level.json
/* the world's own records, by the data/ file each is kept in (the names are the save format's) */
const DATA_FILES = {
  structures: { about: 'Which structures have been found, so each is populated once (vseen villages, nseen and aseen the Nether and Aether ones, pseen parks, wdseen dungeons, lsseen, rseen roosts), and where the spawners stand (spw).', keys: ['vseen', 'nseen', 'aseen', 'pseen', 'wdseen', 'lsseen', 'rseen', 'spw'] },
  bosses: { about: 'Which dimension bosses are dead: the fortresses of the Nether (infkill) and the citadels of the Aether (valkill) whose boss has been killed.', keys: ['infkill', 'valkill'] },
  nukes: { about: 'Where a mega nuke went off: [x, y, z, dimension] or "x,y,z,dimension" (0 Overworld, 1 Nether, 2 Aether, 3 Puppet Purgatory).', keys: ['nukes'] },
  market: { about: 'What the stocks cost (p) and where each is drifting (mu).', keys: ['market'] },
};
const DIM_OF = Object.fromEntries(Object.entries(DIM_PFX).map(([dim, pfx]) => [pfx, dim]));   // 'n;' -> 'nether'
/* the folder a key's dimension prefix ('' or 'n;' ...) is stored under, and back. A prefix this server has no name for
   (a newer game's dimension) gets a folder of its own, so nothing is lost. */
const dimFolder = (pfx) => DIM_OF[pfx] || 'dim-' + pfx[0];
const dimPrefix = (folder) => (folder in DIM_PFX ? DIM_PFX[folder] : /^dim-[a-z]$/.test(folder) ? folder[4] + ';' : null);
const splitKey = (k) => (k[1] === ';' ? [k.slice(0, 2), k.slice(2)] : ['', k]);
const regionOf = (cx, cz) => Math.floor(cx / REGION) + '.' + Math.floor(cz / REGION);
const blockRegion = (x, z) => regionOf(Math.floor(x / CHUNK), Math.floor(z / CHUNK));

/* where a world lives: { dir, legacy }. The "world" setting names the folder (inside the data folder unless a full path).
   A name ending in .json is a world from before 6.12, or an exported single-player save: the folder is that name without
   the ending, and the file is read once if the folder does not exist yet. */
export function worldPlace(dataDir, setting) {
  const p = path.resolve(dataDir, setting);
  if (/\.json$/i.test(p)) return { dir: p.replace(/(\.vxw)?\.json$/i, ''), legacy: p };
  return { dir: p, legacy: p + '.vxw.json' };
}

/* the file a player is kept in: their lower-case name, with anything a file system might mind spelled as %xx. (A name
   Windows reserves, like "con", gets a trailing %, which no real name can produce.) The name inside the file is the truth. */
export function playerFile(key) {
  const safe = key.replace(/[^a-z0-9_-]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
  return (/^(con|prn|aux|nul|com\d|lpt\d)$/.test(safe) || !safe ? safe + '%' : safe) + '.json';
}

const line = (v) => JSON.stringify(v);
/* an object as one "key": value pair per line, each value on a single line: readable, diffable, and not a page per chest */
function lines(obj, indent) {
  const keys = Object.keys(obj);
  return keys.length ? '{\n' + keys.map((k) => indent + '  ' + line(k) + ': ' + line(obj[k])).join(',\n') + '\n' + indent + '}' : '{}';
}

/* The world as files: a Map of path (relative to the world folder, forward slashes) -> text. */
export function worldFiles(world, cold) {
  const coldR = (cold && cold.regions) || new Set(), coldP = (cold && cold.players) || new Set();   // 6.51: what is written compressed
  const out = new Map();
  const { edits, be, players, drops, mobs, vehicles, ...level } = world;
  /* data/<name>.json: the world's own records leave level.json for a file each (only the ones this world has) */
  for (const name of Object.keys(DATA_FILES)) {
    const doc = {};
    for (const k of DATA_FILES[name].keys) if (level[k] !== undefined) { doc[k] = level[k]; delete level[k]; }
    if (!Object.keys(doc).length) continue;
    out.set(`data/${name}.json`, '{\n  "about": ' + line(DATA_FILES[name].about) + ',\n' + Object.keys(doc).map((k) => '  ' + line(k) + ': ' + line(doc[k])).join(',\n') + '\n}\n');
  }
  out.set('level.json', JSON.stringify({ layout: LAYOUT, regionSize: REGION, chunkSize: CHUNK, ...level }, null, 2) + '\n');

  /* region/<dim>/r.<rx>.<rz>.json: chunk by chunk, the changed blocks ("lx,y,lz": block id) and the block entities */
  const regions = new Map();           // 'over/0.-1' -> { 'cx,cz': { blocks, blockEntities } }
  const chunkIn = (folder, cx, cz) => {
    const rk = folder + '/' + regionOf(cx, cz);
    let r = regions.get(rk);
    if (!r) regions.set(rk, r = {});
    return r[cx + ',' + cz] || (r[cx + ',' + cz] = { blocks: null, blockEntities: null });
  };
  for (const k of Object.keys(edits)) {
    if (!Object.keys(edits[k]).length) continue;
    const [pfx, ck] = splitKey(k), c = ck.split(',');
    chunkIn(dimFolder(pfx), +c[0], +c[1]).blocks = edits[k];
  }
  for (const k of Object.keys(be)) {
    const [pfx, bk] = splitKey(k), p = bk.split(',');
    const ch = chunkIn(dimFolder(pfx), Math.floor(p[0] / CHUNK), Math.floor(p[2] / CHUNK));
    (ch.blockEntities || (ch.blockEntities = {}))[bk] = be[k];
  }
  for (const [rk, chunks] of regions) {
    const [folder, r] = rk.split('/'), [rx, rz] = r.split('.').map(Number), isCold = coldR.has(rk);
    const body = Object.keys(chunks).sort().map((ck) => {
      const c = chunks[ck];
      return '    ' + line(ck) + ': {\n      ' + (isCold ? '"runs": ' + line(encodeRuns(c.blocks || {})) : '"blocks": ' + line(c.blocks || {})) + ',\n      "blockEntities": ' + lines(c.blockEntities || {}, '      ') + '\n    }';
    }).join(',\n');
    (isCold ? (rel, text) => out.set(rel + '.br', brotli(text)) : (rel, text) => out.set(rel, text))(`region/${folder}/r.${r}.json`, `{\n  "dimension": ${line(folder)},\n  "region": [${rx}, ${rz}],\n  "blocksFrom": [${rx * REGION * CHUNK}, ${rz * REGION * CHUNK}],\n  "chunks": {\n${body}\n  }\n}\n`);
  }

  /* entities/<dim>/r.<rx>.<rz>.json: what lies in that region */
  const ents = new Map();            // 'over/0.-1' -> { items: {id: ...}, mobs: [...] }
  const entsIn = (folder, x, z) => { const rk = folder + '/' + blockRegion(x, z); let r = ents.get(rk); if (!r) ents.set(rk, r = { items: {}, mobs: [], vehicles: [] }); return r; };
  for (const id of Object.keys(drops)) {
    const d = drops[id];
    entsIn(DIM_PFX[d.dim] === undefined ? 'over' : d.dim, d.x, d.z).items[id] = { x: d.x, y: d.y, z: d.z, item: d.st, ageSeconds: Math.round(d.age || 0) };
  }
  /* the mobs: the Overworld's, as the server's own game reported them (type, place, health; a villager's name; "origin":
     the spot a structure spawned it at) */
  for (const m of mobs || []) {
    const o = { type: m.t, x: m.x, y: m.y, z: m.z, yaw: m.yaw, health: m.hp };
    if (m.name) o.name = m.name;
    if (m.ox !== undefined) o.origin = [m.ox, m.oz];
    entsIn(m.d || 'over', m.x, m.z).mobs.push(o);
  }
  for (const v of vehicles || []) entsIn(v.d || 'over', v.x, v.z).vehicles.push({ type: v.t, x: v.x, y: v.y, z: v.z, yaw: v.yaw, health: v.hp });
  for (const [rk, e] of ents) {
    const [folder, r] = rk.split('/'), [rx, rz] = r.split('.').map(Number);
    const listText = (arr) => (arr.length ? '[\n' + arr.map((m) => '    ' + line(m)).join(',\n') + '\n  ]' : '[]');
    out.set(`entities/${folder}/r.${r}.json`, `{\n  "dimension": ${line(folder)},\n  "region": [${rx}, ${rz}],\n  "items": ${lines(e.items, '  ')},\n  "mobs": ${listText(e.mobs)},\n  "vehicles": ${listText(e.vehicles)}\n}\n`);
  }

  /* playerdata/<name>.json */
  for (const key of Object.keys(players)) {
    const p = players[key];
    if (!p || typeof p !== 'object') continue;
    const { inv, armor, password, ...rest } = p;
    /* 6.49: an account's password is the file's second line, in plain text (the owner can read it: the game says so) */
    const head = JSON.stringify({ player: key, ...(typeof password === 'string' ? { password } : {}), ...rest }, null, 2).replace(/\n}$/, '');
    const list = (name, arr) => (Array.isArray(arr) ? `,\n  ${line(name)}: [\n${arr.map((it) => '    ' + line(it)).join(',\n')}\n  ]` : '');
    const text = head + list('armor', armor) + list('inv', inv) + '\n}\n';
    if (coldP.has(key)) out.set('playerdata/' + playerFile(key) + '.br', brotli(text)); else out.set('playerdata/' + playerFile(key), text);
  }
  return out;
}

const md5 = (t) => crypto.createHash('md5').update(t).digest('hex');
/* ----- cold files (6.51) -----
   A region nobody has been near for compressAfter days, and a player who has not joined for compressPlayersAfter days, are
   written compressed: r.<rx>.<rz>.json.br and <name>.json.br, Brotli (Node's own zlib). Inside, a cold region's chunks keep
   their changed blocks as "runs" instead of "blocks": every changed cell by its index in the chunk (y * 256 + z * 16 + x),
   in order, and a stretch of cells in a row with the same block written once, in base 36:
     "<start>[+<length>]=<block>"   separated by spaces; the block is the id plus its meta << 8, as in "blocks"
   so a dug-out chunk is a few bytes. Anyone can open one: brotli -d, or node -e "process.stdout.write(require('zlib')
   .brotliDecompressSync(require('fs').readFileSync(process.argv[1])))" <file>. The server reads both forms, and writes a
   file plain again as soon as its region is visited or its player joins. */
export function encodeRuns(blocks) {
  const a = [];
  for (const lk of Object.keys(blocks || {})) {
    const p = lk.split(',').map(Number), v = blocks[lk];
    if (p.length === 3 && p.every(Number.isInteger) && Number.isInteger(v)) a.push([p[1] * 256 + p[2] * 16 + p[0], v]);
  }
  a.sort((x, y) => x[0] - y[0]);
  const out = [];
  for (let i = 0; i < a.length;) {
    let j = i;
    while (j + 1 < a.length && a[j + 1][0] === a[j][0] + 1 && a[j + 1][1] === a[i][1]) j++;
    out.push(a[i][0].toString(36) + (j > i ? '+' + (j - i + 1).toString(36) : '') + '=' + a[i][1].toString(36));
    i = j + 1;
  }
  return out.join(' ');
}
/* the runs back into {"lx,y,lz": block} (anything malformed is skipped) */
export function decodeRuns(text) {
  const out = {};
  for (const r of String(text || '').split(' ')) {
    const m = /^([0-9a-z]+)(?:\+([0-9a-z]+))?=([0-9a-z]+)$/.exec(r);
    if (!m) continue;
    const s = parseInt(m[1], 36), n = m[2] ? parseInt(m[2], 36) : 1, v = parseInt(m[3], 36);
    for (let i = s; i < s + n && i < CHUNK * CHUNK * 256; i++) out[(i % CHUNK) + ',' + Math.floor(i / 256) + ',' + (Math.floor(i / CHUNK) % CHUNK)] = v;
  }
  return out;
}
const brotli = (text) => zlib.brotliCompressSync(Buffer.from(text, 'utf8'), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });
/* every .json file under a folder of the world, as paths relative to the world folder (and, since 6.51, .json.br) */
function listJson(dir, sub) {
  const out = [];
  (function walk(rel) {
    let names = [];
    try { names = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }); } catch { return; }
    for (const n of names) {
      if (n.isDirectory()) walk(rel + '/' + n.name);
      else if (n.name.endsWith('.json') || n.name.endsWith('.json.br')) out.push(rel + '/' + n.name);
    }
  })(sub);
  return out;
}

/* Read a world folder. Returns { world (not yet adopted), seen }: seen is path -> md5 of every file read, which
   writeWorld uses to write only what changed and to remove a file whose content is gone. A file that cannot be parsed
   is an error that names it. */
export function readWorldDir(dir) {
  const seen = new Map();
  const read = (rel) => {
    const raw = fs.readFileSync(path.join(dir, rel));
    let text;
    if (rel.endsWith('.br')) { seen.set(rel, md5(raw)); try { text = zlib.brotliDecompressSync(raw).toString('utf8'); } catch (e) { throw new Error(`${path.join(dir, rel)} is damaged (${e.message}). Fix it, or move the world folder away to start a new world.`); } }
    else { text = raw.toString('utf8'); seen.set(rel, md5(text)); }
    try { return JSON.parse(text); } catch (e) { throw new Error(`${path.join(dir, rel)} is damaged (${e.message}). Fix it, or move the world folder away to start a new world.`); }
  };
  const { layout, regionSize, chunkSize, ...level } = read('level.json');
  if (regionSize && regionSize !== REGION) throw new Error(`${path.join(dir, 'level.json')} says regions are ${regionSize} chunks wide; this server reads ${REGION}`);
  const world = { ...level, edits: {}, be: {}, players: {}, drops: {}, mobs: [], vehicles: [] };
  for (const rel of listJson(dir, 'data')) {
    const name = rel.split('/')[1].replace(/\.json$/, ''), doc = read(rel);
    if (!DATA_FILES[name] || !doc || typeof doc !== 'object') continue;
    for (const k of DATA_FILES[name].keys) if (doc[k] !== undefined) world[k] = doc[k];
  }
  for (const rel of listJson(dir, 'region')) {
    const pfx = dimPrefix(rel.split('/')[1]);
    if (pfx === null) continue;
    const chunks = read(rel).chunks || {};
    for (const ck of Object.keys(chunks)) {
      const c = chunks[ck] || {};
      const blocks = c.blocks || (typeof c.runs === 'string' ? decodeRuns(c.runs) : null);   // 6.51: a cold region keeps runs
      if (blocks && Object.keys(blocks).length) world.edits[pfx + ck] = blocks;
      for (const bk of Object.keys(c.blockEntities || {})) world.be[pfx + bk] = c.blockEntities[bk];
    }
  }
  for (const rel of listJson(dir, 'entities')) {
    const folder = rel.split('/')[1];
    if (dimPrefix(folder) === null) continue;
    const file = read(rel), items = file.items || {};
    for (const m of Array.isArray(file.mobs) ? file.mobs : []) {
      if (m && typeof m === 'object') world.mobs.push({ d: folder, t: m.type, x: m.x, y: m.y, z: m.z, yaw: m.yaw, hp: m.health, name: m.name, ...(Array.isArray(m.origin) ? { ox: m.origin[0], oz: m.origin[1] } : {}) });
    }
    for (const v of Array.isArray(file.vehicles) ? file.vehicles : []) {
      if (v && typeof v === 'object') world.vehicles.push({ d: folder, t: v.type, x: v.x, y: v.y, z: v.z, yaw: v.yaw, hp: v.health });
    }
    for (const id of Object.keys(items)) { const it = items[id]; if (it && typeof it === 'object') world.drops[id] = { dim: folder, x: it.x, y: it.y, z: it.z, st: it.item, age: +it.ageSeconds || 0 }; }
  }
  for (const rel of listJson(dir, 'playerdata')) {
    const { player, ...p } = read(rel);
    if (typeof player === 'string' && player) world.players[playerKey(player)] = p;
  }
  return { world, seen };
}

/* Write the world folder: only the files whose text changed since the last write (or the read), each through a .tmp and a
   rename so a crash never leaves half a file, and remove the ones whose content is gone. seen (path -> md5) is updated.
   Returns how many files were written or removed. */
export function writeWorld(dir, world, seen, cold) {
  const files = worldFiles(world, cold);
  let n = 0;
  for (const [rel, text] of files) {
    const h = md5(text);
    if (seen.get(rel) === h) continue;
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', text);
    fs.renameSync(file + '.tmp', file);
    seen.set(rel, h); n++;
  }
  for (const rel of [...seen.keys()]) {
    if (files.has(rel)) continue;
    try { fs.unlinkSync(path.join(dir, rel)); } catch { /* already gone */ }
    seen.delete(rel); n++;
  }
  return n;
}

/* 6.51: the region a chunk is in, as worldFiles names it ("over/0.-1"), from a chunk key with its dimension prefix */
export function regionKey(ck) {
  const [pfx, k] = splitKey(ck), c = k.split(',');
  return dimFolder(pfx) + '/' + regionOf(+c[0], +c[1]);
}

/* the world as the one file the game's Import World reads (and a server from before 6.12 used) */
export function exportWorld(world) {
  const players = {};   // 6.49: the one file is for single player: accounts (passwords, locks) stay with the server
  for (const k of Object.keys(world.players || {})) { const p = world.players[k]; if (p && typeof p === 'object') { const { password, locks, ...rest } = p; players[k] = rest; } else players[k] = p; }
  return JSON.stringify({ ...world, players });
}

/* The world the server starts with ({world, isNew, seen}): the folder if there is one, else a world file from before 6.12
   (or an exported single-player save) next to it, else a new world. place null (or o.memory) means "never touch the
   disk". Anything that cannot be read is an error, never replaced: the host decides what to do with a damaged world. */
export function openWorld(place, o, log) {
  if (!o.memory && place && fs.existsSync(path.join(place.dir, 'level.json'))) {
    const { world: raw, seen } = readWorldDir(place.dir);
    const world = adoptWorld(raw, o);
    log(`world: loaded ${place.dir} (seed ${world.seed}, ${Object.keys(world.edits).length} edited chunks, ${Object.keys(world.players).length} known players)`);
    return { world, isNew: false, seen };
  }
  if (!o.memory && place && fs.existsSync(place.legacy) && fs.statSync(place.legacy).isFile()) {
    let d;
    try { d = JSON.parse(fs.readFileSync(place.legacy, 'utf8')); } catch (e) { throw new Error(`the world file ${place.legacy} is damaged (${e.message}). Fix it, or move it away to start a new world.`); }
    const world = adoptWorld(d, o);
    log(`world: read ${place.legacy} (seed ${world.seed}, ${Object.keys(world.edits).length} edited chunks, ${Object.keys(world.players).length} known players)`);
    log(`world: from now on it lives in the folder ${place.dir}; the old file is left where it is and is no longer used`);
    return { world, isNew: true, seen: new Map() };
  }
  const world = newWorld(o);
  if (!o.memory) log(`world: none found, generating a new one (seed ${world.seed}, ${world.mode === 'c' ? 'creative' : 'survival'})`);
  return { world, isNew: !o.memory, seen: new Map() };
}

/* The settings file decides: its rules and (when given) its mode are applied on every start, over whatever the world file
   says. A rule the settings do not mention keeps the world's value, or the default for a world that never had one. */
export function applySettings(world, rules, mode) {
  world.gr = { ...RULES, ...world.gr, ...cleanRules(rules) };
  if (mode !== undefined) world.mode = mode === 'c' ? 'c' : 's';
}



/* a skin as a game sends it: base64 of a PNG that is 64x64 or 64x32 and small. '' clears it. null: not a skin. */
export function cleanSkin(png) {
  if (png === '' || png == null) return '';
  if (typeof png !== 'string' || png.length > LIMITS.skinB64 || /[^A-Za-z0-9+/=]/.test(png)) return null;
  const b = Buffer.from(png, 'base64');
  if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a || b.toString('latin1', 12, 16) !== 'IHDR') return null;
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  return w === 64 && (h === 64 || h === 32) ? png : null;
}
