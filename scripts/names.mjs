#!/usr/bin/env node
// Write server/lib/names.json, what every block and item id and every mob type is called, from the built game:   npm run names
//   --check    exit 1 (and write nothing) when names.json is out of date; tests/net/n_files.js runs the same check
//
// The server's world files keep ids (lib/region.mjs); the server window and "dinglecraft-server find" show and search them
// by name. The names live in the game (DEFS, MOBT), so the game is loaded headless the way the server's own game is
// (server/lib/headless.cjs), in a child process, and asked. Run npm run build first: it reads build/game.js.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO } from './lib/paths.mjs';

const OUT = path.join(REPO, 'server', 'lib', 'names.json');
const GAME = path.join(REPO, 'build', 'game.js');
const die = (m) => { console.error('names: ' + m); process.exit(1); };
if (!fs.existsSync(GAME)) die('no build/game.js: run npm run build first');

const probe = `require(${JSON.stringify(path.join(REPO, 'server', 'lib', 'headless.cjs'))});const log=console.log;console.log=()=>{};
require(${JSON.stringify(GAME)});console.log=log;const V=global.__vox,ids={};
for(const k of Object.keys(V.DEFS).map(Number).sort((a,b)=>a-b))if(V.DEFS[k]&&typeof V.DEFS[k].name==='string')ids[k]=V.DEFS[k].name;
process.stdout.write(JSON.stringify({ids,mobs:Object.keys(V.MOBT).sort()}));process.exit(0);`;
let got;
try { got = JSON.parse(execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8', maxBuffer: 1 << 24, timeout: 120000 })); } catch (e) { die('the game would not load: ' + e.message.split('\n')[0]); }
const text = '{\n  "about": "What the ids in the world files are called (block and item ids; a block is id | meta << 8) and the mob types. Made from the game by npm run names.",\n' +
  '  "ids": {\n' + Object.keys(got.ids).map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(got.ids[k])}`).join(',\n') + '\n  },\n' +
  '  "mobs": ' + JSON.stringify(got.mobs) + '\n}\n';
const old = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
if (process.argv.includes('--check')) {
  if (old !== text) die('server/lib/names.json is out of date: run npm run build && npm run names');
  console.log('names: server/lib/names.json is up to date (' + Object.keys(got.ids).length + ' ids, ' + got.mobs.length + ' mob types)');
} else if (old === text) console.log('names: unchanged (' + Object.keys(got.ids).length + ' ids, ' + got.mobs.length + ' mob types)');
else { fs.writeFileSync(OUT, text); console.log('names: wrote server/lib/names.json (' + Object.keys(got.ids).length + ' ids, ' + got.mobs.length + ' mob types)'); }
