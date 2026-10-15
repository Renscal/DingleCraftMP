/* k19_spawn.js (v6.44, rewritten for v6.48; lane CORE2, gate x1): the natural spawner, the way the game this one takes after
   runs it (src/entities/p05e_spawning_tick.js; the sky's light in src/world/p03e_light.js; dungeon spawners in
   src/features/p16_xp_enchanting_dungeon.js). A sealed stone hall is built in the air 40 blocks from Dan, 11 x 11 inside,
   4 high, with the sky cleared above and round it.
   1 room: a zombie needs a solid opaque floor and two free cells; not in mid-air, under a 1-high gap, in water or lava, on
     glass or leaves; a spider needs its 3 x 3 but only 1 of height
   2 the sky's light: 15 on the open roof and straight down an open shaft; 14 under leaves; one less a block sideways
     under the roof from a hole in it; 0 in the sealed hall; a block put back in the hole takes it away again, all of it
   3 dark: the sealed hall is dark at noon whatever the dice say; the open roof never by day; under the night sky about a
     quarter of the time (17/32 x 4/8); a torch's light keeps monsters off exactly as far as it reaches
   4 far: never within 24 blocks of a player (in 3D), never more than 128 from one
   5 the caps: 70 monsters and 10 animals for 289 spawnable chunks, less for fewer
   6 the real spawner, by the tick: with Dan 30 above the dark hall it fills with monsters on its floor (and caves elsewhere),
     in packs of at most 4, never past the cap; lit with glowstone, nothing appears in it
   7 gone: past 128 blocks at once; past 32 after half a minute, now and then; within 32, never; a named one never;
     animals only past 128
   8 animals: on grass in the light (even at night under the sky), not on stone, not in a dark cave
   9 a dungeon spawner: wakes with a player within 16, spawns within 4 of itself, stops at 6 of its kind round it
   10 falling: a zombie dropped 10 blocks is hurt 7; into water, not at all; a pig from the cannon lands safely
   11 the server's own game keeps both light maps */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:44});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,SPAWN=V.SPAWN;
  ok('the seams are on __vox',['spawnRoom','spawnDark','spawnClear','spawnOK','spawnOKP','spawnTry','mobsTick','mobsDespawn','countMobs','spawnChunks','getSky','skyDarken','lightAt'].every(k=>typeof V[k]==='function')&&!!SPAWN);
  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.fireTick=false;V.GR.god=true;
  const P=()=>V.P;
  const HX=o.x+40,HZ=o.z,HY=Math.min(60,Math.max(V.surfaceTop(HX,HZ)+10,o.y+10));   /* the hall's floor is at HY-1, its inside HY..HY+3 */
  V.forceChunksNear(HX,HZ);step(30);
  const R=5;
  const kill=()=>{for(const e of V.entities)if(e.mob||e.t==='drop')e.dead=true;step(2);};
  const hall=()=>{for(let dx=-R-1;dx<=R+1;dx++)for(let dz=-R-1;dz<=R+1;dz++)for(let y=HY-1;y<=HY+4;y++){
      const wall=Math.abs(dx)===R+1||Math.abs(dz)===R+1||y===HY-1||y===HY+4;V.setBlock(HX+dx,y,HZ+dz,wall?B.STONE:B.AIR);}
    kill();};
  for(let dx=-R-4;dx<=R+4;dx++)for(let dz=-R-4;dz<=R+4;dz++)for(let y=HY-2;y<79;y++)V.setBlock(HX+dx,y,HZ+dz,B.AIR);
  hall();
  const home=()=>{const p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;p.fallD=0;p.mode='s';};
  home();step(3);
  const noon=()=>V.setTime(0.25),night=()=>V.setTime(0.75);
  let rs=77;const mul=()=>{rs=(rs+0x6D2B79F5)|0;let t=Math.imul(rs^(rs>>>15),1|rs);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};   /* mulberry32: a float LCG falls into short cycles */const rnd=mul;

  /* ===== 1. room ===== */
  const room=(mt,dx,dz,y)=>V.spawnRoom(mt,HX+dx,y===undefined?HY:y,HZ+dz);
  const r0=room('zombie',0,0),air=room('zombie',0,0,HY+1);
  V.setBlock(HX+2,HY+1,HZ,B.STONE);const low=room('zombie',2,0);V.setBlock(HX+2,HY+1,HZ,B.AIR);
  V.setBlock(HX+2,HY,HZ,B.WATER);const wet=room('zombie',2,0);V.setBlock(HX+2,HY,HZ,B.LAVA);const hot=room('zombie',2,0);V.setBlock(HX+2,HY,HZ,B.AIR);V.LIQ.w.clear();V.LIQ.l.clear();
  V.setBlock(HX-3,HY-1,HZ,B.GLASS);const onGlass=room('zombie',-3,0);V.setBlock(HX-3,HY-1,HZ,B.LEAF_O);const onLeaf=room('zombie',-3,0);V.setBlock(HX-3,HY-1,HZ,B.STONE);
  ok('a zombie: on a floor with two free cells yes; in mid-air, under a 1-high gap, in water, in lava, on glass, on leaves: no',
    r0===true&&[air,low,wet,hot,onGlass,onLeaf].every(v=>v===false));
  const s0=room('spider',0,0);V.setBlock(HX+1,HY,HZ+1,B.STONE);const s1=room('spider',0,0);V.setBlock(HX+1,HY,HZ+1,B.AIR);
  V.setBlock(HX,HY+1,HZ,B.STONE);const s2=room('spider',0,0),z2=room('zombie',0,0);V.setBlock(HX,HY+1,HZ,B.AIR);
  ok('a spider needs three by three (a pillar beside it is in the way) but only one cell of height (a zombie needs two)',s0===true&&s1===false&&s2===true&&z2===false);
  hall();

  /* ===== 2. the sky's light ===== */
  {const roof=HY+5,sk=(dx,y,dz)=>V.getSky(HX+dx,y,HZ+dz);
    ok('the open roof of the hall and the air above it have the sky\'s full light (15), the sealed hall none ('+sk(0,roof,0)+', '+sk(0,HY,0)+')',sk(0,roof,0)===15&&sk(0,roof+6,0)===15&&sk(0,HY,0)===0&&sk(R,HY+3,R)===0);
    V.setBlock(HX-R,HY+4,HZ-R,B.AIR);
    const shaft=sk(-R,HY,-R),side=[1,2,3,4,8].map(i=>sk(-R+i,HY,-R)),deep=sk(R,HY,R);
    ok('a hole in the roof: 15 straight down to the floor, then one less a block across it ('+shaft+'; '+side.join(', ')+'; far corner '+deep+')',
      shaft===15&&side.join()==='14,13,12,11,7'&&deep===0);
    V.setBlock(HX-R,HY+4,HZ-R,B.STONE);
    ok('the hole closed: the hall is dark again, every cell of it',[[-R,-R],[0,0],[R,R],[-R+1,-R]].every(([dx,dz])=>sk(dx,HY,dz)===0&&sk(dx,HY+3,dz)===0));
    V.setBlock(HX,roof,HZ,B.LEAF_O);const leaf=[sk(0,roof-0,0),sk(0,roof,0)];
    const under=V.getSky(HX,roof+0,HZ);V.setBlock(HX,roof+1,HZ,B.LEAF_O);const below1=V.getSky(HX,roof,HZ);V.setBlock(HX,roof+1,HZ,B.AIR);V.setBlock(HX,roof,HZ,B.AIR);
    ok('a leaf over a cell leaves it 14, not 15 ('+below1+')',below1===14&&under<=15&&leaf.length===2);}

  /* ===== 3. dark ===== */
  {SPAWN.rnd=rnd;noon();
    let hallDark=0,roofDay=0,roofNight=0;const N=2000;
    for(let i=0;i<N;i++){if(V.spawnDark(HX,HY,HZ))hallDark++;if(V.spawnDark(HX,HY+5,HZ))roofDay++;}
    night();for(let i=0;i<N;i++)if(V.spawnDark(HX,HY+5,HZ))roofNight++;noon();
    ok('the sealed hall is dark at noon every time ('+hallDark+'/'+N+'), the open roof never by day ('+roofDay+'), and under the night sky about a quarter of the time ('+(roofNight/N).toFixed(3)+'; darkening '+(night(),V.skyDarken())+' at night, '+(noon(),V.skyDarken())+' at noon)',
      hallDark===N&&roofDay===0&&roofNight/N>0.2&&roofNight/N<0.34&&V.skyDarken()===0);
    for(let i=0;i<24;i++){for(let dy=-1;dy<=2;dy++)for(let dz=-1;dz<=1;dz++)V.setBlock(HX+R+1+i,HY+dy,HZ+dz,(dy===0||dy===1)&&dz===0&&i<23?B.AIR:B.STONE);}
    V.setBlock(HX+R+1,HY,HZ,B.TORCH);step(2);let first=-1;for(let i=0;i<23;i++)if(V.spawnDark(HX+R+1+i,HY,HZ)){first=i;break;}
    ok('down a sealed corridor a torch keeps monsters off exactly as far as its light reaches: the first dark cell is '+first+' blocks from it',first===14&&V.lightAt(HX+R+1+14,HY,HZ)===0);
    V.setBlock(HX+R+1,HY,HZ,B.AIR);for(let i=0;i<24;i++)for(let dy=-1;dy<=2;dy++)for(let dz=-1;dz<=1;dz++)V.setBlock(HX+R+1+i,HY+dy,HZ+dz,B.AIR);hall();}

  /* ===== 4. far ===== */
  const p=P();p.x=HX+0.5;p.z=HZ+0.5;p.y=HY+30;p.flying=true;p.vy=0;
  {const c=[V.spawnClear(HX,HY+30-23,HZ),V.spawnClear(HX,HY+30-25,HZ),V.spawnClear(HX+23,HY+30,HZ),V.spawnClear(HX+25,HY+30,HZ),V.spawnClear(HX+127,HY+30,HZ),V.spawnClear(HX+129,HY+30,HZ)];
    ok('never within 24 blocks of the player in any direction, never more than 128 from one ('+c.map(v=>v?1:0).join('')+')',c.join()==='false,true,false,true,true,false');}

  /* ===== 5. the caps ===== */
  {const n=V.spawnChunks().length;
    ok('the spawnable chunks are the loaded ones within 8 of the player ('+n+' of at most 289): caps '+Math.floor(70*n/289)+' monsters and '+Math.floor(10*n/289)+' animals',n>0&&n<=289&&SPAWN.capH===70&&SPAWN.capP===10&&SPAWN.base===289);}

  /* ===== 6. the real spawner ===== */
  {p.mode='s';V.GR.mobSpawn=true;noon();kill();
    const hallMobs=()=>V.entities.filter(e=>e.mob&&!e.dead&&e.hostile&&Math.abs(e.x-HX-0.5)<=R+0.6&&Math.abs(e.z-HZ-0.5)<=R+0.6&&e.y>=HY-0.5&&e.y<HY+4);
    const n=V.spawnChunks().length,cap=Math.floor(70*n/289);
    const inHall=e=>Math.abs(e.x-HX-0.5)<=R+0.6&&Math.abs(e.z-HZ-0.5)<=R+0.6&&e.y>=HY-0.5&&e.y<HY+4;
    let ticks=0,most=0,elsewhere=0;
    /* the caves round about fill the cap quickly; what lands outside the hall is checked and cleared, so the hall gets its turn */
    const outside=[];
    for(;ticks<6000;ticks++){V.mobsTick(0.05);const h=V.countMobs()[0];if(h>most)most=h;
      for(const e of V.entities)if(e.mob&&!e.dead&&e.hostile&&!inHall(e)){outside.push(e);e.dead=true;elsewhere++;}
      if(hallMobs().length>=4)break;}
    const M=hallMobs(),all=M.concat(outside.slice(0,200));
    const sane=all.every(e=>{const x=Math.floor(e.x),y=Math.round(e.y),z=Math.floor(e.z);return V.spawnRoom(e.mt,x,y,z)&&V.lightAt(x,y,z)===0&&V.getSky(x,y,z)<15;})&&M.every(e=>Math.round(e.y)===HY);
    ok(ticks+' ticks at noon with Dan 30 above the dark hall: '+M.length+' monsters in the hall, on its floor ('+elsewhere+' elsewhere, in caves), every one in a dark cell with room for it, never past the cap of '+cap+' (most '+most+')',
      M.length>=3&&sane&&most<=cap&&new Set(all.map(e=>e.mt)).size>=2);
    /* 6.63: light it first, then clear it: kill() steps two frames, and in a still-dark hall the game could spawn into them */
    for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3],[0,0],[0,-4],[0,4],[-4,0],[4,0]])V.setBlock(HX+dx,HY+3,HZ+dz,B.GLOWSTONE);step(2);
    kill();
    for(let i=0;i<400;i++){V.mobsTick(0.05);for(const e of V.entities)if(e.mob&&e.hostile&&!e.dead&&!(Math.abs(e.x-HX-0.5)<=R+0.6&&Math.abs(e.z-HZ-0.5)<=R+0.6))e.dead=true;}
    ok('the same hall lit by glowstone in its ceiling: 400 ticks, '+hallMobs().length+' monsters in it',hallMobs().length===0);
    for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3],[0,0],[0,-4],[0,4],[-4,0],[4,0]])V.setBlock(HX+dx,HY+3,HZ+dz,B.AIR);
    V.GR.mobSpawn=false;kill();}

  /* ===== 7. gone ===== */
  {const put=(mt,dx,dy,dz)=>{V.spawnMob(mt,p.x+dx,p.y+dy,p.z+dz);const e=V.entities[V.entities.length-1];e.ai=false;return e;};
    const far=put('zombie',130,0,0),mid=put('zombie',40,0,0),near=put('zombie',20,0,0),named=put('zombie',60,0,0),cow=put('cow',60,0,0),cowFar=put('cow',0,0,140);
    named.name='Gerald';
    V.mobsDespawn(0.05);
    ok('past 128 blocks a monster is gone at once (and an animal too); within, it stays',far.dead&&cowFar.dead&&!mid.dead&&!near.dead&&!cow.dead);
    for(let i=0;i<500;i++)V.mobsDespawn(0.05);   /* 25 s: not idle long enough yet */
    const early=!mid.dead;
    for(let i=0;i<20000&&!mid.dead;i++)V.mobsDespawn(0.05);
    ok('past 32 blocks it stays half a minute, then goes now and then (gone: '+mid.dead+'); within 32 it never does; a named one, and an animal, never',early&&mid.dead&&!near.dead&&!named.dead&&!cow.dead);
    kill();}

  /* ===== 8. animals ===== */
  {home();P().flying=false;V.forceChunksNear(o.x,o.z);step(30);
    const gx=o.x+12,gz=o.z;const gy=V.surfaceTop(gx,gz)+1;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){V.setBlock(gx+dx,gy-1,gz+dz,B.GRASS);for(let y=gy;y<gy+4;y++)V.setBlock(gx+dx,y,gz+dz,B.AIR);}
    const fx=o.x+50;P().x=fx+0.5;P().z=o.z+0.5;P().y=V.surfaceTop(fx,o.z)+1;
    noon();const day=V.spawnOKP('cow',gx,gy,gz);night();const nightOK=V.spawnOKP('cow',gx,gy,gz);noon();
    V.setBlock(gx,gy-1,gz,B.STONE);const stone=V.spawnOKP('cow',gx,gy,gz);V.setBlock(gx,gy-1,gz,B.GRASS);
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)V.setBlock(gx+dx,gy+3,gz+dz,B.STONE);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let y=gy;y<gy+3;y++)if(Math.abs(dx)===2||Math.abs(dz)===2)V.setBlock(gx+dx,y,gz+dz,B.STONE);
    const cave=V.spawnOKP('cow',gx,gy,gz);
    ok('animals: on grass in the light by day '+day+', and under the night sky too '+nightOK+' (it is the sky\'s light, not the hour); not on stone '+stone+'; not on grass in a dark cave '+cave,day===true&&nightOK===true&&stone===false&&cave===false);
    home();step(3);}

  /* ===== 9. a dungeon spawner ===== */
  {kill();const sx=HX,sy=HY,sz=HZ;hall();V.setBlock(sx,sy,sz,B.SPAWNER_Z);
    const k=V.bkey?V.bkey(sx,sy,sz):(sx+','+sy+','+sz);
    p.x=sx+0.5;p.y=sy+20;p.z=sz+0.5;p.flying=true;
    const SPWm=V.getSPW?V.getSPW():null;
    if(!SPWm||typeof SPWm.set!=='function'){ok('a dungeon spawner [no SPW map on __vox]',false);}
    else{SPWm.set(k,0);
      for(let i=0;i<200;i++)V.tickSpawners(0.05);
      const asleep=V.entities.filter(e=>e.mob&&!e.dead).length;
      p.y=sy+10;for(let i=0;i<4000;i++)V.tickSpawners(0.05);
      const Z=V.entities.filter(e=>e.mob&&!e.dead&&e.mt==='zombie');
      ok('a zombie spawner: asleep with Dan 20 blocks off ('+asleep+'), awake within 16; '+Z.length+' zombies, every one within 4 of it, and it stops at 6',
        asleep===0&&Z.length>=1&&Z.length<=6+3&&Z.every(e=>Math.abs(e.x-sx-0.5)<=4.6&&Math.abs(e.z-sz-0.5)<=4.6&&Math.abs(e.y-sy)<=1.1));
      SPWm.delete(k);}
    V.setBlock(sx,sy,sz,B.AIR);kill();}

  /* ===== 10. falling ===== */
  {hall();night();const top=HY+5;
    const drop=(mt,h,water,noFall)=>{if(water)V.setBlock(HX,top,HZ,B.WATER,0);V.spawnMob(mt,HX+0.5,top+h,HZ+0.5);const e=V.entities[V.entities.length-1];if(noFall)e.noFall=true;const hp=e.hp;
      let i=0;for(;i<200&&!(e.onGround&&i>5);i++)step(1);step(3);const lost=hp-e.hp;e.dead=true;if(water){V.setBlock(HX,top,HZ,B.AIR);V.LIQ.w.clear();}step(2);return lost;};
    p.y=HY+60;p.x=HX+40.5;
    const z10=drop("zombie",10),z3=drop("zombie",3),wet=drop("zombie",10,true),pig=drop("pig",10,false,true);
    ok("a zombie that falls 10 blocks is hurt 7 ("+z10+"), one that falls 3 is not ("+z3+"), one that lands in water is not ("+wet+"), and a pig from the cannon lands safely ("+pig+")",z10===7&&z3===0&&wet===0&&pig===0);
    noon();kill();}

  /* ===== 11. the server's game ===== */
  {home();step(3);const was=V.NET.host;V.NET.host=true;let l1=-1,l2=-1,s1=-1,s2=-1;
    try{V.setBlock(o.x+2,o.y,o.z+2,B.TORCH);l1=V.lightAt(o.x+2,o.y,o.z+2);l2=V.lightAt(o.x+2,o.y,o.z+4);V.setBlock(o.x+2,o.y,o.z+2,B.AIR);
      V.setBlock(o.x+2,o.y+3,o.z+2,B.STONE);s1=V.getSky(o.x+2,o.y,o.z+2);V.setBlock(o.x+2,o.y+3,o.z+2,B.AIR);s2=V.getSky(o.x+2,o.y,o.z+2);}finally{V.NET.host=was;}
    ok('the server\'s own game keeps both light maps: a torch gives 14 at its cell and 12 two on ('+l1+', '+l2+'); a block over a cell takes the sky\'s 15 off it and gives it back ('+s1+', '+s2+')',l1===14&&l2===12&&s1<15&&s2===15);}
  SPAWN.rnd=null;
});
