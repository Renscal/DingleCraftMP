// files.mjs: the world's files from the command line (6.60). The region and entity files are packed (lib/region.mjs); these
// turn them into JSON a person can read, back again, and search a whole world. The server does not need to be running.
//   node dinglecraft-server.mjs view <file>                 print a region or entity file as JSON
//   node dinglecraft-server.mjs unpack <file> [<out.json>]  the same, into a file (default: its name with .json, here)
//   node dinglecraft-server.mjs pack <file.json> [<out>]    a JSON file (from unpack, or a region file from before 6.60)
//                                                           back into a packed file (default: r.<x>.<z>.dcr or .dce
//                                                           next to it). Stop the server before putting it in a world:
//                                                           a running server writes its own copy over it.
//   node dinglecraft-server.mjs find <words> [options]      search a world for blocks, items (in chests, on the ground,
//                                                           carried by players), mobs and vehicles, by name or "#id"
//       --world <folder>   the world (default: the one data/server.json names, in the data folder)
//       --data <folder>    the data folder (default: data/ next to the server)
//       --blocks --items --mobs --players   look only for these (default: all of them)
//       --in <file>        only this file of the world (region/over/r.0.0.dcr, or playerdata); more than one may be given
//       --max <n>          at most this many hits (default 200)
import fs from 'node:fs';
import path from 'node:path';
import { SERVER_DIR } from './config.mjs';
import { decodeFile, encodeFile, docText, fileName, searchWorld, summary, listWorldFiles } from './region.mjs';

export const FILE_COMMANDS = ['view', 'unpack', 'pack', 'find', 'files'];
const USAGE = 'usage:\n  dinglecraft-server view <file>\n  dinglecraft-server unpack <file> [<out.json>]\n  dinglecraft-server pack <file.json> [<out>]\n' +
  '  dinglecraft-server files [--world <folder>] [--data <folder>]\n' +
  '  dinglecraft-server find <words> [--world <folder>] [--data <folder>] [--blocks] [--items] [--mobs] [--players] [--in <file>] [--max <n>]';

const writeSafe = (file, data) => { fs.writeFileSync(file + '.tmp', data); fs.renameSync(file + '.tmp', file); };
/* the world folder: --world, else the world data/server.json names */
function worldDir(o) {
  const data = path.resolve(o.data || path.join(SERVER_DIR, 'data'));
  if (o.world) return path.resolve(data, o.world);
  let name = 'world';
  try { name = JSON.parse(fs.readFileSync(path.join(data, 'server.json'), 'utf8')).world || 'world'; } catch { /* no settings: the default */ }
  return path.resolve(data, String(name).replace(/(\.vxw)?\.json$/i, ''));
}
const fmtAt = (at) => (Array.isArray(at) ? at.map((v) => (typeof v === 'number' ? Math.round(v) : '?')).join(' ') : '');

/* run one command; returns the exit code. out and err are for the tests (default: the console) */
export async function filesMain(argv, out = (s) => process.stdout.write(s), err = (s) => process.stderr.write(s)) {
  const [cmd, ...rest] = argv, pos = [], o = { in: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i], val = () => { if (i + 1 >= rest.length) throw new Error('missing value after ' + a); return rest[++i]; };
    if (a === '--world') o.world = val(); else if (a === '--data') o.data = val(); else if (a === '--in') o.in.push(val().replace(/\\/g, '/'));
    else if (a === '--max') o.max = Number(val());
    else if (['--blocks', '--items', '--mobs', '--players'].includes(a)) (o.only || (o.only = new Set())).add(a.slice(2));
    else if (a === '--help' || a === '-h') { out(USAGE + '\n'); return 0; }
    else if (a.startsWith('--')) { err('unknown option ' + a + '\n' + USAGE + '\n'); return 2; }
    else pos.push(a);
  }
  try {
    if (cmd === 'view' || cmd === 'unpack') {
      if (!pos[0]) { err(USAGE + '\n'); return 2; }
      const { kind, form, doc } = decodeFile(fs.readFileSync(pos[0]), pos[0]), text = docText(kind, doc);
      if (cmd === 'view') { out(text); return 0; }
      const to = pos[1] || path.basename(pos[0]).replace(/\.(dcr|dce|json\.br|json)$/, '') + '.json';
      if (path.resolve(to) === path.resolve(pos[0])) { err('unpack: that would write over ' + pos[0] + '\n'); return 1; }
      writeSafe(to, text);
      const s = summary(kind, doc);
      out(`unpacked ${pos[0]} (${form}, ${kind}: ${Object.entries(s).map(([k, v]) => v + ' ' + k).join(', ')}) to ${to}\n`);
      return 0;
    }
    if (cmd === 'pack') {
      if (!pos[0]) { err(USAGE + '\n'); return 2; }
      const { kind, doc } = decodeFile(fs.readFileSync(pos[0]), pos[0]);
      if (!Array.isArray(doc.region) || doc.region.length !== 2 || !doc.region.every(Number.isInteger)) { err(`pack: ${pos[0]} has no "region": [x, z]\n`); return 1; }
      if (typeof doc.dimension !== 'string' || !doc.dimension) doc.dimension = 'over';
      const buf = encodeFile(kind, doc), to = pos[1] || path.join(path.dirname(pos[0]), fileName(kind, doc.region[0], doc.region[1]));
      if (path.resolve(to) === path.resolve(pos[0])) { err('pack: that would write over ' + pos[0] + '\n'); return 1; }
      writeSafe(to, buf);
      out(`packed ${pos[0]} (${fs.statSync(pos[0]).size} B) to ${to} (${buf.length} B). Stop the server before putting it in a world folder.\n`);
      return 0;
    }
    if (cmd === 'files') {
      const dir = worldDir(o), list = listWorldFiles(dir);
      if (!fs.existsSync(dir)) { err('no world at ' + dir + '\n'); return 1; }
      out(`${dir}: ${list.length} file${list.length === 1 ? '' : 's'}\n`);
      for (const f of list) { let s = ''; try { const r = decodeFile(fs.readFileSync(path.join(dir, f.rel)), f.rel); s = Object.entries(summary(r.kind, r.doc)).map(([k, v]) => v + ' ' + k).join(', '); } catch (e) { s = 'cannot be read: ' + e.message; } out(`  ${f.rel.padEnd(34)} ${String(f.bytes).padStart(9)} B  ${f.form === 'packed' ? '' : '(' + f.form + ') '}${s}\n`); }
      return 0;
    }
    if (cmd === 'find') {
      const query = pos.join(' ').trim();
      if (!query) { err(USAGE + '\n'); return 2; }
      const dir = worldDir(o);
      if (!fs.existsSync(dir)) { err('no world at ' + dir + '\n'); return 1; }
      const has = (k) => !o.only || o.only.has(k), max = Number.isInteger(o.max) && o.max > 0 ? o.max : 200;
      const r = await searchWorld(dir, { query, files: o.in, blocks: has('blocks'), items: has('items'), mobs: has('mobs'), players: has('players'), limit: max }), hits = r.hits;
      for (const e of r.errors) err('skipped: ' + e + '\n');
      if (!hits.length) { out(`nothing matching "${query}" in ${dir} (${r.files} file${r.files === 1 ? '' : 's'} searched)\n`); return 0; }
      const rows = hits.map((h) => [h.dim || '-', fmtAt(h.at), h.count > 1 ? h.count + ' x' : '', h.name + (h.id !== undefined ? ' #' + h.id : ''), h.in, h.rel]);
      const w = rows[0].map((_, i) => Math.min(40, Math.max(...rows.map((x) => String(x[i]).length))));
      for (const row of rows) out(row.map((c, i) => (i === row.length - 1 ? c : String(c).padEnd(w[i]))).join('  ') + '\n');
      out(`${hits.length} hit${hits.length === 1 ? '' : 's'}${r.truncated ? ' (stopped at ' + max + ': --max for more)' : ''} in ${r.files} file${r.files === 1 ? '' : 's'}\n`);
      return 0;
    }
  } catch (e) { err(cmd + ': ' + e.message + '\n'); return 1; }
  err(USAGE + '\n');
  return 2;
}
