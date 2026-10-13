#!/usr/bin/env node
// Package a version for its GitHub release: npm run package   (after npm run release, or npm run build for a dry run)
//   --beta   the notes end with a line saying this is a beta that was released without the full test run
// Writes into out/release/ (gitignored):
//   DINGLECRAFT-Server-v<X.Y>.zip   server/ (front door, lib/, launchers, README) with the game html beside it, so the
//                                   server hands the game out at its own address: players only need a browser
//   DINGLECRAFT-Client-v<X.Y>.zip   client/ (the Electron wrapper) with the same html beside main.js
//   notes.md                        the version's patch notes as Markdown, for the release page
// Then it reads both zips back and checks every file (names, bytes, CRC), and prints the gh command that publishes them.
// Publishing stays a separate step (docs/RELEASING.md, step 6): this script never talks to the network.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO, FIX, rel } from './lib/paths.mjs';
import { readVersion, readLabel, readPatchLog } from './lib/version.mjs';
import { writeZip, readZip } from './lib/zip.mjs';

const die = (m) => { console.error('package: ' + m); process.exit(1); };
for (const a of process.argv.slice(2)) if (a !== '--beta') die('unknown option ' + a);
const BETA = process.argv.includes('--beta');
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const VER = readVersion(REPO), LABEL = readLabel(REPO);
const HTML_NAME = `dinglecraft_v${VER}.html`;
const htmlFile = path.join(path.resolve(process.env.DC_DIST || path.join(REPO, 'dist')), HTML_NAME);
if (!fs.existsSync(htmlFile)) die(`${rel(htmlFile)} missing: run npm run build first`);
const html = fs.readFileSync(htmlFile);
const shipped = (JSON.parse(fs.readFileSync(path.join(FIX, 'shipped.json'), 'utf8')).shipped || {})[VER];
const RELEASED = !!shipped;
if (RELEASED && shipped.md5 !== md5(html)) die(`${rel(htmlFile)} is not the released v${VER} (md5 differs from tests/fixtures/shipped.json): run npm run build`);

/* every file under a repo folder, as zip entries below `top/` (never data/, node_modules/ or a dropped game html) */
function tree(dir, top) {
  const out = [];
  (function walk(d, pre) {
    for (const n of fs.readdirSync(d).sort()) {
      if (n === 'data' || n === 'node_modules' || n.startsWith('.') || /^dinglecraft_v.*\.html$/.test(n) || n === 'package-lock.json') continue;
      const f = path.join(d, n), st = fs.statSync(f);
      if (st.isDirectory()) walk(f, pre + n + '/');
      else out.push({ name: top + '/' + pre + n, data: fs.readFileSync(f), mode: n.endsWith('.sh') ? 0o755 : 0o644 });
    }
  })(dir, '');
  return out;
}

const server = tree(path.join(REPO, 'server'), 'DINGLECRAFT-Server');
server.push({ name: 'DINGLECRAFT-Server/' + HTML_NAME, data: html, mode: 0o644 });
const client = tree(path.join(REPO, 'client'), 'DINGLECRAFT-Client');
{ /* the packaged client carries the game version */
  const pj = client.find((e) => e.name === 'DINGLECRAFT-Client/package.json');
  if (!pj) die('client/package.json missing');
  const doc = JSON.parse(pj.data.toString('utf8')); doc.version = VER + '.0';
  pj.data = Buffer.from(JSON.stringify(doc, null, 2) + '\n');
}
client.push({ name: 'DINGLECRAFT-Client/' + HTML_NAME, data: html, mode: 0o644 });
for (const need of ['DINGLECRAFT-Server/dinglecraft-server.mjs', 'DINGLECRAFT-Server/lib/server.mjs', 'DINGLECRAFT-Server/Start Server.bat', 'DINGLECRAFT-Server/start-server.sh'])
  if (!server.some((e) => e.name === need)) die('the server package would miss ' + need);
if (!client.some((e) => e.name === 'DINGLECRAFT-Client/main.js')) die('the client package would miss main.js');

const OUT = path.join(path.resolve(process.env.DC_OUT_DIR || path.join(REPO, 'out')), 'release');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const files = [];
for (const [label, entries] of [['Server', server], ['Client', client]]) {
  const file = path.join(OUT, `DINGLECRAFT-${label}-v${VER}.zip`), buf = writeZip(entries);
  const back = readZip(buf);
  if (back.length !== entries.length || back.some((b, i) => b.name !== entries[i].name || !b.data.equals(entries[i].data) || b.mode !== entries[i].mode)) die(`${label} zip does not read back as written`);
  fs.writeFileSync(file, buf); files.push(file);
  console.log(`${rel(file)}: ${entries.length} files, ${buf.length} B`);
}

/* the patch notes: single-quoted html lines -> Markdown */
const md = (s) => s.replace(/<\/?(?:b|strong)>/g, '**').replace(/<\/?(?:i|em)>/g, '*').replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const top = readPatchLog(REPO, VER)[0];
if (!top || top.v !== VER) die('the top PATCH_LOG entry is not this version');
const notes = [
  `**${LABEL}, game version ${VER}: ${md(top.title)}**`, '',
  ...top.lines.map((l) => '- ' + md(l)), '',
  '## Downloads', '',
  `- **DINGLECRAFT-Server-v${VER}.zip**: the multiplayer server with the game inside. Needs Node.js 20 or newer. Start it (` +
    '`Start Server.bat` on Windows, `./start-server.sh` elsewhere) and players open its address in a browser: nothing else to install.',
  `- **DINGLECRAFT-Client-v${VER}.zip**: the game as a desktop app (an Electron wrapper around the same html). Optional: ` +
    'the html inside it also opens in any browser by double-click. `npm install`, then `npm start`.', '',
  ...(BETA ? ['> **Beta.** Cut from the Experimental branch for players to test; it was released without the full test run. Report what breaks.', ''] : []),
].join('\n');
const notesFile = path.join(OUT, 'notes.md');
fs.writeFileSync(notesFile, notes);
console.log(`${rel(notesFile)}: ${top.lines.length} lines`);

if (!RELEASED) console.log(`\nnote: v${VER} is not in tests/fixtures/shipped.json yet, so this is a dry run: release it first (npm run release).`);
console.log(`\npublish: gh release create v${VER} ${files.map((f) => rel(f)).join(' ')} --target Experimental --prerelease ` +
  `--title "${LABEL} (v${VER}) ${md(top.title)}" --notes-file ${rel(notesFile)}`);
