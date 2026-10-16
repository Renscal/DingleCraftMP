/* n_bossaim.js (v6.70, lane NET, gate x1): bosses on the server's game fight everyone (src/net/n8_host.js ntHostAim and
   ntHostArea, src/net/n7_mobs.js ntMobHurt). In-process: the game is made the server's game for the length of each check
   (NET.host, NET.hpl stand-ins for two or three players, a socket that only records), then put back.
   1 a boss goes for the nearest player, until another player hits it: then for that player, for 15 s, while they are in
     reach, alive and not in creative; an ordinary mob keeps going for the nearest
   2 the Stone Titan's slam: the player it is aimed at was already hit; every other player inside the slam gets the hit
     too, pushed away from the Titan, in their own game; one outside it, one in creative and one above it do not */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:70});
const step=boot.stepper(600000);

boot.run(async()=>{
  ok('the seams are on __vox',['ntHostAim','ntHostArea','ntMobHurt','spawnMob'].every(k=>typeof V[k]==='function')&&!!V.NET&&!!V.MOBT);
  V.startNewWorld('n70','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(120);
  const NET=V.NET,P0=V.P,sent=[];
  const was={host:NET.host,hpl:NET.hpl,ws:NET.ws,acc:NET.acc};
  const stand=(nid,dx,dz,o)=>Object.assign({nid,x:P0.x+dx,y:P0.y,z:P0.z+dz,dead:false,mode:'s',hitAt:-9,hp:20},o||{});
  const mob=(mt,dx,dz)=>{V.spawnMob(mt,P0.x+dx,P0.y,P0.z+dz);const e=V.entities[V.entities.length-1];e.rid='t.'+mt+dx;NET.mobs.set(e.rid,e);return e;};
  /* P is the game's own: ntHostAim is what points it, here as on the server's game, so it also puts the real player back */
  const aimAt=(q,e)=>{const h=NET.hpl;NET.hpl=[q];V.ntHostAim(e);NET.hpl=h;};
  const asHost=fn=>{NET.host=true;NET.ws={readyState:1,send:s=>sent.push(JSON.parse(s))};
    try{return fn();}finally{aimAt(P0,{x:P0.x,z:P0.z});NET.host=was.host;NET.hpl=was.hpl;NET.ws=was.ws;NET.acc=was.acc;}};

  /* ===== 1. who a boss goes for ===== */
  asHost(()=>{
    const near=stand(11,6,0),far=stand(12,-30,0),b=mob('titan',0,0),z=mob('zombie',0,2);
    NET.hpl=[near,far];NET.acc=100;
    ok('a boss goes for the nearest player at first',V.ntHostAim(b)===false&&V.P===near);
    V.ntMobHurt({id:b.rid,from:12,name:'Far',dmg:1,kx:0,kz:0});
    ok('hit by the far player, it remembers them',b.aggro===12&&b.aggroT===100);
    V.ntHostAim(b);ok('...and goes for them, though another player is nearer',V.P===far);
    NET.acc=110;V.ntHostAim(b);ok('...still, ten seconds on',V.P===far);
    far.mode='c';V.ntHostAim(b);ok('not while they are in creative',V.P===near);far.mode='s';
    far.dead=true;V.ntHostAim(b);ok('not while they are dead',V.P===near);far.dead=false;
    NET.acc=116;V.ntHostAim(b);ok('after 15 s without a hit it goes back to the nearest',V.P===near);
    V.ntMobHurt({id:z.rid,from:12,name:'Far',dmg:1,kx:0,kz:0});V.ntHostAim(z);
    ok('an ordinary mob hit by the far player keeps going for the nearest (only bosses hold a grudge)',z.aggro===undefined&&V.P===near);
    b.dead=true;z.dead=true;
  });

  /* ===== 2. the Titan's slam ===== */
  asHost(()=>{
    const t=stand(21,2,0),ins=stand(22,-3,2),out=stand(23,9,0),cre=stand(24,0,-3,{mode:'c'}),up=stand(25,1,1,{y:P0.y+8});
    NET.hpl=[t,ins,out,cre,up];NET.acc=200;sent.length=0;
    aimAt(t,{x:P0.x,z:P0.z});
    V.ntHostArea(P0.x,P0.y,P0.z,6.5,4);
    const hurt=sent.filter(m=>m.t==='hurt');
    ok('the slam reaches the other player inside it, with the same 4 damage ('+hurt.map(m=>m.to+':'+m.dmg).join(', ')+')',hurt.length===1&&hurt[0].to===22&&hurt[0].dmg===4);
    ok('...pushed away from the Titan',hurt.length===1&&hurt[0].kx<0&&hurt[0].kz>0);
    ok('...and not the one it was aimed at (already hit), one 9 blocks off, one in creative or one 8 blocks above',!hurt.some(m=>[21,23,24,25].includes(m.to)));
    ok('"the player" is the one it was aimed at again afterwards',V.P===t);
  });
  ok('the game is its own again: not the server\'s, the real player',NET.host===was.host&&V.P===P0);
});
