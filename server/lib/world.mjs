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
// On disk it is a folder, laid out like a Minecraft world (6.12). What fills the world is packed for size (6.60, lib/region.mjs:
// "node dinglecraft-server.mjs view <file>" prints one as JSON, the server window shows and searches them); the rest is JSON
// a person can read and edit:
//   <world>/
//     level.json                        the world itself: name, seed, mode, time, spawn, rules, and whatever else a save carried
//     region/<dimension>/r.<rx>.<rz>.dcr     the changed blocks and the chests and furnaces of one region: 32 x 32 chunks
//                                            (512 x 512 blocks), named after its place in the world
//     entities/<dimension>/r.<rx>.<rz>.dce   everything that lies or walks in that region: the dropped items and the mobs
//     playerdata/<name>.json            one file per player who has ever joined: position, health, hunger, spawn point,
//                                       inventory, armour, XP, game mode
//     data/structures.json              which villages, dungeons, parks and roosts have been found (so each is populated
//                                       once), and where the spawners stand
//     data/bosses.json                  which dimension bosses are dead
//     data/nukes.json                   where a mega nuke went off
//     data/market.json                  what the stocks cost
// Only what changed since the last save is written (each file through a .tmp and a rename), and a file whose region
// emptied out is removed. A world from before 6.12 (one world.vxw.json) is read once and written out as a folder; the old
// file is left where it was. Region and entity files from before 6.60 (.json, and the .json.br of 6.53 to 6.59) and the
// .json.br players of 6.53 to 6.59 are read, and written out in the new form at once. exportWorld turns the folder back into that one file, which the game can import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { RULES, DIM_PFX, LIMITS, cleanRules } from './config.mjs';
import { encodeRegion, encodeEntities, decodeFile, listWorldFiles, fileName } from './region.mjs';

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
    if (typeof m.ci === 'string' && /^-?\d{1,7},-?\d{1,7}$/.test(m.ci)) o.ci = m.ci;   // 6.71: the fortress a Nether or Aether boss guards
    if (typeof m.d === 'string' && m.d !== 'over' && m.d in DIM_PFX) o.d = m.d;   // which dimension (the Overworld is not spelled out)
    out.push(o);
    if (out.length >= 4000) break;
  }
  return out;
}

/* ---- Creativity works (6.73) ---- */
export const WORK_ID0 = 10000, WORK_MAXN = 9999;
const WORK_SIZES = [[64, 64], [128, 64], [64, 128]], WORK_D = { art: 7000, song: 6000 };
/* a work as the game sends it, checked: null if it is not one */
export function cleanWork(r) {
  if (!r || typeof r !== 'object' || (r.k !== 'art' && r.k !== 'song')) return null;
  let dl = 0;
  try { dl = r.d == null ? 0 : typeof r.d === 'string' ? r.d.length : JSON.stringify(r.d).length; } catch { return null; }
  if (dl > WORK_D[r.k]) return null;
  const o = { k: r.k, st: r.st === 'done' ? 'done' : 'wip', t: cleanText(r.t, 24), by: cleanText(r.by, 24), d: r.d == null ? null : r.d, u: Math.max(0, num(r.u, 0, 1e9, 0) | 0) };
  if (r.k === 'art') { if (!WORK_SIZES.some((s) => s[0] === r.w && s[1] === r.h)) return null; o.w = r.w; o.h = r.h; }
  return o;
}
/* every stack ({id, count}) anywhere inside x, each passed to f */
function eachStack(x, f, depth = 0) {
  if (!x || typeof x !== 'object' || depth > 12) return;
  if (Array.isArray(x)) { for (const v of x) eachStack(v, f, depth + 1); return; }
  if (Number.isInteger(x.id) && Number.isInteger(x.count)) f(x);
  for (const k of Object.keys(x)) if (x[k] && typeof x[k] === 'object') eachStack(x[k], f, depth + 1);
}
/* One time, from the first start of 6.73: each player's own Creativity works (players[key].cr, numbered per player) become
   the world's (crw, numbered once for everyone). Their works in that player's own things get the new numbers; a work in a
   chest or on the ground gets its owner's new number when exactly one player had that old one, and otherwise keeps its old
   number, which no new work will ever take (it shows as a Lost Work rather than as somebody else's). Returns how many moved. */
export function migrateWorks(world) {
  if (world.crv === 1) return 0;
  const owners = new Map(), maps = {};
  let top = 0, moved = 0;
  const seen = (st) => { const n = st.id - WORK_ID0; if (n > 0 && n <= WORK_MAXN) top = Math.max(top, n); };
  eachStack(world.players, seen); eachStack(world.be, seen); eachStack(world.drops, seen);
  for (const key of Object.keys(world.players || {})) { const w = world.players[key] && world.players[key].cr && world.players[key].cr.w; if (w) for (const n of Object.keys(w)) top = Math.max(top, +n || 0); }
  let crn = Math.min(WORK_MAXN + 1, top + 1);
  const crw = world.crw && typeof world.crw === 'object' ? world.crw : {};
  for (const key of Object.keys(world.players || {})) {
    const p = world.players[key], w = p && p.cr && p.cr.w;
    if (w && typeof w === 'object') for (const old of Object.keys(w)) {
      const r = cleanWork(w[old]);
      if (!r || crn > WORK_MAXN) continue;
      const n = crn++;
      crw[n] = { ...r, o: key };
      (maps[key] ||= {})[old] = n;
      if (!owners.has(+old)) owners.set(+old, []);
      owners.get(+old).push(key);
      moved++;
    }
    if (p && typeof p === 'object') {
      const m = maps[key];
      if (m) eachStack(p, (st) => { const n = st.id - WORK_ID0; if (m[n]) st.id = WORK_ID0 + m[n]; });
      delete p.cr;
    }
  }
  const elsewhere = (st) => { const n = st.id - WORK_ID0, who = owners.get(n); if (who && who.length === 1) st.id = WORK_ID0 + maps[who[0]][n]; };
  eachStack(world.be, elsewhere); eachStack(world.drops, elsewhere);
  world.crw = crw; world.crn = crn; world.crfree = []; world.crv = 1;
  return moved;
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
  works: { about: 'The Creativity works (6.73): every painting and music disc of this world by its number (crw: kind, finished or not, title, author, its data; o: the player who owns it), the next number (crn), numbers handed out and given back (crfree), and the form (crv).', keys: ['crw', 'crn', 'crfree', 'crv'] },
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

/* The world as files: a Map of path (relative to the world folder, forward slashes) -> text. */
export function worldFiles(world) {
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

  /* region/<dim>/r.<rx>.<rz>.dcr: chunk by chunk, the changed blocks ("lx,y,lz": block id) and the block entities */
  const regions = new Map();           // 'over/0.-1' -> { 'cx,cz': { blocks, blockEntities } }
  const chunkIn = (folder, cx, cz) => {
    const rk = folder + '/' + (Number.isFinite(cx) && Number.isFinite(cz) ? regionOf(cx, cz) : '0.0');   // a key that is no place: kept in r.0.0
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
    const [folder, r] = rk.split('/'), [rx, rz] = r.split('.').map(Number), doc = { dimension: folder, region: [rx, rz], blocksFrom: [rx * REGION * CHUNK, rz * REGION * CHUNK], chunks: {} };
    for (const ck of Object.keys(chunks)) doc.chunks[ck] = { blocks: chunks[ck].blocks || {}, blockEntities: chunks[ck].blockEntities || {} };
    out.set(`region/${folder}/${fileName('region', rx, rz)}`, encodeRegion(doc));
  }

  /* entities/<dim>/r.<rx>.<rz>.dce: what lies in that region */
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
    out.set(`entities/${folder}/${fileName('entities', rx, rz)}`, encodeEntities({ dimension: folder, region: [rx, rz], ...e }));
  }

  /* playerdata/<name>.json */
  for (const key of Object.keys(players)) {
    const p = players[key];
    if (!p || typeof p !== 'object') continue;
    const { inv, armor, password, ...rest } = p;
    /* 6.49: an account's password is the file's second line. 6.61: its scrypt hash (lib/commands.mjs), which nobody can read back */
    const head = JSON.stringify({ player: key, ...(typeof password === 'string' ? { password } : {}), ...rest }, null, 2).replace(/\n}$/, '');
    const list = (name, arr) => (Array.isArray(arr) ? `,\n  ${line(name)}: [\n${arr.map((it) => '    ' + line(it)).join(',\n')}\n  ]` : '');
    const text = head + list('armor', armor) + list('inv', inv) + '\n}\n';
    out.set('playerdata/' + playerFile(key), text);
  }
  return out;
}

const md5 = (t) => crypto.createHash('md5').update(t).digest('hex');
/* every .json file under a folder of the world, as paths relative to the world folder (and the .json.br of 6.53 to 6.59) */
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

/* Read a world folder. Returns { world (not yet adopted), seen, stale }: seen is path -> md5 of every file read, which
   writeWorld uses to write only what changed and to remove a file whose content is gone; stale is how many files are in a
   form from before 6.60 (the server writes them out in the new form at once). A file that cannot be read is an error that
   names it. */
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
  /* the regions and entities (lib/region.mjs reads every form). A place with a file in an older form beside its new one
     (a conversion cut short) is read from the new one; the old one is in seen, so the next save removes it. */
  let stale = 0;
  const packed = (rel) => {
    const raw = fs.readFileSync(path.join(dir, rel));
    seen.set(rel, md5(raw));
    return decodeFile(raw, path.join(dir, rel)).doc;
  };
  for (const f of listWorldFiles(dir, true)) {
    if (f.form !== 'packed') stale++;
    if (f.shadowed) { seen.set(f.rel, ''); continue; }
    const pfx = dimPrefix(f.dim);
    if (pfx === null) continue;
    if (f.kind === 'region') {
      const chunks = packed(f.rel).chunks || {};
      for (const ck of Object.keys(chunks)) {
        const c = chunks[ck] || {};
        if (c.blocks && Object.keys(c.blocks).length) world.edits[pfx + ck] = c.blocks;
        for (const bk of Object.keys(c.blockEntities || {})) world.be[pfx + bk] = c.blockEntities[bk];
      }
      continue;
    }
    const folder = f.dim, file = packed(f.rel), items = file.items || {};
    for (const m of Array.isArray(file.mobs) ? file.mobs : []) {
      if (m && typeof m === 'object') world.mobs.push({ d: folder, t: m.type, x: m.x, y: m.y, z: m.z, yaw: m.yaw, hp: m.health, name: m.name, ...(Array.isArray(m.origin) ? { ox: m.origin[0], oz: m.origin[1] } : {}) });
    }
    for (const v of Array.isArray(file.vehicles) ? file.vehicles : []) {
      if (v && typeof v === 'object') world.vehicles.push({ d: folder, t: v.type, x: v.x, y: v.y, z: v.z, yaw: v.yaw, hp: v.health });
    }
    for (const id of Object.keys(items)) { const it = items[id]; if (it && typeof it === 'object') world.drops[id] = { dim: folder, x: it.x, y: it.y, z: it.z, st: it.item, age: +it.ageSeconds || 0 }; }
  }
  for (const rel of listJson(dir, 'playerdata')) {
    if (rel.endsWith('.br')) stale++;
    const { player, ...p } = read(rel);
    if (typeof player === 'string' && player) world.players[playerKey(player)] = p;
  }
  return { world, seen, stale };
}

/* Write the world folder: only the files whose text changed since the last write (or the read), each through a .tmp and a
   rename so a crash never leaves half a file, and remove the ones whose content is gone. seen (path -> md5) is updated.
   Returns how many files were written or removed. */
export function writeWorld(dir, world, seen) {
  const files = worldFiles(world);
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
    const { world: raw, seen, stale } = readWorldDir(place.dir);
    const world = adoptWorld(raw, o);
    log(`world: loaded ${place.dir} (seed ${world.seed}, ${Object.keys(world.edits).length} edited chunks, ${Object.keys(world.players).length} known players)`);
    return { world, isNew: false, seen, stale };
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
