// Assemble the two embedded-art scripts from the committed packed payloads (assets/packed/), byte for byte.
//
//   hr_assets.gen.js  = header.txt + 'function hrAssetMeta(){return ' + meta.json + ';}\n'
//                       + 'function hrAssets(){return hrAssets.T||(hrAssets.T={\n'
//                       + one '"<key>":"data:image/webp;base64,<b64>",\n' per payload, SORTED BY KEY STRING
//                       + '});}\n' + the module.exports line
//   mg_assets.gen.js  = header.txt + 'function hrMgAssets(){return {' + entries in order.json order, comma-joined + '};}\n'
//                       + the module.exports line
//   hrassets.js       = hr + mg
//
// The three gotchas (docs/ASSETS.md):
//   1. meta.json is VERBATIM: never JSON.parse/stringify it (the packer is Python and writes floats as 1.0).
//   2. hr keys sort by the key string 't:<name>|<map>', never by file name ('|' sorts after '_', '.' before it).
//   3. mg keys are NOT sorted: order.json holds their order (ids x maps).
// The manifests' fileSha1 / sha1 pin the assembled text, so any drift fails the build.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { REPO } from './paths.mjs';

const PREFIX = 'data:image/webp;base64,';
const FILE_RE = /^([a-z0-9_]+)\.([a-z])\.webp$/;
const sha1 = (s) => crypto.createHash('sha1').update(s, 'latin1').digest('hex');

function oneLine(file) {
  const s = fs.readFileSync(file, 'latin1');
  if (!s.endsWith('\n') || s.indexOf('\n') !== s.length - 1) throw new Error(path.basename(path.dirname(file)) + '/header.txt must be exactly one line ending in a newline');
  return s;
}

function uri(file) {
  const b = fs.readFileSync(file);
  if (b.length < 12 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') throw new Error('not a RIFF/WEBP payload: ' + path.basename(file));
  return PREFIX + b.toString('base64');
}

/** Assemble hr_assets.gen.js text from assets/packed/hr. Returns { text, keys }. */
export function assembleHr(repo = REPO) {
  const D = path.join(repo, 'assets', 'packed', 'hr');
  let meta = fs.readFileSync(path.join(D, 'meta.json'), 'latin1');
  if (meta.endsWith('\n')) meta = meta.slice(0, -1);           // tolerate ONE newline an editor may have added
  if (meta.includes('\n')) throw new Error('assets/packed/hr/meta.json must be one line (verbatim packer output)');
  const entries = [];
  for (const kind of ['t', 'e']) {
    for (const f of fs.readdirSync(path.join(D, kind))) {
      if (f.startsWith('.')) continue;
      const m = FILE_RE.exec(f);
      if (!m) throw new Error('unexpected file in assets/packed/hr/' + kind + ': ' + f);
      entries.push([`${kind}:${m[1]}|${m[2]}`, path.join(D, kind, f)]);
    }
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const out = [oneLine(path.join(D, 'header.txt')),
    'function hrAssetMeta(){return ', meta, ';}\n',
    'function hrAssets(){return hrAssets.T||(hrAssets.T={\n'];
  for (const [k, f] of entries) out.push(JSON.stringify(k), ':', JSON.stringify(uri(f)), ',\n');
  out.push("});}\nif(typeof module!=='undefined'&&module.exports)module.exports={hrAssets,hrAssetMeta};\n");
  return { text: out.join(''), keys: entries.map((e) => e[0]) };
}

/** Assemble mg_assets.gen.js text from assets/packed/mg. Returns { text, keys }. */
export function assembleMg(repo = REPO) {
  const D = path.join(repo, 'assets', 'packed', 'mg');
  const order = JSON.parse(fs.readFileSync(path.join(D, 'order.json'), 'utf8'));
  const files = new Set(fs.readdirSync(path.join(D, 'm')).filter((f) => !f.startsWith('.')));
  const parts = order.map((k) => {
    const m = /^m:([a-z0-9_]+)\|([a-z])$/.exec(k);
    if (!m) throw new Error('assets/packed/mg/order.json: bad key ' + JSON.stringify(k));
    const f = m[1] + '.' + m[2] + '.webp';
    if (!files.delete(f)) throw new Error('assets/packed/mg/m/' + f + ' missing (listed in order.json)');
    return JSON.stringify(k) + ':' + JSON.stringify(uri(path.join(D, 'm', f)));
  });
  if (files.size) throw new Error('assets/packed/mg/m has files not in order.json: ' + [...files].join(', '));
  const text = oneLine(path.join(D, 'header.txt')) + 'function hrMgAssets(){return {' + parts.join(',') + '};}\n'
    + "if(typeof module!=='undefined'&&module.exports)module.exports.hrMgAssets=hrMgAssets;\n";
  return { text, keys: order };
}

/** The splice-era boundary contract for an asset script. Returns problems. */
export function checkAssetText(name, text, mustHave) {
  const p = [];
  if (!/^[\x00-\x7f]*$/.test(text)) p.push(name + ': not pure ASCII');
  if (text.includes('<')) p.push(name + ": contains '<' (would break the inline <script>)");
  if (!text.endsWith('\n')) p.push(name + ': does not end with a newline');
  for (const s of mustHave) if (!text.includes(s)) p.push(name + ': missing ' + s);
  return p;
}

/** Assemble both, run the contract and the manifest sha1 pins. Returns { hr, mg, problems, info }. */
export function assembleAssets(repo = REPO) {
  const problems = [];
  const hr = assembleHr(repo), mg = assembleMg(repo);
  problems.push(...checkAssetText('hr_assets.gen.js', hr.text, ['function hrAssets(', 'function hrAssetMeta(', 'module.exports']));
  problems.push(...checkAssetText('mg_assets.gen.js', mg.text, ['function hrMgAssets(', 'module.exports']));
  const hm = JSON.parse(fs.readFileSync(path.join(repo, 'assets', 'packed', 'hr', 'manifest.json'), 'utf8'));
  const mm = JSON.parse(fs.readFileSync(path.join(repo, 'assets', 'packed', 'mg', 'manifest.json'), 'utf8'));
  const hs = sha1(hr.text), ms = sha1(mg.text);
  if (hs !== hm.fileSha1) problems.push('hr_assets.gen.js: sha1 differs from assets/packed/hr/manifest.json fileSha1 (repack with npm run repack)');
  if (Buffer.byteLength(hr.text, 'latin1') !== hm.fileBytes) problems.push('hr_assets.gen.js: size differs from manifest fileBytes');
  if (ms !== mm.sha1) problems.push('mg_assets.gen.js: sha1 differs from assets/packed/mg/manifest.json sha1 (repack with npm run repack)');
  if (Buffer.byteLength(mg.text, 'latin1') !== mm.fileBytes) problems.push('mg_assets.gen.js: size differs from manifest fileBytes');
  const hk = Object.keys(hm.keys || {}).sort(), ak = [...hr.keys].sort();
  if (hk.length && JSON.stringify(hk) !== JSON.stringify(ak)) problems.push('assets/packed/hr: payload files do not match the manifest keys');
  const mk = Object.keys(mm.keys || {});
  if (mk.length && JSON.stringify([...mk].sort()) !== JSON.stringify([...mg.keys].sort())) problems.push('assets/packed/mg: order.json does not match the manifest keys');
  return { hr: hr.text, mg: mg.text, problems, info: { hrKeys: hr.keys.length, mgKeys: mg.keys.length, hrSha1: hs, mgSha1: ms } };
}

/* ---- 6.62: the art beside the page ----
   The page no longer carries the art. assembleArt splits the same payloads (every hr key in hr order, then every mg key
   in order.json order, each the same data: URI hrassets.js holds) into files of at most ART_SPLIT bytes:
     art/hyperreal-<n>-<sha1 of the file, 10 hex>.js = one comment line + 'hrArtArrived("<its own name>",{hr...},{mg...});\n'
   and writes the small stand-in the page carries instead of hrassets.js (hrart.js): hrAssetMeta verbatim, and hrAssets,
   hrMgAssets, hrArtReady and hrArtLoad, which adds the files as <script> tags the first time Hyperreal is switched on
   (src/texpacks/t0_contract.js tpEnable). Script tags load from file:// as well as http, so the same page and folder work
   opened from disk, served by the multiplayer server and in the desktop client. The names carry their content's hash: a
   browser may keep them forever, and a release only adds files when the art changed. */
export const ART_SPLIT = 20000000;
export const ART_DIR = 'art';
/** every payload as [key, file], hr then mg, in the order the scripts above write them */
function artEntries(repo) {
  const H = path.join(repo, 'assets', 'packed', 'hr'), M = path.join(repo, 'assets', 'packed', 'mg'), hr = [];
  for (const kind of ['t', 'e']) for (const f of fs.readdirSync(path.join(H, kind))) {
    if (f.startsWith('.')) continue;
    const m = FILE_RE.exec(f);
    if (!m) throw new Error('unexpected file in assets/packed/hr/' + kind + ': ' + f);
    hr.push(['hr', `${kind}:${m[1]}|${m[2]}`, path.join(H, kind, f)]);
  }
  hr.sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
  const mg = JSON.parse(fs.readFileSync(path.join(M, 'order.json'), 'utf8')).map((k) => { const m = /^m:([a-z0-9_]+)\|([a-z])$/.exec(k); return ['mg', k, path.join(M, 'm', m[1] + '.' + m[2] + '.webp')]; });
  return hr.concat(mg);
}
/** { stub (hrart.js text), files: [{ name, text }] } */
export function assembleArt(repo = REPO, split = ART_SPLIT) {
  let meta = fs.readFileSync(path.join(repo, 'assets', 'packed', 'hr', 'meta.json'), 'latin1');
  if (meta.endsWith('\n')) meta = meta.slice(0, -1);
  const groups = [];
  let cur = null;
  for (const [pack, key, file] of artEntries(repo)) {
    const item = JSON.stringify(key) + ':' + JSON.stringify(uri(file));
    if (!cur || (cur.bytes + item.length > split && cur.bytes > 0)) groups.push(cur = { hr: [], mg: [], bytes: 0 });
    cur[pack].push(item); cur.bytes += item.length + 1;
  }
  const files = groups.map((g, i) => {
    const body = '{' + g.hr.join(',') + '},{' + g.mg.join(',') + '});\n';
    const name = `hyperreal-${i + 1}-` + sha1(body).slice(0, 10) + '.js';
    return { name, text: `/* DINGLECRAFT Hyperreal art, part ${i + 1} of ${groups.length}: loaded by the game when Hyperreal is switched on. GENERATED by scripts/build.mjs from assets/packed. Do not edit. Do not print (lines are megabytes long). */\nhrArtArrived(${JSON.stringify(name)},` + body };
  });
  const list = JSON.stringify(files.map((f) => ART_DIR + '/' + f.name)), total = files.reduce((a, f) => a + f.text.length, 0);
  const stub = `/* PART 54 ASSETS - GENERATED by scripts/build.mjs (6.62; server/lib/host.mjs cuts the game script at this line): the Hyperreal art is not in this page. It is ${files.length} file${files.length === 1 ? '' : 's'} (${total} bytes) in the ${ART_DIR}/ folder next to it, loaded the first time Hyperreal is switched on (hrArtLoad). */\n` +
    'function hrAssetMeta(){return ' + meta + ';}\n' +
    'var HRART={files:' + list + ',got:{},T:{},M:{},p:null};\n' +
    'function hrArtArrived(name,T,M){HRART.got[name]=1;Object.assign(HRART.T,T);Object.assign(HRART.M,M);}\n' +
    "function hrArtReady(){return HRART.files.every(function(f){return HRART.got[f.slice(f.lastIndexOf('/')+1)];});}\n" +
    'function hrAssets(){return hrArtReady()?HRART.T:null;}\n' +
    'function hrMgAssets(){return hrArtReady()?HRART.M:{};}\n' +
    '/* the art, as script tags (they load from file:// too); true once every part has arrived, false if one could not be loaded */\n' +
    'function hrArtLoad(){if(hrArtReady())return Promise.resolve(true);if(HRART.p)return HRART.p;\n' +
    "  var one=function(f){if(HRART.got[f.slice(f.lastIndexOf('/')+1)])return Promise.resolve(true);return new Promise(function(res){var s;\n" +
    "    try{s=document.createElement('script');}catch(e){return res(false);}\n" +
    '    s.async=true;s.onload=function(){res(true);};s.onerror=function(){if(s.parentNode)s.parentNode.removeChild(s);res(false);};s.src=f;\n' +
    '    (document.head||document.documentElement).appendChild(s);});};\n' +
    '  return HRART.p=Promise.all(HRART.files.map(one)).then(function(){HRART.p=null;return hrArtReady();});}\n';
  return { stub, files };
}
