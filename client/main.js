// The DINGLECRAFT desktop client: an Electron window around the game's one html file.
// Nobody needs it to play (the html opens in any browser, and a server hands it out at its own address). It exists so
// the desktop version has somewhere to grow: window behaviour, shortcuts, menus, whatever a browser tab cannot do.
// The game itself is not changed here: it is the same html, byte for byte.
//   npm install      once (downloads Electron)
//   npm start        opens the game
//   npm start -- --game <file>     opens another build
'use strict';
const { app, BrowserWindow, Menu, shell } = require('electron');
const fs = require('fs');
const path = require('path');

/* a.b version order, newest first */
function byVersion(a, b) {
  const va = a.match(/_v(\d+)\.(\d+)\.html$/), vb = b.match(/_v(\d+)\.(\d+)\.html$/);
  return (vb[1] - va[1]) || (vb[2] - va[2]);
}
/* the game file: --game <file>, else the newest dinglecraft_v<X.Y>.html next to this file, else the newest in the
   repo's dist/ (so a checkout works after npm run build) */
function findGame() {
  const i = process.argv.indexOf('--game');
  if (i > 0 && process.argv[i + 1]) return path.resolve(process.argv[i + 1]);
  for (const dir of [__dirname, path.join(__dirname, '..', 'dist')]) {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => /^dinglecraft_v\d+\.\d+\.html$/.test(n)); } catch { /* no such folder */ }
    if (names.length) return path.join(dir, names.sort(byVersion)[0]);
  }
  return null;
}

/* no browser shortcuts: Electron's default menu brings reload (Ctrl+R), close (Ctrl+W), quit (Ctrl+Q, the game's
   drop-the-stack), developer tools, zoom and more, and they work even with the menu bar hidden. The window has no menu
   at all; on macOS, where copying and pasting in a text box need one, the app menu has Copy and Paste and nothing else.
   On Windows and Linux a text box copies and pastes by itself. */
function noBrowserKeys() {
  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ label: 'DINGLECRAFT', submenu: [{ role: 'copy' }, { role: 'paste' }] }])
    : null);
}

/* the one window */
function open() {
  const game = findGame();
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 360, backgroundColor: '#000000', autoHideMenuBar: false,
    title: 'DINGLECRAFT', webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.removeMenu();
  /* F11 full screen. Every other key belongs to the game. */
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); ev.preventDefault(); }
  });
  /* a link out of the game opens in the real browser, never in this window */
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (ev, url) => { ev.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); });
  /* mouse buttons 4 and 5 are the game's (Change keys can take them), never back and forward: there is no history to go
     back to, and Windows' back / forward commands do nothing */
  win.webContents.on('did-finish-load', () => { try { win.webContents.navigationHistory.clear(); } catch { /* older Electron */ } });
  win.on('app-command', (ev) => ev.preventDefault());
  if (game && fs.existsSync(game)) win.loadFile(game);
  else win.loadURL('data:text/plain;charset=utf-8,' + encodeURIComponent('DINGLECRAFT\n\nNo game file found. Put dinglecraft_v<version>.html next to main.js, or start with --game <file>.'));
}

app.whenReady().then(() => { noBrowserKeys(); open(); });
app.on('window-all-closed', () => app.quit());
