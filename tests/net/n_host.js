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
   8 "simulate": false, or a game file with no script in it: no host, and players are told so (the old way)
   9 (6.14) what flies is seen: a skeleton's arrow on the server's game, a player's own arrow, lit TNT; the copy flies, hurts
     nothing and goes when the real one does
   10 (6.14) vehicles are the server's: a placed car is handed over and everyone gets it, getting on makes it the rider's
      (a second rider is refused), getting off gives it back, a hit on a parked one breaks it once, and they are saved
   11 (6.15) the world the server runs: its game flows the water and drops the sand (a player's game does neither and is
      shown the sand falling), lights and burns the fire a player's game asks for, and cooks a furnace nobody has open
   12 (6.16) what the world remembers: a structure one game finds is found for everyone, a dead boss stays dead, a spawner
      that is gone is taken off the list by the server's game, the stock market is the server's and one for all, a player's
      own things (the Snail, Malgorath, their Creativity works) travel with their save, and all of it is in data/ on disk
   13 (6.17) every dimension: the Nether gets a game of its own the moment a player goes there (the Aether's is not started
      for nothing), "player 0" is the game of your own dimension, its mobs stay in it and are saved under entities/nether */
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
  {await sleep(1500);const y1=bea.mobs().get('z.1')[3];await sleep(800);const y2=bea.mobs().get('z.1')[3];
    ok('the server\'s game has the terrain: seconds later the pig is still on the ground near where it was put, not falling through the world',y1>sy-10&&y1<sy+12&&y2>sy-10&&y2<sy+12);}
  {bea.clear();const d0=Object.keys(W.drops).length;bea.send({t:'mhit',to:0,id:'z.1',dmg:999,kx:1,kz:0});
    ok('a hit sent to player 0 lands on the mob: its death is announced to the players',await until(()=>bea.by('mgone').some(m=>m.dead===1&&m.ids.includes('z.1')&&m.from===0),4000));
    ok('...and what it drops is a dropped item of the world, like any other',await until(()=>bea.by('drop').length>0&&Object.keys(W.drops).length>d0,3000));
    {const at=bea.last('drop')||{x:sx+3,y:sy,z:sz};await bea.pose(at.x,at.y,at.z);
      ok('...and the XP it leaves goes to the player who walks into it',await until(()=>!!bea.last('xp'),8000)&&bea.last('xp').n>0);await bea.pose(sx,sy,sz);}}

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
    /* ===== 9. what flies ===== */
    {const fxs=()=>[...NET.fx.values()].filter(e=>e.pup&&!e.dead);
      bea.clear();V.spawnArrow(P.x+1,P.y+1.5,P.z,6,3,0,'p',4);const arr=V.entities[V.entities.length-1];await pump(3);
      ok('an arrow this player shoots is announced to the players nearby: its kind, where and how fast',await until(()=>!!bea.last('fx'),3000)&&bea.last('fx').f[0][1]==='arrow'&&bea.last('fx').f[0][5]===6&&bea.last('fx').from===NET.id&&!!arr.fxid);
      ok('...and again when it has landed',await pumpUntil(()=>bea.by('fxgone').some(m=>m.ids.includes(arr.fxid)),8000));
      const hp0=V.P.hp;bea.send({t:'fx',f:[['9f1','arrow',P.x+3,P.y+7,P.z,-8,2,0,14,8],['9f2','tnt',P.x+4,P.y+1,P.z+2,0,0,0,24,1.5],['9f3','xp',P.x+2,P.y+1,P.z-2,0,0,0,14,60],['9f4','warp',P.x,P.y,P.z,0,0,0,0,5],['9f5','arrow',P.x+900,P.y,P.z,0,0,0,14,8]]});
      ok('something another player shoots appears here as a copy: an arrow, lit TNT and an XP orb (an unknown kind and a far one do not)',await pumpUntil(()=>fxs().length===3,3000)&&NET.fx.has('9f1')&&NET.fx.get('9f1').t==='arrow'&&NET.fx.get('9f2').t==='tnt'&&NET.fx.get('9f3').t==='nfx'&&!NET.fx.has('9f4')&&!NET.fx.has('9f5'));
      {const a=NET.fx.get('9f1');step(6);await pump(2);
        ok('the copy flies the way the real one does',a.x<P.x+3-0.5&&a.pup===true);
        const b0=V.getBlock(Math.floor(P.x+4),Math.floor(P.y),Math.floor(P.z+2));step(80);await pump(4);
        ok('...and touches nothing: the arrow flew through where Dan stands and the TNT ran out its fuse, and neither he nor a block is the worse for it',V.P.hp===hp0&&!NET.fx.has('9f2')&&V.getBlock(Math.floor(P.x+4),Math.floor(P.y),Math.floor(P.z+2))===b0);}
      bea.send({t:'fxgone',ids:['9f3']});
      ok('told it is gone: gone',await pumpUntil(()=>!NET.fx.has('9f3'),3000));
      /* the server's own game: a skeleton shoots at Bea, who is closer */
      /* (on a stone ledge built high above the trees, with her hovering level with it: a skeleton only shoots at what it can see) */
      {const hx=Math.floor(P.x)+20,hy=Math.min(70,Math.floor(P.y)+26),hz=Math.floor(P.z),ed=[];
        for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){const x=hx+dx,z=hz+dz;ed.push([Math.floor(x/16)+','+Math.floor(z/16),(x-Math.floor(x/16)*16)+','+hy+','+(z-Math.floor(z/16)*16),B.STONE]);}
        bea.send({t:'edits',e:ed});
        S.setTime(0.8);await sleep(150);await bea.pose(hx-8+0.5,hy+1,hz+0.5);bea.clear();
        bea.send({t:'mgive',to:0,m:['z.7','skel',hx+0.5,hy+1.1,hz+0.5,0,20,0,'',hx+0.5,hz+0.5,'0,0,0']});}
      {const seen=await pumpUntil(()=>bea.by('fx').some(m=>m.from===0&&m.f.some(a=>a[1]==='arrow')),25000);
        ok('a skeleton the server runs shoots: its arrow is announced by the server, so the players see it coming'+(seen?'':' [skeleton '+JSON.stringify(bea.mobs().get('z.7'))+', hurt '+bea.by('hurt').length+', fx '+bea.by('fx').length+']'),seen);
        ok('...and this player\'s game, standing further off, flies a copy of it too',await pumpUntil(()=>[...NET.fx.keys()].some(k=>/^0f/.test(k)),8000));}
      bea.send({t:'mhit',to:0,id:'z.7',dmg:999,kx:1,kz:0});S.setTime(0.3);await pump(20);await bea.pose(sx,sy,sz);}

    /* ===== 10. vehicles are the server's ===== */
    {const veh=id=>V.entities.find(e=>e.vid===id&&!e.dead),bveh=()=>{const m=new Map();for(const g of bea.by('vehs'))for(const a of g.v)m.set(a[0],[g.from,a]);return m;};
      bea.clear();await bea.pose(P.x+4,P.y,P.z);
      V.spawnCar(P.x+3,P.y+1,P.z,0);const car=V.entities[V.entities.length-1];
      ok('a car this player places is handed to the server at once: a puppet here, with an id',await pumpUntil(()=>car.pup===true&&!!car.vid,3000));
      ok('...and the server\'s game keeps it: Bea is sent it as one of the server\'s',await until(()=>bveh().has(car.vid)&&bveh().get(car.vid)[0]===0,4000)&&bveh().get(car.vid)[1][1]==='car');
      ok('the server knows who is riding what: nobody yet',!S.riders().has(car.vid));
      /* getting on */
      V.P.ride=car;bea.clear();
      ok('getting on makes it this player\'s for the ride: their game drives it again and reports it',await pumpUntil(()=>car.pup===false&&car.mine===true&&S.riders().get(car.vid)===NET.id,3000)&&await until(()=>bea.by('vehs').some(m=>m.from===NET.id&&m.v[0][0]===car.vid),3000));
      bea.clear();bea.send({t:'vtake',id:car.vid,v:[car.vid,'car',1,1,1,0,30]});
      ok('a second player trying to get on the same car is refused',await until(()=>!!bea.last('vno'),3000)&&bea.last('vno').id===car.vid&&S.riders().get(car.vid)===NET.id);
      bea.send({t:'vehs',v:[[car.vid,'car',500,50,500,0,30,0]]});await sleep(80);await pump(4);
      ok('...and cannot move it either',Math.abs(car.x-(P.x))<40);
      {const hp0=car.hp;bea.send({t:'vhit',id:car.vid,dmg:5});
        ok('a hit on a ridden car goes to its rider\'s game',await pumpUntil(()=>car.hp===hp0-5,3000));}
      /* getting off */
      V.P.ride=null;bea.clear();
      ok('getting off gives it back to the server',await pumpUntil(()=>car.pup===true&&car.mine===false&&!S.riders().has(car.vid),3000)&&await until(()=>bveh().has(car.vid)&&bveh().get(car.vid)[0]===0,4000));
      ok('the server reports its vehicles for saving',await until(()=>W.vehicles.some(v=>v.t==='car'),8000)&&W.vehicles.every(v=>typeof v.x==='number'&&typeof v.hp==='number'));
      /* a parked car is broken once, by the server's game */
      {const d0=Object.keys(W.drops).length;bea.clear();car.hurtT=0;V.hitCar(car,9999);
        ok('breaking a parked car: the hit goes to the server, which breaks it for everyone and drops the one item',await pumpUntil(()=>!veh(car.vid),4000)&&await until(()=>bea.by('vgone').some(m=>m.ids.includes(car.vid))&&Object.keys(W.drops).length===d0+1,4000));}
      V.spawnBoat(P.x+3,P.y+1,P.z+2,0);const boat=V.entities[V.entities.length-1];await pumpUntil(()=>!!boat.vid&&boat.pup,3000);await until(()=>W.vehicles.some(v=>v.t==='boat'),8000);}
    /* ===== 11. the world the server runs ===== */
    {const hx=Math.floor(P.x)+20,hy=Math.min(70,Math.floor(P.y)+26),hz=Math.floor(P.z);   /* the stone ledge from section 9, above the trees */
      const E=(x,y,z,id)=>[Math.floor(x/16)+','+Math.floor(z/16),(x-Math.floor(x/16)*16)+','+y+','+(z-Math.floor(z/16)*16),id];
      const from0=(id,pred)=>bea.by('edits').some(m=>m.e.some(e=>(e[2]&255)===id&&(!pred||pred(e))));   /* (6.25: a liquid's level rides above its id) */
      await bea.pose(hx-4+0.5,hy+1,hz+0.5);V.P.x=hx-6+0.5;V.P.y=hy+3;V.P.z=hz+0.5;V.P.vy=0;V.P.mode='c';V.P.flying=true;await pump(40);
      ok('where the server runs the world, a player\'s game flows no water of its own',V.ntSimHere(hx,hz)===false&&V.ntHosted()===true);
      /* water set on the ledge runs off its edge: only the server\'s game does that */
      bea.clear();bea.send({t:'edits',e:[E(hx+2,hy+1,hz,B.WATER)]});
      ok('water a player pours is flowed by the server\'s game: the cells it runs into arrive as edits',await pumpUntil(()=>from0(B.WATER),8000));
      ok('...with their levels: the server\'s game sends flowing water as the id with its level above it',bea.by('edits').some(m=>m.e.some(e=>(e[2]&255)===B.WATER&&(e[2]>>8)>0)));
      ok('...and this player\'s game has them too, without having flowed anything itself',await pumpUntil(()=>V.getBlock(hx+3,hy,hz)===B.WATER||V.getBlock(hx+3,hy+1,hz)===B.WATER,6000));
      /* sand put in mid-air falls on the server, and is seen falling here */
      {bea.clear();const sy0=hy+6;V.setBlock(hx-2,sy0,hz+6,B.SAND);const fell=()=>V.entities.filter(e=>e.t==='fall'&&!e.dead).length;
        ok('sand this player sets in mid-air does not start falling in their own game',fell()===0&&V.getBlock(hx-2,sy0,hz+6)===B.SAND);
        ok('the server\'s game drops it: the block is taken away, and the players are shown it falling',await pumpUntil(()=>V.getBlock(hx-2,sy0,hz+6)===B.AIR,5000)&&
          await pumpUntil(()=>bea.by('fx').some(m=>m.from===0&&m.f.some(a=>a[1]==='fall'&&a[10]===B.SAND)),3000)&&[...NET.fx.values()].some(e=>e.fxk==='fall'&&e.pup));
        ok('...and where it lands it is a block again for everyone (or, on a spot that is taken, a dropped item), and the falling copy is gone',
          await pumpUntil(()=>bea.by('edits').some(m=>m.e.some(e=>(e[2]&255)===B.SAND&&+e[1].split(',')[1]<sy0))||bea.by('drop').some(d=>d.st.id===B.SAND),12000)&&fell()===0&&await pumpUntil(()=>![...NET.fx.values()].some(e=>e.fxk==='fall'&&!e.dead),6000));}
      /* fire */
      {const fx=hx-1,fy=hy+1,fz=hz+1;V.setBlock(fx,fy,fz,B.PLANK_O);await pump(10);bea.clear();
        V.igniteAt(fx,fy,fz);
        ok('a fire this player\'s game would light is not lit here: the server\'s game is asked',!V.getFires().has(fx+','+fy+','+fz));
        ok('the server\'s game lights it and says so: the flames show here and for the others',await pumpUntil(()=>V.getFires().has(fx+','+fy+','+fz),4000)&&bea.by('fire').some(m=>m.c.some(c=>c[0]===fx&&c[1]===fy&&c[2]===fz)));
        ok('...and burns the block down, for everyone, once',await pumpUntil(()=>V.getBlock(fx,fy,fz)===B.AIR,5000)&&await until(()=>bea.by('edits').some(m=>m.e.some(e=>e[2]===B.AIR)),2000));}
      {const wx=hx+3,wy=hy+1,wz=hz;await pumpUntil(()=>V.getBlock(wx,wy,wz)===B.WATER||V.getBlock(wx,hy,wz)===B.WATER,3000);
        const where=V.getBlock(wx,wy,wz)===B.WATER?wy:hy;
        ok('the level arrives with the block: this player\'s game holds the same flowing water the server\'s does',V.getBlock(wx,where,wz)===B.WATER&&(V.getMeta(wx,where,wz)&15)>0);}
      /* a furnace nobody has open */
      {const ore=+Object.keys(V.SMELT)[0],fuel=+Object.keys(V.FUELS)[0],fk=(hx+1)+','+(hy+1)+','+(hz-1);
        bea.clear();bea.send({t:'be',k:fk,v:{t:'furnace',in:{id:ore,count:2},fuel:{id:fuel,count:2},out:null,burn:0,burnMax:0,cook:0}});
        await pumpUntil(()=>V.blockEnts.has(fk),3000);const fb=V.blockEnts.get(fk);
        ok('a furnace nobody has open is not cooked by a player\'s game',!!fb&&V.ntNoTick(fb)===true);
        step(120);await pump(4);
        ok('...so here its timers stand still',fb.cook===0||fb.cook<=1);
        ok('the server\'s game cooks it: it starts burning, and ten seconds later the first item is out, for everyone',await pumpUntil(()=>bea.by('be').some(m=>m.k===fk&&m.v.burn>0),6000)&&await pumpUntil(()=>bea.by('be').some(m=>m.k===fk&&m.v.out&&m.v.out.id===V.SMELT[ore]),16000)&&await pumpUntil(()=>!!fb.out&&fb.out.id===V.SMELT[ore],3000));
        /* with the window open it is this player's to cook */
        V.NET.lockK=fk;ok('with its window open, it is this player\'s game that cooks it',V.ntNoTick(fb)===false);V.NET.lockK=null;}
      V.P.mode='s';V.P.flying=false;}

    /* ===== 12. what the world remembers ===== */
    {const hx=Math.floor(P.x)+20,hy=Math.min(70,Math.floor(P.y)+26),hz=Math.floor(P.z);
      await bea.pose(hx-4+0.5,hy+1,hz+0.5);bea.clear();
      V.getVSEEN().add('9,-9');
      ok('a village this player\'s game finds is found for everyone: the server is told within a second and passes it on',await pumpUntil(()=>bea.by('wd').some(m=>m.k==='vseen'&&m.add.includes('9,-9')),4000)&&W.vseen.includes('9,-9'));
      bea.send({t:'wd',k:'infkill',add:['3,4','3,4',{},'x'.repeat(60)]});
      ok('a boss another player killed is dead here too',await pumpUntil(()=>V.getINFKILL().has('3,4'),3000)&&JSON.stringify(W.infkill)==='["3,4"]');
      bea.clear();bea.send({t:'wd',k:'vseen',del:['9,-9']});bea.send({t:'wd',k:'pvp',add:['1']});bea.send({t:'wd',k:'vseen',add:['9,-9']});await sleep(80);await pump(4);
      ok('these lists only grow: a player cannot take a village off, name a list of their own, or be echoed what is already known',W.vseen.includes('9,-9')&&V.getVSEEN().has('9,-9')&&!('pvp' in W)&&bea.by('wd').length===0);
      /* a spawner that is not there any more */
      {const sk=(hx+1)+','+(hy+3)+','+hz;bea.clear();bea.send({t:'wd',k:'spw',add:[sk]});
        ok('a spawner one game knows of is on everyone\'s list',await pumpUntil(()=>V.getSPW().has(sk),3000)&&W.spw.includes(sk));
        ok('...and when no spawner stands there, the server\'s game takes it off for everyone (this player\'s game runs no spawners here)',await pumpUntil(()=>!V.getSPW().has(sk)&&!W.spw.includes(sk),8000)&&bea.by('wd').some(m=>m.k==='spw'&&m.del.includes(sk)));}
      /* the market */
      {bea.clear();const t0=V.getMKT().t;
        ok('the stock market is the server\'s: its game announces the prices every 2 seconds, and the server keeps them',await pumpUntil(()=>bea.by('mkt').length>=2,8000)&&Object.values(bea.last('mkt').p).every(v=>typeof v==='number'&&v>0)&&!!W.market&&Object.keys(W.market.p).length===Object.keys(bea.last('mkt').p).length);
        const last=bea.last('mkt'),k0=Object.keys(last.p)[0];await pump(6);
        ok('...and this player\'s game runs no market of its own: it shows the server\'s prices',V.getMKT().t===t0&&Math.abs(V.getMKT().p[k0]-bea.by('mkt').filter(m=>m.p[k0]===V.getMKT().p[k0]).length*0-V.getMKT().p[k0])===0&&bea.by('mkt').some(m=>m.p[k0]===V.getMKT().p[k0]));}
      /* a player's own things travel with their save */
      {await V.saveToStorage('x',true);await sleep(120);const rec=W.players.dan;
        ok('the save a player sends carries what is theirs alone: the Snail and the old demon (and Malgorath and their Creativity works, once they have any)',!!rec&&('snl' in rec)&&rec.demon&&typeof rec.demon==='object'&&!('vseen' in rec)&&!('market' in rec));}}

    /* ===== 13. every dimension ===== */
    {ok('players are told which dimensions the server runs: the Overworld, the Nether and the Aether (not Puppet Purgatory)',JSON.stringify(NET.hdims)==='["over","nether","aether"]'&&NET.hosted===true&&!NET.hdims.includes('puppet'));
      ok('only the Overworld\'s game is running while everyone is there',!!S.host('over')&&S.host('nether')===null&&S.host('aether')===null);
      /* 6.33: a dimension the rules switch off gets no game */
      {const back=bea.pose?[W.gr.nether]:[];W.gr.nether=false;await bea.pose(8.5,40,8.5,{dim:'nether'});await new Promise(r=>setTimeout(r,400));
        ok('with the nether rule off, a player turning up there starts no game for it',S.host('nether')===null);
        W.gr.nether=back[0]===undefined?true:back[0];if(W.gr.nether===false)W.gr.nether=true;await bea.pose(8.5,40,8.5,{dim:'over'});await new Promise(r=>setTimeout(r,150));}
      bea.clear();await bea.pose(8.5,40,8.5,{dim:'nether'});
      ok('the first player into the Nether wakes a game for it (and none for the Aether)',!!S.host('nether')&&await until(()=>S.host('nether')&&S.host('nether').ready,25000)&&S.host('aether')===null);
      await sleep(900);bea.send({t:'mgive',to:0,m:['z.n1','imp',10.5,60,8.5,0,8,0,'',10.5,8.5,'0,0,0']});
      ok('there, "player 0" is the Nether\'s game: a mob handed over is run by it and comes back to her',await until(()=>bea.mobs().has('z.n1'),6000)&&bea.mobs().get('z.n1')[1]==='imp');
      await pump(10);
      ok('...and stays in the Nether: a player in the Overworld is sent nothing of it',!V.entities.some(e=>e.rid==='z.n1')&&!NET.mobs.has('z.n1'));
      {const known=new Set(bea.mobs().keys());W.gr.mobSpawn=true;S.host('nether').post({t:'gr',gr:{...W.gr}});
        const got=await until(()=>[...bea.mobs().keys()].some(k=>/^0n\./.test(k)&&!known.has(k)),60000);
        const fresh=[...bea.mobs().values()].filter(a=>/^0n\./.test(a[0]));
        ok('the Nether\'s game spawns the Nether\'s own mobs around her'+(got?'':' [none in 60 s]'),got&&fresh.every(a=>a[1]==='imp'||a[1]==='hellhog'));
        W.gr.mobSpawn=false;S.host('nether').post({t:'gr',gr:{...W.gr}});}
      ok('each dimension\'s game reports its own mobs for saving, and they are kept apart',await until(()=>W.mobs.some(m=>m.d==='nether'&&m.t==='imp'),8000)&&W.mobs.some(m=>!m.d&&m.t==='alien')&&W.mobs.filter(m=>m.d==='nether').every(m=>m.t==='imp'||m.t==='hellhog'));
      await bea.pose(sx,sy,sz);await sleep(200);}
    await V.quitToTitle();}

  /* ===== 7. saved with the world ===== */
  await sleep(5200);
  const nSaved=W.mobs.filter(m=>!m.d).length;
  await S.close();
  {const dir=path.join(OUT,'world','entities','over'),files=fs.existsSync(dir)?fs.readdirSync(dir):[];
    const all=files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).mobs||[]);
    ok('the world folder lists the mobs under entities/, by region: type, place, health, a villager\'s name and spot ('+all.length+' mobs)',nSaved>0&&all.length===nSaved&&all.some(m=>m.type==='alien'&&m.name==='Zorp'&&Array.isArray(m.origin))&&all.every(m=>typeof m.type==='string'&&typeof m.health==='number'));
    const S2=createServer({port:0,data:OUT,world:'world',noGame:true,hostGame:GAME,quiet:true});await S2.listen();
    {const dj=f=>JSON.parse(fs.readFileSync(path.join(OUT,'world','data',f),'utf8')),lvl=JSON.parse(fs.readFileSync(path.join(OUT,'world','level.json'),'utf8'));
      ok('the world\'s own records are in data/, a file each, with a line saying what they are: structures, bosses, the market',dj('structures.json').vseen.includes('9,-9')&&typeof dj('structures.json').about==='string'&&dj('bosses.json').infkill.includes('3,4')&&
        Object.keys(dj('market.json').market.p).length>0&&!('vseen' in lvl)&&!('market' in lvl)&&!('infkill' in lvl)&&typeof lvl.seed==='number');}
{const nd=path.join(OUT,'world','entities','nether'),nf=fs.existsSync(nd)?fs.readdirSync(nd):[];
      ok('the Nether\'s mobs are saved under entities/nether, apart from the Overworld\'s',nf.length>0&&nf.flatMap(f=>JSON.parse(fs.readFileSync(path.join(nd,f),'utf8')).mobs).some(m=>m.type==='imp')&&!all.some(m=>m.type==='imp'));}
    {const vs=files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).vehicles||[]);
      ok('...and the vehicles beside them',vs.some(v=>v.type==='boat'&&typeof v.health==='number')&&S2.world().vehicles.some(v=>v.t==='boat'));}
    ok('a restarted server reads them back',S2.world().mobs.filter(m=>!m.d).length===nSaved&&S2.world().mobs.some(m=>m.d==='nether')&&await until(()=>S2.host()&&S2.host().ready,20000));
    const b2=raw(S2.port,'Bea');await b2.open;await until(()=>!!b2.last('ready'));await b2.pose(sx,sy,sz);
    ok('a restarted server still knows them, and a joining player is given them with the world',S2.world().vseen.includes('9,-9')&&S2.world().infkill.includes('3,4')&&b2.last('welcome').world.vseen.includes('9,-9')&&!!b2.last('welcome').world.market);
    ok('...and its game puts them back in the world: the villager is there again, by name, for the next player',await until(()=>[...b2.mobs().values()].some(a=>a[1]==='alien'&&a[8]==='Zorp'),8000));
    ok('...and the boat is back on the water, the server\'s to keep',await until(()=>b2.by('vehs').some(m=>m.from===0&&m.v.some(a=>a[1]==='boat')),8000));
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
