// simdist_bench.mjs: what the server's own game costs at a given simulation distance (6.55). Headless, no network beyond
// 127.0.0.1, writes nothing. For each radius, 1 and then 4 raw players stand 300 blocks apart; once their chunks are built
// the process's CPU time (the game's thread included) is measured over 10 s, with the game's heap.
//   node tools/qa/simdist_bench.mjs [radii, default 5,8,10]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { createServer } = await import(path.join(REPO, 'server', 'dinglecraft-server.mjs'));
const { PROTO } = await import(path.join(REPO, 'server', 'lib', 'config.mjs'));
const GAME = path.join(REPO, 'build', 'game.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const radii = (process.argv[2] || '5,8,10').split(',').map(Number);
for (const r of radii) for (const n of [1, 4]) {
  const S = createServer({ port: 0, memory: true, world: '', noGame: true, hostGame: GAME, quiet: true, seed: '6550', simulationDistance: r, pauseWhenEmpty: 0, rules: { mobSpawn: true } });
  await S.listen();
  for (let i = 0; i < 300 && !(S.host() && S.host().ready); i++) await sleep(100);
  const socks = [];
  for (let i = 0; i < n; i++) {
    const ws = new WebSocket('ws://127.0.0.1:' + S.port), got = [];
    ws.onmessage = (e) => got.push(e.data.length);
    await new Promise((res) => { ws.onopen = res; });
    ws.send(JSON.stringify({ t: 'hello', proto: PROTO, v: S.status().version || '6.55', name: 'B' + i }));
    socks.push(ws);
  }
  const pose = () => socks.forEach((ws, i) => ws.send(JSON.stringify({ t: 'pose', x: i * 300 + 0.5, y: 60, z: 0.5, yaw: 0, pitch: 0, dim: 'over', held: 0, hp: 20, fl: 0 })));
  for (let i = 0; i < 300; i++) { pose(); await sleep(100); }          // 30 s: chunks built, mobs spawning
  const c0 = process.cpuUsage(), t0 = Date.now();
  for (let i = 0; i < 100; i++) { pose(); await sleep(100); }          // 10 s measured
  const c1 = process.cpuUsage(c0), wall = (Date.now() - t0) / 1000;
  let heap = 0; try { heap = await S.host().heap(); } catch { /* not available */ }
  console.log(`radius ${String(r).padStart(2)}  players ${n}:  CPU ${(100 * (c1.user + c1.system) / 1e6 / wall).toFixed(0).padStart(3)}% of one core   game heap ${(heap / 1048576).toFixed(0)} MB`);
  socks.forEach((ws) => ws.close()); await S.close();
}
process.exit(0);
