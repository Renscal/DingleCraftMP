// store.cjs: what the server window does with files, kept apart from Electron so the test suites can run it.
// A data folder holds server.json and the world folders (each with a level.json), exactly as the terminal server's
// data/ does; backups/ beside them holds dated copies.
'use strict';
const fs = require('fs');
const path = require('path');

/* server.json as an object ({} when there is none; throws on a file that is not one JSON object) */
function readSettings(dataDir) {
  const f = path.join(dataDir, 'server.json');
  if (!fs.existsSync(f)) return {};
  const o = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('server.json must hold one JSON object');
  return o;
}
function writeSettings(dataDir, o) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'server.json'), JSON.stringify(o, null, 2) + '\n');
}
/* the world folders in a data folder: [{ name, seed, mode, difficulty, bytes, changed }] */
function listWorlds(dataDir) {
  let names = [];
  try { names = fs.readdirSync(dataDir); } catch { return []; }
  const out = [];
  for (const n of names.sort()) {
    const lvl = path.join(dataDir, n, 'level.json');
    if (n === 'backups' || !fs.existsSync(lvl)) continue;
    let L = {};
    try { L = JSON.parse(fs.readFileSync(lvl, 'utf8')); } catch { /* unreadable: listed with what is known */ }
    out.push({ name: n, seed: L.seed === undefined ? '' : String(L.seed), mode: L.mode === 'c' ? 'c' : 's', difficulty: (L.gr && L.gr.difficulty) || (L.rules && L.rules.difficulty) || 'normal',
      bytes: folderBytes(path.join(dataDir, n)), changed: fs.statSync(lvl).mtimeMs });
  }
  return out;
}
function folderBytes(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? folderBytes(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size;
  return n;
}
const WORLD_RE = /^[A-Za-z0-9_][A-Za-z0-9_. -]{0,39}$/;
function goodWorldName(n) { return typeof n === 'string' && WORLD_RE.test(n) && !n.includes('..') && n !== 'backups'; }
/* copy a world folder to backups/<name>-<YYYYMMDD-HHMMSS>; returns the new folder. when: a Date (tests pass one) */
function backupWorld(dataDir, name, when) {
  if (!goodWorldName(name)) throw new Error('not a world name');
  const from = path.join(dataDir, name);
  if (!fs.existsSync(path.join(from, 'level.json'))) throw new Error('no such world: ' + name);
  const d = when || new Date(), p = (v) => String(v).padStart(2, '0');
  const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  let to = path.join(dataDir, 'backups', name + '-' + stamp);
  for (let i = 2; fs.existsSync(to); i++) to = path.join(dataDir, 'backups', name + '-' + stamp + '-' + i);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return to;
}
/* point the settings at a new world: its name, seed, mode and difficulty. The server makes the folder when it starts.
   Refuses a name that is taken. Returns the new settings (not yet written). */
function newWorld(dataDir, settings, w) {
  if (!goodWorldName(w.name)) throw new Error('A world name is letters, digits, spaces, dots, dashes and underscores, at most 40.');
  if (fs.existsSync(path.join(dataDir, w.name))) throw new Error('There is already a world called ' + w.name + '.');
  const diff = ['easy', 'normal', 'hard', 'dinglecore'].includes(w.difficulty) ? w.difficulty : 'normal';
  return { ...settings, world: w.name, seed: String(w.seed == null ? '' : w.seed).slice(0, 64), mode: w.mode === 'c' ? 'c' : 's', rules: { ...(settings.rules || {}), difficulty: diff } };
}
/* seconds as "2 h 05 min" / "3 min 20 s" */
function fmtUptime(s) {
  s = Math.max(0, s | 0);
  const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0;
  return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m ? m + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s';
}
function fmtBytes(n) { return n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(0) + ' MB' : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : (n | 0) + ' B'; }

/* ---- backups ---- */
/* the dated copies under backups/: [{ name, world, bytes, made }], newest first */
function listBackups(dataDir) {
  const dir = path.join(dataDir, 'backups');
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const n of names) {
    const p = path.join(dir, n), m = /^(.*)-\d{8}-\d{6}(?:-\d+)?$/.exec(n);
    if (!m || !fs.existsSync(path.join(p, 'level.json'))) continue;
    out.push({ name: n, world: m[1], bytes: folderBytes(p), made: fs.statSync(p).mtimeMs });
  }
  return out.sort((x, y) => (y.name < x.name ? -1 : y.name > x.name ? 1 : 0));
}
const BACKUP_RE = /^[A-Za-z0-9_][A-Za-z0-9_. -]{0,39}-\d{8}-\d{6}(?:-\d+)?$/;
/* put a backup back as its world. The world as it is now is backed up first, so a restore can itself be undone. */
function restoreBackup(dataDir, name, when) {
  if (!BACKUP_RE.test(name) || name.includes('..')) throw new Error('not a backup name');
  const from = path.join(dataDir, 'backups', name);
  if (!fs.existsSync(path.join(from, 'level.json'))) throw new Error('no such backup: ' + name);
  const world = /^(.*)-\d{8}-\d{6}(?:-\d+)?$/.exec(name)[1], to = path.join(dataDir, world);
  let kept = null;
  if (fs.existsSync(path.join(to, 'level.json'))) kept = backupWorld(dataDir, world, when);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  return { world, kept };
}
function deleteBackup(dataDir, name) {
  if (!BACKUP_RE.test(name) || name.includes('..')) throw new Error('not a backup name');
  fs.rmSync(path.join(dataDir, 'backups', name), { recursive: true, force: true });
  return true;
}
/* keep the newest n backups of a world, delete the rest; returns how many went */
function pruneBackups(dataDir, world, keep) {
  const mine = listBackups(dataDir).filter((b) => b.world === world), gone = mine.slice(Math.max(1, keep | 0));
  for (const b of gone) deleteBackup(dataDir, b.name);
  return gone.length;
}

/* ---- the list of servers (servers.json in the program's own folder) ---- */
/* Each server is a name and a data folder: { id, name, dataDir, tasks: [...] }. The file is the window's, not the
   server's: a server's own settings stay in its data folder's server.json. */
function readServers(file) {
  try { const o = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(o.servers) ? o.servers.filter((x) => x && typeof x.id === 'string' && typeof x.dataDir === 'string') : []; } catch { return []; }
}
function writeServers(file, list) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ servers: list }, null, 2) + '\n');
}
/* the port a data folder's server.json asks for (the default when it says nothing) */
function portOf(dataDir) { try { const p = readSettings(dataDir).port; return Number.isInteger(p) ? p : 40162; } catch { return 40162; } }
/* Add a server. With dataDir it adopts an existing folder as it is; without, it makes servers/<id>/ under root with a
   server.json holding the name and the first port no other listed server uses. Returns the new list and the entry. */
function addServer(list, root, o) {
  const name = String((o && o.name) || '').trim().slice(0, 60) || 'A DINGLECRAFT Server';
  let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'server';
  for (let i = 2, base = id; list.some((x) => x.id === id); i++) id = base + '-' + i;
  let dataDir = o && o.dataDir ? path.resolve(o.dataDir) : path.join(root, 'servers', id);
  if (list.some((x) => path.resolve(x.dataDir) === dataDir)) throw new Error('That folder is already in the list.');
  if (!(o && o.dataDir)) {
    const used = new Set(list.map((x) => portOf(x.dataDir)));
    let port = 40162; while (used.has(port)) port++;
    writeSettings(dataDir, { name, port });
  }
  const entry = { id, name, dataDir, tasks: [] };
  return { list: [...list, entry], entry };
}
/* take a server off the list. Its folder is left exactly where it is. */
function removeServer(list, id) { return list.filter((x) => x.id !== id); }

/* ---- the scheduler ---- */
/* A task: { id, every (minutes, 1 to 10080), what: 'backup' | 'restart' | 'command', command?, keep? (backups to keep),
   on }. cleanTask returns a good task or throws saying what is wrong. */
function cleanTask(t) {
  if (!t || typeof t !== 'object') throw new Error('not a task');
  const every = Number(t.every);
  if (!Number.isInteger(every) || every < 1 || every > 10080) throw new Error('"Every" is a whole number of minutes from 1 to 10080 (a week).');
  if (!['backup', 'restart', 'command'].includes(t.what)) throw new Error('A task backs up, restarts or runs a command.');
  const out = { id: typeof t.id === 'string' && t.id ? t.id.slice(0, 24) : 't' + Date.now().toString(36), every, what: t.what, on: t.on !== false };
  if (t.what === 'command') {
    const c = String(t.command || '').trim().slice(0, 300);
    if (!c) throw new Error('Type the command to run.');
    if (/^\/?(stop|quit|exit)\b/i.test(c)) throw new Error('Use a restart task, or the Stop button: a scheduled stop would leave the server off.');
    out.command = c;
  }
  if (t.what === 'backup') { const k = Number(t.keep); out.keep = Number.isInteger(k) && k >= 1 && k <= 500 ? k : 10; }
  return out;
}
/* which tasks are due: last[id] is when each last ran (ms; a task never run counts from since). Returns the due ones. */
function dueTasks(tasks, last, now, since) {
  return (tasks || []).filter((t) => t.on !== false && now - (last[t.id] === undefined ? since : last[t.id]) >= t.every * 60000);
}

module.exports = { readSettings, writeSettings, listWorlds, backupWorld, newWorld, goodWorldName, fmtUptime, fmtBytes,
  listBackups, restoreBackup, deleteBackup, pruneBackups, readServers, writeServers, addServer, removeServer, portOf, cleanTask, dueTasks };
