// renderer.js: the page. It knows nothing of Node: everything goes through window.dc (preload.js).
// Layout: the servers down the left; on the right the one that is picked (S.id), a header of buttons and nine tabs.
'use strict';
const $ = (id) => document.getElementById(id);
const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); for (const k of kids || []) e.append(k); return e; };
const S = { id: null, servers: [], versions: [], remote: [], cur: null, settings: null, tab: 'dash', history: [], hpos: 0 };

const fmtUp = (s) => { s = Math.max(0, s | 0); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0; return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m ? m + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s'; };
const fmtB = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(0) + ' MB' : n > 0 ? Math.max(1, Math.round(n / 1024)) + ' KB' : 'not known');
const fmtEvery = (m) => (m % 1440 === 0 ? m / 1440 + ' d' : m % 60 === 0 ? m / 60 + ' h' : m + ' min');
const DIMS = { over: 'Overworld', nether: 'The Nether', aether: 'The Aether', puppet: 'Puppet Purgatory' };

/* ---- the list of servers ---- */
function paintList() {
  $('slist').replaceChildren(...S.servers.map((s) => el('div', { className: 'srv' + (s.id === S.id ? ' on' : ''), onclick: () => pick(s.id) }, [
    el('span', { className: 'dot ' + (s.running ? 'on' : s.starting ? 'wait' : '') }),
    el('div', {}, [el('b', { textContent: s.name }), el('small', { textContent: (s.running ? s.players + ' online, port ' + s.port : s.starting ? 'starting' : 'stopped, port ' + s.port) + ', ' + (s.version ? (s.version === 'checkout' ? 'this checkout' : 'v' + s.version) + (s.runs ? '' : ' (missing)') : 'no version') })]),
  ])));
}
/* ---- server versions: the library, and the one this server runs ---- */
function paintVersions() {
  $('novers').hidden = S.versions.length > 0;
  let lastLab = null;                                      /* 1.1.1: a heading for each release name */
  $('vlist').replaceChildren(...S.versions.flatMap((v) => { const lab = v.version === 'checkout' ? 'This checkout' : v.label || 'Other versions';
    const head = lab !== lastLab ? [el('div', { className: 'vlab', textContent: lab })] : []; lastLab = lab; return [...head, el('div', { className: 'ver', title: v.label || '' }, [
    el('b', { textContent: v.version === 'checkout' ? 'this checkout' : 'v' + v.version }),
    el('small', { textContent: v.users.length ? v.users.length + ' server' + (v.users.length === 1 ? '' : 's') : 'not in use' }),
    ...(v.version === 'checkout' || v.users.length ? [] : [el('button', { textContent: 'Remove', className: 'danger', onclick: async () => { const r = await window.dc.removeVersion(v.version); $('vmsg').textContent = r.ok ? 'Removed v' + v.version + '.' : r.why; } })]),
  ])]; }));
  const sel = $('sver'), c = S.cur, have = S.versions.map((v) => v.version);
  versionOptions(sel, allVersions().filter((x) => x.have), () => '');   /* 1.1.1: grouped under their release names */
  if (c && c.version && !have.includes(c.version)) sel.append(el('option', { value: c.version, textContent: vName(c.version) + ' (missing)' }));
  if (c && !c.version) sel.prepend(el('option', { value: '', textContent: 'none' }));
  sel.value = (c && c.version) || '';
  sel.disabled = !c || c.running || c.starting;
  sel.title = c && (c.running || c.starting) ? 'Stop the server to change its version' : 'The server version this server runs';
}
/* ---- 1.4: upgrading a server to a newer version ---- */
/* show the button when a newer version is here (or, after a check, on GitHub) */
async function paintUpgrade(online) {
  const b = $('b_upgrade'), id = S.id;
  if (!id || !S.cur || !S.cur.version || S.cur.version === 'checkout') { b.hidden = true; $('upmsg').textContent = ''; return; }
  const r = await window.dc.upgrades(id, !!online);
  if (id !== S.id || !r || r.ok === false) return;
  S.newest = r.newest;
  b.hidden = !r.newest; b.textContent = r.newest ? 'Upgrade to ' + vName(r.newest) : '';
  b.title = r.newest ? (r.have ? 'v' + r.newest + ' is in the library' : 'v' + r.newest + ' is downloaded from GitHub first') + ': the world is backed up, then the server runs the new version' : '';
  if (online) $('upmsg').textContent = r.why ? r.why : r.newest ? '' : 'This server runs the newest version (' + vName(r.current) + ').';
}
$('b_upcheck').onclick = async () => { $('upmsg').textContent = 'Checking GitHub...'; $('b_upcheck').disabled = true; try { await paintUpgrade(true); } finally { $('b_upcheck').disabled = false; } };
$('b_upgrade').onclick = async () => {
  const c = S.cur, v = S.newest; if (!c || !v) return;
  if (!window.confirm('Upgrade "' + c.name + '" from ' + vName(c.version) + ' to ' + vName(v) + '?\n\n' + (c.running || c.starting ? 'The server is stopped (it saves first), ' : '') + 'the world is backed up, then ' + (c.running || c.starting ? 'it starts again on ' : 'it runs ') + vName(v) + '. The backup is under Backups if you ever need to go back.')) return;
  S.upgrading = v; $('b_upgrade').disabled = true; $('upmsg').textContent = 'Upgrading to ' + vName(v) + '...';
  try {
    const r = await window.dc.upgrade(c.id, v);
    $('upmsg').textContent = r.ok ? 'Upgraded to ' + vName(r.version) + (r.backup ? ' (backup: ' + r.backup + ')' : '') + '.' : r.why || 'The upgrade did not finish.';
  } finally { S.upgrading = ''; $('b_upgrade').disabled = false; paintUpgrade(false); }
};
$('sver').onchange = async () => {
  const v = $('sver').value; if (!S.id || !v) return;
  let r = await window.dc.setVersion(S.id, v, false);
  if (r && r.ask) r = window.confirm(r.ask) ? await window.dc.setVersion(S.id, v, true) : { ok: false, why: '' };
  if (r && r.ok === false && r.why) say(r.why);
  S.settings = null; if (S.tab === 'settings' || S.tab === 'rules') loadSettings();
  paintVersions();
};
const importV = async (kind) => {
  $('vmsg').textContent = 'Importing...';
  const r = await window.dc.importVersion(kind);
  $('vmsg').textContent = r.ok ? 'Imported v' + r.version + '.' : r.why || '';
};
$('b_vzip').onclick = () => importV('zip');
$('b_vdir').onclick = () => importV('folder');
async function pick(id) {
  S.id = id; S.settings = null;
  $('log').textContent = '';
  const st = await window.dc.state(id);
  if (st && st.ok === false) { S.cur = null; paint(); return; }
  S.cur = st;
  for (const l of st.log) say(l);
  paintList(); paint(); showTab(S.tab);
  $('upmsg').textContent = ''; paintUpgrade(false);
}
function takeServers(o) {
  S.servers = o.servers; S.versions = o.versions || []; paintVersions(); if (!$('newserver').hidden) nsOptions();
  if (!S.servers.some((s) => s.id === S.id)) { S.id = null; S.cur = null; if (S.servers[0]) return pick(S.servers[0].id); }
  paintList(); if (!S.id) paint();
  if (S.id && !S.upgrading) paintUpgrade(false);           /* 1.4: a version just imported may be newer */
}
/* ---- a new server: a name and a version. The versions are the ones here and (1.1) the ones on GitHub; one that is not
   here yet is downloaded and imported when the server is created. The refresh button asks GitHub again. ---- */
const vName = (v) => (v === 'checkout' ? 'this checkout' : 'v' + v);
const mb = (n) => (n > 0 ? Math.round(n / 1048576) + ' MB' : '');
/* 1.1.1: every version, here or on GitHub, with its release name ("DingleCraft Multiplayer 2.0", "Release 1.1"), its title
   and whether it is a full release or a beta (what GitHub says; a version only here takes the name its game file has) */
function allVersions() {
  const remote = new Map(S.remote.map((x) => [x.version, x]));
  const all = [...S.versions.map((v) => ({ ...(remote.get(v.version) || {}), version: v.version, label: (remote.get(v.version) || {}).label || v.label || '', have: true })),
    ...S.remote.filter((x) => !S.versions.some((v) => v.version === x.version)).map((x) => ({ ...x, have: false }))];
  const num = (v) => (v === 'checkout' ? [1e9, 0] : v.split('.').map(Number));
  return all.sort((a, b) => { const x = num(a.version), y = num(b.version); return (y[0] - x[0]) || (y[1] - x[1]); });
}
/* a select's options, grouped under each release name in the order the names first come (newest first) */
function versionOptions(sel, all, extra) {
  const groups = [];
  for (const x of all) { const g = x.version === 'checkout' ? 'This checkout' : x.label || 'Other versions'; let G = groups.find((q) => q.g === g); if (!G) groups.push(G = { g, list: [] }); G.list.push(x); }
  const text = (x) => vName(x.version) + (x.title ? '  ' + x.title : x.label ? '  ' + x.label : '')   /* no title of its own (a named release): its name, so the closed box says it */ + (x.prerelease === false ? '  (release)' : x.prerelease ? '  (beta)' : '') + extra(x);
  sel.replaceChildren(...groups.map((G) => el('optgroup', { label: G.g }, G.list.map((x) => el('option', { value: x.version, textContent: text(x) })))));
}
function nsOptions() {
  const sel = $('ns_ver'), was = sel.value, all = allVersions();
  versionOptions(sel, all, (x) => (x.have ? '' : '  (download' + (x.size ? ', ' + mb(x.size) : '') + ')'));
  if (!all.length) sel.append(el('option', { value: '', textContent: 'no versions: press refresh' }));
  sel.value = all.some((x) => x.version === was) ? was : (all[0] ? all[0].version : '');
}
async function nsRefresh(force) {
  $('ns_msg').textContent = 'Checking GitHub for versions...';
  const r = await window.dc.remoteVersions(!!force);
  S.remote = r.list || [];
  $('ns_msg').textContent = r.ok ? (force ? 'Up to date: ' + S.remote.length + ' version' + (S.remote.length === 1 ? '' : 's') + ' on GitHub.' : '') : r.why;
  nsOptions();
}
$('b_new').onclick = () => {
  $('newserver').hidden = !$('newserver').hidden;
  if (!$('newserver').hidden) { nsOptions(); nsRefresh(false); $('ns_name').focus(); }
};
$('ns_refresh').onclick = () => nsRefresh(true);
$('newserver').onsubmit = async (e) => {
  e.preventDefault();
  const v = $('ns_ver').value, name = $('ns_name').value;
  if (!v) { $('ns_msg').textContent = 'Pick a version first (refresh checks GitHub).'; return; }
  $('ns_go').disabled = true;
  try {
    if (!S.versions.some((x) => x.version === v)) {
      $('ns_msg').textContent = 'Downloading ' + vName(v) + '...';
      const d = await window.dc.downloadVersion(v);
      if (!d.ok) { $('ns_msg').textContent = d.why; return; }
    }
    const r = await window.dc.addServer({ name, version: v });
    if (!r.ok) { $('ns_msg').textContent = r.why; return; }
    $('ns_name').value = ''; $('ns_msg').textContent = ''; $('newserver').hidden = true; pick(r.id);
  } finally { $('ns_go').disabled = false; }
};
window.dc.on('dl', (m) => {
  if (S.upgrading && m.version === S.upgrading) $('upmsg').textContent = m.got !== undefined ? 'Downloading ' + vName(m.version) + ': ' + mb(m.got) + (m.total ? ' of ' + mb(m.total) : '') : m.failed ? m.failed : 'Downloaded ' + vName(m.version) + '.';
  if (m.got !== undefined) $('ns_msg').textContent = 'Downloading ' + vName(m.version) + ': ' + mb(m.got) + (m.total ? ' of ' + mb(m.total) : '');
  else if (m.done) $('ns_msg').textContent = 'Downloaded ' + vName(m.version) + '.';
  else if (m.failed) $('ns_msg').textContent = m.failed;
});
$('b_adopt').onclick = async () => { const r = await window.dc.adoptServer(); if (r.ok) pick(r.id); else if (r.why) say(r.why); };

/* ---- tabs ---- */
for (const b of $('tabs').querySelectorAll('button')) b.onclick = () => showTab(b.dataset.tab);
function showTab(name) {
  S.tab = name;
  for (const b of $('tabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === name);
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== 't_' + name;
  if (!S.id) return;
  if (name === 'settings' || name === 'rules') loadSettings();
  if (name === 'worlds') loadWorlds();
  if (name === 'files') loadFiles();
  if (name === 'backups') loadBackups();
  if (name === 'sched') paintTasks();
  if (name === 'console') $('log').scrollTop = $('log').scrollHeight;
}

/* ---- the header and the dashboard ---- */
function paint() {
  const c = S.cur, st = c && c.status, running = !!(c && c.running), starting = !!(c && c.starting);
  paintVersions();
  $('sname').textContent = c ? c.name : 'No server selected';
  $('sport').textContent = c ? 'port ' + c.port : '';
  const pill = $('pill'); pill.textContent = running ? 'running' : starting ? 'starting' : 'stopped'; pill.className = 'pill ' + (running ? 'on' : starting ? 'wait' : 'off');
  $('b_start').disabled = !c || running || starting || !c.runs; $('b_stop').disabled = !running && !starting; $('b_restart').disabled = !running; $('b_kill').disabled = !running && !starting;
  $('b_browser').disabled = !(st && st.game);
  $('c_status').textContent = running ? 'Running' : starting ? 'Starting' : 'Stopped';
  $('c_uptime').textContent = st ? 'up ' + fmtUp(st.uptime) + (st.version ? ', game ' + st.version : '') : '';
  $('c_players').textContent = st ? String(st.players.length) : '0';
  $('c_max').textContent = st ? 'of ' + st.max + (st.accounts ? ', accounts' : ', open to anyone') : '';
  $('c_mem').textContent = st ? fmtB(st.memory) : 'none';
  $('c_world').textContent = st && st.worldDir ? st.worldDir.split(/[\\/]/).pop() : 'none';
  $('c_diff').textContent = st ? (st.mode === 'c' ? 'Creative' : 'Survival') + ', ' + st.difficulty : '';
  $('datadir').textContent = c ? c.dataDir : '';
  const addrs = $('addrs'); addrs.replaceChildren();
  if (st) {
    const scheme = st.secure ? 'https' : 'http';
    for (const a of ['localhost', ...st.addresses]) {
      const url = scheme + '://' + a + ':' + st.port + '/';
      addrs.append(el('div', {}, [el('code', { textContent: url }), el('span', { className: 'dim', textContent: a === 'localhost' ? 'this computer' : 'your network' }), el('button', { textContent: 'Copy', onclick: () => window.dc.copy(url) })]));
    }
    if (!st.game) addrs.append(el('div', { className: 'warn', textContent: 'No game file was found to hand out. Players need their own copy of the game and choose Multiplayer.' }));
  } else addrs.append(el('div', { className: c && !c.runs ? 'warn' : 'dim', textContent: !c ? 'Pick a server on the left, or make one.' : !c.runs ? 'Give this server a version (Version, at the top) before starting it. Import one under Server versions on the left.' : 'Start the server to get its address.' }));
  $('hosts').replaceChildren(...(st ? st.hosts : []).map((h) => el('tr', {}, [el('td', { textContent: DIMS[h.dim] || h.dim }), el('td', { textContent: h.paused ? 'paused (nobody there)' : h.ready ? 'running' : h.running ? 'starting' : 'asleep (starts when a player goes there)' }), el('td', { textContent: h.running ? fmtB(h.heap) : '' })])));
  paintPlayers();
}
/* 6.49: every account, with what can be done to it */
function paintAccounts() {
  const st = S.cur && S.cur.status, list = (st && st.accountList) || [], G = (st && st.locks) || {};
  $('noaccounts').hidden = list.length > 0;
  $('acnote').textContent = !st ? 'Start the server to manage its accounts.' : st.accounts ? 'Players log in with an account made here.' : 'Accounts are off (Settings): anyone may join by name, but a name that has an account needs its password.';
  const act = (label, line) => el('button', { textContent: label, onclick: () => acRun(line) });
  $('aclist').replaceChildren(...list.map((a) => {
    const inp = el('input', { maxLength: 64, placeholder: 'new password or name', spellcheck: false });
    const lock = (k, word) => { const on = !!(a.locks && a.locks[k]); return el('button', { textContent: word + (on ? ': locked' : G[k] ? ': locked for all' : ': free'), onclick: () => acRun('account lock ' + a.name + ' ' + k + (on ? ' off' : ' on')) }); };
    return el('tr', {}, [
      el('td', {}, [a.name, ...(a.online ? [el('span', { className: 'tag', textContent: 'online' })] : []), ...(a.op ? [el('span', { className: 'tag', textContent: 'operator' })] : [])]),
      el('td', { className: 'acts' }, [lock('name', 'Name'), lock('password', 'Password'), lock('skin', 'Skin')]),
      el('td', { className: 'acts' }, [inp, el('button', { textContent: 'Set password', onclick: () => { if (inp.value.trim()) { acRun('account password ' + a.name + ' ' + inp.value.trim()); inp.value = ''; } } }),
        el('button', { textContent: 'Rename', onclick: () => { if (inp.value.trim()) acRun('account rename ' + a.name + ' ' + inp.value.trim()); } }),
        el('button', { textContent: 'Set skin', onclick: () => { S.skinFor = a.name; $('ac_skinfile').value = ''; $('ac_skinfile').click(); } }),
        ...(a.skin ? [act('Reset skin', 'setskin ' + a.name + ' reset')] : []), act('Remove', 'account remove ' + a.name)]),
    ]);
  }));
}
/* an account command from this tab: its answer shows here as well as in the console, and a password typed for add or
   password is shown in the console as **** (6.61: the server keeps only its hash; the window does not keep the text either) */
async function acRun(line) {
  if (!S.id) return;
  const w = line.split(' '), shown = /^account (add|password)$/i.test(w.slice(0, 2).join(' ')) ? w.map((x, i) => (i === 3 ? '****' : x)).join(' ') : line;
  say('> ' + shown);
  const out = await window.dc.command(S.id, line);
  say(out); $('acmsg').textContent = out || '';
}
$('acform').onsubmit = (e) => {
  e.preventDefault();
  const n = $('ac_name').value.trim(), p = $('ac_pass').value.trim();
  if (!n || !p) return;
  acRun('account add ' + n + ' ' + p);
  $('ac_name').value = ''; $('ac_pass').value = '';
};
$('ac_skinfile').onchange = () => {
  const f = $('ac_skinfile').files && $('ac_skinfile').files[0], who = S.skinFor;
  if (!f || !who || !S.id) return;
  const rd = new FileReader();
  rd.onload = async () => { const b64 = String(rd.result).replace(/^data:[^,]*,/, ''); say('> setskin ' + who + ' (' + f.name + ')'); say(await window.dc.setSkin(S.id, who, b64)); };
  rd.readAsDataURL(f);
};
function paintPlayers() {
  paintAccounts();
  const list = S.cur && S.cur.status ? S.cur.status.players : [];
  $('noplayers').hidden = list.length > 0;
  const act = (label, line) => el('button', { textContent: label, onclick: () => run(line) });
  $('plist').replaceChildren(...list.map((p) => el('tr', {}, [
    el('td', {}, [p.name, ...(p.op ? [el('span', { className: 'tag', textContent: 'operator' })] : []), ...(p.gm === 'spectator' ? [el('span', { className: 'tag', textContent: 'spectator' })] : [])]),
    el('td', { textContent: DIMS[p.dim] || p.dim || '' }), el('td', { textContent: p.dim ? p.x + ', ' + p.y + ', ' + p.z : '' }), el('td', { textContent: p.ms ? p.ms + ' ms' : '' }),
    el('td', { className: 'acts' }, [act('Kick', 'kick ' + p.name), act('Ban', 'ban ' + p.name), act(p.op ? 'Deop' : 'Op', (p.op ? 'deop ' : 'op ') + p.name),
      ...list.filter((q) => q !== p).slice(0, 3).map((q) => act('To ' + q.name, 'tp ' + p.name + ' ' + q.name))]),
  ])));
}

/* ---- console ---- */
function say(line) {
  if (line === undefined || line === null || line === '') return;
  const log = $('log'), stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  log.append(String(line) + '\n');
  if (log.childNodes.length > 3000) log.removeChild(log.firstChild);
  if (stick) log.scrollTop = log.scrollHeight;
}
async function run(line) { if (!S.id) return; say('> ' + line); say(await window.dc.command(S.id, line)); }
$('cmdform').onsubmit = (e) => {
  e.preventDefault();
  const line = $('cmd').value.trim();
  if (!line) return;
  S.history.push(line); if (S.history.length > 100) S.history.shift(); S.hpos = S.history.length;
  $('cmd').value = '';
  run(line);
};
$('cmd').onkeydown = (e) => {
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  S.hpos = Math.max(0, Math.min(S.history.length, S.hpos + (e.key === 'ArrowUp' ? -1 : 1)));
  $('cmd').value = S.history[S.hpos] || '';
};

/* ---- settings and game rules: two forms over one server.json ---- */
const FIELDS = [['name', 'Server name', 'text'], ['motd', 'Message of the day', 'text'], ['port', 'Port', 'int'], ['accounts', 'Players need an account to join (make them on the Players tab)', 'bool'], ['maxPlayers', 'Most players at once', 'int'],
  ['mode', 'Mode for new players', 'mode'], ['pvp', 'Players can hurt each other (PvP)', 'bool'], ['viewChunks', 'View distance sent to players (chunks)', 'int'], ['pauseWhenEmpty', 'Pause a world nobody is in after (seconds; 0 never)', 'int'], ['stopWhenEmpty', 'Stop a paused Nether or Aether after (minutes; 0 never)', 'int'],
  ['simulationDistance', 'How far round each player the server runs the world (chunks, 4 to 12)', 'int'], ['catchUpMax', 'Most a crop or furnace catches up at once (minutes; 0 no limit)', 'int'],
  ['compressAfter', 'Compress land nobody has visited for (days; 0 never)', 'int'], ['compressPlayersAfter', 'Compress players who have not joined for (days; 0 never)', 'int'], ['spawnProtection', 'Spawn protection (blocks; 0 for none)', 'int'],
  ['sleepPercent', 'Players asleep to skip the night (%)', 'int'], ['simulate', 'The server runs the world itself (mobs, water, crops)', 'bool'], ['singlePlayer', 'The served game may also play alone', 'bool'],
  ['lockNames', 'Nobody may change their own name', 'bool'], ['lockPasswords', 'Nobody may change their own password', 'bool'], ['lockSkins', 'Nobody may change their own skin', 'bool'],
  ['whitelist', 'Only listed players may join (whitelist)', 'bool'], ['allow', 'Whitelist (one name a line)', 'list'], ['ops', 'Operators (one name a line)', 'list'], ['bans', 'Banned (one name a line)', 'list'],
  ['cert', 'TLS certificate file, PEM (empty: plain http)', 'text'], ['key', 'TLS private key file, PEM', 'text'], ['origins', 'Web pages allowed to connect (one address a line; empty: any)', 'list']];
/* the game rules' names, for a server from before 6.58 (a newer one names its own: formSchema) */
const RULE_NAMES = { keepInv: 'Keep inventory on death', god: 'God mode', mobGrief: 'Mob griefing', mobSpawn: 'Natural mob spawning', dayCycle: 'Daylight cycle', fireTick: 'Fire spreads', fallDmg: 'Fall damage', snail: 'The Eternal Snail',
  jsc: 'Jumpscare chance (0 to 100)', instaKill: 'Instant kill', freezeMobs: 'Freeze all mobs', ghosts: 'Guilt ghosts', figDrops: 'Figurine drops', fbOK: 'Fullbright allowed', store: 'Dingle Store', powers: 'Superpowers', cheats: 'Cheats (the debug menu, for everyone)',
  nether: 'The Nether', aether: 'The Aether', puppet: 'Puppet Purgatory', difficulty: 'Difficulty' };
/* settings the form does not show: the game rules (their own tab), the world (Worlds tab), the seed of a new world, the game file */
const HIDDEN = ['rules', 'world', 'seed', 'game'];
/* A form is built from descriptions: { key, label, kind: text | int | bool | list | select, min, max, options, group }.
   A server from 6.58 on describes its own settings and rules (formSchema in its lib/admin.mjs): a setting or rule a newer
   version adds shows with its own label and limits. An older server has none: the window's own list above is used. Either
   way, anything the server has that no description covers is still shown, under its own name, so nothing is left out. */
const guess = (k, v) => ({ key: k, label: k, kind: typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'int' : Array.isArray(v) ? 'list' : 'text' });
const plain = (v) => v === null || ['boolean', 'number', 'string'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
function describe(values, described, skip) {
  const known = described.filter((d) => d.key in values), seen = new Set([...described.map((d) => d.key), ...skip]);
  return [...known, ...Object.keys(values).filter((k) => !seen.has(k) && plain(values[k])).map((k) => guess(k, values[k]))];
}
const OLD_SETTINGS = FIELDS.map(([key, label, kind]) => (kind === 'mode' ? { key, label, kind: 'select', options: [['s', 'Survival'], ['c', 'Creative']] } : { key, label, kind }));
const OLD_RULES = Object.keys(RULE_NAMES).map((key) => (key === 'difficulty' ? { key, label: RULE_NAMES[key], kind: 'select', options: ['easy', 'normal', 'hard', 'dinglecore'].map((d) => [d, d === 'dinglecore' ? 'DingleCore (one life)' : d[0].toUpperCase() + d.slice(1)]) }
  : { key, label: RULE_NAMES[key], kind: key === 'jsc' ? 'int' : 'bool', ...(key === 'jsc' ? { min: 0, max: 100 } : {}) }));
/* one form from descriptions and values; a heading wherever the group changes */
function buildForm(form, list, values) {
  form.replaceChildren();
  if (list.some((d) => d.group)) {                         /* each group together, in the order it first appears; the undescribed last, as Other */
    const order = [...new Set(list.map((d) => d.group || 'Other'))].sort((x, y) => (x === 'Other') - (y === 'Other'));
    list = order.flatMap((g) => list.filter((d) => (d.group || 'Other') === g).map((d) => ({ ...d, group: g })));
  }
  let group = null;
  for (const d of list) {
    if (d.group && d.group !== group) { group = d.group; form.append(el('h4', { className: 'fgroup', textContent: d.group })); }
    const range = d.kind === 'int' && Number.isFinite(d.min) && Number.isFinite(d.max) && !/\d\s*(to|-)\s*\d/.test(d.label) ? d.min + ' to ' + d.max : '';
    const v = values[d.key], label = !range ? d.label : /\)$/.test(d.label) ? d.label.slice(0, -1) + '; ' + range + ')' : d.label + ' (' + range + ')';
    let input;
    if (d.kind === 'bool') { input = el('input', { type: 'checkbox', checked: !!v }); form.append(el('label', { className: 'check' }, [input, label])); }
    else if (d.kind === 'select') { input = el('select', {}, (d.options || []).map(([val, txt]) => el('option', { value: String(val), textContent: txt }))); input.value = String(v); form.append(el('label', {}, [label, input])); }
    else if (d.kind === 'list') { input = el('textarea', { rows: 3, value: (v || []).join('\n') }); form.append(el('label', {}, [label, input])); }
    else {
      input = el('input', { type: d.kind === 'int' ? 'number' : 'text', value: v === undefined || v === null ? '' : String(v) });
      if (d.kind === 'int') { if (Number.isFinite(d.min)) input.min = d.min; if (Number.isFinite(d.max)) input.max = d.max; }
      else if (Number.isFinite(d.max)) input.maxLength = d.max;
      form.append(el('label', {}, [label, input]));
    }
    input.dataset.k = d.key; input.dataset.kind = d.kind === 'select' ? 'text' : d.kind;
  }
}
async function loadSettings() {
  const r = await window.dc.readSettings(S.id);
  if (!r.ok) { $('setmsg').textContent = r.why || 'could not read the settings'; return; }
  S.settings = r.settings;
  $('setmsg').textContent = ''; $('rulemsg').textContent = '';
  const sc = r.schema && Array.isArray(r.schema.settings) && Array.isArray(r.schema.rules) ? r.schema : null;
  buildForm($('setform'), describe(S.settings, sc ? sc.settings : OLD_SETTINGS, sc && Array.isArray(sc.elsewhere) ? sc.elsewhere : HIDDEN), S.settings);
  const rules = S.settings.rules || {};
  buildForm($('ruleform'), describe(rules, sc ? sc.rules : OLD_RULES, []), rules);
}
function readForm(form) {
  const o = {};
  for (const i of form.querySelectorAll('[data-k]')) {
    const kind = i.dataset.kind;
    o[i.dataset.k] = kind === 'bool' ? i.checked : kind === 'int' ? (i.value.trim() === '' ? NaN : Number(i.value)) : kind === 'list' ? i.value.split('\n').map((s) => s.trim()).filter(Boolean) : i.value;
  }
  return o;
}
async function saveSettings(msgEl) {
  if (!S.settings || !S.id) return;
  const next = { ...S.settings, ...readForm($('setform')), rules: { ...(S.settings.rules || {}), ...readForm($('ruleform')) } };
  for (const l of document.querySelectorAll('.form label')) { l.classList.remove('bad'); const w = l.querySelector('.why'); if (w) w.remove(); }
  const r = await window.dc.saveSettings(S.id, next);
  if (!r.ok) {
    for (const e of r.errors || []) {
      const key = e.key.replace(/^rules\./, ''), input = document.querySelector('.form [data-k="' + key + '"]');
      if (input) { const l = input.closest('label'); l.classList.add('bad'); l.append(el('small', { className: 'why', textContent: e.why })); }
    }
    msgEl.textContent = r.why || 'Not saved: ' + (r.errors || []).length + ' value(s) need fixing.';
    return;
  }
  S.settings = next;
  const live = S.cur && S.cur.running;
  msgEl.textContent = 'Saved.' + (r.restart && r.restart.length ? ' Restart the server for: ' + r.restart.join(', ') + '.' : live ? ' Game rules are read when the server starts; to change one right now use /gamerule in the console.' : '') + (r.note ? ' ' + r.note : '');
}
$('b_savesettings').onclick = (e) => { e.preventDefault(); saveSettings($('setmsg')); };
$('b_saverules').onclick = (e) => { e.preventDefault(); saveSettings($('rulemsg')); };

/* ---- worlds ---- */
async function loadWorlds() {
  const r = await window.dc.worlds(S.id);
  if (!r.ok) { $('worldmsg').textContent = r.why || ''; return; }
  $('wlist').replaceChildren(...r.worlds.map((w) => el('tr', {}, [
    el('td', {}, [w.name, ...(w.name === r.current ? [el('span', { className: 'tag', textContent: 'in use' })] : [])]),
    el('td', { textContent: w.seed }), el('td', { textContent: w.mode === 'c' ? 'Creative' : 'Survival' }), el('td', { textContent: w.difficulty }), el('td', { textContent: fmtB(w.bytes) }),
    el('td', { className: 'acts' }, w.name === r.current ? [] : [el('button', { textContent: 'Use this world', onclick: async () => { const u = await window.dc.useWorld(S.id, w.name); $('worldmsg').textContent = u.ok ? 'Selected.' + (u.restart ? ' Restart the server to load it.' : '') : u.why; loadWorlds(); } })]),
  ])));
  $('worldmsg').textContent = r.worlds.length ? '' : 'No world yet: one is made the first time the server starts.';
}
$('newworld').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), r = await window.dc.newWorld(S.id, { name: String(f.get('name')).trim(), seed: String(f.get('seed')), mode: f.get('mode'), difficulty: f.get('difficulty') });
  if (r.ok) e.target.reset();
  await loadWorlds();
  $('worldmsg').textContent = r.ok ? 'The server will make that world when it next starts.' + (r.restart ? ' Restart it now to switch.' : '') : r.why;
};

/* ---- world files (1.2): the packed region and entity files of 6.60, listed, shown and searched ---- */
const WF = { sid: null, world: '', files: [], open: '', tick: new Set(), busy: false };
const fmtAt = (at) => (Array.isArray(at) ? at.map((v) => (typeof v === 'number' ? Math.round(v) : '?')).join(' ') : '');
const sumText = (s) => (!s ? '' : 'chunks' in s ? s.chunks + ' chunk' + (s.chunks === 1 ? '' : 's') + ', ' + s.blocks + ' changed block' + (s.blocks === 1 ? '' : 's') + (s.blockEntities ? ', ' + s.blockEntities + ' chest' + (s.blockEntities === 1 ? '' : 's') + ' or furnace' + (s.blockEntities === 1 ? '' : 's') : '')
  : [s.items && s.items + ' dropped item' + (s.items === 1 ? '' : 's'), s.mobs && s.mobs + ' mob' + (s.mobs === 1 ? '' : 's'), s.vehicles && s.vehicles + ' vehicle' + (s.vehicles === 1 ? '' : 's')].filter(Boolean).join(', ') || 'empty');
async function loadFiles(world) {
  if (WF.sid !== S.id) { WF.sid = S.id; WF.world = ''; }                       /* another server: its own current world */
  $('wf_msg').textContent = 'Reading...';
  const r = await window.dc.worldFiles(S.id, world || WF.world || '');
  if (!r.ok) { $('wf_msg').textContent = r.why || ''; $('wf_list').replaceChildren(); $('wf_none').hidden = true; return; }
  if (r.world !== WF.world) { WF.tick.clear(); WF.open = ''; $('wf_view').hidden = true; $('wf_found').replaceChildren(); }
  WF.world = r.world; WF.files = r.files;
  $('wf_world').replaceChildren(...r.worlds.map((n) => el('option', { value: n, textContent: n, selected: n === r.world })));
  $('wf_save').hidden = !r.running;
  const packed = r.files.filter((f) => f.form === 'packed').length, bytes = r.files.reduce((a, f) => a + f.bytes, 0);
  $('wf_msg').textContent = r.files.length + ' file' + (r.files.length === 1 ? '' : 's') + ', ' + fmtB(bytes) + (packed < r.files.length ? ' (' + (r.files.length - packed) + ' from an older server: written packed the next time the server starts)' : '') + (r.players ? '; ' + r.players + ' player' + (r.players === 1 ? '' : 's') : '');
  $('wf_none').hidden = r.files.length > 0;
  const row = (rel, cells) => el('tr', { className: rel === WF.open ? 'open' : '' }, [el('td', {}, [el('input', { type: 'checkbox', checked: WF.tick.has(rel), onchange: (e) => { if (e.target.checked) WF.tick.add(rel); else WF.tick.delete(rel); } })]), ...cells]);
  $('wf_list').replaceChildren(...r.files.map((f) => row(f.rel, [
    el('td', { className: 'fname', textContent: f.rel, title: 'Show what is in it', onclick: () => openFile(f.rel) }),
    el('td', { textContent: DIMS[f.dim] || f.dim }), el('td', { textContent: f.kind === 'region' || f.kind === 'entities' ? 'x ' + f.rx * 512 + ', z ' + f.rz * 512 : '' }),
    el('td', { textContent: fmtB(f.bytes) + (f.form === 'packed' ? '' : ' (' + f.form + ')') }), el('td', { textContent: f.why ? 'cannot be read: ' + f.why : sumText(f.summary) }),
  ])), ...(r.players ? [row('playerdata', [el('td', { textContent: 'playerdata/' }), el('td', { textContent: '' }), el('td', { textContent: '' }), el('td', { textContent: '' }), el('td', { textContent: r.players + ' player file' + (r.players === 1 ? '' : 's') + ' (searched for what they carry)' })])] : []));
  $('wf_all').checked = false;
}
async function openFile(rel) {
  const r = await window.dc.readWorldFile(S.id, WF.world, rel);
  if (!r.ok) { $('wf_msg').textContent = r.why || ''; return; }
  WF.open = rel;
  for (const tr of $('wf_list').children) tr.classList.toggle('open', tr.querySelector('.fname') && tr.querySelector('.fname').textContent === rel);
  $('wf_view').hidden = false;
  $('wf_vtitle').textContent = rel + ': ' + (DIMS[r.dimension] || r.dimension) + ', region ' + (r.region || []).join(' ') + (r.form === 'packed' ? '' : ' (' + r.form + ', from an older server)');
  $('wf_vmsg').textContent = sumText(r.summary) + (r.cut ? ' (the JSON is cut short here: save it to see all of it)' : '');
  $('wf_tables').replaceChildren(...(r.tables.length ? r.tables.flatMap((t) => [el('h4', { textContent: t.title }), el('table', {}, [el('thead', {}, [el('tr', {}, t.head.map((h) => el('th', { textContent: h })))]), el('tbody', {}, t.rows.map((row) => el('tr', {}, row.map((c) => el('td', { textContent: String(c) })))))])]) : [el('p', { className: 'dim', textContent: 'Nothing in it.' })]));
  $('wf_json').textContent = r.text;
  $('wf_view').scrollIntoView({ block: 'start' });
}
const vtab = (json) => { $('wf_tables').hidden = json; $('wf_json').hidden = !json; $('wf_vtab_t').classList.toggle('on', !json); $('wf_vtab_j').classList.toggle('on', json); };
$('wf_vtab_t').onclick = () => vtab(false);
$('wf_vtab_j').onclick = () => vtab(true);
$('wf_export').onclick = async () => { if (!WF.open) return; const r = await window.dc.exportWorldFile(S.id, WF.world, WF.open); $('wf_vmsg').textContent = r.ok ? 'Saved to ' + r.to : r.why || ''; };
$('wf_world').onchange = () => loadFiles($('wf_world').value);
$('wf_reload').onclick = () => loadFiles();
$('wf_save').onclick = async () => { $('wf_msg').textContent = 'Saving...'; await window.dc.saveWorld(S.id); loadFiles(); };
$('wf_all').onchange = (e) => { WF.tick = new Set(e.target.checked ? [...WF.files.map((f) => f.rel), 'playerdata'] : []); for (const c of $('wf_list').querySelectorAll('input[type=checkbox]')) c.checked = e.target.checked; };
$('wf_find').onsubmit = async (e) => {
  e.preventDefault();
  const query = $('wf_q').value.trim();
  if (!query || WF.busy) return;
  if ($('wf_only').checked && !WF.tick.size) { $('wf_found').replaceChildren(el('p', { className: 'dim', textContent: 'Tick the files to search in the list below, or untick "Only ticked files".' })); return; }
  WF.busy = true; $('wf_found').replaceChildren(el('p', { className: 'dim', textContent: 'Searching...' }));
  const r = await window.dc.findInWorld(S.id, WF.world, { query, files: $('wf_only').checked ? [...WF.tick] : [], blocks: $('wf_k_blocks').checked, items: $('wf_k_items').checked, mobs: $('wf_k_mobs').checked, players: $('wf_k_players').checked });
  WF.busy = false;
  if (!r.ok) { $('wf_found').replaceChildren(el('p', { className: 'dim', textContent: r.why || 'The search failed.' })); return; }
  const head = el('p', { className: 'dim', textContent: (r.hits.length ? r.hits.length + ' found' : 'Nothing matching "' + query + '"') + ' in ' + r.files + ' file' + (r.files === 1 ? '' : 's') + (r.truncated ? ' (stopped at ' + r.hits.length + ': search for something narrower)' : '') + (r.errors.length ? '; ' + r.errors.length + ' could not be read' : '') + '.' });
  if (!r.hits.length) { $('wf_found').replaceChildren(head); return; }
  $('wf_found').replaceChildren(head, el('table', {}, [
    el('thead', {}, [el('tr', {}, ['What', 'How many', 'Where (x y z)', 'Dimension', 'In', 'File'].map((h) => el('th', { textContent: h })))]),
    el('tbody', {}, r.hits.slice(0, 500).map((h) => el('tr', {}, [
      el('td', { textContent: h.name + (h.id !== undefined ? ' #' + h.id : '') }), el('td', { textContent: String(h.count) }), el('td', { className: 'at', textContent: fmtAt(h.at) }),
      el('td', { textContent: DIMS[h.dim] || h.dim || '' }), el('td', { textContent: h.in }),
      el('td', h.rel && h.rel !== 'playerdata' && !h.rel.startsWith('playerdata/') ? { className: 'fname', textContent: h.rel, onclick: () => openFile(h.rel) } : { textContent: h.rel || '' }),
    ]))),
  ]), ...(r.hits.length > 500 ? [el('p', { className: 'dim', textContent: 'The first 500 are shown.' })] : []));
};
window.dc.on('wfind', (m) => { if (m.id === S.id && WF.busy) $('wf_found').replaceChildren(el('p', { className: 'dim', textContent: 'Searching... ' + m.done + ' of ' + m.total + ' files' })); });

/* ---- backups ---- */
async function loadBackups() {
  const r = await window.dc.backups(S.id);
  const list = r.ok ? r.backups : [];
  $('nobackups').hidden = list.length > 0;
  $('blist').replaceChildren(...list.map((b) => el('tr', {}, [
    el('td', { textContent: b.name }), el('td', { textContent: b.world }), el('td', { textContent: new Date(b.made).toLocaleString() }), el('td', { textContent: fmtB(b.bytes) }),
    el('td', { className: 'acts' }, [
      el('button', { textContent: 'Restore', onclick: async () => { const x = await window.dc.restoreBackup(S.id, b.name); $('backmsg').textContent = x.ok ? 'Restored as "' + x.world + '".' + (x.kept ? ' The world as it was is kept as a backup of its own.' : '') : x.why; loadBackups(); } }),
      el('button', { textContent: 'Delete', className: 'danger', onclick: async () => { await window.dc.deleteBackup(S.id, b.name); loadBackups(); } }),
    ]),
  ])));
}
$('b_backup').onclick = async () => { $('backmsg').textContent = 'Backing up...'; const r = await window.dc.backupNow(S.id); $('backmsg').textContent = r.ok ? 'Saved as ' + r.to : 'Backup failed: ' + r.why; loadBackups(); };

/* ---- scheduler ---- */
function paintTasks() {
  const tasks = (S.cur && S.cur.tasks) || [];
  $('notasks').hidden = tasks.length > 0;
  const what = (t) => (t.what === 'backup' ? 'Back up the world (keep ' + t.keep + ')' : t.what === 'restart' ? 'Restart the server' : 'Run: ' + t.command);
  $('tlist').replaceChildren(...tasks.map((t) => el('tr', {}, [
    el('td', { textContent: fmtEvery(t.every) }), el('td', { textContent: what(t) }),
    el('td', {}, [el('input', { type: 'checkbox', checked: t.on !== false, onchange: async (e) => { const r = await window.dc.saveTask(S.id, { ...t, on: e.target.checked }); if (r.ok) { S.cur.tasks = r.tasks; paintTasks(); } } })]),
    el('td', { className: 'acts' }, [el('button', { textContent: 'Delete', className: 'danger', onclick: async () => { const r = await window.dc.deleteTask(S.id, t.id); if (r.ok) { S.cur.tasks = r.tasks; paintTasks(); } } })]),
  ])));
}
$('task_what').onchange = () => { const w = $('task_what').value; $('task_keep_l').hidden = w !== 'backup'; $('task_cmd_l').hidden = w !== 'command'; };
$('newtask').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), r = await window.dc.saveTask(S.id, { every: Number(f.get('every')), what: f.get('what'), keep: Number(f.get('keep')), command: String(f.get('command') || '') });
  $('taskmsg').textContent = r.ok ? '' : r.why;
  if (r.ok) { S.cur.tasks = r.tasks; paintTasks(); }
};

/* ---- the buttons at the top, and what the program tells us ---- */
$('b_start').onclick = async () => { const r = await window.dc.start(S.id); if (r && r.ok === false) { say(r.why); showTab('console'); } };
$('b_stop').onclick = () => window.dc.stop(S.id);
$('b_restart').onclick = () => window.dc.restart(S.id);
$('b_kill').onclick = () => window.dc.kill(S.id);
$('b_browser').onclick = () => window.dc.openBrowser(S.id);
$('b_opendata').onclick = () => window.dc.openData(S.id);
$('b_remove').onclick = async () => { const r = await window.dc.removeServer(S.id); if (r.ok === false) say(r.why); };
window.dc.on('servers', takeServers);
window.dc.on('state', (st) => { if (st.id === S.id) { S.cur = { ...st }; paint(); if (S.tab === 'sched') paintTasks(); } });
window.dc.on('status', (m) => { if (m.id === S.id && S.cur) { S.cur.status = m.status; paint(); } });
window.dc.on('log', (m) => { if (m.id === S.id) say(m.line); });
window.dc.servers().then(takeServers);
