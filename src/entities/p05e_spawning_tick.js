/* ----- spawner ----- */
let spawnT=0;
function countMobs(){
  let h=0,p=0;
  for(const e of entities)if(e.t==='mob'&&!e.dead&&!MOBT[e.mt].pnc&&(!NET.host||ntHostNear(e))){if(e.hostile)h++;else p++;}   /* PART 58: per player on the server's game */
  return [h,p];
}
function torchNear(x,y,z){
  for(const k of torches){
    const p=dimP(k);
    if(!p)continue;
    const dx=p[0]-x,dy=p[1]-y,dz=p[2]-z;
    if(dx*dx+dy*dy+dz*dz<64)return true;
  }
  return false;
}
/* ----- where a mob may appear (6.44) -----
   Monsters used to appear on the surface at night and at random underground by day, with a torch keeping an 8-block
   bubble clear, and nothing checked what was actually at the spot. Now, as in the game this one takes after:
     dark     no block light at all (the 6.26 light map), and not daylit: by night nothing is, by day a spot is daylit
              if open sky is within SPAWN.sky steps through open air (skyLit). A sealed room is dark at noon.
     safe     a solid, opaque block underneath, and every cell the mob's own box touches free of blocks and of water
              and lava. The box is the mob's size, so a spider needs three by three and a zombie two cells of height.
     far      never within SPAWN.near blocks of a player.
   Each cycle makes a few tries anywhere in the loaded area round the player, at a height picked between the bottom of
   the world and the top of that column, so caves and rooms get their share; a spot that takes one may seat a small pack. */
const SPAWN={tries:10,near:24,range:88,sky:8,pack:4,capH:14,capP:8,rnd:null};
function spawnRnd(){return SPAWN.rnd?SPAWN.rnd():Math.random();}
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
/* dark enough for a monster? */
function spawnDark(x,y,z){
  if(getLight(x,y,z)>0)return false;
  if(DIM!=='over'||!sunUp())return true;
  return !skyLit(x,y,z,SPAWN.sky);
}
/* far enough from every player (the server's game has several) */
function spawnClear(x,y,z){
  const pl=NET.host&&NET.hpl?NET.hpl:[P];
  for(const q of pl)if(Math.hypot(q.x-x-0.5,q.y-y,q.z-z-0.5)<SPAWN.near)return false;
  return true;
}
/* a monster for the Overworld, by the old odds */
function spawnPick(){const r=spawnRnd();return r<0.35?'zombie':r<0.62?'skel':r<0.82?'boomer':'spider';}
/* may this kind of monster appear standing in cell x,y,z right now? */
function spawnOK(mt,x,y,z){
  return chunkAt(x,z)&&spawnRoom(mt,x,y,z)&&spawnDark(x,y,z)&&spawnClear(x,y,z)&&!(MGP_ON&&mgNoSpawn(x,z));
}
/* One try for the Overworld's monsters: a column near the anchor, a height in it, the first floor at or below that
   height; then up to SPAWN.pack of one kind round it. room: how many more the cap allows. Returns how many appeared. */
function spawnTry(an,room){
  const x=Math.floor(an.x+(spawnRnd()*2-1)*SPAWN.range),z=Math.floor(an.z+(spawnRnd()*2-1)*SPAWN.range);
  if(!chunkAt(x,z))return 0;
  let y=1+Math.floor(spawnRnd()*(surfaceTop(x,z)+1));
  for(let i=0;i<12&&y>1&&DEFS[getBlock(x,y-1,z)].solid===false;i++)y--;   /* down to a floor */
  const mt=spawnPick();
  if(!spawnOK(mt,x,y,z))return 0;
  spawnMob(mt,x+0.5,y,z+0.5);
  let n=1;
  const want=Math.min(room,1+Math.floor(spawnRnd()*SPAWN.pack));
  for(let i=0;i<8&&n<want;i++){
    const px=x+Math.floor(spawnRnd()*11)-5,pz=z+Math.floor(spawnRnd()*11)-5;
    for(let py=y+1;py>=y-1;py--)if(spawnOK(mt,px,py,pz)){spawnMob(mt,px+0.5,py,pz+0.5);n++;break;}
  }
  return n;
}
function mobsTick(dt){
  spawnT-=dt;
  if(spawnT>0)return;
  spawnT=1.4;
  if(NET.host&&LGT.q.length){LGT.ch=null;lightFlood();lightFlush(true);}   /* the server's game has no frame to finish a long flood of light in */
  const [h,p]=countMobs();
  /* despawn far */
  for(const e of entities)if(e.t==='mob'&&!e.dead&&!MOBT[e.mt].boss&&!MOBT[e.mt].pnc&&!e.pkeep&&mobFarFromAll(e))removeEnt(e);
  if(!GR.mobSpawn||(NET.on&&ntHosted()))return;   /* PART 58: on a server that runs the mobs, the server spawns them */
  const _an=mobAnchor();
  if(DIM==='nether'||DIM==='puppet'||DIM==='aether'){
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
  if(P.mode!=='c'){
    let have=h;
    for(let i=0;i<SPAWN.tries&&have<SPAWN.capH;i++)have+=spawnTry(_an,SPAWN.capH-have);
  }
  if(p<SPAWN.capP&&sunUp()){
    const ang=Math.random()*6.28,dist=14+Math.random()*22;
    const x=Math.floor(_an.x+Math.sin(ang)*dist),z=Math.floor(_an.z+Math.cos(ang)*dist);
    if(!chunkAt(x,z))return;
    const sy=surfaceTop(x,z);
    const g=getBlock(x,sy,z);
    if((g===B.GRASS||g===B.SNOWGRASS)&&Math.random()<0.5){
      const r=Math.random(),mt=r<0.08?'snake':(r<0.36?'pig':r<0.68?'cow':'sheep');
      if(spawnRoom(mt,x,sy+1,z)&&skyOpen(x,sy+1,z))spawnMob(mt,x+0.5,sy+1,z+0.5);   /* 6.44: room for it, in the open */
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

