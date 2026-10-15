#!/usr/bin/env node
// summary.mjs: what a Node CPU profile spent its time on, as a short table (prints function names and file:line, never
// source text). Make a profile with node's own flag, then summarise it:
//   node --cpu-prof --cpu-prof-dir=out/prof tests/core2/k24_spawn.js
//   node tools/prof/summary.mjs out/prof [--top 25] [--by self|file]
// A folder means its newest .cpuprofile. self: time in each function itself (the default); file: time per source file.
// The game is one big script (build/game.js): its lines are the built file's; tools/grep-safe.sh finds them in src/.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
let src = argv.find((a, i) => !a.startsWith('--') && !['--top', '--by'].includes(argv[i - 1]));
if (!src) { console.error('usage: node tools/prof/summary.mjs <file.cpuprofile | folder> [--top N] [--by self|file]'); process.exit(2); }
if (fs.statSync(src).isDirectory()) {
  const all = fs.readdirSync(src).filter((n) => n.endsWith('.cpuprofile')).map((n) => path.join(src, n)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!all.length) { console.error('no .cpuprofile in ' + src); process.exit(2); }
  src = all[0];
}
const TOP = +opt('--top', 25), BY = opt('--by', 'self');
const P = JSON.parse(fs.readFileSync(src, 'utf8'));
const node = new Map(P.nodes.map((n) => [n.id, n]));
const tally = new Map();
let total = 0, idle = 0;
for (let i = 0; i < P.samples.length; i++) {
  const n = node.get(P.samples[i]), dt = P.timeDeltas[i] || 0, cf = n.callFrame, fn = cf.functionName || '(anonymous)';
  total += dt;
  if (fn === '(idle)' || fn === '(garbage collector)' || fn === '(program)') { if (fn === '(idle)') idle += dt; }
  const file = (cf.url || '').replace(/^file:\/\//, '').split('/').slice(-2).join('/') || fn;
  const key = BY === 'file' ? file : fn + '  ' + file + (cf.lineNumber >= 0 ? ':' + (cf.lineNumber + 1) : '');
  tally.set(key, (tally.get(key) || 0) + dt);
}
const ms = (v) => (v / 1000).toFixed(0);
console.log(`${path.basename(src)}: ${ms(total)} ms sampled, ${ms(total - idle)} ms busy`);
for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1]).slice(0, TOP))
  console.log(ms(v).padStart(7) + ' ms ' + (100 * v / Math.max(1, total - idle)).toFixed(1).padStart(5) + '%  ' + k);
