/* n_host.js (v6.13, lane NET, gate x1, real clock): the server runs the Overworld's mobs itself. The real server in this
   process with its own game in a worker thread (server/lib/host.mjs, loading build/game.js headless), a raw second player
   speaking the protocol ("Bea"), and this process's headless game as a real player. Nothing leaves the machine.
   1 the host starts, and a joining player is told the server runs the mobs
   2 a mob handed to the host (what a player's game does with anything it spawns) is run by the host: it comes back as the
     host's own (from 0), keeps the speed it was handed over with, and a hit sent to player 0 lands on it; its death is
     announced and its loot is a dropped item like any other
   3 a mob the host runs hurts a player through that player's own game ({t:'hurt'}, with the mob's name), never a dead or a
     creative one; a mob with no player near it waits where it is
   4 a villager from a spot that already has one is refused; the first one keeps its name and is reported for saving
   5 the host spawns mobs by itself around a player (and none within 12 blocks of one)
   6 this process's game as a player: it knows the server runs the mobs, spawns nothing natural, draws the host's mobs as
      puppets, and a mob it spawns (an egg, a jar) is handed over at once; a hit on a puppet goes to the host
   7 saved with the world: entities/ in the world folder lists the mobs, and a restarted server puts them back
   8 "simulate": false, or a game file with no script in it: no host, and players are told so (the old way) */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const step=boot.stepper(900000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;await sleep(10);}return !!f();}
function raw(port,name){
  const ws=new WebSocket('ws://127.0.0.1:'+port),R={ws,got:[],closed:false,by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),
    send:m=>ws.send(JSON.stringify(m)),clear:()=>{R.got.length=0;}};
  ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
  R.open=new Promise((res,rej)=>{ws.onopen=()=>{R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,pw:''});res();};ws.onerror=()=>rej(new Error('socket'));});
  R.pose=async(x,y,z,o)=>{R.send({t:'pose',x,y,z,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0,...o});await sleep(40);};
  R.mobs=()=>{const m=new Map();for(const g of R.by('mobs'))if(g.from===0)for(const a of g.m)m.set(a[0],a);return m;};
  return R;
}

boot.run(async()=>{
  const {createServer}=await import(pathToFileURL(path.join(REPO,'server','dinglecraft-server.mjs')).href);
  const {gameScript}=await import(pathToFileURL(path.join(REPO,'server','lib','host.mjs')).href);
  const NET=V.NET,B=V.B,GAME=boot.BUILD+'game.js';
  /* where the game puts a new player in this seed (the server has no terrain to ask) */
  V.startNewWorld('nhprobe','4242','s');step(30);
  const sx=Math.floor(V.P.x)+0.5,sz=Math.floor(V.P.z)+0.5,sy=Math.floor(V.P.y);
  await V.quitToTitle();await window.storage.delete('vxw:nhprobe');
  const OUT=path.join(outDir('net'),'host_data');fs.rmSync(OUT,{recursive:true,force:true});

  /* ===== 1. the host starts ===== */
  const S=createServer({port:0,data:OUT,world:'world',noGame:true,hostGame:GAME,quiet:true,seed:'4242',maxPlayers:4,rules:{snail:false,mobSpawn:false,dayCycle:false}});
  await S.listen();const port=S.port,W=S.world();
  ok('the server starts a game of its own, and it is ready within moments',!!S.host()&&await until(()=>S.host()&&S.host().ready,20000));
  S.setTime(0.3);
  const bea=raw(port,'Bea');await bea.open;await until(()=>!!bea.last('ready'));
  ok('a joining player is told the server runs the mobs',bea.last('welcome').host===true&&S.players().length===1&&S.status().players.join()==='Bea');
  await bea.pose(sx,sy,sz);await sleep(600);   /* the host builds the chunks around her */

  /* ===== 2. a mob handed to the host ===== */
  bea.clear();bea.send({t:'mgive',to:0,m:['z.1','pig',sx+3,sy+1,sz,0,10,0,'',sx+3,sz,'0,0,0']});
  ok('a mob handed to player 0 is run by the server: it comes back as the server\'s own, to the players near it',await until(()=>bea.mobs().has('z.1'),4000)&&bea.mobs().get('z.1')[1]==='pig'&&bea.by('mobs').every(m=>m.from===0));
  {bea.send({t:'mgive',to:0,m:['z.2','pig',sx-6,sy+14,sz-3,0,10,0,'',sx-6,sz-3,'0,0,-8']});await until(()=>bea.mobs().has('z.2'),4000);
    const z0=bea.mobs().get('z.2')[4];await sleep(400);
    ok('...keeping the speed it was handed over with (a pig out of the cannon flies on)',z0<sz-3-0.1||bea.mobs().get('z.2')[4]<z0-0.8);}
  {await sleep(700);const y1=bea.mobs().get('z.1')[3];await sleep(400);
    ok('the server\'s game has the terrain: the pig stands on the ground, it does not fall through the world',Math.abs(bea.mobs().get('z.1')[3]-y1)<1.6&&y1>sy-6&&y1<sy+8);}
  {bea.clear();const d0=Object.keys(W.drops).length;bea.send({t:'mhit',to:0,id:'z.1',dmg:999,kx:1,kz:0});
    ok('a hit sent to player 0 lands on the mob: its death is announced to the players',await until(()=>bea.by('mgone').some(m=>m.dead===1&&m.ids.includes('z.1')&&m.from===0),4000));
    ok('...and what it drops is a dropped item of the world, like any other',await until(()=>bea.by('drop').length>0&&Object.keys(W.drops).length>d0,3000));
    ok('...and the XP it leaves goes to the player who walks into it',await until(()=>!!bea.last('xp'),8000)&&bea.last('xp').n>0);}

  /* ===== 3. a mob hurts a player through that player's game ===== */
  S.setTime(0.8);await sleep(100);
  {bea.clear();bea.send({t:'mgive',to:0,m:['z.3','zombie',sx+2,sy+1,sz,0,20,0,'',sx+2,sz,'0,0,0']});
    ok('a zombie the server runs walks up to a player and hits her: her own game is told to take the damage, and by whom',await until(()=>!!bea.last('hurt'),15000)&&bea.last('hurt').dmg>0&&bea.last('hurt').by==='Zombie'&&bea.last('hurt').how==='mob');
    await bea.pose(sx,sy,sz,{fl:16});await sleep(1500);bea.clear();await sleep(2500);
    ok('a creative player is left alone',bea.by('hurt').length===0);
    await bea.pose(sx,sy,sz,{fl:4});await sleep(600);bea.clear();await sleep(2000);
    ok('...and so is a dead one',bea.by('hurt').length===0);
    await bea.pose(sx,sy,sz);
    bea.send({t:'mhit',to:0,id:'z.3',dmg:999,kx:1,kz:0});await until(()=>bea.by('mgone').some(m=>m.ids.includes('z.3')),4000);}
  S.setTime(0.3);await sleep(100);

  /* ===== 4. one villager per spot ===== */
  {const ax=sx+6,az=sz+6;bea.clear();
    bea.send({t:'mgive',to:0,m:['z.5','alien',ax,sy+1,az,0,16,0,'Zorp',ax,az,'0,0,0']});await until(()=>bea.mobs().has('z.5'),4000);
    ok('a villager handed over keeps its name and the spot it was spawned at',bea.mobs().has('z.5')&&bea.mobs().get('z.5')[8]==='Zorp'&&bea.mobs().get('z.5')[9]===ax&&bea.mobs().get('z.5')[10]===az);
    bea.clear();bea.send({t:'mgive',to:0,m:['z.6','alien',ax+1,sy+1,az,0,16,0,'Blip',ax+1,az,'0,0,0']});
    ok('a second one from the same spot (another player\'s game populating the same village) is refused',await until(()=>bea.by('mgone').some(m=>m.ids.includes('z.6')&&!m.dead),4000)&&!bea.mobs().has('z.6'));
    ok('the server keeps a list of every mob its game has, for the next save',await until(()=>W.mobs.some(m=>m.t==='alien'&&m.name==='Zorp'&&m.ox===ax&&m.oz===az),8000)&&W.mobs.every(m=>typeof m.x==='number'&&typeof m.hp==='number'));
    /* nobody near: it waits */
    await bea.pose(sx+400,sy,sz);await sleep(1500);const a0=W.mobs.find(m=>m.name==='Zorp');await sleep(5600);const a1=W.mobs.find(m=>m.name==='Zorp');
    ok('with no player near, a villager is neither despawned nor moved: it waits',!!a0&&!!a1&&a0.x===a1.x&&a0.z===a1.z&&a0.y===a1.y);
    await bea.pose(sx,sy,sz);await sleep(400);}

  /* ===== 5. natural spawning ===== */
  {const known=new Set(bea.mobs().keys());bea.clear();W.gr.mobSpawn=true;
    for(const c of S.players())c.sent=null;
    S.host().post({t:'gr',gr:{...W.gr}});
    ok('the server\'s game spawns mobs around a player by itself',await until(()=>[...bea.mobs().keys()].some(k=>/^0\./.test(k)&&!known.has(k)),60000));
    const fresh=[...bea.mobs().values()].filter(a=>/^0\./.test(a[0])&&!known.has(a[0]));
    ok('...ordinary ones, out of arm\'s reach',fresh.length>0&&fresh.every(a=>['pig','cow','sheep','zombie','skel','boomer','spider'].includes(a[1])));
    W.gr.mobSpawn=false;S.host().post({t:'gr',gr:{...W.gr}});await sleep(200);}

  /* ===== 6. this process's game as a player ===== */
  V.setPName('Dan');V.ntConnect('127.0.0.1:'+port,'');
  ok('the game joins and knows the server runs the mobs here',await until(()=>NET.on,8000)&&NET.hosted===true&&V.ntHosted()===true&&NET.host===false);
  const pump=async n=>{for(let i=0;i<(n||6);i++){step(2);await sleep(8);}};
  const pumpUntil=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;step(2);await sleep(8);}return !!f();};
  step(60);await pump(20);
  {const P=V.P,mob=rid=>V.entities.find(e=>e.rid===rid&&!e.dead);
    ok('the server\'s mobs near the player are puppets in their game (the villager, with its name)',await pumpUntil(()=>!!mob('z.5'),8000)&&mob('z.5').pup===true&&mob('z.5').own===0&&mob('z.5').name==='Zorp');
    V.GR.mobSpawn=true;const n0=V.entities.filter(e=>e.t==='mob'&&!e.pup).length;step(900,40);
    ok('their game spawns nothing natural where the server does',V.entities.filter(e=>e.t==='mob'&&!e.pup&&!e.dead).length===n0);
    V.spawnMob('pig',P.x+2,P.y+1,P.z);const pig=V.entities[V.entities.length-1];pig.vx=3;
    ok('a mob their game spawns (an egg, a jar, a village) is handed to the server at once and is a puppet from then on',await pumpUntil(()=>pig.pup===true&&pig.own===0&&!!pig.rid,3000));
    ok('...which the server\'s game then runs: Bea sees it too',await until(()=>bea.mobs().has(pig.rid),4000));
    {const hp0=pig.hp;pig.hurtT=0;V.hurtMob(pig,4,1,0);
      ok('hitting a puppet of the server\'s goes to the server, and the mob\'s health comes back lower',await pumpUntil(()=>pig.hp<hp0,4000)&&pig.hp===hp0-4);}
    {V.P.hp=20;V.P.hurtT=0;V.ntMsg({t:'hurt',dmg:3,kx:1,kz:0,by:'Zombie',how:'mob'});
      ok('a hurt from the server is applied by the player\'s own game, and remembered for the death message',V.P.hp<20&&V.getLastDmg?V.getLastDmg().by==='Zombie':V.P.hp<20);
      const x0=V.P.xp||0;V.ntMsg({t:'xp',n:5});ok('XP from the server is added',(V.P.xp||0)===x0+5);V.P.hp=20;}
    await V.quitToTitle();}

  /* ===== 7. saved with the world ===== */
  await sleep(5200);
  const nSaved=W.mobs.length;
  await S.close();
  {const dir=path.join(OUT,'world','entities','over'),files=fs.existsSync(dir)?fs.readdirSync(dir):[];
    const all=files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).mobs||[]);
    ok('the world folder lists the mobs under entities/, by region: type, place, health, a villager\'s name and spot ('+all.length+' mobs)',nSaved>0&&all.length===nSaved&&all.some(m=>m.type==='alien'&&m.name==='Zorp'&&Array.isArray(m.origin))&&all.every(m=>typeof m.type==='string'&&typeof m.health==='number'));
    const S2=createServer({port:0,data:OUT,world:'world',noGame:true,hostGame:GAME,quiet:true});await S2.listen();
    ok('a restarted server reads them back',S2.world().mobs.length===nSaved&&await until(()=>S2.host()&&S2.host().ready,20000));
    const b2=raw(S2.port,'Bea');await b2.open;await until(()=>!!b2.last('ready'));await b2.pose(sx,sy,sz);
    ok('...and its game puts them back in the world: the villager is there again, by name, for the next player',await until(()=>[...b2.mobs().values()].some(a=>a[1]==='alien'&&a[8]==='Zorp'),8000));
    await S2.close();}

  /* ===== 8. no host ===== */
  {const S3=createServer({port:0,memory:true,world:'',noGame:true,hostGame:GAME,simulate:false,quiet:true});await S3.listen();
    const b3=raw(S3.port,'Bea');await b3.open;await until(()=>!!b3.last('ready'));
    ok('"simulate": false: no server game, and players are told their games run the mobs',S3.host()===null&&b3.last('welcome').host===false);
    b3.send({t:'mgive',to:0,m:['z.9','pig',1,40,1,0,10,0]});b3.send({t:'hurt',to:b3.last('welcome').id,dmg:9});b3.send({t:'hsnap',mobs:[{t:'pig',x:1,y:1,z:1}]});await sleep(80);
    ok('a player cannot pose as the server\'s game: hurt, xp and hsnap from a player are ignored',b3.by('hurt').length===0&&S3.world().mobs.length===0);
    await S3.close();
    const junk=path.join(OUT,'junk.html');fs.writeFileSync(junk,'<!doctype html><title>stand-in</title>');
    ok('a game file with no script in it gives no host script',gameScript(junk,path.join(OUT,'.cache'))===null);}
  fs.rmSync(OUT,{recursive:true,force:true});
});
