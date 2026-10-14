#!/usr/bin/env node
// Package the server window for its own GitHub release: npm run package:gui
// The window (server-gui/) is one program for every server version since its 1.0: it carries no server and no game, and
// players import a game release's DINGLECRAFT-Server-v<X.Y>.zip into it. So it has its own version (server-gui's
// package.json) and its own release, tagged server-gui-v<version>, made only when the window itself changes.
// Writes into out/release-gui/ (gitignored):
//   DINGLECRAFT-ServerGUI-v<version>.zip   server-gui/ (its source, no node_modules, no out/) and the logo as tray.png
//   notes.md                               what it is and how to start it, for the release page
// Reads the zip back and checks every file, then prints the gh command that publishes it. Never talks to the network.
import fs from 'node:fs';
import path from 'node:path';
import { REPO, rel } from './lib/paths.mjs';
import { writeZip, readZip } from './lib/zip.mjs';

const die = (m) => { console.error('package-gui: ' + m); process.exit(1); };
if (process.argv.length > 2) die('no options: the version is the one in server-gui/package.json');
const DIR = path.join(REPO, 'server-gui'), pkg = JSON.parse(fs.readFileSync(path.join(DIR, 'package.json'), 'utf8'));
const VER = String(pkg.version || '');
if (!/^\d+\.\d+\.\d+$/.test(VER) || VER === '0.0.0') die('server-gui/package.json needs a real version (major.minor.patch), not "' + VER + '"');
const TOP = 'DINGLECRAFT-ServerGUI';

const entries = [];
(function walk(d, pre) {
  for (const n of fs.readdirSync(d).sort()) {
    if (n === 'node_modules' || n === 'out' || n === 'server' || n === 'data' || n.startsWith('.') || n === 'package-lock.json' || /^dinglecraft_v.*\.html$/.test(n)) continue;
    const f = path.join(d, n), st = fs.statSync(f);
    if (st.isDirectory()) walk(f, pre + n + '/');
    else entries.push({ name: TOP + '/' + pre + n, data: fs.readFileSync(f), mode: 0o644 });
  }
})(DIR, '');
entries.push({ name: TOP + '/tray.png', data: fs.readFileSync(path.join(REPO, 'assets', 'logo.png')), mode: 0o644 });
for (const need of ['main.js', 'preload.js', 'index.html', 'renderer.js', 'style.css', 'lib/store.cjs', 'lib/zip.cjs', 'package.json', 'README.md'])
  if (!entries.some((e) => e.name === TOP + '/' + need)) die('the package would miss ' + need);
if (entries.some((e) => /dinglecraft-server\.mjs$|\/server\//.test(e.name))) die('the window must not carry a server: players import one');

const OUT = path.join(path.resolve(process.env.DC_OUT_DIR || path.join(REPO, 'out')), 'release-gui');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${TOP}-v${VER}.zip`), buf = writeZip(entries), back = readZip(buf);
if (back.length !== entries.length || back.some((b, i) => b.name !== entries[i].name || !b.data.equals(entries[i].data))) die('the zip does not read back as written');
fs.writeFileSync(file, buf);
console.log(`${rel(file)}: ${entries.length} files, ${buf.length} B`);

const notes = [
  `**DINGLECRAFT Server window ${VER}**`, '',
  'The multiplayer server as a desktop program: your servers down the left, and for the one you pick a dashboard, a console, players and accounts, settings, game rules, worlds, backups and a scheduler.', '',
  '**One window for every server version.** It carries no server of its own. Download a game release\'s `DINGLECRAFT-Server-v<version>.zip` (any version from 6.41 on) and import it under **Server versions**; each server in the list picks the version it runs, and different servers can run different versions at the same time. A new game release needs no new window: import its Server zip and switch.', '',
  '**Or straight from GitHub.** New server asks for a name and a version: the drop-down lists the versions you have and the ones on the releases page, with a refresh button. Pick one you do not have and it is downloaded, checked against GitHub\'s fingerprint and imported for you.', '',
  '**Settings that keep up.** From game version 6.58 the server describes its own settings and game rules, so ones added later show in the window with their own names and limits. Older servers use the window\'s own list.', '',
  `**Install it (Windows):** download **DINGLECRAFT-Server-Setup-${VER}.exe** and run it. It is not signed, so the first time Windows SmartScreen says it protected your PC: click **More info**, then **Run anyway**.`, '',
  `**Build it from source** (or run it on Linux or macOS): unpack **${TOP}-v${VER}.zip**, then \`npm install\` (once; needs Node.js 20 or newer) and \`npm start\`. \`npm run dist\` builds the Windows installer and a portable exe into \`out/\` (on Windows; elsewhere it needs Wine).`, '',
].join('\n');
const notesFile = path.join(OUT, 'notes.md');
fs.writeFileSync(notesFile, notes);
console.log(`${rel(notesFile)}`);
console.log(`\npublish: gh release create server-gui-v${VER} ${rel(file)} --target Experimental --prerelease --title "DINGLECRAFT Server window ${VER}" --notes-file ${rel(notesFile)}`);
