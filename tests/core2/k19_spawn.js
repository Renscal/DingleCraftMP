/* k19_spawn.js (v6.44, lane CORE2, gate x1): monsters spawn where it is dark, safe and far (src/entities/p05e_spawning_tick.js;
   skyLit in src/world/p03e_light.js). A sealed stone hall is built in the air 40 blocks from Dan, 11 x 11 inside, 4 high.
   1 room: a zombie needs a solid floor and two free cells; not in mid-air, not in a 1-high gap, not in water or lava,
     not standing on glass or leaves; a spider needs its 3 x 3 (a pillar beside it is in the way) but only 1 of height
   2 dark: the sealed hall is dark at noon; one torch lights it exactly as far as its light reaches (block light 0 is
     the edge); the torch gone, it is dark again
   3 daylight: a hole in the roof daylights the cells within 8 steps of it by day and nothing by night; the open surface
     is daylit by day and dark by night
   4 far: never within 24 blocks of the player (measured in 3D), allowed beyond
   5 the whole answer: in the dark hall at noon a zombie may spawn; Dan standing in it, it may not; in a daylit, torch-lit
     or flooded spot it may not
   6 the real tick: with the hall dark and Dan far away, monsters appear in it (only on its floor, never inside a block or
     in the air), in a pack now and then, and never more than the cap; with the hall lit by torches none appear in it
   7 animals still appear by day, on grass, in the open
   8 the server's own game keeps a light map: a torch placed there lights its cell */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:44});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,SPAWN=V.SPAWN;
  ok('the seams are on __vox',['spawnRoom','spawnDark','spawnClear','spawnOK','spawnTry','skyLit','mobsTick','lightAt'].every(k=>typeof V[k]==='function')&&!!SPAWN);
  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.fireTick=false;V.GR.god=true;
  const P=()=>V.P;
  const HX=o.x+40,HZ=o.z,HY=Math.min(60,Math.max(V.surfaceTop(HX,HZ)+10,o.y+10));   /* the hall's floor is at HY-1, its inside HY..HY+3 */
  V.forceChunksNear(HX,HZ);step(30);
  const R=5;
  const hall=()=>{for(let dx=-R-1;dx<=R+1;dx++)for(let dz=-R-1;dz<=R+1;dz++)for(let y=HY-1;y<=HY+4;y++){
      const wall=Math.abs(dx)===R+1||Math.abs(dz)===R+1||y===HY-1||y===HY+4;V.setBlock(HX+dx,y,HZ+dz,wall?B.STONE:B.AIR);}
    for(const e of V.entities)if(e.mob||e.t==='drop')e.dead=true;step(2);};
  /* clear the sky over and round the hall first, so nothing else shades it */
  for(let dx=-R-4;dx<=R+4;dx++)for(let dz=-R-4;dz<=R+4;dz++)for(let y=HY-2;y<79;y++)V.setBlock(HX+dx,y,HZ+dz,B.AIR);
  hall();
  const home=()=>{const p=P();p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;p.fallD=0;p.mode='s';};
  home();step(3);
  const noon=()=>V.setTime(0.25),night=()=>V.setTime(0.75);
  /* ===== 1. room ===== */
  const room=(mt,dx,dz,y)=>V.spawnRoom(mt,HX+dx,y===undefined?HY:y,HZ+dz);
  const r0=room('zombie',0,0),air=room('zombie',0,0,HY+1);
  V.setBlock(HX+2,HY+1,HZ,B.STONE);const low=room('zombie',2,0);V.setBlock(HX+2,HY+1,HZ,B.AIR);
  V.setBlock(HX+2,HY,HZ,B.WATER);const wet=room('zombie',2,0);V.setBlock(HX+2,HY,HZ,B.LAVA);const hot=room('zombie',2,0);V.setBlock(HX+2,HY,HZ,B.AIR);V.LIQ.w.clear();V.LIQ.l.clear();
  V.setBlock(HX+2,HY+1,HZ,B.WATER,0);const wetHead=room('zombie',2,0);V.setBlock(HX+2,HY+1,HZ,B.AIR);V.LIQ.w.clear();
  for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++)for(let y=HY;y<=HY+3;y++)if(V.getBlock(HX+dx,y,HZ+dz)!==B.AIR)V.setBlock(HX+dx,y,HZ+dz,B.AIR);V.LIQ.w.clear();V.LIQ.l.clear();
  V.setBlock(HX-3,HY-1,HZ,B.GLASS);const onGlass=room('zombie',-3,0);V.setBlock(HX-3,HY-1,HZ,B.LEAF_O);const onLeaf=room('zombie',-3,0);V.setBlock(HX-3,HY-1,HZ,B.STONE);
  ok('a zombie: on a floor with two free cells yes; in mid-air, under a 1-high gap, in water, in lava, with its head in water, on glass, on leaves: no',
    r0===true&&[air,low,wet,hot,wetHead,onGlass,onLeaf].every(v=>v===false));
  const s0=room('spider',0,0);V.setBlock(HX+1,HY,HZ+1,B.STONE);const s1=room('spider',0,0),z1=room('zombie',0,0);V.setBlock(HX+1,HY,HZ+1,B.AIR);
  V.setBlock(HX,HY+1,HZ,B.STONE);const s2=room('spider',0,0),z2=room('zombie',0,0);V.setBlock(HX,HY+1,HZ,B.AIR);
  const sWall=room('spider',R,0),zWall=room('zombie',R,0);
  ok('a spider needs three by three: free floor yes; a pillar diagonally beside it no (a zombie does not mind); against the wall no (a zombie yes); one cell of height is enough for it (not for a zombie)',
    s0===true&&s1===false&&z1===true&&sWall===false&&zWall===true&&s2===true&&z2===false);
  /* ===== 2. dark ===== */
  noon();step(2);
  const d0=V.spawnDark(HX,HY,HZ);
  V.setBlock(HX-R,HY,HZ,B.TORCH);step(2);
  let edge=-1;for(let dx=-R;dx<=R;dx++)if(V.lightAt(HX+dx,HY,HZ)===0){edge=dx;break;}
  const lit=[-R,0,R].map(dx=>V.spawnDark(HX+dx,HY,HZ)),lv=[-R,0,R].map(dx=>V.lightAt(HX+dx,HY,HZ));
  V.setBlock(HX-R,HY,HZ,B.TORCH);V.setBlock(HX-R,HY,HZ,B.AIR);step(2);
  ok('the sealed hall is dark at noon; a torch at one end lights it (block light '+lv.join(', ')+' along the hall) and nothing there is dark; the torch gone, it is dark again',
    d0===true&&lv[0]===14&&lv[1]===9&&lv[2]===4&&lit.every(v=>v===false)&&V.spawnDark(HX,HY,HZ)===true&&V.lightAt(HX,HY,HZ)===0);
  {/* a long corridor, to find where a torch's light ends */
    for(let i=0;i<24;i++){for(let dy=-1;dy<=2;dy++)for(let dz=-1;dz<=1;dz++)V.setBlock(HX+R+1+i,HY+dy,HZ+dz,(dy===0||dy===1)&&dz===0&&i<23?B.AIR:B.STONE);}
    V.setBlock(HX+R+1,HY,HZ,B.TORCH);step(2);let first=-1;for(let i=0;i<23;i++)if(V.spawnDark(HX+R+1+i,HY,HZ)){first=i;break;}
    ok('down a corridor a torch keeps monsters off for exactly as far as its light reaches: the first dark cell is '+first+' blocks from it (light 14, losing one a block)',first===14&&V.lightAt(HX+R+1+13,HY,HZ)===1&&V.lightAt(HX+R+1+14,HY,HZ)===0);
    V.setBlock(HX+R+1,HY,HZ,B.AIR);for(let i=0;i<24;i++)for(let dy=-1;dy<=2;dy++)for(let dz=-1;dz<=1;dz++)V.setBlock(HX+R+1+i,HY+dy,HZ+dz,B.AIR);hall();}
  /* ===== 3. daylight ===== */
  noon();step(2);
  V.setBlock(HX-R,HY+4,HZ-R,B.AIR);step(2);
  const dist=(dx,dz)=>Math.abs(dx+R)+Math.abs(dz+R);        /* steps along the floor to the cell under the hole (the whole column under a hole is open to the sky) */
  let wrong=0,litN=0,darkN=0;for(let dx=-R;dx<=R;dx++)for(let dz=-R;dz<=R;dz++){const want=dist(dx,dz)<=8,got=V.skyLit(HX+dx,HY,HZ+dz,8);if(got!==want)wrong++;if(got)litN++;else darkN++;}
  const dayHole=V.spawnDark(HX-R,HY,HZ-R),dayFar=V.spawnDark(HX+R,HY,HZ+R);
  night();const nightHole=V.spawnDark(HX-R,HY,HZ-R);noon();
  ok('one block out of the roof: by day the '+litN+' floor cells within 8 steps of the hole are daylit and the other '+darkN+' are not ('+wrong+' wrong); by night the hole changes nothing',
    wrong===0&&litN>5&&darkN>50&&dayHole===false&&dayFar===true&&nightHole===true);
  V.setBlock(HX-R,HY+4,HZ-R,B.STONE);step(2);
  const top=HY+5;noon();const sDay=V.spawnDark(HX,top,HZ);night();const sNight=V.spawnDark(HX,top,HZ);noon();
  ok('the open roof of the hall: daylit by day, dark by night',sDay===false&&sNight===true&&V.spawnRoom('zombie',HX,top,HZ)===true);
  /* ===== 4. far ===== */
  {const p=P();p.x=HX+0.5;p.z=HZ+0.5;p.y=HY+30;p.flying=true;p.mode='c';p.vy=0;
    const c=[V.spawnClear(HX,HY+30-23,HZ),V.spawnClear(HX,HY+30-25,HZ),V.spawnClear(HX+23,HY+30,HZ),V.spawnClear(HX+24,HY+30,HZ+1),V.spawnClear(HX+17,HY+30,HZ+17)];
    ok('never within 24 blocks of the player, measured in every direction ('+c.map(v=>v?1:0).join('')+')',c.join()==='false,true,false,true,true');
    /* ===== 5. the whole answer ===== */
    noon();
    const far=V.spawnOK('zombie',HX,HY,HZ);                    /* Dan is 30 above: far enough */
    p.y=HY+6;const close=V.spawnOK('zombie',HX,HY,HZ);p.y=HY+30;
    V.setBlock(HX+3,HY,HZ,B.TORCH);step(1);const torch=V.spawnOK('zombie',HX,HY,HZ);V.setBlock(HX+3,HY,HZ,B.AIR);step(1);
    V.setBlock(HX,HY,HZ,B.WATER,7);const wet2=V.spawnOK('zombie',HX,HY,HZ);V.setBlock(HX,HY,HZ,B.AIR);V.LIQ.w.clear();
    ok('the dark hall at noon: a zombie may spawn; with Dan 6 blocks away, or a torch in the hall, or water at the spot, or on the daylit roof, it may not',
      far===true&&close===false&&torch===false&&wet2===false&&V.spawnOK('zombie',HX,top,HZ)===false);
    /* ===== 6. the real tick ===== */
    let rs=77;const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
    SPAWN.rnd=rnd;V.GR.mobSpawn=true;p.mode='s';V.GR.god=true;p.flying=true;
    const realRange=SPAWN.range;SPAWN.range=R+1;              /* tries land in and round the hall, so the test does not wait an hour */
    const anchor={x:HX+0.5,y:HY,z:HZ+0.5};
    const hallMobs=()=>V.entities.filter(e=>e.mob&&!e.dead&&e.hostile&&Math.abs(e.x-HX-0.5)<=R+0.6&&Math.abs(e.z-HZ-0.5)<=R+0.6&&e.y>=HY-0.5&&e.y<HY+4);
    let n=0,biggest=0,tries=0;for(;tries<400&&n<SPAWN.capH;tries++){const got=V.spawnTry(anchor,SPAWN.capH-n);n+=got;if(got>biggest)biggest=got;}
    const M=hallMobs(),all=V.entities.filter(e=>e.mob&&!e.dead&&e.hostile);
    /* some land in caves under the hall, which is as it should be: every one, wherever it is, stands in a dark, roomy cell out of the daylight */
    const sane=all.every(e=>{const x=Math.floor(e.x),y=Math.round(e.y),z=Math.floor(e.z);return V.spawnRoom(e.mt,x,y,z)&&V.lightAt(x,y,z)===0&&!V.skyLit(x,y,z,8)&&Math.abs(e.x-x-0.5)<1e-9;})&&M.every(e=>Math.round(e.y)===HY);
    ok(tries+' tries by day with Dan 30 blocks up: '+n+' monsters, '+M.length+' of them in the dark hall on its floor, every one in a dark cell with room for it and none in daylight; the largest pack '+biggest,
      n>=4&&n<=SPAWN.capH&&M.length>=3&&sane&&biggest>=2&&biggest<=SPAWN.pack&&new Set(all.map(e=>e.mt)).size>=2);
    for(const e of V.entities)if(e.mob)e.dead=true;step(2);
    for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3],[0,0]])V.setBlock(HX+dx,HY+3,HZ+dz,B.GLOWSTONE);step(2);
    let n2=0;for(let i=0;i<400;i++)n2+=V.spawnTry(anchor,SPAWN.capH);
    ok('the same hall with five lights in its ceiling: 400 tries, '+hallMobs().length+' monsters in it ('+n2+' in the dark elsewhere)',hallMobs().length===0);
    for(const e of V.entities)if(e.mob)e.dead=true;step(2);
    for(const [dx,dz] of [[-3,-3],[3,-3],[-3,3],[3,3],[0,0]])V.setBlock(HX+dx,HY+3,HZ+dz,B.AIR);step(2);
    /* the cap, through mobsTick itself */
    SPAWN.tries=60;let cycles=0;for(;cycles<40;cycles++){V.mobsTick(2);}
    const capped=V.entities.filter(e=>e.mob&&!e.dead&&e.hostile).length;
    ok('the real spawner, 40 cycles over the dark hall: it fills up to the cap of '+SPAWN.capH+' and stops ('+capped+')',capped===SPAWN.capH);
    SPAWN.tries=10;SPAWN.range=realRange;
    for(const e of V.entities)if(e.mob)e.dead=true;step(2);
    /* ===== 7. animals ===== */
    home();P().flying=false;P().mode='s';V.forceChunksNear(o.x,o.z);step(30);noon();
    let animals=0,bad=0;for(let i=0;i<600&&animals<4;i++){V.mobsTick(2);for(const e of V.entities)if(e.mob&&!e.dead&&!e.hostile&&!e._seen){e._seen=1;animals++;
      const g=V.getBlock(Math.floor(e.x),Math.round(e.y)-1,Math.floor(e.z));if((g!==B.GRASS&&g!==B.SNOWGRASS)||!V.skyOpen(Math.floor(e.x),Math.round(e.y),Math.floor(e.z)))bad++;}}
    const hostileByDay=V.entities.filter(e=>e.mob&&!e.dead&&e.hostile&&V.skyOpen(Math.floor(e.x),Math.round(e.y),Math.floor(e.z))).length;
    ok('by day animals still appear on grass under open sky ('+animals+', '+bad+' somewhere else), and no monster appears under open sky ('+hostileByDay+')',animals>=1&&bad===0&&hostileByDay===0);
    SPAWN.rnd=null;V.GR.mobSpawn=false;for(const e of V.entities)if(e.mob)e.dead=true;step(2);}
  /* ===== 8. the server's game ===== */
  {home();step(3);const was=V.NET.host;V.NET.host=true;let l1=-1,l2=-1;
    try{V.setBlock(o.x+2,o.y,o.z+2,B.TORCH);l1=V.lightAt(o.x+2,o.y,o.z+2);l2=V.lightAt(o.x+2,o.y,o.z+4);V.setBlock(o.x+2,o.y,o.z+2,B.AIR);}finally{V.NET.host=was;}
    ok('the server\'s own game keeps the light map too: a torch placed there gives 14 at its cell and 12 two blocks on ('+l1+', '+l2+')',l1===14&&l2===12&&V.lightAt(o.x+2,o.y,o.z+2)===0);}
});
