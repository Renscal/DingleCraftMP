// store.cjs: what the server window does with files, kept apart from Electron so the test suites can run it.
// A data folder holds server.json and the world folders (each with a level.json), exactly as the terminal server's
// data/ does; backups/ beside them holds dated copies.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readZip } = require('./zip.cjs');

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

/* ---- server versions (the window is one program for every version of the server) ---- */
/* A version is a server release as it is downloaded: DINGLECRAFT-Server-v<X.Y>.zip, or that zip unpacked. Imported, it
   lives in versions/<X.Y>/ under the program's folder: dinglecraft-server.mjs, lib/ (with admin.mjs, the --ipc mode the
   window drives, 6.41 and newer) and the game html dinglecraft_v<X.Y>.html that names the version. Each server in the
   list says which version it runs; several versions can run side by side. */
const VER_RE = /^\d{1,3}\.\d{1,3}$/;
/* "6.9" < "6.10" */
function cmpVersion(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  return (x[0] - y[0]) || (x[1] - y[1]);
}
/* the version a server folder holds, or throws saying why it is not one the window can run */
function versionOfDir(dir) {
  if (!fs.existsSync(path.join(dir, 'dinglecraft-server.mjs'))) throw new Error('That is not a DINGLECRAFT server: there is no dinglecraft-server.mjs in it.');
  if (!fs.existsSync(path.join(dir, 'lib', 'admin.mjs'))) throw new Error('That server is too old for this window: it needs game version 6.41 or newer.');
  const htmls = fs.readdirSync(dir).map((n) => /^dinglecraft_v(\d{1,3}\.\d{1,3})\.html$/.exec(n)).filter(Boolean).map((m) => m[1]).sort(cmpVersion);
  if (!htmls.length) throw new Error('That server has no game file (dinglecraft_v<version>.html) beside it, so its version is not known.');
  return htmls[htmls.length - 1];
}
const versionsDir = (root) => path.join(root, 'versions');
/* every imported version, newest first: [{ version, dir }] */
function listVersions(root) {
  let names = [];
  try { names = fs.readdirSync(versionsDir(root)); } catch { return []; }
  const out = [];
  for (const n of names) {
    if (!VER_RE.test(n)) continue;
    const dir = path.join(versionsDir(root), n);
    try { if (versionOfDir(dir) === n) out.push({ version: n, dir }); } catch { /* half-imported or damaged: not offered */ }
  }
  return out.sort((a, b) => cmpVersion(b.version, a.version));
}
const SKIP = (n) => n === 'data' || n === 'node_modules' || n.startsWith('.');
/* Import a version from a zip (a release as downloaded) or a folder (one unpacked). It is unpacked into a scratch folder
   first and only takes its place once it checks out, replacing the same version if it was there. inUse(version): true
   while a server of that version is running (it is not replaced under a running server). Returns { version, dir }. */
function importVersion(root, src, inUse) {
  const st = fs.statSync(src), tmp = path.join(versionsDir(root), '.import-' + process.pid + '-' + Date.now().toString(36));
  fs.mkdirSync(tmp, { recursive: true });
  try {
    if (st.isDirectory()) {
      const top = fs.existsSync(path.join(src, 'dinglecraft-server.mjs')) ? src : null;
      if (!top) throw new Error('That folder has no dinglecraft-server.mjs: pick the unpacked DINGLECRAFT-Server folder.');
      fs.cpSync(top, tmp, { recursive: true, filter: (f) => !SKIP(path.basename(f)) || f === top });
    } else {
      const entries = readZip(fs.readFileSync(src));
      const front = entries.find((e) => /(^|\/)dinglecraft-server\.mjs$/.test(e.name));
      if (!front) throw new Error('That zip holds no DINGLECRAFT server (no dinglecraft-server.mjs). Pick DINGLECRAFT-Server-v<version>.zip.');
      const pre = front.name.slice(0, front.name.length - 'dinglecraft-server.mjs'.length);
      for (const e of entries) {
        if (!e.name.startsWith(pre) || e.name.endsWith('/')) continue;
        const rel = e.name.slice(pre.length);
        if (!rel || rel.split('/').some((p) => p === '..' || p === '' || SKIP(p)) || path.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) continue;   /* nothing outside the folder */
        const to = path.join(tmp, ...rel.split('/'));
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, e.data, { mode: e.mode & 0o111 ? 0o755 : 0o644 });
      }
    }
    const version = versionOfDir(tmp), dir = path.join(versionsDir(root), version);
    if (inUse && inUse(version)) throw new Error('Version ' + version + ' is running on a server: stop it before importing that version again.');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
    return { version, dir };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
/* delete an imported version; refused while a server in the list is set to it */
function removeVersion(root, version, list) {
  if (!VER_RE.test(version)) throw new Error('not a version');
  const users = (list || []).filter((e) => e.version === version).map((e) => e.name);
  if (users.length) throw new Error('Version ' + version + ' is set on ' + users.join(', ') + ': give ' + (users.length === 1 ? 'it' : 'them') + ' another version first.');
  fs.rmSync(path.join(versionsDir(root), version), { recursive: true, force: true });
  return true;
}
/* give every server that has no version (a list from before 1.0 of the window, or a fresh import) the newest one */
function fillVersions(list, versions) {
  const v = versions[0] && versions[0].version;
  if (!v) return { list, changed: false };
  let changed = false;
  const out = list.map((e) => { if (e.version) return e; changed = true; return { ...e, version: v }; });   /* one set to a version since removed keeps it: the window asks for another */
  return { list: out, changed };
}

/* ---- versions on GitHub (1.1): the game's releases, each with its DINGLECRAFT-Server-v<X.Y>.zip ---- */
/* where the window looks: this repository's releases, or DC_RELEASES_REPO (owner/name) for a fork */
const RELEASES_REPO = /^[\w.-]+\/[\w.-]+$/.test(process.env.DC_RELEASES_REPO || '') ? process.env.DC_RELEASES_REPO : 'Renscal/DingleCraftMP';
const releasesUrl = (repo) => 'https://api.github.com/repos/' + (repo || RELEASES_REPO) + '/releases?per_page=100';
const OLDEST = '6.41';   /* the first version with the --ipc mode the window drives */
/* GitHub's list of releases (the JSON of releasesUrl) -> the server versions it offers, newest first:
   [{ version, url, size, digest, prerelease, date }]. Only github.com download links are taken. */
function releaseVersions(json) {
  const out = new Map();
  for (const r of Array.isArray(json) ? json : []) {
    if (!r || r.draft || !Array.isArray(r.assets)) continue;
    for (const a of r.assets) {
      const m = a && typeof a.name === 'string' && /^DINGLECRAFT-Server-v(\d{1,3}\.\d{1,3})\.zip$/.exec(a.name);
      if (!m || cmpVersion(m[1], OLDEST) < 0 || out.has(m[1])) continue;
      if (typeof a.browser_download_url !== 'string' || !/^https:\/\/github\.com\//.test(a.browser_download_url)) continue;
      out.set(m[1], { version: m[1], url: a.browser_download_url, size: Number(a.size) || 0, digest: typeof a.digest === 'string' ? a.digest : '',
        prerelease: !!r.prerelease, date: typeof r.published_at === 'string' ? r.published_at.slice(0, 10) : '' });
    }
  }
  return [...out.values()].sort((a, b) => cmpVersion(b.version, a.version));
}
/* does a download match the fingerprint GitHub published for it ("sha256:<hex>")? No fingerprint: nothing to check. */
function digestOK(buf, digest) {
  if (!digest) return true;
  const m = /^sha256:([0-9a-f]{64})$/i.exec(digest);
  return !!m && crypto.createHash('sha256').update(buf).digest('hex') === m[1].toLowerCase();
}

/* ---- the list of servers (servers.json in the program's own folder) ---- */
/* Each server is a name, a data folder and the version it runs: { id, name, dataDir, version, ran, tasks: [...] } (ran:
   the newest version that has run it, to warn before an older one opens a world a newer one wrote). The file is the window's, not the
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
  const entry = { id, name, dataDir, version: (o && typeof o.version === 'string' && VER_RE.test(o.version)) ? o.version : '', tasks: [] };
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

module.exports = { RELEASES_REPO, releasesUrl, releaseVersions, digestOK, cmpVersion, versionOfDir, listVersions, importVersion, removeVersion, fillVersions, readSettings, writeSettings, listWorlds, backupWorld, newWorld, goodWorldName, fmtUptime, fmtBytes,
  listBackups, restoreBackup, deleteBackup, pruneBackups, readServers, writeServers, addServer, removeServer, portOf, cleanTask, dueTasks };
