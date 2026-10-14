// cli.mjs: the program a person runs. Reads the command line and data/server.json, starts one server, prints the addresses
// to hand out, and takes commands typed into the window (the same commands operators type in the game: lib/commands.mjs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { DEFAULTS, HELP, SERVER_DIR, parseArgs } from './config.mjs';
import { createServer } from './server.mjs';
import { attachAdmin } from './admin.mjs';

/* this computer's addresses on the local network, for the "hand these out" list */
function lanAddresses() {
  return Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
}

/* data/server.json as an object; {} when there is none yet. A file that is not valid JSON stops the program. */
function readSettings(cfgFile) {
  if (!fs.existsSync(cfgFile)) return {};
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { console.error(`dinglecraft-server: ${cfgFile} is not valid JSON (${e.message})`); process.exit(2); }
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) { console.error(`dinglecraft-server: ${cfgFile} must hold one JSON object`); process.exit(2); }
  return cfg;
}

/* the banner: where players should point their browser or their game */
function printWelcome(S) {
  const lan = lanAddresses();
  console.log('');
  console.log(`  ${S.opts.name}`);
  console.log(`  listening on port ${S.port}` + (S.opts.accounts ? ' (accounts: players log in)' : ' (open: anyone may join by name)') + `, up to ${S.opts.maxPlayers} players, PvP ${S.opts.pvp ? 'on' : 'off'}`);
  if (S.gameFile) {
    console.log('  Players open one of these in a browser (it hands them the game, already pointed at this server):');
    console.log(`    this computer   ${S.secure ? 'https' : 'http'}://localhost:${S.port}/`);
    for (const a of lan) console.log(`    your network    ${S.secure ? 'https' : 'http'}://${a}:${S.port}/`);
  } else {
    console.log('  No game html found to hand out (build one with "npm run build", or put dinglecraft_v<version>.html next to the server).');
    console.log('  Players open their own copy of the game, choose Multiplayer and enter:');
    console.log(`    this computer   ${S.secure ? 'wss://' : ''}localhost:${S.port}`);
    for (const a of lan) console.log(`    your network    ${S.secure ? 'wss://' : ''}${a}:${S.port}`);
  }
  if (S.host()) console.log('  The server runs the Overworld\'s mobs itself ("simulate": false in server.json turns that off and saves the memory).');
  if (S.secure) console.log('  Encrypted (TLS): the certificate must be for the address players type, or their browser will refuse it.');
  console.log('  Friends outside your network need your public address and this port forwarded on your router (TCP).');
  console.log('  Commands: list, say <text>, kick <name>, op <name>, ban <name>, whitelist, time <day|night|0..1>, save, stop, help');
  console.log('');
}

/* one line typed into the server window */
function runCommand(S, line, stop) {
  const cmd = line.trim().replace(/^\//, '').split(/\s+/)[0].toLowerCase();
  if (!cmd) return;
  if (cmd === 'stop' || cmd === 'quit' || cmd === 'exit') return stop('stop command');
  const out = S.command(line.trim());
  if (out) console.log(out);
}

/* the whole program: settings, one server, the banner, then console commands until it is stopped */
export async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error('dinglecraft-server: ' + e.message + ' (try --help)'); process.exit(2); }
  if (args.help) { console.log(HELP); return; }

  const dataDir = path.resolve(args.data || path.join(SERVER_DIR, 'data'));
  const cfgFile = path.join(dataDir, 'server.json');
  let fresh = !fs.existsSync(cfgFile);
  let cfg = readSettings(cfgFile);
  /* 6.49: accounts. A server.json that does not say gets them if it is new (no player has played here yet), or if it had a
     server password (accounts replace those); an existing open server stays open. */
  if (typeof cfg.accounts !== 'boolean') {
    const had = typeof cfg.password === 'string' && cfg.password !== '';
    const pdir = path.join(dataDir, String(cfg.world || DEFAULTS.world), 'playerdata');
    let played = false;
    try { played = fs.readdirSync(pdir).some((n) => /\.json(\.br)?$/.test(n)); } catch { /* no world yet */ }
    cfg.accounts = had || !played;
    if (had) console.log('Server passwords are gone (6.49): this server had one, so it now uses accounts instead. Make one for each player: /account add <name> <password>');
  }
  delete cfg.password;
  if (args.passwordGone) { console.log('--password is gone (6.49): the server uses accounts. Make one for each player: /account add <name> <password>'); delete args.passwordGone; }
  /* server.json always shows the whole truth: every game rule and the mode the world is really running with. It is
     rewritten when it is new, when it is missing rules (an older file), and when a rule is changed from inside the game. */
  const writeCfg = (S, why) => {
    const next = { ...DEFAULTS, ...(fresh ? {} : cfg), mode: S.world().mode, rules: S.rules(), ops: S.opts.ops, whitelist: S.opts.whitelist, allow: S.opts.allow, bans: S.opts.bans,
      accounts: !!S.opts.accounts, lockNames: !!S.opts.lockNames, lockPasswords: !!S.opts.lockPasswords, lockSkins: !!S.opts.lockSkins };
    if (!fresh && JSON.stringify(next) === JSON.stringify(cfg)) return;
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(cfgFile, JSON.stringify(next, null, 2) + '\n'); cfg = next; fresh = false; console.log(why + ' ' + cfgFile); } catch { /* read-only folder: run on what we have */ }
  };
  /* a first run next to an existing world (say, one exported from single player) passes no settings of its own, so that
     world's mode and rules become the starting values in the new server.json */
  /* --ipc: a parent process is watching (the server window, a test). What is logged before the server exists is kept for it. */
  const ipc = !!args.ipc && typeof process.send === 'function';
  let admin = null; const early = [];
  let S;
  try { S = createServer({ ...(fresh ? { accounts: cfg.accounts } : cfg), ...args, data: dataDir, ...(ipc ? { onLog: (l) => (admin ? admin.log(l) : early.push(l)) } : {}), onRules: () => writeCfg(S, 'a game rule was changed in the game: updated'),
    onSettings: () => writeCfg(S, 'a command changed the settings: updated') }); }
  catch (e) { console.error('dinglecraft-server: ' + e.message); process.exit(1); }
  writeCfg(S, fresh ? 'wrote the settings to' : 'added the missing settings to');

  try { await S.listen(); } catch (e) {
    console.error(e.code === 'EADDRINUSE' ? `dinglecraft-server: port ${S.opts.port} is already in use (is the server already running? try --port)` : 'dinglecraft-server: ' + e.message);
    process.exit(1);
  }
  printWelcome(S);

  /* every way of stopping saves the world first: the stop command, Ctrl+C, closing the window */
  let stopping = false;
  const stop = async (why) => { if (stopping) return; stopping = true; S.log('stopping (' + why + ')'); await S.close(); if (admin) admin.close(); process.exit(0); };
  if (ipc) {
    admin = attachAdmin(S, { send: (m) => process.send(m), stop });
    for (const l of early) admin.log(l);
    process.on('message', (m) => admin.onMessage(m));
    process.on('disconnect', () => stop('the window that started it has gone'));
    setInterval(() => admin.tick(), 1000).unref();
    admin.ready();
  }
  process.on('SIGINT', () => stop('Ctrl+C'));
  process.on('SIGTERM', () => stop('terminated'));
  process.on('SIGHUP', () => stop('window closed'));
  process.on('SIGBREAK', () => stop('Ctrl+Break'));

  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => runCommand(S, line, stop));
  rl.on('close', () => { /* no console (a service, or input closed): keep serving */ });
}
