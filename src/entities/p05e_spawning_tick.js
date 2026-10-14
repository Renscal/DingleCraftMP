/* ----- where a mob may appear (6.48: the rules of the game this one takes after, Java edition) -----
   6.44 made monsters go by how dark it is; 6.48 makes the whole spawner work the way that game's does, so the farms people
   know how to build work here too.
     when      every game tick (20 a second), one try per spawnable chunk (the loaded chunks within SPAWN.chunks (8) of
               the player), in a new order each tick, as long as there are fewer monsters near that player than the cap
     cap       70 monsters for 289 spawnable chunks (a full 17 x 17), and that much less for fewer; 10 animals likewise.
               What counts is the mobs within those chunks of the player
     where     a random column of the chunk and a random height from 1 to one above its surface. Nothing if that cell is
               a solid block. From there three packs of up to four, each step a few blocks sideways at the same height
     dark      (monsters) the sky's light there (sl) above a random 0..31: no. Any block light: no. Then the brighter of
               the sky (less the hour's darkening) and the block light must be at most a random 0..7. So: always in a
               sealed room, never in daylight, about half the time under the night sky, and a torch makes a spot safe
     safe      a solid, opaque block underneath, and every cell the mob's own box touches free of blocks, water and lava
     far       more than SPAWN.near (24) blocks from every player, and within SPAWN.far (128) of one
     animals   once every 400 ticks, on grass or snowy grass, where the light (sky or block, not counting the hour) is
               above 8
     gone      a monster more than 128 blocks from every player vanishes at once; past 32, after half a minute with no
               player within 32, it has a 1 in 800 chance a tick. Animals go only past 128 (here the world keeps no mobs
               with unloaded chunks, so an animal left far behind would be lost anyway). Bosses, villagers and other
               named mobs, and anything kept on purpose, never go
   The Nether, the Aether and Puppet Purgatory keep their own spawners (their mobs are their own). */
const SPAWN={near:24,far:128,chunks:8,base:289,capH:70,capP:10,pack:4,packs:3,passEvery:400,idle:30,quiet:32,rnd:null,t:0,pass:0};
function spawnRnd(){return SPAWN.rnd?SPAWN.rnd():Math.random();}
function spawnInt(n){return Math.floor(spawnRnd()*n);}
/* room for this kind of mob standing in cell x,y,z: a floor under it and nothing in its box */
function spawnRoom(mt,x,y,z){
  const T=MOBT[mt];
  if(!T||y<1||y>=WH-1)return false;
  const ud=DEFS[getBlock(x,y-1,z)];
  if(ud.solid===false||!ud.opq)return false;
  const x0=Math.floor(x+0.5-T.hw),x1=Math.floor(x+0.5+T.hw),z0=Math.floor(z+0.5-T.hw),z1=Math.floor(z+0.5+T.hw),y1=Math.floor(y+T.h-1e-4);
  for(let X=x0;X<=x1;X++)for(let Y=y;Y<=y1;Y++)for(let Z=z0;Z<=z1;Z++){
    const id=getBlock(X,Y,Z);
    if(DEFS[id].solid!==false||id===B.WATER||id===B.LAVA)return false;
  }
  return true;
}
/* dark enough for a monster, right now? (random: see above) */
function spawnDark(x,y,z){
  const s=getSky(x,y,z);
  if(s>spawnInt(32))return false;
  const b=getLight(x,y,z);
  if(b>0)return false;
  return Math.max(s-skyDarken(),b)<=spawnInt(8);
}
/* the players the spawner measures from (the server's game has several) */
function spawnPlayers(){return NET.host&&NET.hpl?NET.hpl:[P];}
/* far enough from every player, and near enough to one */
function spawnClear(x,y,z){
  let near=false;
  for(const q of spawnPlayers()){
    const d=Math.hypot(q.x-x-0.5,q.y-y,q.z-z-0.5);
    if(d<=SPAWN.near)return false;
    if(d<=SPAWN.far)near=true;
  }
  return near;
}
/* a monster for the Overworld, by that game's weights */
function spawnPick(){const r=spawnInt(395);return r<95?'zombie':r<195?'skel':r<295?'spider':'boomer';}
function spawnPickP(){const r=spawnInt(33);return r<10?'pig':r<18?'cow':r<30?'sheep':'snake';}
/* may this kind of monster appear standing in cell x,y,z right now? */
function spawnOK(mt,x,y,z){
  return chunkAt(x,z)&&spawnRoom(mt,x,y,z)&&spawnClear(x,y,z)&&spawnDark(x,y,z)&&!(MGP_ON&&mgNoSpawn(x,z));
}
/* may this animal appear there? */
function spawnOKP(mt,x,y,z){
  if(!chunkAt(x,z)||!spawnRoom(mt,x,y,z)||!spawnClear(x,y,z))return false;
  const g=getBlock(x,y-1,z);
  return (g===B.GRASS||g===B.SNOWGRASS)&&Math.max(getSky(x,y,z),getLight(x,y,z))>8;
}
/* the spawnable chunks round the player: loaded, within SPAWN.chunks */
function spawnChunks(){
  const out=[],pcx=Math.floor(P.x/CH),pcz=Math.floor(P.z/CH),r=SPAWN.chunks;
  for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){const ch=chunks.get(ckey(pcx+dx,pcz+dz));if(ch)out.push(ch);}
  return out;
}
/* the mobs that count against the player's caps: in the spawnable chunks round them */
function countMobs(){
  let h=0,p=0;
  const pcx=Math.floor(P.x/CH),pcz=Math.floor(P.z/CH),r=SPAWN.chunks;
  const inR=e=>Math.abs(Math.floor(e.x/CH)-pcx)<=r&&Math.abs(Math.floor(e.z/CH)-pcz)<=r;
  for(const e of entities)if(e.t==='mob'&&!e.dead&&!MOBT[e.mt].pnc&&inR(e)&&(!NET.host||ntHostNear(e))){if(e.hostile)h++;else p++;}   /* PART 58: per player on the server's game */
  return [h,p];
}
/* One try in one chunk: a cell, then up to three packs round it. ok: spawnOK or spawnOKP; pick: the kind (once a pack).
   room: how many more the cap allows. Returns how many appeared. */
function spawnTry(ch,room,ok,pick){
  const x=ch.cx*CH+spawnInt(CH),z=ch.cz*CH+spawnInt(CH);
  const y=1+spawnInt(Math.max(1,surfaceTop(x,z)+1));
  const d=DEFS[getBlock(x,y,z)];
  if(d.solid!==false&&d.opq)return 0;
  let n=0;
  for(let k=0;k<SPAWN.packs;k++){
    let px=x,pz=z,mt=null;
    const size=Math.ceil(spawnRnd()*SPAWN.pack);
    for(let l=0;l<size;l++){
      px+=spawnInt(6)-spawnInt(6);pz+=spawnInt(6)-spawnInt(6);
      if(!spawnClear(px,y,pz))continue;
      if(!mt)mt=pick();
      if(!ok(mt,px,y,pz))continue;
      spawnMob(mt,px+0.5,y,pz+0.5);n++;
      if(n>=room)return n;
    }
  }
  return n;
}
/* the despawn rules (above), for dt seconds */
function mobsDespawn(dt){
  const pl=spawnPlayers();
  for(const e of entities){
    if(e.t!=='mob'||e.dead)continue;
    const T=MOBT[e.mt];
    if(T.boss||T.pnc||e.pkeep||e.name||(NET.host&&NT_UNIQ[e.mt]===1))continue;
    let d=1e9;
    for(const q of pl){const v=Math.hypot(q.x-e.x,q.y-e.y,q.z-e.z);if(v<d)d=v;}
    if(d>SPAWN.far){removeEnt(e);continue;}
    if(!e.hostile)continue;
    if(d<SPAWN.quiet){e.idleT=0;continue;}
    e.idleT=(e.idleT||0)+dt;
    if(e.idleT>SPAWN.idle&&spawnRnd()<1-Math.pow(1-1/800,dt*20))removeEnt(e);
  }
}
let spawnT=0;
function mobsTick(dt){
  if(NET.host&&LGT.q.length){LGT.ch=null;lightFlood();lightFlush(true);}   /* the server's game has no frame to finish a long flood of light in */
  if(NET.host&&SKYL.q.length)skyFlood();
  SPAWN.t+=dt;
  const ticks=Math.min(8,Math.floor(SPAWN.t/0.05));
  SPAWN.t=ticks===8?0:SPAWN.t-ticks*0.05;
  if(!ticks)return;
  mobsDespawn(ticks*0.05);
  if(!GR.mobSpawn||(NET.on&&ntHosted()))return;   /* PART 58: on a server that runs the mobs, the server spawns them */
  if(DIM==='nether'||DIM==='puppet'||DIM==='aether'){
    spawnT-=ticks*0.05;
    if(spawnT>0)return;
    spawnT=1.4;
    const [h,p]=countMobs();
    const _an=mobAnchor();
    const ang=Math.random()*6.28,dist=14+Math.random()*22;
    const x=Math.floor(_an.x+Math.sin(ang)*dist),z=Math.floor(_an.z+Math.cos(ang)*dist);
    if(!chunkAt(x,z))return;
    if(DIM==='nether'){
      if(h<10){
        const nc2=nCol(x,z),mt=Math.random()<0.55?'imp':'hellhog';
        if(nc2.f>=12&&spawnRoom(mt,x,nc2.f+1,z))spawnMob(mt,x+0.5,nc2.f+1,z+0.5);   /* 6.44: room for it, and never in lava */
      }
      return;
    }
    if(DIM==='puppet'){mpAmbient(x,z,h,p);return;}
    if(h<8){
      const ac2=aCol(x,z);
      if(ac2&&getBlock(x,ac2.t+1,z)===B.AIR&&getBlock(x,ac2.t+2,z)===B.AIR)spawnMob('cherub',x+0.5,ac2.t+1.1,z+0.5);
    }
    return;
  }
  const list=spawnChunks(),k=list.length/SPAWN.base,capH=Math.floor(SPAWN.capH*k),capP=Math.floor(SPAWN.capP*k);
  let [h,p]=countMobs();
  for(let t=0;t<ticks;t++){
    for(let i=list.length-1;i>0;i--){const j=spawnInt(i+1),c=list[i];list[i]=list[j];list[j]=c;}   /* a new order every tick, so no corner is always first to the cap */
    if(P.mode!=='c')for(const ch of list){if(h>=capH)break;h+=spawnTry(ch,capH-h,spawnOK,spawnPick);}
    if(++SPAWN.pass>=SPAWN.passEvery){
      SPAWN.pass=0;
      for(const ch of list){if(p>=capP)break;p+=spawnTry(ch,capP-p,spawnOKP,spawnPickP);}
    }
  }
}
const AETHER_VOID_DESPAWN={mob:1,car:1,skate:1,cart:1,boat:1,plane:1,drop:1};
function updateEntities(dt){
  if(TP.hr)hrEntFrame(dt);
  for(const e of entities){
    if(e.dead)continue;
    if(NET.host&&ntHostAim(e))continue;   /* PART 58: the server's game points P at the nearest player, or lets the entity wait */
    if(e.pup&&e.t!=='mob'){ntEntPup(e,dt);continue;}   /* PART 58: another game's vehicle, or the copy of something flying */
    /* the aether has no floor: things that tumble into the void are lost to it,
       not left standing on the invisible bottom of the world */
    if(DIM==='aether'&&e.y<2&&AETHER_VOID_DESPAWN[e.t]&&!(P&&P.ride===e)){
      burstParticles(e.x,e.y+0.4,e.z,B.CLOUDSTONE,e.t==='drop'?4:8,0.5);
      if(P&&P.ride===e)P.ride=null;
      removeEnt(e);
      continue;
    }
    if(e.t==='drop')updateDrop(e,dt);
    else if(e.t==='fall')updateFall(e,dt);
    else if(e.t==='arrow')updateArrow(e,dt);
    else if(e.t==='tnt')updateTNT(e,dt);
    else if(e.t==='part')updatePart(e,dt);
    else if(e.t==='blt')updateBullet(e,dt);
    else if(e.t==='nade')updateNade(e,dt);
    else if(e.t==='subb')updateSubBtn(e,dt);
    else if(e.t==='bobber')updateBobber(e,dt);
    else if(e.t==='esnail')updateSnail(e,dt);
    else if(e.t==='ghost')updateGhost(e,dt);
    else if(e.t==='ball')updateBall(e,dt);
    else if(e.t==='car')updateCar(e,dt);
    else if(e.t==='skate')updateSkate(e,dt);
    else if(e.t==='twister')updateTwister(e,dt);
    else if(e.t==='debris')updateDebris(e,dt);
    else if(e.t==='lavab')updateLavaBomb(e,dt);
    else if(e.t==='fireb')updateFireBomb(e,dt);
    else if(e.t==='cart')updateCart(e,dt);
    else if(e.t==='xp')updateXP(e,dt);
    else if(e.t==='boat')updateBoat(e,dt);
    else if(e.t==='puff')updatePuff(e,dt);
    else if(e.t==='beam')updateBeam(e,dt);
    else if(e.t==='rock')updateRock(e,dt);
    else if(e.t==='nukefx')updateNukefx(e,dt);
    else if(e.t==='plane')updatePlane(e,dt);
    else if(e.t==='abomb')updateBomb(e,dt);
    else if(e.t==='mcloud')updateMcloud(e,dt);
    else if(e.t==='pproj')puUpdate(e,dt);
    else if(e.t==='mob'){if(e.pup)ntMobPup(e,dt);else updateMob(e,dt);}   /* e.pup: PART 58, a mob another player's game runs */
  }
  if(HRE.corpses.length)hrTickCorpses(dt);
  pruneEnts();
}

