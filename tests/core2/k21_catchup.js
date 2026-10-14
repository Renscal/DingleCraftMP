/* k21_catchup.js (v6.50, lane CORE2, gate x1): the world keeps time while nobody is looking (src/features/p53h_catchup.js).
   Crops, a sapling and a furnace in a survival world, with the dice seeded (CATCH.rnd).
   1 crops: a watered one is ripe after a few days, unchanged after a second; a dry one never grows
   2 saplings: under a stone roof in the dark nothing happens; in the open a long wait makes it due, and the next tick of
     treeTick makes it a tree
   3 furnaces: what furnaceTick would have cooked (8 ore and a coal: up to 8 out), and it stops when the fuel runs out
     (64 ore and a coal, a year later: still at most 8, and quickly)
   4 a chunk that was unloaded remembers when (catchStamp) and catches up when it is built again; a loaded world whose clock
     jumps catches up by the jump; the server's clock moves the game's forward, never back
   5 saved and loaded: the clock, the moment of the save and the chunks' stamps are in the save; the time the game was
     closed is added on loading; an old save without them loads with nothing to catch up
   6 a cap (catchUpMax on a server) limits any one catch-up */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:50});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT,C=V.CATCH;
  ok('the seams are on __vox',['catchTick','catchChunk','catchStamp','farmCatch','treeCatch','furnaceCatch','furnaceStep','catchIn','catchOut','catchClockIn','catchSteps'].every(k=>typeof V[k]==='function')&&!!C);
  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.god=true;
  let rs=50;const mul=()=>{rs=(rs+0x6D2B79F5)|0;let t=Math.imul(rs^(rs>>>15),1|rs);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};   /* mulberry32: a float LCG falls into short cycles */C.rnd=mul;
  const X=o.x+2,Y=o.y,Z=o.z;
  const crop=(dx,wet)=>{V.setBlock(X+dx,Y-1,Z,B.FARMLAND,wet?(8|5):0);V.setBlock(X+dx,Y,Z,B.WHEAT,7);return ()=>V.getMeta(X+dx,Y,Z)&7;};
  const DAY=1200;

  /* ===== 1. crops ===== */
  {const a=crop(0,true),b=crop(1,true),dry=crop(2,false);
    V.farmCatch(X,Y,Z,DAY*5);V.farmCatch(X+1,Y,Z,1);V.farmCatch(X+2,Y,Z,DAY*5);
    ok('a watered crop is ripe after five days ('+a()+' stages left), one second changes nothing ('+b()+'), a dry one never grows ('+dry()+')',a()===0&&b()===7&&dry()===7);
    let sum=0;for(let i=0;i<40;i++){V.setBlock(X+1,Y,Z,B.WHEAT,7);V.farmCatch(X+1,Y,Z,DAY/7);sum+=7-(V.getMeta(X+1,Y,Z)&7);}
    ok('the odds are farmTick\'s own: a seventh of a day grows a crop about one stage ('+(sum/40).toFixed(2)+' on average)',sum/40>0.6&&sum/40<1.5);}

  /* ===== 2. saplings ===== */
  {const sx=X+4,sz=Z+3;
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){V.setBlock(sx+dx,Y-1,sz+dz,B.GRASS);for(let y=Y;y<Y+7;y++)V.setBlock(sx+dx,y,sz+dz,B.AIR);}
    V.setBlock(sx,Y,sz,B.SAPLING,0);V.setBlock(sx,Y+2,sz,B.STONE);
    const dark=V.getLight(sx,Y,sz);V.treeCatch(sx,Y,sz,DAY*10);
    ok('a sapling under a stone roof, in the dark ('+dark+'), does nothing in ten days',V.getBlock(sx,Y,sz)===B.SAPLING&&V.getMeta(sx,Y,sz)===0&&!C.due.size);
    V.setBlock(sx,Y+2,sz,B.AIR);for(let y=Y+1;y<79;y++)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)if(V.getBlock(sx+dx,y,sz+dz)!==B.AIR)V.setBlock(sx+dx,y,sz+dz,B.AIR);
    V.treeCatch(sx,Y,sz,DAY*10);
    ok('in the open ten days make it full grown and due ('+((V.getMeta(sx,Y,sz)>>2)&3)+')',((V.getMeta(sx,Y,sz)>>2)&3)===3&&C.due.has(sx+','+Y+','+sz));
    V.treeTick(1);
    ok('...and the next second of treeTick makes it a tree',V.getBlock(sx,Y,sz)!==B.SAPLING&&V.isLogId(V.getBlock(sx,Y,sz))&&!C.due.size);}

  /* ===== 3. furnaces ===== */
  {const ore=+Object.keys(V.SMELT).find(k=>V.SMELT[k]===IT.IRON)||+Object.keys(V.SMELT)[0];
    const f=(n)=>({t:'furnace',in:{id:ore,count:n},fuel:{id:IT.COAL,count:1},out:null,burn:0,burnMax:0,cook:0});
    const a=f(8),ref=f(8);V.furnaceCatch(a,120);for(let i=0;i<2400;i++)V.furnaceStep(ref,0.05);
    ok('8 ore and a coal, two minutes on: '+(a.out?a.out.count:0)+' cooked, as furnaceTick itself would ('+(ref.out?ref.out.count:0)+')',!!a.out&&Math.abs(a.out.count-ref.out.count)<=1&&a.out.count>=7&&a.fuel===null);
    const b=f(64),t0=Date.now();V.furnaceCatch(b,3600*24*365);const ms=Date.now()-t0;
    ok('64 ore and a coal, a year on: the coal cooks '+(b.out?b.out.count:0)+' and it stops ('+b.in.count+' left, in '+ms+' ms)',b.out.count<=8&&b.out.count>=7&&b.in.count===64-b.out.count&&b.burn===0&&ms<200);}

  /* ===== 4. chunks and the clock ===== */
  {const cx=Math.floor(X/16),cz=Math.floor(Z/16);let key=null,ch=null;for(const [k,c] of V.chunks)if(c.cx===cx&&c.cz===cz){key=k;ch=c;}
    const g=crop(6,true);
    V.catchStamp(key,ch);const was=C.seen.get(key);
    ok('a chunk with a crop in it is stamped when it goes ('+was+')',typeof was==='number');
    C.clock+=DAY*5;V.catchChunk(key,ch);
    ok('...and when it is built again it catches up on the time since: the crop is ripe ('+g()+'), and the stamp is used up',g()===0&&!C.seen.has(key));
    const h=crop(7,true);V.catchTick(0.05);C.clock+=DAY*5;V.catchTick(0.05);
    ok('a loaded world whose clock jumps five days catches up by the jump ('+h()+')',h()===0);
    const c0=C.clock;V.catchClockIn(c0+100);const c1=C.clock;V.catchClockIn(c0-5000);
    ok('the server\'s clock moves the game\'s forward, never back',c1===c0+100&&C.clock===c1);}

  /* ===== 5. saved and loaded ===== */
  {const snap=V.snapshot('k21');
    ok('the save has the clock, when it was written, and the stamps',typeof snap.clock==='number'&&typeof snap.wall==='number'&&snap.cseen&&typeof snap.cseen==='object');
    V.catchIn({clock:100,wall:Date.now()-3600e3},Date.now());
    ok('loading a save written an hour ago adds the hour ('+C.clock.toFixed(0)+')',Math.abs(C.clock-3700)<5);
    V.catchIn({},Date.now());
    ok('an old save without any of it: the clock at 0, nothing to catch up',C.clock===0&&C.seen.size===0);}

  /* ===== 6. a cap ===== */
  {C.max=60;const g=crop(8,true);   /* the cap is applied where the time is worked out (catchChunk, catchTick, catchIn, furnaceCatch) */
    const cx=Math.floor((X+8)/16),cz=Math.floor(Z/16);let key=null,ch=null;for(const [k,c] of V.chunks)if(c.cx===cx&&c.cz===cz){key=k;ch=c;}
    C.seen.set(key,C.clock-DAY*5);V.catchChunk(key,ch);
    ok('with a cap of a minute, five days away grow a crop at most a little ('+g()+' stages left)',g()>=5);
    C.max=0;}
  C.rnd=null;
});
