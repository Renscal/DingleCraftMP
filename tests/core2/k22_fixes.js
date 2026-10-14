/* k22_fixes.js (v6.51, lane CORE2, gate x1): three small fixes.
   1 Figurine Drops, a game rule (figDrops): off, a thousand kills drop no figurine; on, some do. It is in the debug menu's
     list, on the Create New World screen and in the server's rules
   2 right-clicking a chest with a block in hand: on a server the chest only opens when the server says so, and meanwhile
     the held button placed the block against it. Now a click that used a block places nothing until the button is let go
   3 Escape on a server: the pause menu no longer stops the world (a mob still falls, so does the player); this player's
     keys and buttons let go. In single player, paused still freezes everything */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path');
const {REPO}=require('../lib/paths.js');
const V=boot({seed:51});
const step=boot.stepper(700000);

boot.run(async()=>{
  const B=V.B,IT=V.IT;
  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.god=true;V.GR.ghosts=false;

  /* ===== 1. Figurine Drops ===== */
  {const figs=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead&&e.st&&e.st.id===IT.FIGURINE).length;
    const killN=n=>{for(let i=0;i<n;i++){V.spawnMob('pig',o.x+3.5,o.y,o.z+0.5);const e=V.entities[V.entities.length-1];e.hurtT=0;V.hurtMob(e,999,0,0);}};
    for(const e of V.entities)if(e.t==='drop')e.dead=true;step(2);
    V.GR.figDrops=false;killN(1000);const off=figs();
    for(const e of V.entities)if(e.t==='drop'||e.mob)e.dead=true;step(2);
    V.GR.figDrops=true;killN(400);const on=figs();
    ok('Figurine Drops off: 1000 kills, '+off+' figurines; on: 400 kills, '+on,off===0&&on>0);
    for(const e of V.entities)if(e.t==='drop'||e.mob)e.dead=true;step(2);
    const HH=fs.readFileSync(path.join(REPO,'build','head.html'),'utf8'),CFG=fs.readFileSync(path.join(REPO,'server','lib','config.mjs'),'utf8');
    ok('the rule is on by default, in the debug menu, on Create New World and in the server\'s rules',V.GR_DEF().figDrops===true&&V.GR_LABELS.some(l=>l[0]==='figDrops')&&
      HH.includes('id="tr_figDrops"')&&/figDrops: true/.test(CFG));}

  /* ===== 2. a chest and a held block ===== */
  {const cx=o.x+3,cy=o.y,cz=o.z;V.setBlock(cx,cy,cz,B.CHEST);step(2);
    const P=V.P;P.x=o.x+0.5;P.z=o.z+0.5;P.y=o.y;P.yaw=-Math.PI/2;P.pitch=-0.25;step(3);
    const aimAt=(x,y,z)=>{const dx=x+0.5-P.x,dz=z+0.5-P.z,dy=y+0.5-(P.y+1.62);P.yaw=Math.atan2(-dx,-dz);P.pitch=Math.atan2(dy,Math.hypot(dx,dz));};
    aimAt(cx,cy,cz);step(2);
    boot.give(V,B.STONE,0);P.inv[0].count=10;
    /* a server: the chest is asked for and the answer has not come yet */
    const N=V.NET,was={on:N.on,ws:N.ws};const sent=[];N.on=true;N.ws={readyState:1,send:t=>sent.push(JSON.parse(t)),close(){}};
    let placedNear=0;
    try{V.MB.r=true;step(40);
      for(let dx=-1;dx<=1;dx++)for(let dy=0;dy<=1;dy++)for(let dz=-1;dz<=1;dz++)if(V.getBlock(cx+dx,cy+dy,cz+dz)===B.STONE)placedNear++;   /* the floor below is the studio's own stone */
      V.MB.r=false;step(3);}
    finally{N.on=was.on;N.ws=was.ws;N.lockWant=null;}
    ok('holding a block and the button on a chest the server has not opened yet: it was asked for, and nothing was placed ('+placedNear+' stone round it, '+P.inv[0].count+' in hand)',
      sent.some(m=>m.t==='open')&&placedNear===0&&P.inv[0].count===10);
    V.setBlock(cx,cy,cz,B.STONE);step(2);aimAt(cx,cy,cz);step(2);
    V.MB.r=true;step(4);V.MB.r=false;step(3);
    ok('the button let go, a click on stone places the block as before ('+P.inv[0].count+' left)',P.inv[0].count<10);
    V.setBlock(cx,cy,cz,B.AIR);for(let dx=-1;dx<=1;dx++)for(let dy=0;dy<=2;dy++)for(let dz=-1;dz<=1;dz++)if(V.getBlock(cx+dx,cy+dy,cz+dz)===B.STONE)V.setBlock(cx+dx,cy+dy,cz+dz,B.AIR);step(2);}

  /* ===== 3. Escape on a server ===== */
  {const P=V.P;const drop=()=>{V.spawnMob('pig',o.x+3.5,o.y+5,o.z+0.5);return V.entities[V.entities.length-1];};
    const N=V.NET,was=N.on;
    V.pauseGame();
    let pig=drop();const y0=pig.y;step(20);
    ok('single player: the pause menu freezes the world (a pig in the air stays put)',V.isPaused()&&Math.abs(pig.y-y0)<1e-6);
    pig.dead=true;
    N.on=true;
    try{pig=drop();const y1=pig.y;P.y+=4;P.vy=0;const py=P.y;V.KEY.KeyW=true;step(20);
      ok('on a server the pause menu does not stop the world: the pig falls ('+(y1-pig.y).toFixed(1)+'), and so does the player ('+(py-P.y).toFixed(1)+')',V.isPaused()&&pig.y<y1-0.5&&P.y<py-0.5);
      ok('...and this player\'s keys are let go',!V.KEY.KeyW);}
    finally{N.on=was;V.resumeGame();}
    pig.dead=true;step(2);}
});
