// commands.mjs: the slash commands. One table serves both the players (a chat line starting with "/") and the person at the
// server window (who is "the console" and may do everything). It knows nothing about sockets: like lib/protocol.mjs it is handed
//   S    the server's state      net  { send, broadcast, drop }
// Who may do what follows Minecraft: anyone may /help, /list, /me and /msg; everything else needs an operator (the "ops" list
// in server.json, or /op from the console). Commands that change a player's own game (teleport, give, game mode) are sent to
// that player's game as tp / give / mode messages; the rest change the server's world or its settings.
import fs from 'node:fs';
import path from 'node:path';
import { cleanList, cleanRules, RULES } from './config.mjs';
import { num, cleanText, cleanName, cleanSkin, playerKey } from './world.mjs';
import crypto from 'node:crypto';

/* is this player an operator? */
export const isOp = (S, c) => !!c && S.o.ops.includes(playerKey(c.name));

/* is the spawn area protected right now? Like Minecraft: only when the server has operators, and never from them. */
export const protRadius = (S) => (S.world.spawn && S.o.ops.length && S.o.spawnProtection > 0 ? S.o.spawnProtection : 0);

/* the online player with this name, or undefined */
export function findPlayer(S, name) {
  const k = playerKey(name);
  return [...S.clients.values()].find((p) => p.ready && playerKey(p.name) === k);
}

/* what a player's game needs to know about its own rights: sent on joining and again whenever the ops list changes */
export function permOf(S, c) {
  return { t: 'perm', op: isOp(S, c), prot: isOp(S, c) ? 0 : protRadius(S), spawn: S.world.spawn };
}

/* the settings changed (ops, bans, the whitelist): tell the program so it can rewrite server.json, and tell every game */
function settingsChanged(S, net) {
  if (typeof S.o.onSettings === 'function') S.o.onSettings();
  for (const p of S.clients.values()) if (p.ready) net.send(p, permOf(S, p));
}

/* ----- accounts (6.49): the helpers lib/protocol.mjs uses too ----- */
/* does this password open this account? Compared as hashes in constant time, so it cannot be guessed a character at a time */
export function passOK(rec, pass) {
  if (!rec || typeof rec.password !== 'string' || typeof pass !== 'string') return false;
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(pass), h(rec.password));
}
/* the account of that name, or null */
export function accountOf(S, name) {
  const r = S.world.players[playerKey(name || '')];
  return r && typeof r === 'object' && typeof r.password === 'string' ? r : null;
}
/* what a player may not change: the server's rules for everyone, or their own */
export function locksOf(S, name) {
  const r = S.world.players[playerKey(name || '')], l = (r && r.locks) || {};
  return { name: !!(S.o.lockNames || l.name), password: !!(S.o.lockPasswords || l.password), skin: !!(S.o.lockSkins || l.skin) };
}
/* a password an account may have: 1 to 64 printable characters, no spaces (a command line splits on them) */
export const passwordProblem = (p) => (typeof p === 'string' && /^[\x21-\x7e]{1,64}$/.test(p) ? '' : 'A password is 1 to 64 letters, digits or symbols, with no spaces.');
/* an operator dresses a player: the skin is kept with them, and everyone (them too) sees it at once. Returns the reply. */
export function setSkin(S, net, name, png) {
  const k = playerKey(name), rec = S.world.players[k];
  if (!k || !rec || typeof rec !== 'object') return 'No player called ' + (name || '?') + ' has played here.';
  const clean = cleanSkin(png === 'reset' ? '' : png);
  if (clean === null) return 'That is not a skin: it must be a PNG, 64 x 64 or 64 x 32, under 50 KB.';
  if (clean) rec.skin = clean; else delete rec.skin;
  S.dirty = true;
  const p = [...S.clients.values()].find((q) => q.ready && !q.host && playerKey(q.name) === k);
  if (p) { p.skin = clean; net.broadcast({ t: 'skin', id: p.id, png: clean }); }
  return (rec.name || name) + (clean ? ' now wears the new skin' : ' wears the default skin again');
}
/* 6.49: give an account (and everything kept with it) a new name. The playerdata file follows at the next save, and so do
   the ops, whitelist and ban lists; a player online is renamed for everyone at once. Returns {ok, why}. */
export function renameAccount(S, net, from, to) {
  const a = playerKey(from), name = cleanName(to), b = playerKey(name);
  if (!name) return { ok: false, why: 'A name is 1 to 16 letters, digits or symbols.' };
  const rec = S.world.players[a];
  if (!rec || typeof rec !== 'object') return { ok: false, why: 'No player called ' + (from || '?') + ' has played here.' };
  if (b !== a && S.world.players[b]) return { ok: false, why: 'The name ' + name + ' is taken.' };
  delete S.world.players[a];
  rec.name = name;
  S.world.players[b] = rec;
  S.dirty = true;
  for (const k of ['ops', 'allow', 'bans']) if (S.o[k].includes(a)) S.o[k] = cleanList(S.o[k].map((x) => (x === a ? b : x)));
  const p = findPlayer(S, from);
  if (p) { p.name = name; net.broadcast({ t: 'rename', id: p.id, name }); }
  settingsChanged(S, net);
  S.log(`${from} is now called ${name}`);
  return { ok: true, why: 'Renamed to ' + name + '.' };
}
/* the server-wide setting behind a lock (name, password, skin) */
const lockKey = (f) => ['lockNames', 'lockPasswords', 'lockSkins'][['name', 'password', 'skin'].indexOf(f)];
/* tell a player online what they may not change (after a lock was set) */
function locksSent(S, net, key) {
  for (const p of S.clients.values()) if (p.ready && !p.host && (!key || playerKey(p.name) === key)) net.send(p, { t: 'acct', locks: locksOf(S, p.name) });
}

/* set the time of day for everyone */
function setTime(S, net, v) {
  S.world.time = ((v % 1) + 1) % 1; S.dirty = true;
  net.broadcast({ t: 'time', v: S.world.time });
}

/* a time of day from a word or a number; NaN when it is neither */
function parseTime(a) {
  const words = { day: 0.05, morning: 0.05, noon: 0.25, sunset: 0.5, night: 0.6, midnight: 0.75 };
  return a in words ? words[a] : (a === '' ? NaN : Number(a));
}

/* one player's game mode: remembered with the player, and sent to their game */
function setMode(S, net, p, gm) {
  p.gm = gm;
  const rec = S.world.players[playerKey(p.name)];
  if (rec) { rec.gm = gm; S.dirty = true; }
  net.send(p, { t: 'mode', m: gm });
}

/* the commands: name -> { op (needs an operator), con (the console only), use (the usage line), run(ctx) -> a reply or nothing }.
   ctx = { S, net, c (the player, or null for the console), a (the words after the command), rest (the same as one string), who } */
const COMMANDS = {
  help: { use: '/help', run: ({ S, c }) => {
    const mine = Object.keys(COMMANDS).filter((k) => !COMMANDS[k].alias && (!c ? true : !COMMANDS[k].con && (!COMMANDS[k].op || isOp(S, c))));
    return mine.map((k) => COMMANDS[k].use).join('   ');
  } },
  list: { use: '/list', run: ({ S, c }) => {
    const ps = [...S.clients.values()].filter((p) => p.ready);
    return ps.length ? `${ps.length} of ${S.o.maxPlayers} online: ` + ps.map((p) => p.name + (!c ? ` (${p.addr})` : '')).join(', ') : 'nobody is online';
  } },
  me: { use: '/me <action>', run: ({ S, net, rest, who }) => {
    if (!rest) return 'Usage: /me <action>';
    S.log(`* ${who} ${rest}`); net.broadcast({ t: 'sys', txt: `* ${who} ${rest}` });
  } },
  msg: { use: '/msg <player> <text>', run: ({ S, net, c, a, who }) => {
    const to = findPlayer(S, a[0]), txt = a.slice(1).join(' ');
    if (!a[0] || !txt) return 'Usage: /msg <player> <text>';
    if (!to) return 'No player called ' + a[0] + ' is online.';
    net.send(to, { t: 'chat', id: c ? c.id : 0, from: who, to: to.name, txt, w: 1 });
    return `You whisper to ${to.name}: ${txt}`;
  } },
  say: { op: true, use: '/say <text>', run: ({ S, net, rest }) => {
    if (!rest) return 'Usage: /say <text>';
    S.log('[Server] ' + rest); net.broadcast({ t: 'sys', txt: '[Server] ' + rest });
  } },
  seed: { op: true, use: '/seed', run: ({ S }) => 'Seed: ' + S.world.seed },
  tp: { op: true, use: '/tp [who] <player | x y z>', run: ({ S, net, c, a }) => {
    let who = c, at = a;
    if (a.length === 2 || a.length === 4) { who = findPlayer(S, a[0]); at = a.slice(1); if (!who) return 'No player called ' + a[0] + ' is online.'; }
    if (!who) return 'Usage: /tp <who> <player | x y z>';
    let x, y, z, dim = who.pose ? who.pose.dim : 'over', label;
    if (at.length === 1) {
      const to = findPlayer(S, at[0]);
      if (!to || !to.pose) return 'No player called ' + at[0] + ' is online.';
      if (to.pose.dim !== dim) {   // 6.32: to a player means to where they are, whatever the dimension; never into or out of Puppet Purgatory
        if (to.pose.dim === 'puppet') return to.name + ' is in Puppet Purgatory. Nobody can be sent there.';
        if (dim === 'puppet') return who.name + ' is in Puppet Purgatory and has to find their own way out.';
        if (S.world.gr[to.pose.dim] === false) return 'That dimension is switched off in this world.';
        dim = to.pose.dim;
        if (S.startHost) S.startHost(dim);   // wake the game that runs that dimension, as walking through a portal would
      }
      ({ x, y, z } = to.pose); label = to.name;
    } else if (at.length === 3 && at.every((v) => Number.isFinite(Number(v)))) {
      x = num(Number(at[0]), -3e7, 3e7, 0); y = num(Number(at[1]), 0, 1024, 0); z = num(Number(at[2]), -3e7, 3e7, 0); label = `${x} ${y} ${z}`;
    } else return 'Usage: /tp [who] <player | x y z>';
    net.send(who, { t: 'tp', x, y, z, dim });
    S.log(`${who.name} was teleported to ${label}`);
    return `Teleported ${who.name} to ${label}.`;
  } },
  give: { op: true, use: '/give <player> <item id> [count]', run: ({ S, net, a }) => {
    const to = findPlayer(S, a[0]), id = Number(a[1]), count = a[2] === undefined ? 1 : Number(a[2]);
    if (!a[0] || !Number.isInteger(id) || id < 1 || id > 19999 || !Number.isInteger(count) || count < 1 || count > 999) return 'Usage: /give <player> <item id> [count 1-999]';
    if (!to) return 'No player called ' + a[0] + ' is online.';
    net.send(to, { t: 'give', st: { id, count } });
    S.log(`${to.name} was given ${count} of item ${id}`);
    return `Gave ${count} of item ${id} to ${to.name}.`;
  } },
  gamemode: { op: true, use: '/gamemode <survival | creative | spectator> [player]', run: ({ S, net, c, a }) => {
    const gm = /^(c|creative|1)$/i.test(a[0] || '') ? 'c' : /^(s|survival|0)$/i.test(a[0] || '') ? 's' : /^(sp|spectator|3)$/i.test(a[0] || '') ? 'spectator' : null;
    const to = a[1] ? findPlayer(S, a[1]) : c;
    if (!gm || (!a[1] && !c)) return 'Usage: /gamemode <survival | creative | spectator> [player]';
    if (!to) return 'No player called ' + a[1] + ' is online.';
    setMode(S, net, to, gm);
    const word = gm === 'c' ? 'creative' : gm === 's' ? 'survival' : 'spectator';
    S.log(`${to.name} is now in ${word} mode`);
    return `${to.name} is now in ${word} mode.`;
  } },
  defaultgamemode: { op: true, use: '/defaultgamemode <survival | creative>', run: ({ S, a }) => {
    const gm = /^(c|creative|1)$/i.test(a[0] || '') ? 'c' : /^(s|survival|0)$/i.test(a[0] || '') ? 's' : null;
    if (!gm) return 'Usage: /defaultgamemode <survival | creative>';
    S.world.mode = gm; S.dirty = true;
    if (typeof S.o.onSettings === 'function') S.o.onSettings();
    return 'New players now start in ' + (gm === 'c' ? 'creative' : 'survival') + ' mode.';
  } },
  time: { op: true, use: '/time <day | noon | night | midnight | 0..1>', run: ({ S, net, a }) => {
    const v = parseTime(String(a[0] === 'set' ? a[1] : a[0] || '').toLowerCase());
    if (!Number.isFinite(v)) return 'Usage: /time <day | noon | night | midnight | 0..1>';
    setTime(S, net, v);
    return 'time set';
  } },
  gamerule: { op: true, use: '/gamerule <rule> [value]', run: ({ S, net, a }) => {
    const k = Object.keys(RULES).find((r) => r.toLowerCase() === String(a[0] || '').toLowerCase());
    if (!k) return 'Rules: ' + Object.keys(RULES).join(', ');
    if (a[1] === undefined) return `${k} is ${S.world.gr[k]}`;
    const v = typeof RULES[k] === 'number' ? Number(a[1]) : typeof RULES[k] === 'string' ? String(a[1]).toLowerCase() : a[1] === 'true' ? true : a[1] === 'false' ? false : null;
    if (!(k in cleanRules({ [k]: v }))) return `Usage: /gamerule ${k} ` + (typeof RULES[k] === 'number' ? '<0..100>' : typeof RULES[k] === 'string' ? '<easy | normal | hard>' : '<true | false>');
    // 6.38: DingleCore is chosen in server.json before the server starts; nobody is let into it, or out of it, mid-game
    if (k === 'difficulty' && (v === 'dinglecore' || S.world.gr[k] === 'dinglecore')) return 'DingleCore is locked: it is set in server.json ("rules": { "difficulty": ... }) and needs a restart.';
    S.world.gr[k] = v; S.dirty = true;
    net.broadcast({ t: 'gr', gr: S.world.gr });
    if (typeof S.o.onRules === 'function') S.o.onRules(cleanRules(S.world.gr));
    return `${k} is now ${v}`;
  } },
  setworldspawn: { op: true, use: '/setworldspawn [x y z]', run: ({ S, net, c, a }) => {
    const p = a.length === 3 && a.every((v) => Number.isFinite(Number(v))) ? { x: Number(a[0]), y: Number(a[1]), z: Number(a[2]) } : (!a.length && c && c.pose && c.pose.dim === 'over' ? c.pose : null);
    if (!p) return 'Usage: /setworldspawn [x y z] (in the Overworld)';
    S.world.spawn = { x: num(p.x, -3e7, 3e7, 0), y: num(p.y, 0, 1024, 0), z: num(p.z, -3e7, 3e7, 0) }; S.dirty = true;
    settingsChanged(S, net);
    return `The world spawn is now ${Math.round(S.world.spawn.x)} ${Math.round(S.world.spawn.y)} ${Math.round(S.world.spawn.z)}.`;
  } },
  kick: { op: true, use: '/kick <player> [reason]', run: ({ S, net, a }) => {
    const to = findPlayer(S, a[0]);
    if (!to) return 'no player called ' + (a[0] || '');
    net.drop(to, a.slice(1).join(' ') || 'Kicked by the server.', true);
    return 'kicked ' + to.name;
  } },
  ban: { op: true, use: '/ban <player> [reason]', run: ({ S, net, a }) => {
    const k = playerKey(a[0]);
    if (!k) return 'Usage: /ban <player> [reason]';
    S.o.bans = cleanList([...S.o.bans, k]);
    const to = findPlayer(S, k);
    if (to) net.drop(to, 'You are banned from this server.' + (a.length > 1 ? ' ' + a.slice(1).join(' ') : ''), true);
    settingsChanged(S, net);
    return 'banned ' + k;
  } },
  pardon: { op: true, use: '/pardon <player>', run: ({ S, net, a }) => {
    const k = playerKey(a[0]);
    if (!S.o.bans.includes(k)) return (a[0] || 'nobody') + ' is not banned';
    S.o.bans = S.o.bans.filter((b) => b !== k);
    settingsChanged(S, net);
    return 'pardoned ' + k;
  } },
  banlist: { op: true, use: '/banlist', run: ({ S }) => (S.o.bans.length ? 'Banned: ' + S.o.bans.join(', ') : 'nobody is banned') },
  whitelist: { op: true, use: '/whitelist <on | off | add | remove | list> [player]', run: ({ S, net, a }) => {
    const sub = String(a[0] || '').toLowerCase(), k = playerKey(a[1]);
    if (sub === 'list') return (S.o.whitelist ? 'on: ' : 'off: ') + (S.o.allow.join(', ') || 'nobody listed');
    if (sub === 'on' || sub === 'off') S.o.whitelist = sub === 'on';
    else if (sub === 'add' && k) S.o.allow = cleanList([...S.o.allow, k]);
    else if (sub === 'remove' && k) S.o.allow = S.o.allow.filter((b) => b !== k);
    else return 'Usage: /whitelist <on | off | add | remove | list> [player]';
    settingsChanged(S, net);
    return 'whitelist ' + (S.o.whitelist ? 'on' : 'off') + ': ' + (S.o.allow.join(', ') || 'nobody listed');
  } },
  op: { op: true, use: '/op <player>', run: ({ S, net, a }) => {
    const k = playerKey(a[0]);
    if (!k) return 'Usage: /op <player>';
    S.o.ops = cleanList([...S.o.ops, k]);
    settingsChanged(S, net);
    return k + ' is now an operator';
  } },
  deop: { op: true, use: '/deop <player>', run: ({ S, net, a }) => {
    const k = playerKey(a[0]);
    if (!S.o.ops.includes(k)) return (a[0] || 'nobody') + ' is not an operator';
    S.o.ops = S.o.ops.filter((b) => b !== k);
    settingsChanged(S, net);
    return k + ' is no longer an operator';
  } },
  save: { op: true, use: '/save', run: ({ S }) => {
    S.saveWorld('asked');
    return `${Object.keys(S.world.edits).length} edited chunks, ${Object.keys(S.world.be).length} chests and furnaces, ${Object.keys(S.world.drops).length} dropped items`;
  } },
  export: { op: true, use: '/export', run: ({ S }) => {
    let file = null;
    try { file = S.exportWorld ? S.exportWorld() : null; } catch (e) { return 'Export failed: ' + e.message; }
    return file ? 'The world was written as one file the game can import: ' + file : 'This server keeps no world on disk.';
  } },
  /* 6.49: accounts. The password is plain text in the player's file, and the console (the owner) is shown it */
  account: { op: true, use: '/account <add | password | remove | rename | lock | list> ...', run: ({ S, net, c, a }) => {
    const sub = (a[0] || '').toLowerCase(), name = a[1] || '', k = playerKey(name), rec = k ? S.world.players[k] : null;
    if (sub === 'list') {
      const L = Object.keys(S.world.players).filter((x) => accountOf(S, x));
      if (!L.length) return 'No accounts yet. Make one: /account add <name> <password>';
      const lk = (x) => { const l = (S.world.players[x].locks) || {}; const on = ['name', 'password', 'skin'].filter((y) => l[y]); return on.length ? ' [locked: ' + on.join(', ') + ']' : ''; };
      return L.length + ' account' + (L.length === 1 ? '' : 's') + (S.o.accounts ? '' : ' (accounts are off: anyone may also join by name)') + ': ' +
        L.map((x) => (S.world.players[x].name || x) + (c ? '' : ' (password: ' + S.world.players[x].password + ')') + lk(x)).join(', ');
    }
    if (sub === 'add') {
      const nm = cleanName(name), pw = a[2];
      if (!nm) return 'Usage: /account add <name> <password>';
      const bad = a.length > 3 ? passwordProblem(' ') : passwordProblem(pw);   // the line was split on spaces: more words is a password with a space
      if (bad) return bad;
      if (accountOf(S, nm)) return nm + ' already has an account (/account password ' + nm + ' <new> sets a new password)';
      const old = S.world.players[playerKey(nm)];
      if (old && typeof old === 'object') old.password = pw; else S.world.players[playerKey(nm)] = { name: nm, password: pw };
      S.dirty = true;
      return 'Account ' + nm + ' made' + (old ? ' (for the player who has played here before: everything they had is theirs)' : '') + '. They log in with that name and password.';
    }
    if (sub === 'password') {
      if (!accountOf(S, name)) return 'Usage: /account password <account> <new password>';
      const bad = a.length > 3 ? passwordProblem(' ') : passwordProblem(a[2]);
      if (bad) return bad;
      rec.password = a[2]; S.dirty = true;
      return 'New password set for ' + (rec.name || name);
    }
    if (sub === 'remove') {
      if (!accountOf(S, name)) return 'No account called ' + (name || '?');
      delete rec.password; delete rec.locks; S.dirty = true;
      const p = findPlayer(S, name);
      if (p && S.o.accounts) net.drop(p, 'Your account was removed.', true);
      return 'The account ' + (rec.name || name) + ' is gone (what they had is kept, in case it comes back)';
    }
    if (sub === 'rename') {
      if (!rec) return 'Usage: /account rename <name> <new name>';
      return renameAccount(S, net, name, a[2] || '').why;
    }
    if (sub === 'lock') {
      const what = (a[2] || '').toLowerCase(), on = (a[3] || 'on').toLowerCase() !== 'off', field = { name: 'name', password: 'password', skin: 'skin' }[what];
      if (!field || !name) return 'Usage: /account lock <name | *> <name | password | skin> [on | off]   (* is everyone)';
      if (name === '*') {
        S.o[lockKey(field)] = on;
        settingsChanged(S, net); locksSent(S, net, null);
        return on ? 'Nobody may change their own ' + field + ' now' : 'Everyone may change their own ' + field + ' again';
      }
      if (!rec) return 'No player called ' + name + ' has played here.';
      const l = { ...(rec.locks || {}) };
      if (on) l[field] = true; else delete l[field];
      if (Object.keys(l).length) rec.locks = l; else delete rec.locks;
      S.dirty = true; locksSent(S, net, k);
      return (rec.name || name) + (on ? ' may no longer change their ' : ' may change their ') + field + (on ? '' : ' again') + (S.o[lockKey(field)] ? ' (but it is locked for everyone)' : '');
    }
    return 'Usage: /account <add | password | remove | rename | lock | list> ...';
  } },
  setskin: { op: true, use: '/setskin <player> <reset | file.png>', run: ({ S, net, c, a }) => {
    if (!a[0] || !a[1]) return 'Usage: /setskin <player> reset' + (c ? '' : '   or   /setskin <player> <a .png file, next to server.json>');
    if (a[1].toLowerCase() === 'reset') return setSkin(S, net, a[0], '');
    if (c) return 'A skin from a file can only be given from the console or the server window.';
    let png;
    try { png = fs.readFileSync(path.resolve(S.o.data || '.', a[1])).toString('base64'); } catch (e) { return 'Could not read ' + a[1] + ': ' + e.message; }
    return setSkin(S, net, a[0], png);
  } },
  stop: { con: true, use: '/stop', run: () => undefined },   // the program itself stops (lib/cli.mjs); listed here for /help
  w: { alias: 'msg' }, tell: { alias: 'msg' }, whisper: { alias: 'msg' }, gm: { alias: 'gamemode' }, players: { alias: 'list' }, '?': { alias: 'help' },
  unban: { alias: 'pardon' },
};

/* Run one command line (with or without the leading slash). c is the player who typed it, or null for the console.
   Returns the reply as a string ('' when the command said nothing). Never throws on bad input. */
export function runCommand(S, net, c, line) {
  const words = cleanText(line, 200).replace(/^\//, '').split(/\s+/).filter(Boolean);
  let name = (words.shift() || '').toLowerCase();
  if (!name) return '';
  if (COMMANDS[name] && COMMANDS[name].alias) name = COMMANDS[name].alias;
  const cmd = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : null;
  if (!cmd) return 'Unknown command. Type /help';
  if (c && (cmd.con || (cmd.op && !isOp(S, c)))) return 'You do not have permission to use /' + name + '.';
  if (c) { const shown = name === 'account' && /^(add|password)$/i.test(words[0] || '') ? words.map((x, i) => (i === 2 ? '****' : x)) : words;   // 6.49: no passwords in the log
    S.log(`${c.name} ran /${name}${shown.length ? ' ' + shown.join(' ') : ''}`); }
  const out = cmd.run({ S, net, c, a: words, rest: words.join(' '), who: c ? c.name : 'Server' });
  return typeof out === 'string' ? out : '';
}
