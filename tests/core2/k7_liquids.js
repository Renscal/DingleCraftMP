/* k7_liquids.js (v6.25, lane CORE2, gate x1): liquids have levels (src/features/p18_armor_boats_water_qol.js).
   A flat stone table built high in the air, liquids poured on it, the simulation stepped. Headless; how the surface looks
   is not checked here, only its numbers.
   1 one water source on flat ground: levels 1 to 7, out to exactly 7 blocks, in a diamond
   2 take the source away: every block of it is gone soon after
   3 lava in the Overworld reaches 3 blocks (levels 2, 4, 6) and takes its time; the Nether's numbers
   4 it runs toward a drop: with a hole two blocks east, the source spreads east only, and falls down the hole
   5 two sources with a gap between make a third (water only: lava's gap stays a flow)
   6 water on a lava source: obsidian; on flowing lava: cobblestone; lava falling onto water: stone
   7 a torch in the way is washed out and drops as an item
   8 a bucket fills from a source, never from flowing water; pouring makes a source; in the Nether water does not last
   9 a save keeps the levels, and a save from before 6.25 (plain ids) loads with every water block a source
   10 the surface: a source stands at 8/9 of a block, the flow slopes down from it, shared corners agree, falling water is full
   11 standing in a stream pushes the player downstream, and only the part of the block the water fills is "in water"
   12 a 30-block waterfall settles, and no frame of it takes long */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:25});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT||{},LIQ=V.LIQ;
  ok('the seams are on __vox',['getMeta','liqAmt','liqHeight','liqTop','liqFlow','liqRule','isLiq','lavaWaterCheck'].every(k=>typeof V[k]==='function')&&!!LIQ);
  V.startNewWorld('liq','1337','c');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;V.GR.fireTick=false;step(80);
  let P=V.P;P.flying=true;
  const cx=Math.floor(P.x),cz=Math.floor(P.z),FY=Math.min(66,Math.floor(P.y)+14),Y=FY+1,R=10;
  P.y=FY+6;P.vy=0;
  const lvl=(x,z,y)=>{const id=V.getBlock(x,y===undefined?Y:y,z);return V.isLiq(id)?(V.getMeta(x,y===undefined?Y:y,z)&15):-1;};
  const wet=id=>{let n=0;for(let x=-R-2;x<=R+2;x++)for(let z=-R-2;z<=R+2;z++)for(let y=FY-3;y<=Y+2;y++)if(V.getBlock(cx+x,y,cz+z)===id)n++;return n;};
  const table=()=>{LIQ.w.clear();LIQ.l.clear();for(const e of V.entities)if(e.t==='drop')e.dead=true;
    for(let x=-R-2;x<=R+2;x++)for(let z=-R-2;z<=R+2;z++)for(let y=FY-3;y<=Y+3;y++)V.setBlock(cx+x,y,cz+z,(y===FY&&Math.abs(x)<=R&&Math.abs(z)<=R)?B.STONE:B.AIR);
    LIQ.w.clear();LIQ.l.clear();P=V.P;P.x=cx+0.5;P.z=cz+0.5;P.y=FY+6;P.vx=P.vy=P.vz=0;step(3);};
  const settle=(n)=>step(n||220);

  /* ===== 1. a diamond ===== */
  table();V.setBlock(cx,Y,cz,B.WATER);settle();
  {let good=true,cells=0;
    for(let x=-R;x<=R;x++)for(let z=-R;z<=R;z++){const d=Math.abs(x)+Math.abs(z),l=lvl(cx+x,cz+z);
      if(d===0?l!==0:(d<=7?l!==d:l!==-1))good=false;if(l>=0)cells++;}
    ok('one source on flat ground: levels 1 to 7 by the block, out to exactly 7, in a diamond (113 cells)',good&&cells===113);
    ok('the amounts and heights that go with it: a source is 8 and stands 8/9 of a block, level 7 is 1 and stands 1/9',V.liqAmt(0)===8&&V.liqAmt(7)===1&&V.liqAmt(8)===8&&Math.abs(V.liqTop(cx,Y,cz)-8/9)<1e-9&&Math.abs(V.liqTop(cx+7,Y,cz)-1/9)<1e-9&&V.liqTop(cx+8,Y,cz)===0);
    ok('still water wakes nothing: the list of cells due is empty once it has settled',LIQ.w.size===0);}

  /* ===== 2. drain ===== */
  V.setBlock(cx,Y,cz,B.AIR);
  {let f=0;while(f<600&&wet(B.WATER)>0){step(10);f+=10;}
    ok('take the source away and the stream runs dry (within '+f+' frames)',wet(B.WATER)===0&&f<600);}

  /* ===== 3. lava ===== */
  table();V.setBlock(cx,Y,cz,B.LAVA);step(20);
  ok('lava takes its time: nothing yet after 0.8 s',lvl(cx+1,cz)===-1||lvl(cx+2,cz)===-1);
  settle(420);
  ok('lava in the Overworld reaches 3 blocks, thinning by 2 a block (levels 2, 4, 6), and stops',lvl(cx,cz)===0&&lvl(cx+1,cz)===2&&lvl(cx+2,cz)===4&&lvl(cx+3,cz)===6&&lvl(cx+4,cz)===-1&&lvl(cx+1,cz+1)===4&&lvl(cx+2,cz+2)===-1);
  {const o=V.liqRule(B.LAVA,'over'),n=V.liqRule(B.LAVA,'nether'),w=V.liqRule(B.WATER,'over');
    ok('the numbers: water every 0.25 s, 7 blocks, looks 4 for a drop; lava 1.5 s, 3 blocks, looks 2; lava in the Nether 0.5 s, 7 blocks, looks 4',w.every===0.25&&w.drop===1&&w.far===4&&o.every===1.5&&o.drop===2&&o.far===2&&n.every===0.5&&n.drop===1&&n.far===4);}
  V.setBlock(cx,Y,cz,B.AIR);{let f=0;while(f<900&&wet(B.LAVA)>0){step(20);f+=20;}ok('...and it drains too when its source is gone',wet(B.LAVA)===0);}

  /* ===== 4. toward the drop ===== */
  table();V.setBlock(cx+2,FY,cz,B.AIR);V.setBlock(cx,Y,cz,B.WATER);step(40);
  ok('with a hole two blocks east, a source spreads east only',lvl(cx+1,cz)===1&&lvl(cx-1,cz)===-1&&lvl(cx,cz+1)===-1&&lvl(cx,cz-1)===-1);
  settle(120);
  ok('...and the water goes down the hole as a falling column, not on across the table',lvl(cx+2,cz)===2&&(V.getMeta(cx+2,FY,cz)&8)===8&&V.getBlock(cx+2,FY-1,cz)===B.WATER&&lvl(cx+3,cz)===-1&&lvl(cx-1,cz)===-1);

  /* ===== 5. infinite water ===== */
  table();V.setBlock(cx-1,Y,cz,B.WATER);V.setBlock(cx+1,Y,cz,B.WATER);settle(60);
  ok('two water sources with a gap between them, on solid ground: the gap becomes a source',lvl(cx,cz)===0);
  V.setBlock(cx-1,Y,cz,B.AIR);V.setBlock(cx+1,Y,cz,B.AIR);settle(60);
  ok('...a real one: it is still there, and still a source, with the other two gone',lvl(cx,cz)===0&&lvl(cx+1,cz)===1);
  table();V.setBlock(cx-1,Y,cz,B.LAVA);V.setBlock(cx+1,Y,cz,B.LAVA);settle(200);
  ok('lava never does that: the gap between two lava sources stays a flow',lvl(cx,cz)>0);

  /* ===== 6. where they meet ===== */
  table();V.setBlock(cx+2,Y,cz,B.LAVA);LIQ.l.clear();V.setBlock(cx,Y,cz,B.WATER);settle(80);
  ok('water reaching a lava source makes obsidian',V.getBlock(cx+2,Y,cz)===B.OBSIDIAN);
  table();V.setBlock(cx+4,Y,cz,B.LAVA);settle(200);
  {const flowing=lvl(cx+2,cz);V.setBlock(cx,Y,cz,B.WATER);settle(80);
    ok('water reaching flowing lava makes cobblestone where they meet, and the lava source beyond is left alone',flowing===4&&V.getBlock(cx+1,Y,cz)===B.COBBLE&&V.getBlock(cx+4,Y,cz)===B.LAVA&&lvl(cx+4,cz)===0);}
  table();V.setBlock(cx,Y,cz,B.WATER);LIQ.w.clear();V.setBlock(cx,Y+2,cz,B.LAVA);settle(160);
  ok('lava falling onto water makes stone',V.getBlock(cx,Y,cz)===B.STONE);

  /* ===== 7. a torch in the way ===== */
  table();V.setBlock(cx+2,Y,cz,B.TORCH);V.setBlock(cx,Y,cz,B.WATER);settle(100);
  ok('a torch in the way is washed out: water stands where it was, and it lies there as an item',lvl(cx+2,cz)===2&&V.entities.some(e=>e.t==='drop'&&!e.dead&&e.st.id===B.TORCH));

  /* ===== 8. buckets ===== */
  table();V.setBlock(cx,Y,cz,B.WATER);settle();
  {P.mode='s';P.flying=false;const BK=228,BKW=229;
    for(let i=0;i<9;i++)P.inv[i]=null;P.inv[0]={id:BK,count:1};P.sel=0;
    P.x=cx+9.5;P.z=cz+0.5;P.y=Y+0.01;P.vx=P.vy=P.vz=0;P.onGround=true;step(3);
    boot.aim(V,cx+5.5,Y+0.3,cz+0.5);P.useT=0;boot.rclick(V,step);step(3);
    ok('a bucket held to flowing water stays empty, and the water is as it was',P.inv[0]&&P.inv[0].id===BK&&lvl(cx+5,cz)===5&&lvl(cx+7,cz)===7);
    V.setBlock(cx+8,Y,cz+2,B.WATER);LIQ.w.clear();
    boot.aim(V,cx+8.5,Y+0.4,cz+2.5);P.useT=0;boot.rclick(V,step);step(3);
    ok('...and fills from a source, which it takes',P.inv[0]&&P.inv[0].id===BKW&&V.getBlock(cx+8,Y,cz+2)!==B.WATER||lvl(cx+8,cz+2)>0);
    boot.aim(V,cx+8.5,FY+1.0,cz-1.5);P.useT=0;boot.rclick(V,step);step(2);
    ok('pouring it out makes a source',P.inv[0]&&P.inv[0].id===BK&&lvl(cx+8,cz-2)===0);
    P.mode='c';P.flying=true;P.y=FY+6;}

  /* ===== 9. saves ===== */
  table();V.setBlock(cx,Y,cz,B.WATER);settle();
  {const s=JSON.parse(JSON.stringify(V.snapshot('liq')));
    let coded=0,plain=0;for(const k in s.edits)for(const lk in s.edits[k]){const v=s.edits[k][lk];if((v&255)===B.WATER){if(v>>8)coded++;else plain++;}}
    ok('a save writes a flowing block as its id with its level above it, and a source as the plain id ('+coded+' flowing, '+plain+' plain)',coded>=112&&plain>=1);
    V.applySave(s);step(30);
    let good=true;for(let x=-7;x<=7;x++)for(let z=-7;z<=7;z++){const d=Math.abs(x)+Math.abs(z);if(d<=7&&lvl(cx+x,cz+z)!==d)good=false;}
    ok('...and loading it puts every level back',good&&lvl(cx+8,cz)===-1);
    const old=JSON.parse(JSON.stringify(s));for(const k in old.edits)for(const lk in old.edits[k])old.edits[k][lk]&=255;
    V.applySave(old);step(5);
    ok('a save from before 6.25 (plain ids) loads: every water block in it is a source',lvl(cx,cz)===0&&lvl(cx+3,cz)===0&&lvl(cx+7,cz)===0);
    P=V.P;P.flying=true;P.mode='c';}   /* loading a save makes a new player object */

  /* ===== 10. the surface ===== */
  table();V.setBlock(cx,Y,cz,B.WATER);settle();
  {const ch=V.chunkAt(cx,cz),b=V.meshChunk(ch).wat,lx=cx-ch.cx*16,lz=cz-ch.cz*16;
    /* the height the mesh gives the water at a corner (x,z) of the table, from every top quad that touches it */
    const at=(x,z)=>{const hs=[];for(let q=0;q<b.vc/4;q++){if(b.n[q*12+1]!==1)continue;for(let i=0;i<4;i++){const px=b.p[q*12+i*3],py=b.p[q*12+i*3+1],pz=b.p[q*12+i*3+2];
      if(Math.abs(px-(lx+x))<1e-6&&Math.abs(pz-(lz+z))<1e-6&&py>Y&&py<Y+1.01)hs.push(py-Y);}}return hs;};
    const inChunk=(x,z)=>lx+x>=1&&lx+x<=14&&lz+z>=1&&lz+z<=14;
    if(inChunk(0,0)&&inChunk(3,1)){
      const c0=at(0,0),c1=at(1,0),c3=at(3,0);
      ok('the surface slopes: highest round the source, lower with every block out',c0.length>0&&c1.length>0&&c3.length>0&&Math.max(...c0)<=8/9+1e-6&&Math.max(...c0)>Math.max(...c3)&&Math.min(...c1)>Math.min(...c3));
      ok('cells that share a corner agree on its height, so the surface has no steps in it',[c0,c1,c3,at(1,1),at(2,1)].every(h=>h.length>=2&&Math.max(...h)-Math.min(...h)<1e-6));
    }else{boot.skip('the surface slope','the table straddles a chunk border here');}
    V.setBlock(cx+2,FY,cz,B.AIR);settle(120);
    ok('falling water stands the full height of its block',(V.getMeta(cx+2,FY,cz)&8)===8&&V.liqTop(cx+2,FY,cz)>=8/9&&V.liqTop(cx+2,Y,cz)>0);}

  /* ===== 11. standing in it ===== */
  table();V.setBlock(cx,Y,cz,B.WATER);settle();
  {const f=V.liqFlow(cx+3,Y,cz),g=V.liqFlow(cx,Y,cz);
    ok('a stream runs away from its source: east of it, east; at the source itself, nowhere',f[0]>0.9&&Math.abs(f[1])<0.2&&g[0]===0&&g[1]===0&&V.liqFlow(cx+9,Y,cz)[0]===0);
    P.mode='s';P.flying=false;P.x=cx+3.5;P.z=cz+0.5;P.y=Y+0.01;P.vx=P.vy=P.vz=0;step(12);
    ok('standing in it, the player is carried downstream',P.x>cx+3.55);
    P.x=cx+6.5;P.z=cz+0.5;P.y=Y+0.01;P.vx=P.vy=P.vz=0;step(2);
    const shallow=P.inWater;
    P.x=cx+0.5;P.z=cz+0.5;P.y=Y+0.01;P.vx=P.vy=P.vz=0;step(2);
    ok('only the part of a block the water fills is water: ankle-deep at the thin end is not swimming, the source is',shallow===false&&P.inWater===true);
    P.mode='c';P.flying=true;P.y=FY+6;}

  /* ===== 12. a waterfall ===== */
  table();
  {const top=Math.min(74,FY+8);V.setBlock(cx+R+1,top,cz,B.STONE);V.setBlock(cx+R+1,top+1,cz,B.STONE);
    let worst=0,frames=0;
    V.setBlock(cx+R+2,top+1,cz,B.WATER);
    const t0=Date.now();
    for(;frames<1500;frames+=5){const a=Date.now();step(5);worst=Math.max(worst,(Date.now()-a)/5);if(frames>200&&LIQ.w.size===0)break;}
    let col=0;for(let y=top;y>top-30&&y>0;y--)if(V.getBlock(cx+R+2,y,cz)===B.WATER)col++;
    ok('a waterfall off a ledge falls as one column ('+col+' blocks) and comes to rest (in '+frames+' frames, '+(Date.now()-t0)+' ms)',col>=20&&LIQ.w.size===0&&frames<1500);
    ok('...and no frame of it takes long (worst 5-frame average '+worst.toFixed(1)+' ms a frame, limit 60)',worst<60);}
  await V.quitToTitle();await window.storage.delete('vxw:liq').catch(()=>{});
});
