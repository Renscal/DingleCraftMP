// electron.mjs: the muted browser for QA on a machine without Chrome, using the Electron the desktop client already
// installed (client/node_modules, `npm install` in client/). Everything it starts is OFF-SCREEN (no window, no tray icon,
// never focused), MUTED, on its own debugging port and with a profile of its own under out/qa/, so nothing appears on
// the desktop, nothing is heard and nobody's own worlds or servers are touched. It refuses to start if any of that could
// not be arranged, and it stops only the process it started (by its PID, never by name).
//
//   import { launchGame, launchServerWindow } from './lib/electron.mjs';
//   const E = await launchGame({ port: 9461 });                 // an empty off-screen page; C = await connect(E.port), then C.open(url)
//   const W = await launchServerWindow({ port: 9462, setup });   // the server window (server-gui/), copied and made off-screen
//   ...; await E.stop();
// setup(userData): optional, runs before the window starts (put servers.json, imported versions, ... in its own profile).
// The page is 1280 x 720 unless { width, height } say otherwise. ELECTRON=<binary> uses another Electron.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { REPO } from './paths.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function binary() {
  const b = process.env.ELECTRON || path.join(REPO, 'client', 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  if (!fs.existsSync(b)) throw new Error('electron.mjs: no Electron at ' + path.relative(REPO, b) + ' (run npm install in client/, or set ELECTRON)');
  return b;
}
/* a fresh folder of this rig's own under out/qa/ */
function home(name) {
  const d = path.join(REPO, 'out', 'qa', name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  return d;
}
/* the lines every app this rig starts begins with: its own profile, muted, the debugging port, off-screen rendering */
const prelude = (userData, port) => [
  `const { app: __qaApp } = require('electron');`,
  `__qaApp.setPath('userData', ${JSON.stringify(userData)});`,
  `__qaApp.commandLine.appendSwitch('mute-audio');`,
  `__qaApp.commandLine.appendSwitch('remote-debugging-port', '${port | 0}');`,
  `__qaApp.commandLine.appendSwitch('disable-renderer-backgrounding');`,
  `__qaApp.commandLine.appendSwitch('disable-background-timer-throttling');`,
].join('\n') + '\n';
/* start it, wait for the debugging port; stop() ends exactly that process */
async function start(appDir, port) {
  const child = spawn(binary(), [appDir], { stdio: 'ignore' });
  let gone = false;
  child.on('exit', () => { gone = true; });
  const stop = async () => { if (!gone) { try { child.kill('SIGTERM'); } catch { /* already gone */ } for (let i = 0; i < 40 && !gone; i++) await sleep(100); if (!gone) child.kill('SIGKILL'); } };
  process.on('exit', () => { if (!gone) try { child.kill('SIGKILL'); } catch { /* gone */ } });
  for (let i = 0; i < 100; i++) {
    if (gone) throw new Error('electron.mjs: Electron exited before it was ready');
    try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); if (r.ok) { await sleep(500); return { pid: child.pid, port, stop }; } } catch { /* not yet */ }
    await sleep(150);
  }
  await stop();
  throw new Error('electron.mjs: no debugging port ' + port + ' after 15 s');
}

/** An off-screen, muted page to load the game in (connect(port), then C.open(url) from cdp.mjs). */
export async function launchGame({ port = 9461, width = 1280, height = 720 } = {}) {
  const dir = home('electron_game_' + port), ud = path.join(dir, 'profile');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'dc-qa-game', main: 'main.js' }));
  fs.writeFileSync(path.join(dir, 'main.js'), prelude(ud, port) + `
__qaApp.whenReady().then(() => {
  const { BrowserWindow } = require('electron');
  const w = new BrowserWindow({ show: false, width: ${width | 0}, height: ${height | 0}, webPreferences: { offscreen: true, backgroundThrottling: false } });
  w.webContents.setAudioMuted(true); w.webContents.setFrameRate(30); w.loadURL('about:blank');
});
__qaApp.on('window-all-closed', () => __qaApp.quit());
`);
  return start(dir, port);
}

/** The server window (server-gui/), copied under out/qa/ and changed to be off-screen with its own profile and no tray.
 *  Each change must apply exactly once, or nothing is started. */
export async function launchServerWindow({ port = 9462, setup } = {}) {
  const dir = home('electron_gui_' + port), appDir = path.join(dir, 'app'), ud = path.join(dir, 'profile');
  fs.cpSync(path.join(REPO, 'server-gui'), appDir, { recursive: true, filter: (f) => !/node_modules|[\\/]out$/.test(f) });
  let m = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');
  const must = (a, b) => { if (m.split(a).length !== 2) throw new Error('electron.mjs: cannot make the server window off-screen (its main.js changed: ' + a.slice(0, 40) + '): refusing to start it'); m = m.replace(a, b); };
  must(`'use strict';`, `'use strict';\n` + prelude(ud, port));
  must(`webPreferences: { preload:`, `show: false, webPreferences: { offscreen: true, preload:`);
  must(`wire(); openWindow(); makeTray();`, `wire(); openWindow();`);
  if (!m.includes('offscreen: true') || m.includes('makeTray();\n') || !m.includes('__qaApp.setPath(\'userData\'')) throw new Error('electron.mjs: the server window copy is not off-screen: refusing to start it');
  fs.writeFileSync(path.join(appDir, 'main.js'), m);
  fs.mkdirSync(ud, { recursive: true });
  if (setup) await setup(ud);
  return { ...(await start(appDir, port)), userData: ud };
}
