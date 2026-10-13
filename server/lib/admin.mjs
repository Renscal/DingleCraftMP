// admin.mjs: the server as something another program runs and watches (6.41).
// Started with --ipc from a parent process that forked it (the desktop server window in server-gui/, or a test), the
// server reports to that parent with process.send and takes its orders from process.on('message'), instead of a person
// reading the terminal. Nothing is scraped from stdout. Without --ipc none of this is used.
//   to the parent     { t: 'ready', status }               listening
//                     { t: 'status', status }              once a second, and when asked
//                     { t: 'log', line }                   every line the server logs
//                     { t: 'event', what, name }           'join' / 'leave' as players come and go
//                     { t: 'reply', id, text }             the answer to a command
//                     { t: 'stopped' }                     saved and about to exit
//   from the parent   { t: 'cmd', id, line }               a console command (the same ones operators type)
//                     { t: 'status' }                      send a status now
//                     { t: 'save' }                        save the world now
//                     { t: 'stop' }                        save and exit
// Also here, because the window and the tests both need it: validateSettings, the check server.json's values must pass.
import os from 'node:os';
import { DEFAULTS, RULES, DIFFICULTIES, cleanRules } from './config.mjs';
import { playerKey } from './world.mjs';

/* this computer's addresses on the local network */
export function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

/* everything the window shows about a running server */
export function adminStatus(S, startedAt, heaps) {
  const st = S.status();
  const ops = new Set((S.opts.ops || []).map((n) => playerKey(n)));
  return {
    name: st.name, motd: st.motd, version: st.version, proto: st.proto, max: st.max, password: st.password,
    port: S.port, secure: !!S.secure, addresses: lanAddresses(), game: !!S.gameFile, worldDir: S.worldDir || '',
    uptime: Math.round((Date.now() - startedAt) / 1000), memory: process.memoryUsage().rss,
    difficulty: S.world().gr.difficulty || 'normal', mode: S.world().mode || 's',
    hosts: ['over', 'nether', 'aether'].map((d) => { const h = S.host(d); return { dim: d, running: !!h, ready: !!(h && h.ready), heap: (heaps && heaps[d]) || 0 }; }),
    players: S.players().filter((c) => c.ready && !c.host).map((c) => ({ id: c.id, name: c.name, op: ops.has(playerKey(c.name)), gm: c.gm || '', ms: c.ms | 0,
      dim: c.pose ? c.pose.dim : '', x: c.pose ? Math.round(c.pose.x) : 0, y: c.pose ? Math.round(c.pose.y) : 0, z: c.pose ? Math.round(c.pose.z) : 0 })),
  };
}

/* Wire a running server to its parent. send(m) delivers a message to the parent, stop(why) is the program's own stop
   (save, close, exit). Returns { onMessage, tick, log, close }: the caller feeds it the parent's messages, calls tick()
   once a second and log(line) for every logged line. */
export function attachAdmin(S, { send, stop }) {
  const startedAt = Date.now(), heaps = {};
  let known = new Map();
  const safe = (m) => { try { send(m); } catch { /* the parent has gone: the disconnect handler stops the server */ } };
  const status = () => adminStatus(S, startedAt, heaps);
  const A = {
    log(line) { safe({ t: 'log', line: String(line) }); },
    tick() {
      const now = new Map(S.players().filter((c) => c.ready && !c.host).map((c) => [c.id, c.name]));
      for (const [id, name] of now) if (!known.has(id)) safe({ t: 'event', what: 'join', name });
      for (const [id, name] of known) if (!now.has(id)) safe({ t: 'event', what: 'leave', name });
      known = now;
      for (const d of ['over', 'nether', 'aether']) {       // how much memory each dimension's own game holds, where Node can say
        const h = S.host(d);
        if (!h) { delete heaps[d]; continue; }
        if (typeof h.heap === 'function') h.heap().then((v) => { if (v > 0) heaps[d] = v; }).catch(() => {});
      }
      safe({ t: 'status', status: status() });
    },
    onMessage(m) {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'status') return safe({ t: 'status', status: status() });
      if (m.t === 'save') { S.saveWorld('asked by the window'); return safe({ t: 'reply', id: m.id || 0, text: 'saved' }); }
      if (m.t === 'stop') return stop('stopped from the window');
      if (m.t === 'cmd' && typeof m.line === 'string') {
        const line = m.line.trim().slice(0, 300), word = line.replace(/^\//, '').split(/\s+/)[0].toLowerCase();
        if (!word) return safe({ t: 'reply', id: m.id || 0, text: '' });
        if (word === 'stop' || word === 'quit' || word === 'exit') return stop('stop command');
        let text = '';
        try { text = S.command(line) || ''; } catch (e) { text = 'error: ' + e.message; }
        return safe({ t: 'reply', id: m.id || 0, text: String(text) });
      }
    },
    ready() { safe({ t: 'ready', status: status() }); },
    close() { safe({ t: 'stopped' }); },
  };
  return A;
}

/* ---- server.json, checked ---- */
/* the settings that only take effect when the server is started again (everything a running server read once) */
export const RESTART_KEYS = ['port', 'name', 'motd', 'password', 'maxPlayers', 'seed', 'mode', 'pvp', 'world', 'game', 'spawnProtection', 'sleepPercent', 'viewChunks', 'cert', 'key', 'origins', 'simulate', 'singlePlayer'];
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const NAME_RE = /^[\x21-\x7e][\x20-\x7e]{0,15}$/;           // a player name: printable ASCII, at most 16, not starting with a space
/* Check a settings object (what server.json holds, or what the window's form produced). Returns
   { ok, errors: [{ key, why }], restart: [keys that differ from `running` and need a restart] }. */
export function validateSettings(o, running) {
  const errors = [], bad = (key, why) => errors.push({ key, why });
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, errors: [{ key: '', why: 'the settings must be one object' }], restart: [] };
  const s = { ...DEFAULTS, ...o };
  if (!isInt(s.port, 1, 65535)) bad('port', 'a whole number from 1 to 65535');
  if (typeof s.name !== 'string' || !s.name.trim() || s.name.length > 60) bad('name', 'a name of 1 to 60 characters');
  if (typeof s.motd !== 'string' || s.motd.length > 200) bad('motd', 'at most 200 characters');
  if (typeof s.password !== 'string' || s.password.length > 64) bad('password', 'at most 64 characters (empty for none)');
  if (!isInt(s.maxPlayers, 1, 100)) bad('maxPlayers', 'a whole number from 1 to 100');
  if (typeof s.seed !== 'string' && typeof s.seed !== 'number') bad('seed', 'text or a number'); else if (String(s.seed).length > 64) bad('seed', 'at most 64 characters');
  if (s.mode !== 's' && s.mode !== 'c') bad('mode', '"s" (survival) or "c" (creative)');
  for (const k of ['pvp', 'whitelist', 'simulate', 'singlePlayer']) if (typeof s[k] !== 'boolean') bad(k, 'true or false');
  if (typeof s.world !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_. -]{0,39}$/.test(s.world) || s.world.includes('..')) bad('world', 'a folder name: letters, digits, spaces, dots, dashes and underscores, at most 40');
  if (!isInt(s.spawnProtection, 0, 256)) bad('spawnProtection', 'a whole number from 0 to 256');
  if (!isInt(s.sleepPercent, 1, 100)) bad('sleepPercent', 'a whole number from 1 to 100');
  if (!isInt(s.viewChunks, 4, 32)) bad('viewChunks', 'a whole number from 4 to 32');
  for (const k of ['ops', 'allow', 'bans']) {
    if (!Array.isArray(s[k])) { bad(k, 'a list of player names'); continue; }
    const wrong = s[k].find((n) => typeof n !== 'string' || !NAME_RE.test(n.trim()));
    if (wrong !== undefined) bad(k, 'not a player name: ' + JSON.stringify(wrong).slice(0, 30));
  }
  if (!Array.isArray(s.origins) || s.origins.some((x) => typeof x !== 'string')) bad('origins', 'a list of addresses');
  for (const k of ['cert', 'key', 'game']) if (typeof s[k] !== 'string') bad(k, 'a file path (empty for none)');
  if (!!s.cert !== !!s.key) bad('cert', 'a certificate and its key go together: give both or neither');
  if (s.rules != null) {
    if (typeof s.rules !== 'object' || Array.isArray(s.rules)) bad('rules', 'an object of game rules');
    else {
      const clean = cleanRules(s.rules);
      for (const k of Object.keys(s.rules)) {
        if (!(k in RULES)) bad('rules.' + k, 'not a game rule');
        else if (!(k in clean)) bad('rules.' + k, k === 'difficulty' ? 'one of ' + DIFFICULTIES.join(', ') : typeof RULES[k] === 'number' ? 'a number from 0 to 100' : 'true or false');
      }
    }
  }
  const restart = running && typeof running === 'object' ? RESTART_KEYS.filter((k) => JSON.stringify(s[k]) !== JSON.stringify({ ...DEFAULTS, ...running }[k])) : [];
  if (running && running.rules && s.rules && (running.rules.difficulty === 'dinglecore') !== (s.rules.difficulty === 'dinglecore')) restart.push('rules.difficulty');
  return { ok: errors.length === 0, errors, restart };
}

/* every setting and every game rule with its default: what the window's forms start from when server.json is new or old */
export function formDefaults() { return { ...DEFAULTS, rules: { ...RULES } }; }
