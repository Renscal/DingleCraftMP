// world.mjs: the world as data. Making one, adopting a save file, applying the settings file, writing it to disk, and the
// small validators for things that get stored in it. No sockets.
//
// The world is a normal DINGLECRAFT save (what the game's Export World writes) plus two tables of the server's own:
//   { f, v, name, seed, mode, time, gr (game rules), edits {chunkKey: {localKey: blockId}}, be {blockKey: blockEntity},
//     players {lowercase name: saved player (+ gm, that player's own game mode)}, drops {id: {dim, x, y, z, st, age}},
//     spawn {x, y, z} (where new players start), ...whatever else the save carried }
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { RULES, cleanRules } from './config.mjs';

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
  for (const k of ['ench', 'mob']) {
    const v = st[k];
    if (v == null) continue;
    if ((typeof v === 'string' || (typeof v === 'object' && !Array.isArray(v))) && JSON.stringify(v).length <= 600) out[k] = v; else return null;
  }
  return out;
}

/* an empty world from the settings (seed, mode, name) */
export function newWorld(o) {
  return { f: 1, v: null, name: o.name, seed: hashSeed(o.seed), mode: o.mode === 'c' ? 'c' : 's', time: 0.3, gr: {}, edits: {}, be: {}, players: {}, drops: {}, spawn: null };
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
  /* a dropped item's age is counted in seconds played, not by the wall clock (a file from before that starts again at 0) */
  for (const id of Object.keys(w.drops)) { const dr = w.drops[id]; if (dr && typeof dr === 'object') { if (!Number.isFinite(dr.age)) dr.age = 0; delete dr.born; } }
  const sp = d.spawn;
  w.spawn = sp && typeof sp === 'object' && [sp.x, sp.y, sp.z].every(Number.isFinite) ? { x: sp.x, y: sp.y, z: sp.z } : null;
  w.name = o.name || d.name || 'world';
  delete w.player; delete w.dim; delete w.ents; delete w.bots;
  for (const k of ['bots', 'botPvP', 'botGrief', 'botPurg']) delete w.gr[k];
  return w;
}

/* The world the server starts with: the file if there is one, else a new world ({world, isNew}).
   worldFile null (or o.memory) means "never touch the disk". A file that cannot be read is an error, never replaced:
   the host decides what to do with a damaged world. */
export function openWorld(worldFile, o, log) {
  if (o.memory || !worldFile || !fs.existsSync(worldFile)) {
    const world = newWorld(o);
    if (!o.memory) log(`world: none found, generating a new one (seed ${world.seed}, ${world.mode === 'c' ? 'creative' : 'survival'})`);
    return { world, isNew: !o.memory };
  }
  let d;
  try { d = JSON.parse(fs.readFileSync(worldFile, 'utf8')); } catch (e) { throw new Error(`the world file ${worldFile} is damaged (${e.message}). Fix it, or move it away to start a new world.`); }
  const world = adoptWorld(d, o);
  log(`world: loaded ${worldFile} (seed ${world.seed}, ${Object.keys(world.edits).length} edited chunks, ${Object.keys(world.players).length} known players)`);
  return { world, isNew: false };
}

/* The settings file decides: its rules and (when given) its mode are applied on every start, over whatever the world file
   says. A rule the settings do not mention keeps the world's value, or the default for a world that never had one. */
export function applySettings(world, rules, mode) {
  world.gr = { ...RULES, ...world.gr, ...cleanRules(rules) };
  if (mode !== undefined) world.mode = mode === 'c' ? 'c' : 's';
}

/* write the world next to itself and rename it into place: a crash never leaves a half-written world behind */
export function writeWorld(worldFile, world) {
  fs.mkdirSync(path.dirname(worldFile), { recursive: true });
  const tmp = worldFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(world));
  fs.renameSync(tmp, worldFile);
}
