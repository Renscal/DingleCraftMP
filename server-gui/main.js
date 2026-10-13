// DINGLECRAFT Server: the multiplayer server as a desktop program, a window instead of a terminal.
// It manages a list of servers, each one a name and a data folder (its server.json and its worlds), shown down the left
// of the window; the right side is the server that is picked: dashboard, console, players, settings, game rules,
// worlds, backups, scheduler.
// The server itself is not changed and does not run in this process. Each one is started as a child, with this
// program's own Node (ELECTRON_RUN_AS_NODE), in its --ipc mode (server/lib/admin.mjs): it reports status, log lines and
// players over the fork channel and takes commands the same way. So a server that crashes cannot take the window down,
// the window can start it again, and nobody needs Node installed.
//   npm install      once (downloads Electron)
//   npm start        opens the window          (npm start -- --data <folder> adds that folder as a server)
'use strict';
const { app, BrowserWindow, Tray, Menu, dialog, shell, clipboard, ipcMain, nativeImage } = require('electron');
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const store = require('./lib/store.cjs');

/* the server's files: inside this folder in a packaged copy, next door in a checkout of the repository */
const SERVER_DIR = [path.join(__dirname, 'server'), path.join(__dirname, '..', 'server')].find((d) => fs.existsSync(path.join(d, 'dinglecraft-server.mjs'))) || path.join(__dirname, 'server');
const ENTRY = path.join(SERVER_DIR, 'dinglecraft-server.mjs');

/* G.list: the servers as servers.json has them. G.run: id -> what is known about each while the program is open. */
const G = { win: null, tray: null, list: [], run: new Map(), quitting: false, admin: null, timer: null };
const root = () => app.getPath('userData');
const listFile = () => path.join(root(), 'servers.json');
const saveList = () => store.writeServers(listFile(), G.list);
const entry = (id) => { const e = G.list.find((x) => x.id === id); if (!e) throw new Error('No such server.'); return e; };
function rt(id) {
  if (!G.run.has(id)) G.run.set(id, { child: null, running: false, starting: false, status: null, log: [], restart: false, seq: 0, waiting: new Map(), since: 0, last: {} });
  return G.run.get(id);
}
const tell = (what, v) => { if (G.win && !G.win.isDestroyed()) G.win.webContents.send(what, v); };
function addLog(id, line) { const r = rt(id); r.log.push(line); if (r.log.length > 2000) r.log.splice(0, r.log.length - 2000); tell('log', { id, line }); }
const brief = (e) => { const r = rt(e.id); return { id: e.id, name: e.name, dataDir: e.dataDir, port: store.portOf(e.dataDir), running: r.running, starting: r.starting, players: r.status ? r.status.players.length : 0 }; };
const overview = () => ({ servers: G.list.map(brief), hasServer: fs.existsSync(ENTRY) });
const detail = (id) => { const e = entry(id), r = rt(id); return { ...brief(e), status: r.status, log: r.log.slice(-500), tasks: e.tasks || [] }; };
const changed = (id) => { tell('servers', overview()); if (id) tell('state', detail(id)); refreshTray(); };
/* the server's own settings check (an ES module: loaded once) */
async function admin() { if (!G.admin) G.admin = await import(pathToFileURL(path.join(SERVER_DIR, 'lib', 'admin.mjs')).href); return G.admin; }
/* the settings on disk laid over the defaults, rule by rule (an older server.json lists fewer rules) */
function formMerge(def, cur) { return { ...def, ...cur, rules: { ...def.rules, ...(cur.rules || {}) } }; }

/* ---- one server, as a child ---- */
function startServer(id) {
  const e = entry(id), r = rt(id);
  if (r.child) return { ok: false, why: 'That server is already running.' };
  if (!fs.existsSync(ENTRY)) return { ok: false, why: 'The server files are missing (' + ENTRY + ').' };
  const port = store.portOf(e.dataDir), clash = G.list.find((x) => x.id !== id && rt(x.id).child && store.portOf(x.dataDir) === port);
  if (clash) return { ok: false, why: '"' + clash.name + '" is already running on port ' + port + '. Give this server another port in Settings.' };
  fs.mkdirSync(e.dataDir, { recursive: true });
  r.starting = true; r.status = null;
  addLog(id, '--- starting the server ---');
  const child = fork(ENTRY, ['--ipc', '--data', e.dataDir], { execPath: process.execPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true });
  r.child = child;
  child.stderr.on('data', (b) => { for (const l of String(b).split(/\r?\n/)) if (l.trim()) addLog(id, l); });   /* errors before the server could speak for itself */
  child.stdout.on('data', () => { /* the banner: the dashboard shows the same things itself */ });
  child.on('message', (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'ready') { r.running = true; r.starting = false; r.status = m.status; r.since = Date.now(); r.last = {}; changed(id); }
    else if (m.t === 'status') { const n = r.status ? r.status.players.length : -1; r.status = m.status; tell('status', { id, status: m.status }); if (n !== m.status.players.length) { tell('servers', overview()); refreshTray(); } }
    else if (m.t === 'log') addLog(id, m.line);
    else if (m.t === 'event') addLog(id, '* ' + m.name + (m.what === 'join' ? ' joined' : ' left'));
    else if (m.t === 'reply') { const w = r.waiting.get(m.id); if (w) { r.waiting.delete(m.id); w(m.text); } }
  });
  child.on('exit', (code) => {
    const again = r.restart; r.restart = false;
    r.child = null; r.running = false; r.starting = false; r.status = null;
    for (const w of r.waiting.values()) w('(the server stopped)'); r.waiting.clear();
    addLog(id, '--- the server stopped' + (code ? ' (exit code ' + code + ')' : '') + ' ---');
    changed(id);
    if (G.quitting) { if (![...G.run.values()].some((x) => x.child)) app.quit(); } else if (again && G.list.some((x) => x.id === id)) startServer(id);
  });
  changed(id);
  return { ok: true };
}
/* ask it to save and stop; resolves when it has gone (or was not running). kill: do not ask, end it (nothing is saved) */
function stopServer(id, kill) {
  return new Promise((resolve) => {
    const r = rt(id), c = r.child;
    if (!c) return resolve(true);
    c.once('exit', () => resolve(true));
    if (kill) { addLog(id, '--- killed: the world was not saved first ---'); c.kill('SIGKILL'); return; }
    try { c.send({ t: 'stop' }); } catch { c.kill(); }
    setTimeout(() => { if (r.child === c) c.kill(); }, 15000);   /* a server that will not answer is ended */
  });
}
const stopAll = () => Promise.all(G.list.map((e) => stopServer(e.id)));
function sendCommand(id, line) {
  return new Promise((resolve) => {
    const r = rt(id);
    if (!r.child || !r.running) return resolve('The server is not running.');
    const n = ++r.seq;
    r.waiting.set(n, resolve);
    try { r.child.send({ t: 'cmd', id: n, line: String(line) }); } catch { r.waiting.delete(n); resolve('The server is not running.'); }
    setTimeout(() => { if (r.waiting.delete(n)) resolve('(no answer)'); }, 5000);
  });
}
/* back up the world a server is using. A running server is told to save first, so the copy is of the world as it is. */
async function backupNow(id, keep) {
  const e = entry(id), r = rt(id), world = store.readSettings(e.dataDir).world || 'world';
  if (r.child && r.running) await sendCommand(id, 'save');
  const to = store.backupWorld(e.dataDir, world);
  const gone = keep ? store.pruneBackups(e.dataDir, world, keep) : 0;
  addLog(id, 'backed up "' + world + '" to ' + path.basename(to) + (gone ? ' (' + gone + ' older backup' + (gone === 1 ? '' : 's') + ' removed)' : ''));
  return { ok: true, to, removed: gone };
}
/* once every 20 seconds: the scheduled tasks of every running server that have come due */
async function runSchedules() {
  const now = Date.now();
  for (const e of G.list) {
    const r = rt(e.id);
    if (!r.running) continue;
    for (const t of store.dueTasks(e.tasks, r.last, now, r.since)) {
      r.last[t.id] = now;
      try {
        if (t.what === 'backup') await backupNow(e.id, t.keep);
        else if (t.what === 'command') { addLog(e.id, '> ' + t.command + '   (scheduled)'); const out = await sendCommand(e.id, t.command); if (out) addLog(e.id, out); }
        else if (t.what === 'restart') { addLog(e.id, '--- scheduled restart ---'); r.restart = true; await stopServer(e.id); }
      } catch (err) { addLog(e.id, 'a scheduled task failed: ' + err.message); }
    }
  }
}

/* ---- the window and the tray ---- */
function iconFile() { return [path.join(__dirname, 'icon.png'), path.join(__dirname, '..', 'assets', 'logo.png')].find((f) => fs.existsSync(f)) || null; }
const anyRunning = () => [...G.run.values()].some((r) => r.child);
function openWindow() {
  const icon = iconFile();
  G.win = new BrowserWindow({ width: 1180, height: 760, minWidth: 900, minHeight: 560, backgroundColor: '#15171c', autoHideMenuBar: true, title: 'DINGLECRAFT Server',
    ...(icon ? { icon } : {}), webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  G.win.setMenuBarVisibility(false);
  G.win.loadFile(path.join(__dirname, 'index.html'));
  G.win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  /* closing with a server running: ask. "Keep running" leaves the program in the tray. */
  G.win.on('close', (ev) => {
    if (G.quitting || !anyRunning()) return;
    ev.preventDefault();
    const pick = dialog.showMessageBoxSync(G.win, { type: 'question', title: 'DINGLECRAFT Server', message: 'A server is running.',
      detail: 'Stop every running server (each world is saved first) and close, or keep them running in the tray?', buttons: ['Stop and close', 'Keep running in the tray', 'Cancel'], defaultId: 1, cancelId: 2 });
    if (pick === 0) { G.quitting = true; stopAll().then(() => app.quit()); }
    else if (pick === 1) G.win.hide();
  });
}
function showWindow() { if (!G.win || G.win.isDestroyed()) openWindow(); else { G.win.show(); G.win.focus(); } }
function refreshTray() {
  if (!G.tray) return;
  const up = G.list.filter((e) => rt(e.id).running);
  G.tray.setToolTip('DINGLECRAFT Server: ' + (up.length ? up.length + ' running' : 'nothing running'));
  G.tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open the window', click: showWindow },
    { type: 'separator' },
    ...G.list.slice(0, 12).map((e) => { const r = rt(e.id); return { label: (r.child ? 'Stop ' : 'Start ') + e.name, click: () => { if (r.child) stopServer(e.id); else startServer(e.id); } }; }),
    { type: 'separator' },
    { label: 'Quit', click: () => { G.quitting = true; stopAll().then(() => app.quit()); } },
  ]));
}
function makeTray() {
  const f = iconFile();
  if (!f) return;
  try { G.tray = new Tray(nativeImage.createFromPath(f).resize({ width: 16, height: 16 })); G.tray.on('click', showWindow); refreshTray(); } catch { G.tray = null; }
}

/* ---- what the page may ask for (every answer is a plain object; a thrown error becomes { ok: false, why }) ---- */
function wire() {
  const h = (name, fn) => ipcMain.handle(name, async (_e, ...a) => { try { return await fn(...a); } catch (e) { return { ok: false, why: e.message }; } });
  h('servers', () => overview());
  h('server:add', (o) => { const r = store.addServer(G.list, root(), o || {}); G.list = r.list; saveList(); changed(); return { ok: true, id: r.entry.id }; });
  h('server:adopt', async () => {
    const r = await dialog.showOpenDialog(G.win, { title: 'Choose a server\'s data folder (the one with server.json and the world in it)', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, why: '' };
    let name = path.basename(r.filePaths[0]);
    try { name = store.readSettings(r.filePaths[0]).name || name; } catch { /* no settings yet: the folder's name */ }
    const a = store.addServer(G.list, root(), { name, dataDir: r.filePaths[0] }); G.list = a.list; saveList(); changed();
    return { ok: true, id: a.entry.id };
  });
  h('server:remove', (id) => { if (rt(id).child) return { ok: false, why: 'Stop the server first.' }; G.list = store.removeServer(G.list, id); G.run.delete(id); saveList(); changed(); return { ok: true }; });
  h('state', (id) => detail(id));
  h('start', (id) => startServer(id));
  h('stop', async (id) => { await stopServer(id); return { ok: true }; });
  h('kill', async (id) => { await stopServer(id, true); return { ok: true }; });
  h('restart', async (id) => { const r = rt(id); if (r.child) { r.restart = true; await stopServer(id); return { ok: true }; } return startServer(id); });
  h('command', (id, line) => sendCommand(id, line));
  h('settings:read', async (id) => ({ ok: true, settings: formMerge((await admin()).formDefaults(), store.readSettings(entry(id).dataDir)) }));
  h('settings:save', async (id, o) => {
    const e = entry(id), v = (await admin()).validateSettings(o, store.readSettings(e.dataDir));
    if (!v.ok) return { ok: false, errors: v.errors, restart: [] };
    const clash = G.list.find((x) => x.id !== id && store.portOf(x.dataDir) === o.port);
    store.writeSettings(e.dataDir, o);
    if (typeof o.name === 'string' && o.name.trim() && o.name !== e.name) { e.name = o.name.trim().slice(0, 60); saveList(); }
    changed(id);
    return { ok: true, errors: [], restart: rt(id).running ? v.restart : [], note: clash ? '"' + clash.name + '" uses port ' + o.port + ' too: only one of the two can run at a time.' : '' };
  });
  h('worlds', (id) => { const d = entry(id).dataDir; return { ok: true, worlds: store.listWorlds(d), current: store.readSettings(d).world || 'world' }; });
  h('world:new', (id, w) => { const d = entry(id).dataDir, s = store.newWorld(d, store.readSettings(d), w); store.writeSettings(d, s); return { ok: true, restart: rt(id).running }; });
  h('world:use', (id, name) => { const d = entry(id).dataDir; if (!store.goodWorldName(name)) return { ok: false, why: 'not a world name' }; store.writeSettings(d, { ...store.readSettings(d), world: name }); return { ok: true, restart: rt(id).running }; });
  h('backups', (id) => ({ ok: true, backups: store.listBackups(entry(id).dataDir) }));
  h('backup:now', (id) => backupNow(id, 0));
  h('backup:restore', (id, name) => { if (rt(id).child) return { ok: false, why: 'Stop the server before restoring a backup.' }; const r = store.restoreBackup(entry(id).dataDir, name); addLog(id, 'restored ' + name + ' as "' + r.world + '"'); return { ok: true, ...r }; });
  h('backup:delete', (id, name) => { store.deleteBackup(entry(id).dataDir, name); return { ok: true }; });
  h('task:save', (id, t) => { const e = entry(id), c = store.cleanTask(t); e.tasks = [...(e.tasks || []).filter((x) => x.id !== c.id), c]; saveList(); return { ok: true, tasks: e.tasks }; });
  h('task:delete', (id, tid) => { const e = entry(id); e.tasks = (e.tasks || []).filter((x) => x.id !== tid); saveList(); return { ok: true, tasks: e.tasks }; });
  h('open:data', (id) => { const d = entry(id).dataDir; fs.mkdirSync(d, { recursive: true }); shell.openPath(d); return { ok: true }; });
  h('open:browser', (id) => { const s = rt(id).status; if (!s) return { ok: false, why: 'The server is not running.' }; shell.openExternal((s.secure ? 'https' : 'http') + '://localhost:' + s.port + '/'); return { ok: true }; });
  h('copy', (text) => { clipboard.writeText(String(text)); return { ok: true }; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    G.list = store.readServers(listFile());
    const i = process.argv.indexOf('--data');
    if (i > 0 && process.argv[i + 1] && !G.list.some((e) => path.resolve(e.dataDir) === path.resolve(process.argv[i + 1]))) { G.list = store.addServer(G.list, root(), { name: path.basename(process.argv[i + 1]), dataDir: process.argv[i + 1] }).list; saveList(); }
    if (!G.list.length) { G.list = store.addServer(G.list, root(), { name: 'My DINGLECRAFT Server' }).list; saveList(); }   /* a first run starts with one server ready to press Start on */
    wire(); openWindow(); makeTray();
    G.timer = setInterval(() => { runSchedules().catch(() => {}); }, 20000);
  });
  app.on('window-all-closed', () => { if (!anyRunning()) app.quit(); });
  app.on('before-quit', (ev) => { if (anyRunning() && !G.quitting) { ev.preventDefault(); G.quitting = true; stopAll().then(() => app.quit()); } });
}
