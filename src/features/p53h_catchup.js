/* ----- catching up (6.50): the world keeps time while nobody is looking -----
   Crops, saplings and furnaces only move while their chunk is loaded and the game that runs it is ticking. A field left
   behind used to wait for you, frozen; so did a furnace on a server that had paused (6.46). Now the world has a clock of its
   own (CATCH.clock, seconds, never wraps) and remembers when it last ran each chunk that has something growing in it
   (CATCH.seen, chunk key -> clock). When such a chunk is built again, and whenever a loaded world finds its clock has jumped
   (a server game that was paused or had nobody near, a save loaded days later), what was missed happens at once:
     crops     a stage at a time, by the same odds farmTick rolls every second, as long as the farmland under them is
               watered (as it stands when they are caught up: nothing is harvested meanwhile, so it stays as it was)
     saplings  the same with treeTick's odds, where treeTick would grow them (soil under them, sky or light). A sapling that
               would have become a tree is marked due and becomes one on the next tick, in the ordinary way, so a tree is
               never built while the chunks round it are missing
     furnaces  replayed with furnaceTick's own rules, a second at a time, until the time is used up or nothing more can
               happen (no input, no fuel, no room)
   The clock is real time: in single player the time the game was closed is added when the world is loaded (the save keeps
   the clock and the moment it was written); on a server the server keeps the clock (level.json), it runs while the server
   is empty or paused, and the time it was switched off is added when it starts. Day and night do not move meanwhile.
   A server can cap any one catch-up (catchUpMax, minutes; CATCH.max here, seconds; 0 is no cap). Only the game that runs
   the land catches up (single player, or the server's own game), so everyone sees one result.
   Fire, flowing water, leaves waiting to wither and mobs are not caught up: they are physics and life, not growth. */
const CATCH={clock:0,seen:new Map(),last:null,max:0,due:new Set(),rnd:null};
function catchRnd(){return CATCH.rnd?CATCH.rnd():Math.random();}
/* the time to catch up, capped */
function catchSpan(s){return s>0?(CATCH.max>0?Math.min(s,CATCH.max):s):0;}
/* does this chunk have anything that grows? (its edits are where crops and saplings live) */
function catchHas(ch){
  if(!ch||!ch.edits)return false;
  for(const v of ch.edits.values()){const id=v&255;if(id===B.SAPLING||(CROPS[id]&&((v>>8)&7)))return true;}
  return false;
}
/* a chunk is going (unloaded, or the dimension is changing): remember when it was last run */
function catchStamp(k,ch){if(catchHas(ch))CATCH.seen.set(k,CATCH.clock);}
/* the game that runs this land? (a player's game on a server that runs it does not) */
function catchHere(x,z){return !(NET.on&&ntSimHere(x,z)===false);}
/* how many of n chances at p a second come up in s seconds, at most n (the waits between them are drawn one by one) */
function catchSteps(n,p,s){
  let t=0,k=0;
  while(k<n){t+=-Math.log(1-catchRnd()*0.999999)/p;if(t>s)break;k++;}
  return k;
}
/* a crop at x,y,z after s seconds */
function farmCatch(x,y,z,s){
  const id=getBlock(x,y,z);
  if(!CROPS[id]||getBlock(x,y-1,z)!==B.FARMLAND||!(getMeta(x,y-1,z)&8))return;
  const left=getMeta(x,y,z)&7;
  if(!left)return;
  const k=catchSteps(left,FARM.p,s);
  if(k)setBlock(x,y,z,id,left-k);
}
/* a sapling at x,y,z after s seconds */
function treeCatch(x,y,z,s){
  if(getBlock(x,y,z)!==B.SAPLING)return;
  const under=getBlock(x,y-1,z);
  if(under!==B.GRASS&&under!==B.DIRT&&under!==B.SNOWGRASS)return;
  if(!skyOpen(x,y,z)&&getLight(x,y+1,z)<9&&getLight(x,y,z)<9)return;
  const m=getMeta(x,y,z),stage=(m>>2)&3,k=catchSteps(4-stage,TREE.p,s);
  if(!k)return;
  const to=Math.min(3,stage+k);
  if(to!==stage)setBlock(x,y,z,B.SAPLING,(m&3)|(to<<2));
  if(stage+k>=4)CATCH.due.add(x+','+y+','+z);            /* treeTick grows it on its next second */
}
/* a furnace after s seconds: furnaceTick's rules, a second at a time, until nothing more can happen */
function furnaceCatch(be,s){
  s=catchSpan(s);
  while(s>0){
    const out=be.in?SMELT[be.in.id]:undefined;
    const can=out!==undefined&&(!be.out||(be.out.id===out&&be.out.count<stackMax(out)));
    if(!can&&be.burn<=0){be.cook=0;return;}
    if(!can){be.burn=Math.max(0,be.burn-s);be.cook=0;return;}
    if(be.burn<=0&&!(be.fuel&&FUELS[be.fuel.id])){be.cook=0;return;}
    const dt=Math.min(1,s);s-=dt;
    furnaceStep(be,dt);
  }
}
/* everything growing in a loaded chunk, after s seconds */
function catchChunkBy(ch,s){
  s=catchSpan(s);
  if(s<=0)return;
  for(const [lk,v] of ch.edits){
    const id=v&255;
    if(id!==B.SAPLING&&!(CROPS[id]&&((v>>8)&7)))continue;
    const p=lk.split(','),x=ch.cx*CH+ +p[0],y=+p[1],z=ch.cz*CH+ +p[2];
    if(!catchHere(x,z))continue;
    if(id===B.SAPLING)treeCatch(x,y,z,s);else farmCatch(x,y,z,s);
  }
}
/* the createChunk hook: a chunk that was run before catches up on the time since */
function catchChunk(k,ch){
  const was=CATCH.seen.get(k);
  if(was===undefined)return;
  CATCH.seen.delete(k);
  catchChunkBy(ch,CATCH.clock-was);
}
/* from tickFlow, every tick of the land: the clock moves, and if it jumped (more than 2 s since the last tick) every loaded
   chunk catches up by the jump */
function catchTick(dt){
  CATCH.clock+=dt;
  const gap=CATCH.last===null?0:CATCH.clock-CATCH.last;
  CATCH.last=CATCH.clock;
  if(gap>2)for(const ch of chunks.values())catchChunkBy(ch,gap-dt);
}
/* the server's clock arrived (a server's games follow it: it runs while they are paused) */
function catchClockIn(v,max){
  if(typeof v==='number'&&isFinite(v)&&v>CATCH.clock)CATCH.clock=v;
  if(typeof max==='number'&&isFinite(max)&&max>=0)CATCH.max=max;
}
/* for a save: the clock and the chunks' stamps (loaded ones count as run just now) */
function catchOut(){
  const seen={};
  for(const [k,v] of CATCH.seen)seen[k]=+v.toFixed(1);
  for(const [k,ch] of chunks)if(catchHas(ch))seen[k]=+(CATCH.last!==null?CATCH.last:CATCH.clock).toFixed(1);   /* loaded ones: when they last ran */
  return seen;
}
/* from a save: o.clock, o.cseen, and o.wall (when it was written: the time since is added, once) */
function catchIn(o,now){
  CATCH.seen.clear();CATCH.due.clear();CATCH.last=null;
  CATCH.clock=typeof o.clock==='number'&&isFinite(o.clock)?o.clock:0;
  if(typeof o.wall==='number'&&isFinite(o.wall)&&now>o.wall)CATCH.clock+=catchSpan((now-o.wall)/1000);
  if(o.cseen&&typeof o.cseen==='object')for(const k of Object.keys(o.cseen)){const v=o.cseen[k];if(typeof v==='number'&&isFinite(v))CATCH.seen.set(k,v);}
}
/* forget everything (a new world) */
function catchReset(){CATCH.clock=0;CATCH.seen.clear();CATCH.last=null;CATCH.due.clear();}
