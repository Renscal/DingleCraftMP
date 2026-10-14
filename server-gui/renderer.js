// renderer.js: the page. It knows nothing of Node: everything goes through window.dc (preload.js).
// Layout: the servers down the left; on the right the one that is picked (S.id), a header of buttons and eight tabs.
'use strict';
const $ = (id) => document.getElementById(id);
const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); for (const k of kids || []) e.append(k); return e; };
const S = { id: null, servers: [], cur: null, settings: null, tab: 'dash', history: [], hpos: 0 };

const fmtUp = (s) => { s = Math.max(0, s | 0); const h = (s / 3600) | 0, m = ((s % 3600) / 60) | 0; return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m ? m + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s'; };
const fmtB = (n) => (n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(0) + ' MB' : n > 0 ? Math.max(1, Math.round(n / 1024)) + ' KB' : 'not known');
const fmtEvery = (m) => (m % 1440 === 0 ? m / 1440 + ' d' : m % 60 === 0 ? m / 60 + ' h' : m + ' min');
const DIMS = { over: 'Overworld', nether: 'The Nether', aether: 'The Aether', puppet: 'Puppet Purgatory' };

/* ---- the list of servers ---- */
function paintList() {
  $('slist').replaceChildren(...S.servers.map((s) => el('div', { className: 'srv' + (s.id === S.id ? ' on' : ''), onclick: () => pick(s.id) }, [
    el('span', { className: 'dot ' + (s.running ? 'on' : s.starting ? 'wait' : '') }),
    el('div', {}, [el('b', { textContent: s.name }), el('small', { textContent: s.running ? s.players + ' online, port ' + s.port : s.starting ? 'starting' : 'stopped, port ' + s.port })]),
  ])));
}
async function pick(id) {
  S.id = id; S.settings = null;
  $('log').textContent = '';
  const st = await window.dc.state(id);
  if (st && st.ok === false) { S.cur = null; paint(); return; }
  S.cur = st;
  for (const l of st.log) say(l);
  paintList(); paint(); showTab(S.tab);
}
function takeServers(o) {
  S.servers = o.servers; $('noserver').hidden = o.hasServer;
  if (!S.servers.some((s) => s.id === S.id)) { S.id = null; S.cur = null; if (S.servers[0]) return pick(S.servers[0].id); }
  paintList(); if (!S.id) paint();
}
$('b_new').onclick = () => { $('newserver').hidden = !$('newserver').hidden; if (!$('newserver').hidden) $('ns_name').focus(); };
$('newserver').onsubmit = async (e) => {
  e.preventDefault();
  const r = await window.dc.addServer({ name: $('ns_name').value });
  if (r.ok) { $('ns_name').value = ''; $('newserver').hidden = true; pick(r.id); }
};
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
  if (name === 'backups') loadBackups();
  if (name === 'sched') paintTasks();
  if (name === 'console') $('log').scrollTop = $('log').scrollHeight;
}

/* ---- the header and the dashboard ---- */
function paint() {
  const c = S.cur, st = c && c.status, running = !!(c && c.running), starting = !!(c && c.starting);
  $('sname').textContent = c ? c.name : 'No server selected';
  $('sport').textContent = c ? 'port ' + c.port : '';
  const pill = $('pill'); pill.textContent = running ? 'running' : starting ? 'starting' : 'stopped'; pill.className = 'pill ' + (running ? 'on' : starting ? 'wait' : 'off');
  $('b_start').disabled = !c || running || starting; $('b_stop').disabled = !running && !starting; $('b_restart').disabled = !running; $('b_kill').disabled = !running && !starting;
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
  } else addrs.append(el('div', { className: 'dim', textContent: c ? 'Start the server to get its address.' : 'Pick a server on the left, or make one.' }));
  $('hosts').replaceChildren(...(st ? st.hosts : []).map((h) => el('tr', {}, [el('td', { textContent: DIMS[h.dim] || h.dim }), el('td', { textContent: h.paused ? 'paused (nobody there)' : h.ready ? 'running' : h.running ? 'starting' : 'asleep (starts when a player goes there)' }), el('td', { textContent: h.running ? fmtB(h.heap) : '' })])));
  paintPlayers();
}
/* 6.49: every account, with what can be done to it */
function paintAccounts() {
  const st = S.cur && S.cur.status, list = (st && st.accountList) || [], G = (st && st.locks) || {};
  $('noaccounts').hidden = list.length > 0;
  $('acnote').textContent = !st ? 'Start the server to manage its accounts.' : st.accounts ? 'Players log in with an account made here.' : 'Accounts are off (Settings): anyone may join by name, but a name that has an account needs its password.';
  const show = $('ac_show').checked, act = (label, line) => el('button', { textContent: label, onclick: () => run(line) });
  $('aclist').replaceChildren(...list.map((a) => {
    const inp = el('input', { maxLength: 64, placeholder: 'new password or name', spellcheck: false });
    const lock = (k, word) => { const on = !!(a.locks && a.locks[k]); return el('button', { textContent: word + (on ? ': locked' : G[k] ? ': locked for all' : ': free'), onclick: () => run('account lock ' + a.name + ' ' + k + (on ? ' off' : ' on')) }); };
    return el('tr', {}, [
      el('td', {}, [a.name, ...(a.online ? [el('span', { className: 'tag', textContent: 'online' })] : []), ...(a.op ? [el('span', { className: 'tag', textContent: 'operator' })] : [])]),
      el('td', { textContent: show ? a.password : '••••••' }),
      el('td', { className: 'acts' }, [lock('name', 'Name'), lock('password', 'Password'), lock('skin', 'Skin')]),
      el('td', { className: 'acts' }, [inp, el('button', { textContent: 'Set password', onclick: () => { if (inp.value.trim()) run('account password ' + a.name + ' ' + inp.value.trim()); } }),
        el('button', { textContent: 'Rename', onclick: () => { if (inp.value.trim()) run('account rename ' + a.name + ' ' + inp.value.trim()); } }),
        el('button', { textContent: 'Set skin', onclick: () => { S.skinFor = a.name; $('ac_skinfile').value = ''; $('ac_skinfile').click(); } }),
        ...(a.skin ? [act('Reset skin', 'setskin ' + a.name + ' reset')] : []), act('Remove', 'account remove ' + a.name)]),
    ]);
  }));
}
$('ac_show').onchange = () => paintAccounts();
$('acform').onsubmit = (e) => {
  e.preventDefault();
  const n = $('ac_name').value.trim(), p = $('ac_pass').value.trim();
  if (!n || !p) return;
  run('account add ' + n + ' ' + p);
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
  ['mode', 'Mode for new players', 'mode'], ['pvp', 'Players can hurt each other (PvP)', 'bool'], ['viewChunks', 'View distance sent to players (chunks)', 'int'], ['pauseWhenEmpty', 'Pause a world nobody is in after (seconds; 0 never)', 'int'], ['catchUpMax', 'Most a crop or furnace catches up at once (minutes; 0 no limit)', 'int'], ['spawnProtection', 'Spawn protection (blocks; 0 for none)', 'int'],
  ['sleepPercent', 'Players asleep to skip the night (%)', 'int'], ['simulate', 'The server runs the world itself (mobs, water, crops)', 'bool'], ['singlePlayer', 'The served game may also play alone', 'bool'],
  ['lockNames', 'Nobody may change their own name', 'bool'], ['lockPasswords', 'Nobody may change their own password', 'bool'], ['lockSkins', 'Nobody may change their own skin', 'bool'],
  ['whitelist', 'Only listed players may join (whitelist)', 'bool'], ['allow', 'Whitelist (one name a line)', 'list'], ['ops', 'Operators (one name a line)', 'list'], ['bans', 'Banned (one name a line)', 'list']];
const RULE_NAMES = { keepInv: 'Keep inventory on death', god: 'God mode', mobGrief: 'Mob griefing', mobSpawn: 'Natural mob spawning', dayCycle: 'Daylight cycle', fireTick: 'Fire spreads', fallDmg: 'Fall damage', snail: 'The Eternal Snail',
  jsc: 'Jumpscare chance (0 to 100)', instaKill: 'Instant kill', freezeMobs: 'Freeze all mobs', ghosts: 'Guilt ghosts', fbOK: 'Fullbright allowed', store: 'Dingle Store', powers: 'Superpowers', cheats: 'Cheats (the debug menu, for everyone)',
  nether: 'The Nether', aether: 'The Aether', puppet: 'Puppet Purgatory', difficulty: 'Difficulty' };
async function loadSettings() {
  const r = await window.dc.readSettings(S.id);
  if (!r.ok) { $('setmsg').textContent = r.why || 'could not read the settings'; return; }
  S.settings = r.settings;
  $('setmsg').textContent = ''; $('rulemsg').textContent = '';
  const sf = $('setform'); sf.replaceChildren();
  for (const [k, label, kind] of FIELDS) {
    const v = S.settings[k];
    let input;
    if (kind === 'bool') { input = el('input', { type: 'checkbox', checked: !!v }); sf.append(el('label', { className: 'check' }, [input, label])); }
    else if (kind === 'mode') { input = el('select', {}, [el('option', { value: 's', textContent: 'Survival' }), el('option', { value: 'c', textContent: 'Creative' })]); input.value = v === 'c' ? 'c' : 's'; sf.append(el('label', {}, [label, input])); }
    else if (kind === 'list') { input = el('textarea', { rows: 3, value: (v || []).join('\n') }); sf.append(el('label', {}, [label, input])); }
    else { input = el('input', { type: kind === 'int' ? 'number' : 'text', value: v === undefined || v === null ? '' : String(v) }); sf.append(el('label', {}, [label, input])); }
    input.dataset.k = k; input.dataset.kind = kind;
  }
  const rf = $('ruleform'); rf.replaceChildren();
  const rules = S.settings.rules || {};
  for (const k of Object.keys(rules)) {
    const v = rules[k], label = RULE_NAMES[k] || k;
    let input;
    if (k === 'difficulty') { input = el('select', {}, ['easy', 'normal', 'hard', 'dinglecore'].map((d) => el('option', { value: d, textContent: d === 'dinglecore' ? 'DingleCore (one life)' : d[0].toUpperCase() + d.slice(1) }))); input.value = v; rf.append(el('label', {}, [label, input])); }
    else if (typeof v === 'boolean') { input = el('input', { type: 'checkbox', checked: v }); rf.append(el('label', { className: 'check' }, [input, label])); }
    else { input = el('input', { type: 'number', value: String(v) }); rf.append(el('label', {}, [label, input])); }
    input.dataset.k = k; input.dataset.kind = typeof v === 'boolean' ? 'bool' : typeof v === 'number' ? 'int' : 'text';
  }
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
$('b_backup').onclick = async () => { $('backmsg').textContent = 'Backing up...'; const r = await window.dc.backupNow(S.id); $('backmsg').textContent = r.ok ? 'Copied to ' + r.to : 'Backup failed: ' + r.why; loadBackups(); };

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
