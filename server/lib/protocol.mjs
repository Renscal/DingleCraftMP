// protocol.mjs: the game protocol. What each message from a player means, what gets stored, and what everyone else is told.
// Messages are JSON objects {t: '<type>', ...}. It knows nothing about sockets: it is handed
//   S    the server's state (lib/server.mjs): { o (settings), log, world, dirty, clients (id -> client), nextId,
//        editCount, gameVersion, locks (block key -> the id of the player using that chest) }
//   net  { send(client, msg), broadcast(msg, exceptClient, onlyIf), drop(client, why, tell) }
//
//   from a player                                 to players
//   hello {proto, v, name, user?, pass?, rd}      welcome, perm, edits..., bes, drops, ready   (to the one joining)
//                                                 join, sys                                    (to the others)
//                                                 or login {user, why, accounts} (6.49: who are you? a username and
//                                                 password are needed: accounts are on, or the name is an account)
//   login {user, pass}                            the same as hello, or login again (at most 5 tries, one a second)
//   acct {name} | {pass, old}                     acct {ok, why, locks?} (to them); rename {id, name} (to everyone)
//   pose {x y z yaw pitch dim held hp fl ar rv ry rh rid rp rr}   pose (+id, ms): at once to players nearby, once a second to the rest;
//                                                 edits (s:1), bes and drops (add:1) for the chunks that came into range
//   ping {n, ms}                                  pong {n}  (the game times the round trip and reports it in the next ping)
//   rd {v}                                        -         (how far that player's game draws, in chunks)
//   edits {e: [[chunkKey, localKey, id, by?]...]} edits     (to players who have that chunk; by 1: a player's own hand did it;
//                                                 id is the block id plus its meta << 8, 0..4095: a liquid carries its level)
//   open {k}                                      be, lock {k, ok, by}   (a chest is used by one player at a time)
//   close {k}                                     -
//   be {k, v|null}                                be        (or be back to the sender if someone else holds the lock)
//   drop {id dim x y z vx vy vz st by?}           drop      (or undrop back to the sender if it was refused; by: thrown on
//                                                 purpose, so the thrower cannot take it back for 2 seconds)
//   dropAt {id x y z}                             -         (only remembered: where it came to rest)
//   take {id, gone?}                              took (to the taker), undrop (to everyone else); the taker must be near
//   chat {txt}                                    chat
//   cmd {txt}                                     sys       (a slash command: lib/commands.mjs)
//   hit {to, dmg, kx, kz, shot?}                  hit       (to that one player, if PvP is on and they are in reach)
//   save {player}                                 -         (stored by name)
//   spawn {x y z}                                 perm      (the first player's game picks the world spawn)
//   time {v}                                      time      (operators, or anyone when Cheats is on; else time back)
//   gr {gr}                                       gr        (the same rule)
//   sleep {}                                      sys, and time when enough players are asleep
//   death {how, by}                               sys       (the wording is the server's)
//   mobs {m: [[id, type, x, y, z, yaw, hp...]]}   mobs (+from)   (to players nearby: the sender's game runs those mobs)
//   mgone {ids, dead}                             mgone
//   mgive {to, m}                                 mgive     (to that player: their game runs this mob from now on)
//   mhit {to, id, dmg, kx, kz}                    mhit      (to the player whose game runs that mob)
//   boom {x y z r mob}                            boom      (to players nearby, with hurt: may it damage them)
// The server also sends on its own: time (every 5 s), undrop (an item's 5 minutes are up), leave, sys, kick, to one
// player tp / give / mode (commands), and mheir {from} to the player nearest to one who just left (their mobs are yours).
// Every type has a per-second limit (RATE in lib/config.mjs, or its own counter here); lib/server.mjs counts the total.
//
// The server's own game (6.13, lib/host.mjs) is a player too, with id 0 and c.host set. Since 6.17 there is one per
// dimension (S.hosts: 'over', 'nether', 'aether'; c.hdim says which), each started when the first player enters, and "player
// 0" means the game of the sender's own dimension. It runs that dimension's mobs, so:
//   it may send only edits, drop, dropAt, take (gone), mobs, mgone, boom, and three of its own:
//     hurt {to, dmg, kx, kz, by, how}   hurt      (to that player: a mob it runs hit them)
//     xp {to, n}                        xp        (to that player: they picked up XP it dropped)
//     hsnap {mobs}                      -         (every mob it has, kept for the next save: entities/ in the world folder)
//   its mobs go to each player with only the ones within range of that player; no limits apply to it;
//   it is sent join, leave, pose, edits, be, drop, undrop, time, gr, and the mgive and mhit addressed to player 0.
//
// What flies and what you ride (6.14):
//   fx {f: [[id, kind, x, y, z, vx, vy, vz, gravity, life]...]}   fx (+from)   (to players nearby: a copy to look at)
//   fxgone {ids}                                  fxgone
//   and, only on a server that runs its own game, in the Overworld (S.vown: vehicle id -> the player riding it):
//   vgive {v: [id, kind, x, y, z, yaw, hp]}       -> the server's game (a new vehicle, or one just got off)
//   vtake {id, v}                                 -> the server's game; or vno {id} back if someone else is riding it
//   vfree {id}                                    -> the server's game (the rider left the dimension)
//   vehs {v: [...]}                               vehs (+from)  (a rider's own vehicle to players nearby and the server's
//                                                 game; the server's game: the parked ones, to each player in range)
//   vgone {ids}                                   vgone
//   vhit {id, dmg}                                vhit      (to whoever runs that vehicle: its rider, else the server's game)
//
// The world the server runs (6.15, the Overworld of a server with its own game): its game flows the water and drops the
// sand (their results are ordinary edits from player 0), cooks every furnace nobody has open (be from player 0), and burns:
//   ign {c: [[x, y, z]...]}                       -> the server's game (a player's game asks for these cells to be lit)
//   fire {c}  (the server's game)                 fire      (to players nearby: these are alight)
// What the world remembers (6.16): any game may add to one of the world's lists (and take a spawner off its list);
//   skin {png}                                    skin (+id)  (a player's skin, base64 of a small PNG, or '' for the default)
//   wd {k, add, del}                              wd        (to everyone else, and the server's game)
//   mkt {p, mu}  (the server's game)              mkt       (the stock prices, to everyone)
// A chest that already has a record can only be rewritten by the player who has it open: a later visitor's game, which
// filled the same chest with loot of its own, is sent the server's copy back. Loot is rolled once.
import { PROTO, DAY_LEN, MIN_GAME, LIMITS, RATE, RULES, CK_RE, LK_RE, BK_RE, DROP_ID_RE, DIMS, DIM_PFX, cleanRules, cmpVer } from './config.mjs';
import { num, cleanName, cleanText, cleanStack, cleanMobs, cleanSkin, playerKey, cleanWork, WORK_MAXN } from './world.mjs';
import { runCommand, isOp, protRadius, permOf, renameAccount, checkPassword, isHashed, hashPassword, hashPasswordLater, passwordRule, accountOf, locksOf, passwordProblem, setSkin } from './commands.mjs';

export { playerKey, setSkin };

/* the name a joining player gets: their own, or name_2, name_3... if someone online already has it */
function uniqueName(S, want) {
  let name = want || 'Player';
  const taken = new Set([...S.clients.values()].map((c) => playerKey(c.name || '')));
  for (let i = 2; taken.has(playerKey(name)); i++) name = (want || 'Player').slice(0, 13) + '_' + i;
  return name;
}

/* ----- accounts (6.49) -----
   An account is a player record (playerdata/<name>.json) with a password in it (6.61: its scrypt hash), made by an operator
   (/account add, lib/commands.mjs, or the server window). With "accounts" on, nobody joins without one; with it off anyone
   may join by name as before, except as a name that is an account. */
/* a player record as their own game may see it: never the password or the locks */
const ownView = (rec) => { if (!rec || typeof rec !== 'object') return rec || null; const { password, locks, ...r } = rec; return r; };
/* a login: hello again, with the username and password the player typed (one try a second) */
function login(S, net, c, m, now) {
  const user = typeof m.user === 'string' ? m.user : '';
  if (now - (c.loginT || 0) < 1000) return net.send(c, { t: 'login', user: cleanName(user), why: 'Wait a second between tries.', accounts: !!S.o.accounts });
  c.loginT = now;
  hello(S, net, c, { ...c.helloM, user, pass: typeof m.pass === 'string' ? m.pass : '' });
}

/* are two poses in the same dimension and within dist blocks of each other (flat distance, like the game's own checks)? */
function near(a, b, dist) {
  return !!a && !!b && a.dim === b.dim && Math.hypot(a.x - b.x, a.z - b.z) <= dist;
}

/* what the server's own game may send, and what only it may send */
const HOST_SENDS_673 = ['crw'];   // 6.73: the server's game mints found works
const HOST_SENDS = new Set([...HOST_SENDS_673, 'edits', 'drop', 'dropAt', 'take', 'mobs', 'mgone', 'boom', 'hurt', 'xp', 'hsnap', 'fx', 'fxgone', 'vehs', 'vgone', 'be', 'fire', 'wd', 'mkt']);
/* the lists the world keeps (na_data.js in the game): found structures, dead bosses, spawners, nuke sites */
export const WORLD_LISTS = ['vseen', 'nseen', 'aseen', 'pseen', 'wdseen', 'lsseen', 'rseen', 'infkill', 'valkill', 'spw', 'nukes'];
/* entries for one of them from a game: short strings or whole numbers, at most 200 */
const cleanList200 = (list) => (Array.isArray(list) ? list.filter((v) => (typeof v === 'string' && v.length > 0 && v.length <= 40 && !/[\u0000-\u001f]/.test(v)) || Number.isInteger(v)).slice(0, 200).map(String) : []);
/* the kinds of thing that fly, and a vehicle's id */
const DIS_KINDS = new Set(['tornado', 'tsunami', 'volcano', 'fire']);   // 6.72: the disasters a Disaster Sphere starts
const FX_KINDS = new Set(['arrow', 'blt', 'nade', 'tnt', 'fireb', 'lavab', 'rock', 'abomb', 'xp', 'fall', 'beam']);   // beam: laser eyes (6.52)
/* a list of block cells [[x, y, z]...] from a game, at most 64, whole numbers only */
const cleanCells = (list) => (Array.isArray(list) ? list.filter((c) => Array.isArray(c) && c.length === 3 && c.every(Number.isInteger)).slice(0, 64) : []);
const VEH_ID_RE = /^[a-z0-9]{1,8}v[a-z0-9]{1,8}$/;
/* one flying thing as a game announces it, or null */
function cleanFx(a) {
  if (!Array.isArray(a) || (a.length !== 10 && !(a.length === 11 && a[1] === 'fall')) || typeof a[0] !== 'string' || !/^[a-z0-9]{1,8}f[a-z0-9]{1,8}$/.test(a[0]) || !FX_KINDS.has(a[1])) return null;
  for (let i = 2; i < a.length; i++) if (!Number.isFinite(a[i])) return null;
  return a;
}
/* one vehicle as a game describes it: [id, kind, x, y, z, yaw, hp, speed?], or null */
function cleanVeh(a) {
  if (!Array.isArray(a) || a.length < 7 || a.length > 8 || typeof a[0] !== 'string' || !VEH_ID_RE.test(a[0]) || !RIDES.has(a[1])) return null;
  for (let i = 2; i < a.length; i++) if (!Number.isFinite(a[i])) return null;
  return a;
}
/* the server's own game, if it is running */
const hostOf = (S, dim) => { const h = S.hosts.get(dim || 'over'); return h && !h.stopped ? h.c : null; };
const HOST_ONLY = new Set(['hurt', 'xp', 'hsnap', 'mkt', 'fire']);
/* the player a message is addressed to: a real one, or the server's own game (id 0) */
const peerOf = (S, id, c) => (id === 0 ? hostOf(S, c.host ? c.hdim : c.pose && c.pose.dim) : S.clients.get(id));   // player 0 is the game of the sender's own dimension

/* what a player can be seen riding (the game's vehicle kinds) */
const RIDES = new Set(['car', 'skate', 'cart', 'boat', 'plane']);

/* is it night (the game's sunUp, src/core/p07a_render_sound.js, turned around)? */
/* full night: after the sunset (0.5 to 0.575 of a day) and before the sunrise (0.925 to 1). The game's dayRamp, src/core/p07a_render_sound.js */
const isNight = (time) => { const f = ((time % 1) + 1) % 1; return f >= 0.575 && f <= 0.925; };

/* the chunk key a block key ("x,y,z", with the same dimension prefix) lies in; '' if it is not a block key */
function beChunk(k) {
  const q = /^([a-z];)?(-?\d+),-?\d+,(-?\d+)$/.exec(k);
  return q ? (q[1] || '') + Math.floor(q[2] / 16) + ',' + Math.floor(q[3] / 16) : '';
}
/* ... and the one a dropped item lies in */
const dropChunk = (d) => (DIM_PFX[d.dim] || '') + Math.floor(d.x / 16) + ',' + Math.floor(d.z / 16);

/* Send a player what the world holds in every chunk that has come within their view and that they do not have yet: the
   block edits, the chests and furnaces, the dropped items. c.sent is the set of chunk keys they have (null: they were sent
   the whole world). Cheap unless they crossed into a new chunk. Edits sent this way carry s:1, so a game that has already
   built the chunk applies them without side effects; bes and drops carry add:1 ("more of them", not "all of them").
   The set is trimmed now and then to the chunks around the player, so it does not grow for as long as they travel; a
   chunk that was trimmed and comes back into view is simply sent again. */
function syncAround(S, net, c, dim, x, z) {
  if (!c.sent) return;
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16), at = dim + ':' + cx + ',' + cz + ':' + c.rd;
  if (c.sk === at) return;
  c.sk = at;
  const pfx = DIM_PFX[dim] || '', r = c.rd, edits = S.world.edits, fresh = new Set();
  if (c.sent.size > 3 * (2 * r + 1) * (2 * r + 1)) {
    const keep = r + LIMITS.sentSlack;
    for (const k of c.sent) {
      const here = pfx ? k.startsWith(pfx) : k[1] !== ';', p = (here ? k.slice(pfx.length) : '').split(',');
      if (!here || Math.abs(p[0] - cx) > keep || Math.abs(p[1] - cz) > keep) c.sent.delete(k);
    }
  }
  let batch = [];
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const k = pfx + (cx + dx) + ',' + (cz + dz);
    if (c.sent.has(k)) continue;
    c.sent.add(k); fresh.add(k);
    const ed = edits[k];
    if (!ed) continue;
    for (const lk of Object.keys(ed)) {
      batch.push([k, lk, ed[lk]]);
      if (batch.length >= LIMITS.syncBatch) { net.send(c, { t: 'edits', e: batch, s: 1 }); batch = []; }
    }
  }
  if (batch.length) net.send(c, { t: 'edits', e: batch, s: 1 });
  const { be, drops } = S.world, bes = {}, ds = [];
  let nb = 0;
  for (const k of Object.keys(be)) if (fresh.has(beChunk(k))) { bes[k] = be[k]; nb++; }
  if (nb) net.send(c, { t: 'bes', m: bes, add: 1 });
  for (const id of Object.keys(drops)) { const d = drops[id]; if (fresh.has(dropChunk(d))) ds.push({ id, dim: d.dim, x: d.x, y: d.y, z: d.z, st: d.st }); }
  if (ds.length) net.send(c, { t: 'drops', d: ds, add: 1 });
}

/* The first message of every connection. Refuse (with a reason the player sees) or let them in: then the world goes out in
   order (welcome, their rights, the block edits around them in batches, the block entities, the dropped items, ready) and
   only after that does the client start receiving live broadcasts, so nothing is missed and nothing arrives early. */
function hello(S, net, c, m) {
  const { o, world } = S;
  if (m.proto !== PROTO) return net.drop(c, 'This game and this server speak different multiplayer versions. Update both.', true);
  if (typeof m.v !== 'string' || cmpVer(m.v, MIN_GAME) < 0) return net.drop(c, `This server needs DINGLECRAFT ${MIN_GAME} or newer.`, true);
  if (S.gameVersion && m.v !== S.gameVersion) return net.drop(c, `This server runs DINGLECRAFT ${S.gameVersion}; you have ${m.v}. Open the game from the server's own address to get the right one.`, true);
  /* 6.49: who is this? With accounts on: a username and password. With them off: the name they typed, unless that name
     is an account, which needs its password all the same. No answer yet, or a wrong one: ask (login), up to 5 times. */
  const user = cleanName(S.o.accounts ? m.user : (m.user || m.name)), acct = accountOf(S, user);
  if (S.o.accounts || acct) {
    const tried = typeof m.pass === 'string' && m.pass !== '';
    /* 6.61: the password is checked off the main thread, then hello runs again with the answer (for that same record: one
       renamed or removed meanwhile is a wrong login). One check at a time per connection. */
    if (tried && !m.checked) {
      if (c.checking) return;
      c.checking = true;
      checkPassword(acct, m.pass).then((ok) => { c.checking = false; if (!c.closed && !c.id) hello(S, net, c, { ...m, checked: { rec: acct, ok } }); });
      return;
    }
    if (!acct || !m.checked || m.checked.rec !== acct || !m.checked.ok) {
      if (tried) { c.loginN = (c.loginN || 0) + 1; S.log(`  ${c.addr}: wrong login (${user || 'no name'})`); }
      if (c.loginN >= 5) return net.drop(c, 'Too many wrong logins. Ask the server\'s owner if you have forgotten yours.', true);
      c.helloM = { ...m, user: undefined, pass: undefined, checked: undefined };
      return net.send(c, { t: 'login', user: user || '', why: tried ? 'Wrong username or password.' : '', accounts: !!S.o.accounts });
    }
    if (!isHashed(acct.password)) { acct.password = hashPassword(m.pass); S.dirty = true; }   // a plain one written into the file by hand
  }
  const want = acct ? cleanName(acct.name) || user : user, key = playerKey(want || 'Player');
  if (o.bans.includes(key) || o.bans.includes(String(c.addr).toLowerCase())) { S.log(`  ${c.addr}: banned (${want})`); return net.drop(c, 'You are banned from this server.', true); }
  if (o.whitelist && !o.allow.includes(key) && !o.ops.includes(key)) return net.drop(c, 'You are not on this server\'s whitelist.', true);
  /* The same name again. If the one already here has gone quiet (a dropped connection the server has not noticed yet) the
     new one takes its place, like Minecraft's "logged in from another location". If it is alive, they are two people who
     both kept the default name, and the newcomer becomes name_2. */
  const twin = [...S.clients.values()].find((p) => playerKey(p.name) === key);
  if (twin && (acct || Date.now() - twin.seen > 3000)) net.drop(twin, 'You logged in from another location.', true);   // an account is one person: the newest login wins
  if (S.clients.size >= o.maxPlayers) return net.drop(c, 'The server is full.', true);
  if (!S.gameVersion) { S.gameVersion = m.v; S.log(`game version pinned to ${m.v} (the first player's)`); }
  c.name = acct ? want : uniqueName(S, want);
  delete c.helloM; delete c.checking;
  c.id = S.nextId++;
  c.rd = Math.round(num(m.rd, 4, 32, 0)) || o.viewChunks;
  S.clients.set(c.id, c);
  const saved = world.players[playerKey(c.name)] || null;
  c.gm = saved && (saved.gm === 'c' || saved.gm === 's' || saved.gm === 'spectator') ? saved.gm : null;
  c.skin = saved && typeof saved.skin === 'string' ? saved.skin : '';   // 6.49: what they wore last time (or what an operator gave them)
  const { edits, be, players, drops, spawn, crn, crfree, crv, ...meta } = world;   // meta: seed, mode, time, rules and whatever else the save carried (6.73: with crw, the works, less who owns each)
  if (meta.crw) meta.crw = Object.fromEntries(Object.entries(meta.crw).map(([n, r]) => [n, pubWork(r)]));
  net.send(c, { t: 'welcome', proto: PROTO, id: c.id, name: c.name, server: o.name, motd: o.motd, pvp: !!o.pvp, host: S.hdims.length > 0, hdims: S.hdims,
    world: { ...meta, mode: c.gm || world.mode }, player: ownView(saved),
    acct: { accounts: !!S.o.accounts, account: !!acct, locks: locksOf(S, c.name), skin: c.skin, rule: passwordRule(S.o.passwordSecurity) },   // 6.61: what a new password needs
    players: [...S.clients.values()].filter((p) => p !== c && p.ready).map((p) => ({ id: p.id, name: p.name, pose: p.pose, ...(p.skin ? { skin: p.skin } : {}) })) });
  net.send(c, permOf(S, c));
  /* where they will appear: their saved place, else the world spawn. Without either (the very first player of a world that
     has no spawn yet) there is nothing to centre on, so they get everything. */
  const at = saved && Number.isFinite(saved.x) && Number.isFinite(saved.z) ? { dim: DIMS.has(saved.dim) ? saved.dim : 'over', x: saved.x, z: saved.z }
    : spawn ? { dim: 'over', x: spawn.x, z: spawn.z } : null;
  if (at) { c.sent = new Set(); syncAround(S, net, c, at.dim, at.x, at.z); }
  else {
    let batch = [];
    for (const k of Object.keys(edits)) {
      const ed = edits[k];
      for (const lk of Object.keys(ed)) {
        batch.push([k, lk, ed[lk]]);
        if (batch.length >= LIMITS.syncBatch) { net.send(c, { t: 'edits', e: batch }); batch = []; }
      }
    }
    if (batch.length) net.send(c, { t: 'edits', e: batch });
    net.send(c, { t: 'bes', m: be });
    net.send(c, { t: 'drops', d: Object.keys(drops).map((id) => { const d = drops[id]; return { id, dim: d.dim, x: d.x, y: d.y, z: d.z, st: d.st }; }) });
  }
  net.send(c, { t: 'ready' });
  c.ready = true;                        // from here on it also gets every live broadcast, in order, behind the sync
  grantWorks(S, net, c);                 // 6.73
  S.log(`+ ${c.name} joined from ${c.addr} (${saved ? 'returning' : 'new'} player); ${S.clients.size} online`);
  net.broadcast({ t: 'join', id: c.id, name: c.name }, c);
  net.broadcast({ t: 'sys', txt: c.name + ' joined the game' }, c);
}

/* ---- Creativity works (6.73) ---- */
/* a work as the players see it (without who owns it) */
function pubWork(r) { const { o, ...pub } = r; return pub; }
/* top up the work numbers a game holds (LIMITS.workReserve), from the given-back ones first, and tell it */
export function grantWorks(S, net, c) {
  const w = S.world;
  if (!w.crw) w.crw = {};
  if (!Array.isArray(w.crfree)) w.crfree = [];
  if (!(w.crn > 0)) w.crn = 1;
  c.crRes = (c.crRes || []).filter((n) => !w.crw[n]);
  while (c.crRes.length < LIMITS.workReserve) {
    let n = 0;
    while (w.crfree.length && !n) { const f = w.crfree.shift(); if (Number.isInteger(f) && !w.crw[f]) n = f; }
    if (!n && w.crn <= WORK_MAXN) n = w.crn++;
    if (!n) break;
    c.crRes.push(n); S.dirty = true;
  }
  net.send(c, { t: 'crres', n: c.crRes });
}
/* a game's new, changed, finished or thrown-away work: who may, and what then goes to everyone */
function takeWork(S, net, c, m) {
  const w = S.world, n = m.n;
  if (!Number.isInteger(n) || n < 1 || n > WORK_MAXN) return;
  if (!w.crw) w.crw = {};
  const cur = w.crw[n], me = c.host ? '' : playerKey(c.name), back = () => net.send(c, { t: 'crw', n, r: cur ? pubWork(cur) : null });
  if (m.r == null) {                      // thrown away: only an unfinished work, only by its owner
    if (!cur || cur.st === 'done' || cur.o !== me) return back();
    delete w.crw[n]; S.dirty = true;
    net.broadcast({ t: 'crw', n, r: null }, c);
    return;
  }
  const r = cleanWork(m.r);
  if (!r) return back();
  if (cur) {
    if (cur.o !== me || cur.st === 'done' || cur.k !== r.k || (r.k === 'art' && (cur.w !== r.w || cur.h !== r.h))) return back();   // a finished work never changes
  } else {
    const i = (c.crRes || []).indexOf(n);
    if (i < 0 || Object.keys(w.crw).length >= LIMITS.works) return back();
    c.crRes.splice(i, 1);
  }
  const was = cur ? JSON.stringify(cur).length : 0;
  let total = 0; for (const k of Object.keys(w.crw)) total += JSON.stringify(w.crw[k]).length;
  if (total - was + JSON.stringify(r).length > LIMITS.workBytes) return back();
  const told = r.by;
  if (!c.host && r.st === 'done') r.by = cleanText(c.name, 24);   // a finished work is signed by the player who made it, whatever their game wrote
  w.crw[n] = { ...r, o: me }; S.dirty = true;
  net.broadcast({ t: 'crw', n, r: pubWork(w.crw[n]) }, r.by !== told ? null : c);   // the maker hears it back only when the server changed it
  if (!cur) grantWorks(S, net, c);
}

/* a player is gone (called by lib/server.mjs when a connection ends, before the others are told):
   - whatever they held open is free again;
   - if their game did not get to save on the way out (a crash, a dropped line), their saved place becomes where the
     server last saw them, so they do not come back a minute's walk behind. Only within one dimension: the rest of a
     saved player belongs to the dimension it was saved in;
   - the mobs their game was running go to the nearest player who can see them (mheir). */
export function forget(S, net, c) {
  for (const [k, id] of S.locks) if (id === c.id) S.locks.delete(k);
  if (Array.isArray(c.crRes) && c.crRes.length) { const w = S.world; if (!Array.isArray(w.crfree)) w.crfree = []; for (const n of c.crRes) if (!w.crw || !w.crw[n]) w.crfree.push(n); c.crRes = []; S.dirty = true; }   // 6.73: numbers not used are given back
  for (const [vid, id] of S.vown) if (id === c.id) { S.vown.delete(vid); for (const h of S.hosts.values()) if (!h.stopped) net.send(h.c, { t: 'vfree', id: vid }); }   // the vehicle they sat on is the server's again
  const p = c.pose, sv = S.world.players[playerKey(c.name)];
  if (!p) return;
  if (sv && typeof sv === 'object' && !(p.fl & 4) && (sv.dim || 'over') === p.dim) { sv.x = p.x; sv.y = p.y; sv.z = p.z; sv.yaw = p.yaw; sv.pitch = p.pitch; S.dirty = true; }
  let heir = null, hd = LIMITS.mobRange;
  for (const q of S.clients.values()) {
    if (q === c || !q.ready || !q.pose || q.pose.dim !== p.dim || (q.pose.fl & 36)) continue;   // not the dead (4), not the paused (32)
    const d = Math.hypot(q.pose.x - p.x, q.pose.z - p.z);
    if (d <= hd) { hd = d; heir = q; }
  }
  if (heir) net.send(heir, { t: 'mheir', from: c.id });
}

/* who holds the lock on this block entity right now, or null. A holder who has left, or walked away, has let go. */
function lockHolder(S, k) {
  const p = S.clients.get(S.locks.get(k));
  if (p && p.ready) {
    const q = /(-?\d+),-?\d+,(-?\d+)$/.exec(k);
    if (!p.pose || !q || Math.hypot(p.pose.x - Number(q[1]), p.pose.z - Number(q[2])) <= LIMITS.lockReach) return p;
  }
  S.locks.delete(k);
  return null;
}

/* enough players asleep? Then it is morning for everyone. Otherwise say how many more it takes. */
function sleepVote(S, net, c, now) {
  const { o, world } = S;
  if (!isNight(world.time)) return net.send(c, { t: 'sys', txt: 'You can only sleep at night.' });
  c.sleepT = now; c.sleepAt = c.pose;
  const online = [...S.clients.values()].filter((p) => p.ready);
  const asleep = online.filter((p) => p.sleepT && now - p.sleepT < LIMITS.sleepVote * 1000 && (!p.sleepAt || !p.pose || near(p.sleepAt, p.pose, 4)));
  const need = Math.max(1, Math.ceil(online.length * num(o.sleepPercent, 1, 100, 100) / 100));
  if (asleep.length < need) return net.broadcast({ t: 'sys', txt: `${c.name} is sleeping (${asleep.length} of the ${need} it takes to skip the night)` });
  for (const p of online) { p.sleepT = 0; p.sleepAt = null; }
  world.time = 0.05; S.dirty = true;
  net.broadcast({ t: 'time', v: world.time, slept: 1 });
  net.broadcast({ t: 'sys', txt: 'Everyone slept through the night.' });
}

/* the words for a death. Only the cause and a mob's name come from the player's game; the sentence is the server's. */
function deathText(c, m, now) {
  const by = typeof m.by === 'string' && /^[A-Za-z][A-Za-z '-]{0,23}$/.test(m.by) ? m.by : '';
  const pk = c.lastHit && now - c.lastHit.t < 5000 ? c.lastHit : null;
  if (pk) return `${c.name} was ${pk.shot ? 'shot' : 'slain'} by ${pk.name}`;
  switch (m.how) {
    case 'fall': return `${c.name} fell from a high place`;
    case 'drown': return `${c.name} drowned`;
    case 'lava': return `${c.name} tried to swim in lava`;
    case 'void': return `${c.name} fell out of the world`;
    case 'tnt': return `${c.name} blew up`;
    case 'arrow': return by ? `${c.name} was shot by ${by}` : `${c.name} was shot`;
    case 'mob': case 'melee': return by ? `${c.name} was slain by ${by}` : `${c.name} died`;
    default: return `${c.name} died`;
  }
}

/* at most n of something per second for one player (k names the counter). false = over the limit, drop it. */
function allow(c, k, n, now) {
  const r = c.rate[k] || (c.rate[k] = { t: 0, n: 0 });
  if (now - r.t >= 1000) { r.t = now; r.n = 0; }
  return ++r.n <= n;
}

/* one mob as a player's game describes it: a short array of numbers and short strings, or null */
function cleanMob(a) {
  if (!Array.isArray(a) || a.length < 7 || a.length > 12) return null;
  for (const v of a) if (!(typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && v.length <= 24)) return null;
  return a;
}

/* one message from a client. size is its length in characters (for the per-type limits). Anything malformed is ignored. */
export function handleMessage(S, net, c, m, size) {
  if (!m || typeof m.t !== 'string') return;
  if (c.host) { if (!HOST_SENDS.has(m.t)) return; }
  else {
    if (!c.ready) {
      if (m.t === 'hello' && !c.id && !c.helloM) hello(S, net, c, m);
      else if (m.t === 'login' && !c.id && c.helloM) login(S, net, c, m, Date.now());
      return;
    }
    if (HOST_ONLY.has(m.t)) return;
  }
  const { o, world } = S;
  const now = Date.now();
  if (!c.host && RATE[m.t] && !allow(c, m.t, RATE[m.t], now)) return;
  switch (m.t) {
    case 'ping': {                     // the game times the answer; what it measured last time rides along for the player list
      c.ms = Math.round(num(m.ms, 0, 9999, c.ms));
      return net.send(c, { t: 'pong', n: num(m.n, 0, 1e15, 0) });
    }
    case 'pose': {                     // where a player is and what they look like right now: relayed, never stored on disk
      if (now - c.poseT < 25) return;  // 40 a second is plenty
      c.poseT = now;
      const was = c.pose;
      c.pose = { x: num(m.x, -3e7, 3e7, 0), y: num(m.y, -256, 1024, 0), z: num(m.z, -3e7, 3e7, 0), yaw: num(m.yaw, -1e4, 1e4, 0), pitch: num(m.pitch, -2, 2, 0),
        dim: DIMS.has(m.dim) ? m.dim : 'over', held: num(m.held, 0, 99999, 0) | 0, hp: num(m.hp, 0, 9999, 20), fl: num(m.fl, 0, 255, 0) | 0, ms: c.ms };
      /* what they wear (four item ids, 0 for a bare slot) and what they ride: only sent on when there is something to say */
      if (Array.isArray(m.ar) && m.ar.length === 4 && m.ar.some((v) => v)) c.pose.ar = m.ar.map((v) => num(v, 0, 99999, 0) | 0);
      if (!was || was.dim !== c.pose.dim) {   // the first player into a dimension wakes the game that runs it (starts it, or resumes a paused one)
        if (S.startHost) S.startHost(c.pose.dim);
        if (S.wakeHost) S.wakeHost(c.pose.dim);
      }
      if (typeof m.rv === 'string' && RIDES.has(m.rv)) {
        c.pose.rv = m.rv; c.pose.ry = num(m.ry, -1e4, 1e4, 0); c.pose.rh = num(m.rh, -8, 8, 0);
        /* 6.57: the shared vehicle's id (others seat the rider on it) and a plane's pitch and roll */
        if (typeof m.rid === 'string' && VEH_ID_RE.test(m.rid)) c.pose.rid = m.rid;
        if (m.rv === 'plane') { c.pose.rp = num(m.rp, -3.2, 3.2, 0); c.pose.rr = num(m.rr, -3.2, 3.2, 0); }
      }
      syncAround(S, net, c, c.pose.dim, c.pose.x, c.pose.z);
      /* players nearby see every pose; everyone else gets one a second (enough for the player list), and a change of
         dimension at once */
      const far = now - c.farT >= 1000 || !was || was.dim !== c.pose.dim;
      if (far) c.farT = now;
      net.broadcast({ t: 'pose', id: c.id, ...c.pose }, c, far ? null : (p) => near(p.pose, c.pose, LIMITS.poseNear));
      return;
    }
    case 'rd': {                       // the player changed how far their game draws
      c.rd = Math.round(num(m.v, 4, 32, c.rd));
      if (c.pose) syncAround(S, net, c, c.pose.dim, c.pose.x, c.pose.z);
      return;
    }
    case 'edits': {                    // block changes: the last writer of a cell wins
      if (!Array.isArray(m.e) || m.e.length > LIMITS.editsPerMsg) return;
      if (!c.host) { const r = c.rate.cells || (c.rate.cells = { t: 0, n: 0 });
        if (now - r.t >= 1000) { r.t = now; r.n = 0; }
        if ((r.n += m.e.length) > LIMITS.cellsPerSec) return; }
      const out = [], prot = c.host || isOp(S, c) ? 0 : protRadius(S), sp = world.spawn;
      for (const e of m.e) {
        if (!Array.isArray(e) || typeof e[0] !== 'string' || typeof e[1] !== 'string' || !CK_RE.test(e[0]) || !LK_RE.test(e[1])) continue;
        const id = e[2];
        if (!Number.isInteger(id) || id < 0 || id > 4095) continue;   // a block id (0..255) with its meta above it (6.25: a liquid's level, 4 bits)
        if (prot && e[0][1] !== ';') {   // spawn protection: the Overworld, a square around the world spawn
          const ck = e[0].split(','), lk = e[1].split(',');
          if (Math.abs(ck[0] * 16 + +lk[0] + 0.5 - sp.x) <= prot && Math.abs(ck[1] * 16 + +lk[2] + 0.5 - sp.z) <= prot) continue;
        }
        (world.edits[e[0]] ||= {})[e[1]] = id;
        out.push(e[3] === 1 ? [e[0], e[1], id, 1] : [e[0], e[1], id]);
      }
      if (!out.length) return;
      S.dirty = true; S.editCount += out.length;
      for (const p of S.clients.values()) {   // only to players who have that chunk; the rest get it whole when they come near
        if (p === c || !p.ready) continue;
        const mine = p.sent ? out.filter((e) => p.sent.has(e[0])) : out;
        if (mine.length) net.send(p, { t: 'edits', e: mine });
      }
      if (!c.host) for (const h of S.hosts.values()) if (!h.stopped) net.send(h.c, { t: 'edits', e: out });   // the server's games have every chunk they have built
      return;
    }
    case 'open': {                     // a player wants to use a chest or furnace: one at a time
      if (typeof m.k !== 'string' || !BK_RE.test(m.k)) return;
      const h = lockHolder(S, m.k);
      if (h && h !== c) return net.send(c, { t: 'lock', k: m.k, ok: false, by: h.name });
      S.locks.set(m.k, c.id);
      if (Object.hasOwn(world.be, m.k)) net.send(c, { t: 'be', k: m.k, v: world.be[m.k] });   // the latest contents first
      net.send(c, { t: 'lock', k: m.k, ok: true });
      return;
    }
    case 'close': {
      if (typeof m.k === 'string' && S.locks.get(m.k) === c.id) S.locks.delete(m.k);
      return;
    }
    case 'be': {                       // a chest, furnace or other block entity changed (v null: it was removed)
      if (typeof m.k !== 'string' || !BK_RE.test(m.k)) return;
      /* about a chunk this player has not been sent yet (they just arrived and their game generated it afresh): the server's
         copy is on its way to them and stands */
      if (c.sent && !c.sent.has(beChunk(m.k))) return;
      if (m.v == null) { S.locks.delete(m.k); if (m.k in world.be) { delete world.be[m.k]; S.dirty = true; net.broadcast({ t: 'be', k: m.k, v: null }, c); } return; }
      if (typeof m.v !== 'object' || typeof m.v.t !== 'string' || size > LIMITS.beBlob) return;
      const h = lockHolder(S, m.k);
      if (h && h !== c) return net.send(c, { t: 'be', k: m.k, v: Object.hasOwn(world.be, m.k) ? world.be[m.k] : null });   // someone else is in it: theirs stands
      { const cur = Object.hasOwn(world.be, m.k) ? world.be[m.k] : null;   // a chest the world already knows: only through its lid
        if (!c.host && h !== c && cur && cur.t === 'chest' && m.v.t === 'chest') return net.send(c, { t: 'be', k: m.k, v: cur }); }
      world.be[m.k] = m.v; S.dirty = true;
      net.broadcast({ t: 'be', k: m.k, v: m.v }, c);
      return;
    }
    case 'chat': {                     // at most 8 lines in 5 seconds
      const txt = cleanText(m.txt, 200);
      if (!txt) return;
      c.chatN = now - c.chatT > 5000 ? 1 : c.chatN + 1;
      if (c.chatN === 1) c.chatT = now;
      if (c.chatN > 8) return net.send(c, { t: 'sys', txt: 'Slow down.' });
      S.log(`<${c.name}> ${txt}`);
      net.broadcast({ t: 'chat', id: c.id, from: c.name, txt }, c);
      return;
    }
    case 'cmd': {                      // a slash command
      if (!allow(c, 'cmd', 8, now)) return net.send(c, { t: 'sys', txt: 'Slow down.' });
      const out = runCommand(S, net, c, m.txt);
      if (out && !c.closed) net.send(c, { t: 'sys', txt: out });
      return;
    }
    case 'hit': {                      // one player hit another: checked, then passed on to the victim, whose own game applies it
      if (!o.pvp) return;
      const to = S.clients.get(m.to), shot = !!m.shot;
      if (!to || to === c || !to.ready) return;
      if (!near(c.pose, to.pose, shot ? LIMITS.shotReach : LIMITS.hitReach) || (!shot && Math.abs(c.pose.y - to.pose.y) > LIMITS.hitReach)) return;
      if ((c.pose.fl & 4) || (to.pose.fl & 4)) return;   // the dead neither hit nor get hit
      if (now - c.hitT < (shot ? 50 : LIMITS.hitGap)) return;   // a gun fires faster than a fist
      c.hitT = now;
      to.lastHit = { name: c.name, t: now, shot };
      net.send(to, { t: 'hit', from: c.id, name: c.name, dmg: num(m.dmg, 0, 40, 1), kx: num(m.kx, -1, 1, 0), kz: num(m.kz, -1, 1, 0), crit: m.crit ? 1 : 0, ...(m.psn && !shot ? { psn: 1 } : {}) });
      if (m.crit && !shot)   // a critical hit (6.30): the victim's game shows its own, everyone else nearby is shown where
        net.broadcast({ t: 'crit', x: to.pose.x, y: to.pose.y + 1.1, z: to.pose.z }, c, (p) => p !== to && near(p.pose, to.pose, LIMITS.mobRange));
      return;
    }
    case 'crw': takeWork(S, net, c, m); return;   // 6.73: a Creativity work (see takeWork)
    case 'dis': {                      // 6.72: a disaster in this player's game (k '' once it is over): the players near it watch the same one
      if (c.host || !c.pose) return;
      const k = typeof m.k === 'string' ? m.k : '';
      if (k && !DIS_KINDS.has(k)) return;
      const at = { dim: c.pose.dim, x: num(m.x, -3e7, 3e7, c.pose.x), z: num(m.z, -3e7, 3e7, c.pose.z) };
      if (k && !near(c.pose, at, LIMITS.mobRange)) return;   // its player is at it (a tornado's runaway is not)
      const out = { t: 'dis', from: c.id, name: c.name, k, x: at.x, z: at.z, gy: num(m.gy, -64, 512, 40), at: num(m.at, 0, 1e4, 0) };
      if (Array.isArray(m.tw) && m.tw.length === 2) out.tw = [num(m.tw[0], -3e7, 3e7, at.x), num(m.tw[1], -3e7, 3e7, at.z)];
      net.broadcast(out, c, (p) => near(p.pose, at, LIMITS.disRange));
      return;
    }
    case 'crit': {                     // a critical hit on a mob in this player's game: the others nearby see the burst
      if (!c.pose) return;
      const at = { dim: c.pose.dim, x: num(m.x, -3e7, 3e7, c.pose.x), z: num(m.z, -3e7, 3e7, c.pose.z) };
      if (!near(c.pose, at, LIMITS.hitReach + 2)) return;
      net.broadcast({ t: 'crit', x: at.x, y: num(m.y, -256, 1024, c.pose.y), z: at.z }, c, (p) => near(p.pose, at, LIMITS.mobRange));
      return;
    }
    case 'save': {                     // this player's own state (inventory, position...), handed back when they next join
      if (!m.player || typeof m.player !== 'object' || size > LIMITS.playerBlob) return;
      const key = playerKey(c.name), had = world.players[key];
      const { password: _pw, locks: _lk, ...mine } = m.player;   // 6.49: a game cannot give itself a password or take its locks off
      world.players[key] = { ...mine, name: c.name, seen: new Date().toISOString(), ...(c.gm ? { gm: c.gm } : {}), ...(c.skin ? { skin: c.skin } : {}) };
      delete world.players[key].cr;      // 6.73: the Creativity works are the world's now (crw), never a player's
      if (had && typeof had.password === 'string') world.players[key].password = had.password;   // the account stays an account
      if (had && had.locks) world.players[key].locks = had.locks;
      S.dirty = true;
      return;
    }
    case 'spawn': {                    // the first player's game found the world spawn (the server has no terrain to look at)
      if (world.spawn) return;
      const x = num(m.x, -3e7, 3e7, NaN), y = num(m.y, 0, 1024, NaN), z = num(m.z, -3e7, 3e7, NaN);
      if (![x, y, z].every(Number.isFinite)) return;
      world.spawn = { x, y, z }; S.dirty = true;
      S.log(`world spawn set to ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} (found by ${c.name})`);
      for (const p of S.clients.values()) if (p.ready) net.send(p, permOf(S, p));
      return;
    }
    case 'time': {                     // the debug menu moved the clock: operators only, unless Cheats is on
      if (!isOp(S, c) && world.gr.cheats !== true) return net.send(c, { t: 'time', v: +world.time.toFixed(5) });
      world.time = ((num(m.v, -1e6, 1e6, world.time) % 1) + 1) % 1; S.dirty = true;
      net.broadcast({ t: 'time', v: world.time });
      return;
    }
    case 'sleep': return sleepVote(S, net, c, now);
    case 'gr': {                       // a game rule was changed from inside the game: operators only, unless Cheats is on
      if (!m.gr || typeof m.gr !== 'object' || size > LIMITS.rulesBlob) return;
      if (!isOp(S, c) && world.gr.cheats !== true) return net.send(c, { t: 'gr', gr: world.gr });   // put theirs back
      for (const k of Object.keys(m.gr)) {
        const v = m.gr[k];
        if (/^[A-Za-z]\w{0,23}$/.test(k) && (typeof v === 'boolean' || typeof v === 'number') && k in RULES) world.gr[k] = v;   // only rules this game has
      }
      S.dirty = true;
      net.broadcast({ t: 'gr', gr: world.gr }, c);
      if (typeof o.onRules === 'function') o.onRules(cleanRules(world.gr));   // written back to the settings file (lib/cli.mjs)
      return;
    }
    case 'drop': {                     // a player's game dropped an item: it now belongs to the world
      if (typeof m.id !== 'string' || !DROP_ID_RE.test(m.id) || m.id in world.drops || size > LIMITS.dropBlob) return;
      const st = cleanStack(m.st);
      if (!st || Object.keys(world.drops).length >= LIMITS.drops) return net.send(c, { t: 'undrop', id: m.id });
      const d = { dim: DIMS.has(m.dim) ? m.dim : 'over', x: num(m.x, -3e7, 3e7, 0), y: num(m.y, -256, 1024, 0), z: num(m.z, -3e7, 3e7, 0), st, age: 0 };
      /* thrown on purpose: the thrower waits before picking it up again (kept in memory only: it is over long before a save matters) */
      if (m.by && !c.host) { Object.defineProperty(d, 'by', { value: playerKey(c.name), enumerable: false, writable: true }); Object.defineProperty(d, 'byAt', { value: now, enumerable: false, writable: true }); }
      world.drops[m.id] = d; S.dirty = true;
      net.broadcast({ t: 'drop', id: m.id, dim: d.dim, x: d.x, y: d.y, z: d.z, vx: num(m.vx, -60, 60, 0), vy: num(m.vy, -60, 60, 0), vz: num(m.vz, -60, 60, 0), st, ...(d.by ? { by: c.name } : {}) }, c);
      return;
    }
    case 'dropAt': {                   // where it came to rest, as seen by a player standing near it
      const d = typeof m.id === 'string' && Object.hasOwn(world.drops, m.id) ? world.drops[m.id] : null;
      if (!d) return;
      const at = { dim: d.dim, x: num(m.x, -3e7, 3e7, d.x), z: num(m.z, -3e7, 3e7, d.z) };
      if (!c.host && !near(c.pose, at, LIMITS.goneReach)) return;
      d.x = at.x; d.y = num(m.y, -256, 1024, d.y); d.z = at.z; S.dirty = true;
      return;
    }
    case 'take': {                     // first come, first served: one player gets it, everyone else sees it vanish
      if (typeof m.id !== 'string') return;
      if (!Object.hasOwn(world.drops, m.id)) { if (!m.gone) net.send(c, { t: 'undrop', id: m.id }); return; }
      if (c.host ? !m.gone : !near(c.pose, world.drops[m.id], m.gone ? LIMITS.goneReach : LIMITS.takeReach)) return;   // not standing by it: ask again when you are
      { const d = world.drops[m.id]; if (!m.gone && d.by === playerKey(c.name) && now - d.byAt < LIMITS.throwWait) return; }   // their own throw, too soon: like a lost race, they ask again
      delete world.drops[m.id]; S.dirty = true;
      if (!m.gone) net.send(c, { t: 'took', id: m.id });   // gone: the item was destroyed in that player's game, nobody gets it
      net.broadcast({ t: 'undrop', id: m.id }, c);
      return;
    }
    case 'death': {                    // announced to the others in chat, in the server's words
      S.log(`${c.name} died`);
      net.broadcast({ t: 'sys', txt: deathText(c, m, now) }, c);
      c.lastHit = null;
      // 6.38: in a DingleCore world that was the player's one life. They watch from now on, by name, until an operator says otherwise
      if (world.gr.difficulty === 'dinglecore' && c.gm !== 'spectator' && (!c.pose || c.pose.dim !== 'puppet')) {
        c.gm = 'spectator';
        const key = playerKey(c.name);
        world.players[key] = { ...(world.players[key] || { name: c.name }), gm: 'spectator' };
        S.dirty = true;
        net.send(c, { t: 'mode', m: 'spectator' });
        S.log(`${c.name} is out: a spectator from now on`);
      }
      return;
    }
    case 'mobs': {                     // the mobs this player's game is running, for the players around them
      if (c.host) {                    // the server's own game: each player gets the ones within range of them
        if (!Array.isArray(m.m)) return;
        const list = m.m.map(cleanMob).filter(Boolean);
        for (const p of S.clients.values()) {
          if (!p.ready || !p.pose || p.pose.dim !== c.hdim) continue;
          const mine = list.filter((a) => Math.hypot(a[2] - p.pose.x, a[4] - p.pose.z) <= LIMITS.mobRange);
          if (mine.length) net.send(p, { t: 'mobs', from: 0, m: mine });
        }
        return;
      }
      if (!c.pose || !Array.isArray(m.m) || m.m.length > LIMITS.mobsPerMsg || size > LIMITS.mobBlob || !allow(c, 'mobs', 14, now)) return;
      const list = m.m.map(cleanMob).filter(Boolean);
      if (list.length) net.broadcast({ t: 'mobs', from: c.id, m: list }, c, (p) => near(p.pose, c.pose, LIMITS.mobRange));
      return;
    }
    case 'mgone': {                    // some of them are gone (dead: with a death, not just out of sight)
      if (c.host) {
        const ids = Array.isArray(m.ids) ? m.ids.filter((v) => typeof v === 'string' && v.length <= 24) : [];
        if (ids.length) net.broadcast({ t: 'mgone', from: 0, ids, dead: m.dead ? 1 : 0 }, null, (p) => !!p.pose && p.pose.dim === c.hdim);
        return;
      }
      if (!c.pose || !Array.isArray(m.ids) || m.ids.length > LIMITS.mobsPerMsg || size > LIMITS.mobBlob) return;
      const ids = m.ids.filter((v) => typeof v === 'string' && v.length <= 24);
      if (ids.length) net.broadcast({ t: 'mgone', from: c.id, ids, dead: m.dead ? 1 : 0 }, c, (p) => near(p.pose, c.pose, LIMITS.mobRange));
      return;
    }
    case 'mgive': {                    // "you are nearer to this mob than I am: your game runs it from now on"
      const to = peerOf(S, m.to, c), mob = cleanMob(m.m);
      if (!to || to === c || !to.ready || !mob || (to.host ? !c.pose : !near(c.pose, to.pose, LIMITS.mobRange))) return;
      net.send(to, { t: 'mgive', from: c.id, m: mob });
      return;
    }
    case 'mhit': {                     // a player hit a mob that another player's game is running
      const to = peerOf(S, m.to, c);
      if (!to || to === c || !to.ready || typeof m.id !== 'string' || m.id.length > 24 || (to.host ? !c.pose : !near(c.pose, to.pose, LIMITS.mobRange)) || !allow(c, 'mhit', 12, now)) return;
      net.send(to, { t: 'mhit', from: c.id, name: c.name, id: m.id, dmg: num(m.dmg, 0, 1e6, 1), kx: num(m.kx, -1e3, 1e3, 0), kz: num(m.kz, -1e3, 1e3, 0) });
      return;
    }
    case 'boom': {                     // an explosion in this player's game: the others nearby feel it (the holes travel as edits)
      if (!c.host && (!c.pose || !allow(c, 'boom', 20, now))) return;
      const at = c.host ? { dim: c.hdim, x: num(m.x, -3e7, 3e7, 0), z: num(m.z, -3e7, 3e7, 0) } : { dim: c.pose.dim, x: num(m.x, -3e7, 3e7, c.pose.x), z: num(m.z, -3e7, 3e7, c.pose.z) };
      if (!c.host && !near(c.pose, at, LIMITS.mobRange)) return;
      const mob = !!m.mob;
      net.broadcast({ t: 'boom', from: c.id, name: c.host ? '' : c.name, x: at.x, y: num(m.y, -256, 1024, c.host ? 40 : c.pose.y), z: at.z, r: num(m.r, 0, 64, 3), mob: mob ? 1 : 0, hurt: mob || o.pvp ? 1 : 0 },
        c, (p) => near(p.pose, at, LIMITS.mobRange));
      return;
    }
    case 'hurt': {                     // (the server's game) a mob it runs hit a player: that player's own game applies it
      const to = S.clients.get(m.to);
      if (!to || !to.ready) return;
      net.send(to, { t: 'hurt', dmg: num(m.dmg, 0, 40, 1), kx: num(m.kx, -1e3, 1e3, 0), kz: num(m.kz, -1e3, 1e3, 0),
        by: typeof m.by === 'string' && /^[A-Za-z][A-Za-z '-]{0,23}$/.test(m.by) ? m.by : '', how: typeof m.how === 'string' && /^[a-z]{1,8}$/.test(m.how) ? m.how : 'mob' });
      return;
    }
    case 'xp': {                       // (the server's game) a player picked up XP
      const to = S.clients.get(m.to);
      if (to && to.ready) net.send(to, { t: 'xp', n: Math.round(num(m.n, 1, 10000, 1)) });
      return;
    }
    case 'hsnap': {                    // (the server's game) every mob and vehicle it has, for the next save
      { const key = JSON.stringify([m.mobs, m.vehs, m.cseen]);   // 6.46: the same as last time (nobody near, nothing moved): nothing to save
        if (key === c.hsnapK) return;
        c.hsnapK = key; }
      { const d = c.hdim, others = (list) => (Array.isArray(list) ? list.filter((x) => (x.d || 'over') !== d) : []);   // each dimension's game reports its own
        world.mobs = others(world.mobs).concat(cleanMobs(m.mobs).map((x) => (d === 'over' ? x : { ...x, d })));
        world.vehicles = others(world.vehicles).concat(cleanMobs(m.vehs).filter((v) => RIDES.has(v.t)).map((x) => (d === 'over' ? x : { ...x, d }))); }
      if (m.cseen && typeof m.cseen === 'object' && !Array.isArray(m.cseen)) {   // 6.50: when each growing chunk of this dimension last ran
        const pfx = DIM_PFX[c.hdim] || '', mine = (k) => (pfx ? k.startsWith(pfx) : !k.includes(';'));
        const next = {};
        for (const k of Object.keys(world.cseen || {})) if (!mine(k)) next[k] = world.cseen[k];
        for (const k of Object.keys(m.cseen).slice(0, 20000)) if (mine(k) && CK_RE.test(k.slice(pfx.length)) && Number.isFinite(m.cseen[k])) next[k] = m.cseen[k];
        world.cseen = next;
      }
      S.dirty = true;
      return;
    }
    case 'skin': {                     // what a player wears: checked, kept with the player, passed on ('' is the default)
      const png = cleanSkin(m.png);
      if (locksOf(S, c.name).skin) { net.send(c, { t: 'skin', id: c.id, png: c.skin }); return net.send(c, { t: 'sys', txt: 'Skins are locked on this server: an operator chooses yours.' }); }
      if (png === null) return net.send(c, { t: 'sys', txt: 'The server did not take that skin (it wants a PNG, 64 x 64, under 50 KB).' });
      c.skin = png;
      const rec = world.players[playerKey(c.name)];
      if (rec && typeof rec === 'object') { if (png) rec.skin = png; else delete rec.skin; S.dirty = true; }
      net.broadcast({ t: 'skin', id: c.id, png }, c);
      return;
    }
    case 'acct': {                     // 6.49: a player changes their own username or password (Settings)
      const rec = accountOf(S, c.name), L = locksOf(S, c.name);
      if (!rec) return net.send(c, { t: 'acct', ok: false, why: 'You have no account on this server.' });
      if (typeof m.name === 'string') {
        if (L.name) return net.send(c, { t: 'acct', ok: false, why: 'Name changes are locked on this server.' });
        const r = renameAccount(S, net, c.name, m.name);
        return net.send(c, { t: 'acct', ok: r.ok, why: r.why });
      }
      if (typeof m.pass === 'string') {
        if (L.password) return net.send(c, { t: 'acct', ok: false, why: 'Password changes are locked on this server.' });
        const bad = passwordProblem(m.pass, S.o.passwordSecurity);
        if (bad) return net.send(c, { t: 'acct', ok: false, why: bad });
        if (c.checking) return net.send(c, { t: 'acct', ok: false, why: 'One moment: the last change is still being checked.' });
        /* 6.61: checked and hashed off the main thread; the record must still be theirs when it is done */
        c.checking = true;
        const done = (msg) => { c.checking = false; if (!c.closed) net.send(c, msg); };
        checkPassword(rec, m.old).then((ok) => {
          if (!ok) return done({ t: 'acct', ok: false, why: 'Your current password is not right.' });
          return hashPasswordLater(m.pass).then((h) => {
            if (accountOf(S, c.name) !== rec) return done({ t: 'acct', ok: false, why: 'Your account changed meanwhile. Try again.' });
            rec.password = h; S.dirty = true;
            S.log(`${c.name} changed their password`);
            done({ t: 'acct', ok: true, why: 'Password changed.' });
          });
        }).catch(() => done({ t: 'acct', ok: false, why: 'The password could not be changed. Try again.' }));
        return;
      }
      return;
    }
    case 'wd': {                       // a game learnt something about the world: a structure found, a boss dead, a spawner placed or broken
      if (!WORLD_LISTS.includes(m.k)) return;
      const add = cleanList200(m.add), del = m.k === 'spw' ? cleanList200(m.del) : [];
      const have = new Set((Array.isArray(world[m.k]) ? world[m.k] : []).map(String)), news = add.filter((v) => !have.has(v)), gone = del.filter((v) => have.has(v));
      if (!news.length && !gone.length) return;
      for (const v of gone) have.delete(v);
      for (const v of news) if (have.size < LIMITS.listLen) have.add(v);
      world[m.k] = [...have]; S.dirty = true;
      net.broadcast({ t: 'wd', k: m.k, add: news, del: gone }, c);
      return;
    }
    case 'mkt': {                      // (the server's game) what the stocks cost
      const clean = (o) => { const r = {}; if (o && typeof o === 'object') for (const k of Object.keys(o).slice(0, 64)) if (/^[A-Za-z0-9_]{1,12}$/.test(k) && Number.isFinite(o[k])) r[k] = o[k]; return r; };
      const p = clean(m.p), mu = clean(m.mu);
      if (!Object.keys(p).length) return;
      world.market = { p, mu }; S.dirty = true;
      net.broadcast({ t: 'mkt', p, mu }, c);
      return;
    }
    case 'ign': {                      // a player's game asks the server's to light these cells
      const h = hostOf(S, c.pose && c.pose.dim), cells = cleanCells(m.c);
      if (h && c.pose && cells.length) net.send(h, { t: 'ign', c: cells, from: c.id });
      return;
    }
    case 'fire': {                     // (the server's game) these cells are alight
      const cells = cleanCells(m.c);
      if (cells.length) net.broadcast({ t: 'fire', c: cells }, c, (p) => !!p.pose && p.pose.dim === c.hdim && Math.hypot(p.pose.x - cells[0][0], p.pose.z - cells[0][2]) <= LIMITS.mobRange);
      return;
    }
    case 'fx': {                       // something started flying in this game: the players nearby get a copy to look at
      if (!Array.isArray(m.f) || m.f.length > 40 || (!c.host && !c.pose)) return;
      const list = m.f.map(cleanFx).filter(Boolean);
      if (!list.length) return;
      const dim = c.host ? c.hdim : c.pose.dim;
      for (const p of S.clients.values()) {
        if (p === c || !p.ready || !p.pose || p.pose.dim !== dim) continue;
        const mine = list.filter((a) => Math.hypot(a[2] - p.pose.x, a[4] - p.pose.z) <= LIMITS.fxRange);
        if (mine.length) net.send(p, { t: 'fx', from: c.id, f: mine });
      }
      return;
    }
    case 'fxgone': {
      if (!Array.isArray(m.ids) || m.ids.length > 60 || (!c.host && !c.pose)) return;
      const ids = m.ids.filter((v) => typeof v === 'string' && v.length <= 17), dim = c.host ? c.hdim : c.pose.dim;
      if (ids.length) net.broadcast({ t: 'fxgone', ids }, c, (p) => !!p.pose && p.pose.dim === dim && (c.host || near(p.pose, c.pose, LIMITS.fxRange * 2)));
      return;
    }
    case 'vehs': {                     // where vehicles are: the parked ones from the server's game, a ridden one from its rider
      if (!Array.isArray(m.v) || m.v.length > 60) return;
      let list = m.v.map(cleanVeh).filter(Boolean);
      if (c.host) {
        for (const p of S.clients.values()) {
          if (!p.ready || !p.pose || p.pose.dim !== c.hdim) continue;
          const mine = list.filter((a) => !S.vown.has(a[0]) && Math.hypot(a[2] - p.pose.x, a[4] - p.pose.z) <= LIMITS.vehRange);
          if (mine.length) net.send(p, { t: 'vehs', from: 0, v: mine });
        }
        return;
      }
      const h = hostOf(S, c.pose && c.pose.dim);
      if (!h || !c.pose) return;
      list = list.filter((a) => S.vown.get(a[0]) === c.id);
      if (!list.length) return;
      net.broadcast({ t: 'vehs', from: c.id, v: list }, c, (p) => near(p.pose, c.pose, LIMITS.vehRange));
      net.send(h, { t: 'vehs', from: c.id, v: list });
      return;
    }
    case 'vgive': case 'vtake': case 'vfree': {   // a vehicle changes hands between a player and the server's game
      const h = hostOf(S, c.pose && c.pose.dim), v = m.t === 'vfree' ? null : cleanVeh(m.v), id = v ? v[0] : m.id;
      if (!h || !c.pose || typeof id !== 'string' || !VEH_ID_RE.test(id) || (m.t !== 'vfree' && !v)) return;
      const rider = S.clients.get(S.vown.get(id));
      if (rider && rider !== c && rider.ready) { if (m.t === 'vtake') net.send(c, { t: 'vno', id }); return; }   // someone else is on it: theirs stands
      if (m.t === 'vtake') S.vown.set(id, c.id); else S.vown.delete(id);
      net.send(h, m.t === 'vfree' ? { t: 'vfree', id, from: c.id } : { t: m.t, id, v, from: c.id });
      return;
    }
    case 'vgone': {                    // broken, or lost to the void
      if (!Array.isArray(m.ids) || m.ids.length > 60) return;
      const h = c.host ? c : hostOf(S, c.pose && c.pose.dim), vdim = c.host ? c.hdim : c.pose && c.pose.dim;
      if (!h) return;
      const ids = m.ids.filter((v) => typeof v === 'string' && VEH_ID_RE.test(v) && (c.host || S.vown.get(v) === c.id));
      if (!ids.length) return;
      for (const id of ids) S.vown.delete(id);
      net.broadcast({ t: 'vgone', ids }, c, (p) => !!p.pose && p.pose.dim === vdim);
      if (!c.host) net.send(h, { t: 'vgone', ids });
      return;
    }
    case 'vhit': {                     // a hit on a vehicle goes to whoever runs it
      const h = hostOf(S, c.pose && c.pose.dim);
      if (!h || !c.pose || typeof m.id !== 'string' || !VEH_ID_RE.test(m.id)) return;
      const rider = S.clients.get(S.vown.get(m.id)), to = rider && rider.ready ? rider : h;
      if (to !== c) net.send(to, { t: 'vhit', from: c.id, id: m.id, dmg: num(m.dmg, 0, 1e5, 1) });
      return;
    }
    default:
  }
}

/* Once a second (dt = seconds since the last call): the sun moves while anyone is online, everyone's clock is corrected
   every 5 s, and dropped items older than their lifetime disappear (works from the Creativity Update, ids 10000+, never do).
   Like the sun, a dropped item only ages while someone is playing: an empty or stopped server loses nothing.
   T holds the two 5-second counters between calls. */
export function worldTick(S, net, T, now, dt) {
  const { world } = S;
  world.clock = (world.clock || 0) + dt;   // 6.50: the world's own clock runs always, with or without players (crops and furnaces catch up by it)
  if (S.clients.size && world.gr.dayCycle !== false) { world.time = (world.time + dt / DAY_LEN) % 1; S.dirty = true; }
  if (S.clients.size && (T.time += dt) >= 5) { T.time = 0; net.broadcast({ t: 'time', v: +world.time.toFixed(5), clock: Math.round(world.clock) }); }
  if (S.clients.size && (T.drops += dt) >= 5) {
    const aged = T.drops; T.drops = 0;
    for (const id of Object.keys(world.drops)) {
      const d = world.drops[id];
      d.age = (d.age || 0) + aged; S.dirty = true;
      if (d.st && d.st.id < 10000 && d.age > LIMITS.dropLife) { delete world.drops[id]; net.broadcast({ t: 'undrop', id }); }
    }
  }
}
