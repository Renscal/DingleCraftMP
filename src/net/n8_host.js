/* ---- PART 58: n8_host.js ---- */
/* The server's own game (6.13). Since 6.13 the server does run the game, for one thing so far: the Overworld's mobs. It
   starts this same html's script headless in a worker thread (server/lib/host.mjs), and that game is "the host": an
   invisible player with id 0 whose connection is a function call instead of a socket (NET.ws is a stand-in whose send()
   hands the message to the server). Everything in n7_mobs.js still applies, with one owner for every mob:
     the host     spawns the Overworld's mobs (mobsTick), runs their brains (updateEntities), and sends them as {t:'mobs'}.
                  It never hands one over. It is never drawn, never moves, picks nothing up.
     a player     runs no mob of a shared kind in the Overworld: whatever their game spawns there (an egg, a jar, a village,
                  a spawner) is handed to the host on the spot (ntMobHeir -> ntMobGive, the hand-over that already existed),
                  and natural spawning is switched off (mobsTick asks ntHosted).
   The game knows exactly one player, P. The host has none of its own, so it borrows: for every entity it updates, P is
   pointed at the nearest real player (ntHostAim), as a stand-in object filled from that player's last pose; the brain then
   chases, flees from and hits "the player" as it always did. What a brain does to P never happens here: damage is sent to
   that player's own game (damagePlayer -> ntHostHurt -> {t:'hurt'}), and XP they pick up likewise ({t:'xp'}).
   An entity with no player within 72 blocks, or in a chunk the host has not built, is not updated at all: it waits.
   The host builds chunks (blocks only, no meshes) 5 chunks around every player and drops them when the players leave.
   Since 6.15 the host also runs the Overworld's water (tickFlow), its fire (updateFires: a player's game sends it the
   cells to light and is told which are alight) and its falling blocks (they are entities, so they came with the rest;
   players see them fall through n9_ents.js), and every furnace nobody has open (furnaceTick, ntHostBeScan).
   One game holds one dimension, so since 6.17 the server runs one host per dimension: the Overworld's from the start (it
   alone cooks the furnaces and runs the market: NET.hprim), the Nether's and the Aether's from the moment a player first
   goes there. Each is "player 0" to the players in its dimension. Puppet Purgatory stays each player's own. */

/* how far around each player the host keeps chunks, in chunks */
const NT_HOSTR=5;
/* the host as the players' games address it */
const NT_HOST={id:0};

/* ----- on a player's game ----- */
/* is the server running the mobs where this player is? */
function ntHosted(){return !NET.host&&NET.hdims.indexOf(DIM)>=0;}

/* ----- on the server's game ----- */
/* Become the host: load the server's world like a save (blocks and chests; no player, no entities), then put back the
   mobs the server had saved. w is the world as the server keeps it, mobs the list ntHostSnap made last time. */
function ntHostStart(w,mobs,vehs,dim,primary){
  const sp=w.spawn&&typeof w.spawn.x==='number'?[w.spawn.x,w.spawn.y,w.spawn.z]:[0.5,WH-8,0.5];
  const d={...w,f:w.f||SAVE_FORMAT,edits:w.edits||{},be:w.be||{},mode:'s',dim:dim||'over',ents:[],player:{x:sp[0],y:sp[1],z:sp[2],spawn:sp}};
  delete d.mp;delete d.stash;delete d.players;delete d.drops;delete d.mobs;
  applySave(d);
  NET.on=true;NET.host=true;NET.hosted=false;NET.st='on';NET.id=0;NET.name='';NET.acc=0;NET.q.length=0;NET.pend=null;
  NET.mobs.clear();NET.mseq=0;NET.mobT=0;NET.drops.clear();NET.dim=DIM;NET.dseq=0;NET.dropIn=false;NET.scanT=0;
  NET.beS.clear();NET.grS=JSON.stringify(GR);NET.tPrev=timeOfDay;
  NET.hp0=P;NET.hpl=[];NET.hrr=0;NET.hsnT=0;NET.hchT=0;NET.hprim=primary!==false;NET.hdims=[];
  NET.fx.clear();NET.fseq=0;NET.vehs.clear();NET.vseq=0;NET.vehT=0;
  WORLD.name='';enterGame();
  ntWdReset();NET.mktT=0;
  let n=0;
  for(const o of (Array.isArray(mobs)?mobs:[]))if(ntHostRestore(o))n++;
  for(const o of (Array.isArray(vehs)?vehs:[]))if(o&&ntVehMake(['0'+(DIM==='over'?'':DIM[0])+'v'+(++NET.vseq).toString(36),o.t,o.x,o.y,o.z,o.yaw,o.hp]))n++;
  return n;
}
/* one saved mob back into the world; false if this game does not know its kind */
function ntHostRestore(o){
  if(!o||typeof o.t!=='string'||NT_MOBS[o.t]!==1||!MOBT[o.t]||typeof o.x!=='number'||typeof o.y!=='number'||typeof o.z!=='number')return false;
  spawnMob(o.t,o.x,o.y,o.z);
  const e=entities[entities.length-1];
  if(!e||e.t!=='mob')return false;
  if(typeof o.hp==='number'&&o.hp>0)e.hp=Math.min(MOBT[o.t].hp,o.hp);
  if(typeof o.yaw==='number')e.yaw=o.yaw;
  if(typeof o.name==='string'&&o.name)e.name=o.name;
  if(typeof o.ox==='number'&&typeof o.oz==='number'){e.ox=o.ox;e.oz=o.oz;if(o.t==='alien'){e.hx=o.ox;e.hz=o.oz;}}
  ntHostDress(e);
  return true;
}
/* what the place that spawns a mob does to it afterwards, for a mob that arrived another way (handed over, or restored) */
function ntHostDress(e){
  if(e.mt==='titan'){if(e.mesh&&e.mesh.scale)e.mesh.scale.set(1.9,1.75,1.9);if(e.rockT==null)e.rockT=2.5;if(e.slamT==null)e.slamT=5;}
}
/* every mob the host has, as the server saves them (entities/ in the world folder) */
function ntHostSnap(){
  const out=[];
  for(const e of entities){
    if(e.dead||e.pup||!ntMobShared(e))continue;
    const o={t:e.mt,x:+e.x.toFixed(2),y:+e.y.toFixed(2),z:+e.z.toFixed(2),yaw:+(e.yaw||0).toFixed(2),hp:Math.round(e.hp*10)/10};
    if(e.name)o.name=(''+e.name).slice(0,24);
    if(e.ox!=null){o.ox=e.ox;o.oz=e.oz;}
    out.push(o);
  }
  return out;
}
/* the players in the Overworld, each as a stand-in player object the brains can aim at, fresh from their last pose */
function ntHostPlayers(){
  const out=[];
  for(const p of NET.peers.values()){
    if(!p.has||p.dim!==DIM)continue;
    let q=p.px;
    if(!q){q=p.px=newPlayer([p.tx,p.ty,p.tz]);q.nid=p.id;q.hitAt=-9;}
    q.x=p.tx;q.y=p.ty;q.z=p.tz;q.yaw=p.tyaw;q.pitch=p.pitch;q.vx=q.vy=q.vz=0;q.onGround=true;
    q.dead=!!(p.fl&4);q.mode=(p.fl&16)?'c':'s';q.sneak=!!(p.fl&2);q.hp=Math.max(1,p.hp||20);q.hurtT=0;
    out.push(q);
  }
  return out;
}
/* The updateEntities hook: before the host updates an entity, P becomes the nearest player to it (one a mob may go for,
   if there is one). true = nobody is within 72 blocks, or its chunk is not built: leave it exactly as it is. */
function ntHostAim(e){
  let best=null,bd=72,alt=null,ad=72;
  for(const q of NET.hpl){
    const d=Math.hypot(q.x-e.x,q.z-e.z);
    if(d<ad){ad=d;alt=q;}
    if(d<bd&&!q.dead&&q.mode!=='c'){bd=d;best=q;}
  }
  best=best||alt;
  if(!best||!chunkAt(Math.floor(e.x),Math.floor(e.z)))return true;
  P=best;
  return false;
}
/* the mobFarFromAll hook: may the host despawn this mob? Not while a player is within 64 blocks, and never one a structure
   spawned (a villager, a boss): those wait where they are and are saved with the world */
function ntHostFar(e){
  if(NT_UNIQ[e.mt]===1)return false;
  for(const q of NET.hpl)if(Math.hypot(q.x-e.x,q.z-e.z)<=64)return false;
  return true;
}
/* the mobClearOfPlayers hook: nothing spawns within 12 blocks of any player */
function ntHostClear(x,z){
  for(const q of NET.hpl)if(Math.hypot(q.x-x,q.z-z)<=12)return false;
  return true;
}
/* the countMobs hook: the spawn caps count the mobs around the player being spawned for, not the whole world */
function ntHostNear(e){return Math.hypot(e.x-P.x,e.z-P.z)<=SPAWN.far;}   /* 6.48: the spawner's own reach (it also counts only the spawnable chunks) */
/* The damagePlayer hook: a brain hit "the player". Nothing happens to the stand-in: the hit goes to that player's own game,
   which applies its armour and its own rules. An explosion is not sent this way: it reaches everyone near it as {t:'boom'}. */
function ntHostHurt(n,kx,kz){
  const q=P;
  if(HIT_HOW==='tnt'||!q||q===NET.hp0||!q.nid||q.dead||q.mode==='c'||!(n>0))return;
  if(NET.acc-q.hitAt<0.5)return;
  q.hitAt=NET.acc;
  ntSend({t:'hurt',to:q.nid,dmg:n,kx:+kx||0,kz:+kz||0,by:LASTDMG&&LASTDMG.by?''+LASTDMG.by:'',how:LASTDMG&&LASTDMG.how?''+LASTDMG.how:'mob'});
}
/* build the chunks around every player (blocks only: nothing is ever meshed here), a few each tick, and every 10 seconds
   forget the ones no player is near any more */
function ntHostChunks(pl){
  const t0=Date.now();
  build:for(const q of pl){
    const pcx=Math.floor(q.x/CH),pcz=Math.floor(q.z/CH);
    for(let r=0;r<=NT_HOSTR;r++)for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      if(Math.max(Math.abs(dx),Math.abs(dz))!==r||chunks.get(ckey(pcx+dx,pcz+dz)))continue;
      if(Date.now()-t0>12)break build;
      createChunk(pcx+dx,pcz+dz);
    }
  }
  if(NET.acc-NET.hchT<10)return;
  NET.hchT=NET.acc;
  for(const [k,ch] of chunks){
    let keep=false;
    for(const q of pl)if(Math.max(Math.abs(ch.cx-Math.floor(q.x/CH)),Math.abs(ch.cz-Math.floor(q.z/CH)))<=NT_HOSTR+2){keep=true;break;}
    if(!keep){disposeChunkMeshes(ch);chunks.delete(k);}
  }
}
/* 8 times a second: report the mobs that died or were despawned, give ids to the new ones, and send every mob that has a
   player within 128 blocks (the server passes each one on to the players near it) */
function ntHostMobsOut(){
  if(NET.acc-NET.mobT<0.125)return;
  NET.mobT=NET.acc;
  const gone=[],dead=[];
  for(const [rid,e] of NET.mobs)if(e.dead){NET.mobs.delete(rid);(e.hp<=0?dead:gone).push(rid);}
  for(let i=0;i<gone.length;i+=60)ntSend({t:'mgone',ids:gone.slice(i,i+60)});
  for(let i=0;i<dead.length;i+=60)ntSend({t:'mgone',ids:dead.slice(i,i+60),dead:1});
  let out=[];
  for(const e of entities){
    if(e.dead||!ntMobShared(e))continue;
    if(!e.rid){
      if(e.ox==null){e.ox=+e.x.toFixed(1);e.oz=+e.z.toFixed(1);}
      e.rid='0'+(DIM==='over'?'':DIM[0])+'.'+(++NET.mseq).toString(36);NET.mobs.set(e.rid,e);
    }
    let near=false;
    for(const q of NET.hpl)if(Math.hypot(q.x-e.x,q.z-e.z)<=128){near=true;break;}
    if(!near)continue;
    out.push(ntMobState(e));
    if(out.length>=60){ntSend({t:'mobs',m:out});out=[];}
  }
  if(out.length)ntSend({t:'mobs',m:out});
}
/* One tick of the host (the server calls it 20 times a second): the clock, the chunks, natural spawning around each player
   in turn, every entity with P pointed at its nearest player, then what there is to tell. */
function ntHostTick(dt){
  if(!NET.host||!playing)return;
  NET.acc+=dt;
  if(GR.dayCycle)timeOfDay+=dt/DAY_LEN;
  NET.tPrev=timeOfDay;
  const pl=NET.hpl=ntHostPlayers();
  if(pl.length){
    ntHostChunks(pl);
    try{
      P=pl[(NET.hrr++)%pl.length];
      mobsTick(dt*pl.length);
      P=pl[0];
      updateEntities(dt);
    }finally{P=NET.hp0;}
    for(const q of pl)if(q.xp>0){ntSend({t:'xp',to:q.nid,n:Math.round(q.xp)});q.xp=0;}
    tickFlow(dt);                                          /* water, fire: only this game runs them in the Overworld (6.15) */
    updateFires(dt);
    try{P=pl[NET.hrr%pl.length];tickSpawners(dt);}finally{P=NET.hp0;}   /* spawners (6.16); since 6.48 each looks at every player itself */
  }
  if(NET.peers.size&&NET.hprim){updateStocks(dt);ntHostMkt();}   /* one market for everyone */
  ntWdTick();
  if(NET.peers.size&&NET.hprim){furnaceTick(dt);ntHostBeScan();}   /* furnaces cook wherever they stand, as long as anyone is playing (one game does: the Overworld's) */
  ntHostMobsOut();
  ntHostVehsOut();
  ntFxTick();
  ntFlush();
  if(NET.acc-NET.scanT>=1){NET.scanT=NET.acc;ntDropsScan();}
  if(NET.acc-NET.hsnT>=5){NET.hsnT=NET.acc;ntSend({t:'hsnap',mobs:ntHostSnap(),vehs:ntHostVehSnap()});}
}
