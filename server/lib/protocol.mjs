// protocol.mjs: the game protocol. What each message from a player means, what gets stored, and what everyone else is told.
// Messages are JSON objects {t: '<type>', ...}. It knows nothing about sockets: it is handed
//   S    the server's state (lib/server.mjs): { o (settings), log, world, dirty, clients (id -> client), nextId,
//        editCount, gameVersion, locks (block key -> the id of the player using that chest) }
//   net  { send(client, msg), broadcast(msg, exceptClient, onlyIf), drop(client, why, tell) }
//
//   from a player                                 to players
//   hello {proto, v, name, pw, rd}                welcome, perm, edits..., bes, drops, ready   (to the one joining)
//                                                 join, sys                                    (to the others)
//   pose {x y z yaw pitch dim held hp fl ar rv}   pose (+id, ms): at once to players nearby, once a second to the rest;
//                                                 edits (s:1), bes and drops (add:1) for the chunks that came into range
//   ping {n, ms}                                  pong {n}  (the game times the round trip and reports it in the next ping)
//   rd {v}                                        -         (how far that player's game draws, in chunks)
//   edits {e: [[chunkKey, localKey, id, by?]...]} edits     (to players who have that chunk; by 1: a player's own hand did it)
//   open {k}                                      be, lock {k, ok, by}   (a chest is used by one player at a time)
//   close {k}                                     -
//   be {k, v|null}                                be        (or be back to the sender if someone else holds the lock)
//   drop {id dim x y z vx vy vz st}               drop      (or undrop back to the sender if it was refused)
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
// The server's own game (6.13, lib/host.mjs) is a player too, with id 0 and c.host set. It runs the Overworld's mobs, so:
//   it may send only edits, drop, dropAt, take (gone), mobs, mgone, boom, and three of its own:
//     hurt {to, dmg, kx, kz, by, how}   hurt      (to that player: a mob it runs hit them)
//     xp {to, n}                        xp        (to that player: they picked up XP it dropped)
//     hsnap {mobs}                      -         (every mob it has, kept for the next save: entities/ in the world folder)
//   its mobs go to each player with only the ones within range of that player; no limits apply to it;
//   it is sent join, leave, pose, edits, be, drop, undrop, time, gr, and the mgive and mhit addressed to player 0.
import crypto from 'node:crypto';
import { PROTO, DAY_LEN, MIN_GAME, LIMITS, RATE, RULES, CK_RE, LK_RE, BK_RE, DROP_ID_RE, DIMS, DIM_PFX, cleanRules, cmpVer } from './config.mjs';
import { num, cleanName, cleanText, cleanStack, cleanMobs, playerKey } from './world.mjs';
import { runCommand, isOp, protRadius, permOf } from './commands.mjs';

export { playerKey };

/* the name a joining player gets: their own, or name_2, name_3... if someone online already has it */
function uniqueName(S, want) {
  let name = want || 'Player';
  const taken = new Set([...S.clients.values()].map((c) => playerKey(c.name || '')));
  for (let i = 2; taken.has(playerKey(name)); i++) name = (want || 'Player').slice(0, 13) + '_' + i;
  return name;
}

/* compared as hashes in constant time, so the password cannot be guessed a character at a time */
function passwordOK(S, pw) {
  if (!S.o.password) return true;
  const h = (s) => crypto.createHash('sha256').update(String(s == null ? '' : s)).digest();
  return crypto.timingSafeEqual(h(pw), h(S.o.password));
}

/* are two poses in the same dimension and within dist blocks of each other (flat distance, like the game's own checks)? */
function near(a, b, dist) {
  return !!a && !!b && a.dim === b.dim && Math.hypot(a.x - b.x, a.z - b.z) <= dist;
}

/* what the server's own game may send, and what only it may send */
const HOST_SENDS = new Set(['edits', 'drop', 'dropAt', 'take', 'mobs', 'mgone', 'boom', 'hurt', 'xp', 'hsnap']);
const HOST_ONLY = new Set(['hurt', 'xp', 'hsnap']);
/* the player a message is addressed to: a real one, or the server's own game (id 0) */
const peerOf = (S, id) => (id === 0 ? (S.host && !S.host.stopped ? S.host.c : null) : S.clients.get(id));

/* what a player can be seen riding (the game's vehicle kinds) */
const RIDES = new Set(['car', 'skate', 'cart', 'boat', 'plane']);

/* is it night (the game's sunUp, src/core/p07a_render_sound.js, turned around)? */
const isNight = (time) => Math.sin(time * Math.PI * 2) <= 0.02;

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
  if (!passwordOK(S, m.pw)) { S.log(`  ${c.addr}: wrong password`); return net.drop(c, 'Wrong password.', true); }
  const want = cleanName(m.name), key = playerKey(want || 'Player');
  if (o.bans.includes(key) || o.bans.includes(String(c.addr).toLowerCase())) { S.log(`  ${c.addr}: banned (${want})`); return net.drop(c, 'You are banned from this server.', true); }
  if (o.whitelist && !o.allow.includes(key) && !o.ops.includes(key)) return net.drop(c, 'You are not on this server\'s whitelist.', true);
  /* The same name again. If the one already here has gone quiet (a dropped connection the server has not noticed yet) the
     new one takes its place, like Minecraft's "logged in from another location". If it is alive, they are two people who
     both kept the default name, and the newcomer becomes name_2. */
  const twin = [...S.clients.values()].find((p) => playerKey(p.name) === key);
  if (twin && Date.now() - twin.seen > 3000) net.drop(twin, 'You logged in from another location.', true);
  if (S.clients.size >= o.maxPlayers) return net.drop(c, 'The server is full.', true);
  if (!S.gameVersion) { S.gameVersion = m.v; S.log(`game version pinned to ${m.v} (the first player's)`); }
  c.name = uniqueName(S, want);
  c.id = S.nextId++;
  c.rd = Math.round(num(m.rd, 4, 32, 0)) || o.viewChunks;
  S.clients.set(c.id, c);
  const saved = world.players[playerKey(c.name)] || null;
  c.gm = saved && (saved.gm === 'c' || saved.gm === 's') ? saved.gm : null;
  const { edits, be, players, drops, spawn, ...meta } = world;   // meta: seed, mode, time, rules and whatever else the save carried
  net.send(c, { t: 'welcome', proto: PROTO, id: c.id, name: c.name, server: o.name, motd: o.motd, pvp: !!o.pvp, host: !!(S.host && !S.host.stopped),
    world: { ...meta, mode: c.gm || world.mode }, player: saved,
    players: [...S.clients.values()].filter((p) => p !== c && p.ready).map((p) => ({ id: p.id, name: p.name, pose: p.pose })) });
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
  S.log(`+ ${c.name} joined from ${c.addr} (${saved ? 'returning' : 'new'} player); ${S.clients.size} online`);
  net.broadcast({ t: 'join', id: c.id, name: c.name }, c);
  net.broadcast({ t: 'sys', txt: c.name + ' joined the game' }, c);
}

/* a player is gone (called by lib/server.mjs when a connection ends, before the others are told):
   - whatever they held open is free again;
   - if their game did not get to save on the way out (a crash, a dropped line), their saved place becomes where the
     server last saw them, so they do not come back a minute's walk behind. Only within one dimension: the rest of a
     saved player belongs to the dimension it was saved in;
   - the mobs their game was running go to the nearest player who can see them (mheir). */
export function forget(S, net, c) {
  for (const [k, id] of S.locks) if (id === c.id) S.locks.delete(k);
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
    if (!c.ready) { if (m.t === 'hello' && !c.id) hello(S, net, c, m); return; }
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
      if (typeof m.rv === 'string' && RIDES.has(m.rv)) { c.pose.rv = m.rv; c.pose.ry = num(m.ry, -1e4, 1e4, 0); c.pose.rh = num(m.rh, -8, 8, 0); }
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
        if (!Number.isInteger(id) || id < 0 || id > 255) continue;
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
      if (!c.host && S.host && !S.host.stopped) net.send(S.host.c, { t: 'edits', e: out });   // the server's game has every chunk it has built
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
      net.send(to, { t: 'hit', from: c.id, name: c.name, dmg: num(m.dmg, 0, 40, 1), kx: num(m.kx, -1, 1, 0), kz: num(m.kz, -1, 1, 0) });
      return;
    }
    case 'save': {                     // this player's own state (inventory, position...), handed back when they next join
      if (!m.player || typeof m.player !== 'object' || size > LIMITS.playerBlob) return;
      world.players[playerKey(c.name)] = { ...m.player, name: c.name, seen: new Date().toISOString(), ...(c.gm ? { gm: c.gm } : {}) };
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
      world.drops[m.id] = d; S.dirty = true;
      net.broadcast({ t: 'drop', id: m.id, dim: d.dim, x: d.x, y: d.y, z: d.z, vx: num(m.vx, -60, 60, 0), vy: num(m.vy, -60, 60, 0), vz: num(m.vz, -60, 60, 0), st }, c);
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
      delete world.drops[m.id]; S.dirty = true;
      if (!m.gone) net.send(c, { t: 'took', id: m.id });   // gone: the item was destroyed in that player's game, nobody gets it
      net.broadcast({ t: 'undrop', id: m.id }, c);
      return;
    }
    case 'death': {                    // announced to the others in chat, in the server's words
      S.log(`${c.name} died`);
      net.broadcast({ t: 'sys', txt: deathText(c, m, now) }, c);
      c.lastHit = null;
      return;
    }
    case 'mobs': {                     // the mobs this player's game is running, for the players around them
      if (c.host) {                    // the server's own game: each player gets the ones within range of them
        if (!Array.isArray(m.m)) return;
        const list = m.m.map(cleanMob).filter(Boolean);
        for (const p of S.clients.values()) {
          if (!p.ready || !p.pose || p.pose.dim !== 'over') continue;
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
        if (ids.length) net.broadcast({ t: 'mgone', from: 0, ids, dead: m.dead ? 1 : 0 }, null, (p) => !!p.pose && p.pose.dim === 'over');
        return;
      }
      if (!c.pose || !Array.isArray(m.ids) || m.ids.length > LIMITS.mobsPerMsg || size > LIMITS.mobBlob) return;
      const ids = m.ids.filter((v) => typeof v === 'string' && v.length <= 24);
      if (ids.length) net.broadcast({ t: 'mgone', from: c.id, ids, dead: m.dead ? 1 : 0 }, c, (p) => near(p.pose, c.pose, LIMITS.mobRange));
      return;
    }
    case 'mgive': {                    // "you are nearer to this mob than I am: your game runs it from now on"
      const to = peerOf(S, m.to), mob = cleanMob(m.m);
      if (!to || to === c || !to.ready || !mob || (to.host ? !c.pose || c.pose.dim !== 'over' : !near(c.pose, to.pose, LIMITS.mobRange))) return;
      net.send(to, { t: 'mgive', from: c.id, m: mob });
      return;
    }
    case 'mhit': {                     // a player hit a mob that another player's game is running
      const to = peerOf(S, m.to);
      if (!to || to === c || !to.ready || typeof m.id !== 'string' || m.id.length > 24 || (to.host ? !c.pose || c.pose.dim !== 'over' : !near(c.pose, to.pose, LIMITS.mobRange)) || !allow(c, 'mhit', 12, now)) return;
      net.send(to, { t: 'mhit', from: c.id, name: c.name, id: m.id, dmg: num(m.dmg, 0, 1e6, 1), kx: num(m.kx, -1e3, 1e3, 0), kz: num(m.kz, -1e3, 1e3, 0) });
      return;
    }
    case 'boom': {                     // an explosion in this player's game: the others nearby feel it (the holes travel as edits)
      if (!c.host && (!c.pose || !allow(c, 'boom', 20, now))) return;
      const at = c.host ? { dim: 'over', x: num(m.x, -3e7, 3e7, 0), z: num(m.z, -3e7, 3e7, 0) } : { dim: c.pose.dim, x: num(m.x, -3e7, 3e7, c.pose.x), z: num(m.z, -3e7, 3e7, c.pose.z) };
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
    case 'hsnap': {                    // (the server's game) every mob it has, for the next save
      world.mobs = cleanMobs(m.mobs); S.dirty = true;
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
  if (S.clients.size && world.gr.dayCycle !== false) { world.time = (world.time + dt / DAY_LEN) % 1; S.dirty = true; }
  if (S.clients.size && (T.time += dt) >= 5) { T.time = 0; net.broadcast({ t: 'time', v: +world.time.toFixed(5) }); }
  if (S.clients.size && (T.drops += dt) >= 5) {
    const aged = T.drops; T.drops = 0;
    for (const id of Object.keys(world.drops)) {
      const d = world.drops[id];
      d.age = (d.age || 0) + aged; S.dirty = true;
      if (d.st && d.st.id < 10000 && d.age > LIMITS.dropLife) { delete world.drops[id]; net.broadcast({ t: 'undrop', id }); }
    }
  }
}
