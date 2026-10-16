/* ---- PART 58: n9_ents.js ---- */
/* The other things that move (6.14): what flies, and what you can ride.

   WHAT FLIES (everywhere, with or without the server's own game). An arrow, a bullet, a grenade, lit TNT, a boss's rock or
   fireball, an XP orb: each still lives in exactly one game, the one that made it, and that game alone decides what it
   hits. What is new is that the others see it. The game that owns one announces it once ({t:'fx'}: a kind, a place, a
   speed) and again when it is gone ({t:'fxgone'}); everyone nearby flies a copy of their own from that, which looks the
   same and touches nothing: no damage, no blocks, no pick-up (ntFxPup). NET.fx is id -> entity, this game's and the copies.
   The server's own game announces the same way, which is how a skeleton's arrow is seen at all.

   WHAT YOU RIDE (in the Overworld of a server that runs its own game). A car, a boat, a plane, a cart or a skateboard is the
   server's while nobody sits on it: the server's game keeps it, moves it, saves it, and everyone has a puppet of it
   ({t:'vehs'}), exactly as with mobs. Getting on makes it yours for the ride ({t:'vtake'}: your game drives it, as it always
   did, and reports where it is; the server refuses if someone else is already on it, {t:'vno'}); getting off gives it back
   ({t:'vgive'}). A vehicle a player's game makes (the item placed in the world) is handed over the moment it exists. A hit on
   one you do not run goes to whoever does ({t:'vhit'}), so it breaks once and drops one item. NET.vehs is id -> entity.
   Elsewhere (other dimensions, a server without its own game) vehicles are each player's own, as before. */

/* the kinds that are announced, and the vehicles */
const NT_FX={arrow:1,blt:1,nade:1,tnt:1,fireb:1,lavab:1,rock:1,abomb:1,xp:1,fall:1,beam:1};   /* beam: laser eyes (6.52): x y z its start, vx vy vz the beam itself */   /* fall: a falling block, announced only by the server's game */
const NT_VEH={car:1,skate:1,cart:1,boat:1,plane:1};

/* ----- what flies ----- */
/* one of this game's flying things as it is announced: [id, kind, x, y, z, vx, vy, vz, gravity, seconds it may last] */
function ntFxState(e){
  const k=e.t,g=k==='arrow'?14:k==='blt'?(+e.grav||0):k==='fireb'||k==='beam'?0:GRAV*(k==='xp'?0.6:k==='nade'?0.85:1);
  const life=k==='beam'?0.3:k==='blt'?1.8:k==='arrow'?8:(k==='tnt'||k==='nade')?Math.max(0.2,+e.fuse||2):k==='xp'?60:k==='fall'?12:6;
  const r=v=>+(+v||0).toFixed(2);
  const a=[e.fxid,k,r(e.x),r(e.y),r(e.z),r(e.vx),r(e.vy),r(e.vz),r(g),r(life)];
  if(k==='fall')a.push(e.id|0);                            /* which block it is */
  return a;
}
/* every frame: announce the flying things this game has just made, and the ones that are gone */
function ntFxTick(){
  const out=[],gone=[],tell=NET.host?NET.hpl.length>0:NET.peers.size>0;
  for(const [id,e] of NET.fx)if(e.dead){NET.fx.delete(id);if(!e.pup)gone.push(id);}
  for(const e of entities){
    if(e.dead||e.pup||e.fxid||NT_FX[e.t]!==1||(e.t==='fall'&&!NET.host))continue;   /* sand falls in every game on a server without its own: nothing to announce */
    e.fxid=NET.id.toString(36)+'f'+(++NET.fseq).toString(36);NET.fx.set(e.fxid,e);
    if(tell&&out.length<40)out.push(ntFxState(e));
  }
  if(NET.ignQ.length){                                     /* fire: cells for the server's game to light, or (from it) cells that are lit */
    if(tell||!NET.host)ntSend({t:NET.host?'fire':'ign',c:NET.ignQ.slice(0,64)});
    NET.ignQ.length=0;
  }
  if(!tell)return;
  if(out.length)ntSend({t:'fx',f:out});
  if(gone.length)ntSend({t:'fxgone',ids:gone.slice(0,60)});
}
/* {t:'fx'}: things that have started flying in another game: make the copies */
function ntFxIn(m){
  if(!Array.isArray(m.f)||!playing||!P||NET.host)return;
  for(const a of m.f){
    if(!Array.isArray(a)||typeof a[0]!=='string'||NT_FX[a[1]]!==1||NET.fx.has(a[0]))continue;
    for(let i=2;i<10;i++)if(typeof a[i]!=='number')a[i]=0;
    if(Math.hypot(a[2]-P.x,a[4]-P.z)>96||!chunkAt(Math.floor(a[2]),Math.floor(a[4])))continue;
    const n=entities.length,k=a[1];
    if(k==='arrow')spawnArrow(a[2],a[3],a[4],a[5],a[6],a[7],'n',0);
    else if(k==='blt')spawnBullet(a[2],a[3],a[4],a[5],a[6],a[7],0,a[8]);
    else if(k==='tnt')primeTNT(a[2]-0.5,a[3],a[4]-0.5,a[9]);
    else if(k==='beam')laserBeam(a[2],a[3],a[4],a[2]+a[5],a[3]+a[6],a[4]+a[7]);   /* 6.52: another player's laser eyes: it melts nothing here */
    else if(k==='fall'){
      if(!DEFS[a[10]|0]||!(a[10]>0))continue;
      const me=new THREE.Mesh(mkCubeGeo(a[10]|0,0.98),matOp);
      scene.add(me);
      entities.push({t:'nfx',x:a[2],y:a[3],z:a[4],vx:0,vy:a[6],vz:0,hw:0.45,h:0.95,onGround:false,mesh:me});
    }
    else{
      const s=k==='xp'?0.16:k==='nade'?0.22:k==='abomb'?0.5:0.45;
      const me=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),new THREE.MeshBasicMaterial({color:k==='xp'?0x9dff5a:k==='nade'?0x3c4a2a:k==='rock'?0x8a8a8a:k==='abomb'?0x2a2a2e:0xff7a1a}));
      scene.add(me);
      entities.push({t:'nfx',x:a[2],y:a[3],z:a[4],vx:a[5],vy:a[6],vz:a[7],hw:s/2,h:s,onGround:false,mesh:me});
    }
    const e=entities[entities.length-1];
    if(entities.length<=n||!e)continue;
    e.pup=true;e.fxid=a[0];e.fxk=k;e.fxg=a[8];e.fxl=Math.min(60,Math.max(0.1,a[9]));e.vx=a[5];e.vy=a[6];e.vz=a[7];
    NET.fx.set(a[0],e);
  }
}
/* {t:'fxgone'}: they landed, burst or were picked up over there */
function ntFxGone(m){
  if(!Array.isArray(m.ids))return;
  for(const id of m.ids){const e=NET.fx.get(id);if(e&&e.pup){NET.fx.delete(id);if(!e.dead)removeEnt(e);}}
}
/* a copy's whole life: it flies the way the real one does and touches nothing. An arrow sticks where it lands. */
function ntFxPup(e,dt){
  if(e.fxk==='beam'){updateBeam(e,dt);return;}       /* 6.52: a beam stays where it was fired and fades */
  e.fxl-=dt;
  if(e.fxl<=0){NET.fx.delete(e.fxid);removeEnt(e);return;}
  const k=e.fxk;
  if(!e.fxs){
    e.vy-=e.fxg*dt;
    if(k==='arrow'||k==='blt'||k==='fireb'){
      const nx=e.x+e.vx*dt,ny=e.y+e.vy*dt,nz=e.z+e.vz*dt;
      const fb=Math.floor(nx),fy=Math.floor(ny),fz=Math.floor(nz);
      if(k==='blt'?!bulletPass(getBlock(fb,fy,fz)):solidAt(fb,fy,fz)){if(k==='arrow'){e.fxs=true;e.fxl=Math.min(e.fxl,3);}else{NET.fx.delete(e.fxid);removeEnt(e);return;}}
      else{e.x=nx;e.y=ny;e.z=nz;}
    }else{
      moveBody(e,e.vx*dt,e.vy*dt,e.vz*dt,false);
      if(k==='lavab'&&e.onGround){                         /* 6.72: another player's volcano: its bombs still burn whoever they land beside here (the lava they leave arrives as an edit) */
        burstParticles(e.x,e.y+0.5,e.z,B.LAVA,10,0.8);playS('sizzle');
        if(P&&!P.dead&&Math.hypot(P.x-e.x,P.y-e.y,P.z-e.z)<4)damagePlayer(6);
        NET.fx.delete(e.fxid);removeEnt(e);return;
      }
      if(e.onGround){e.vx*=Math.exp(-dt*6);e.vz*=Math.exp(-dt*6);}
    }
  }
  if(k==='tnt'){e.fuse=e.fxl;if(e.flash)e.flash.visible=(e.fxl*5|0)%2===0;e.mesh.position.set(e.x,e.y+0.49,e.z);}
  else if(k==='fall')e.mesh.position.set(e.x,e.y+0.49,e.z);
  else{
    e.mesh.position.set(e.x,e.y+(k==='xp'?0.1:0),e.z);
    if((k==='arrow'||k==='blt')&&!e.fxs&&typeof e.mesh.lookAt==='function')e.mesh.lookAt(e.x+e.vx,e.y+e.vy,e.z+e.vz);
  }
}

/* ----- the world the server runs: fire, sand, water, furnaces (6.15) ----- */
/* The igniteAt hook. Where the server runs the world a player's game lights nothing itself: the cell goes to the server's
   game (true: handled). On the server's game the fire is lit as usual and the players are told (false: carry on). */
function ntIgnite(x,y,z){
  if(NET.host){NET.ignQ.push([x,y,z]);return false;}
  if(!ntHosted())return false;
  if(NET.ignQ.length<64)NET.ignQ.push([x,y,z]);
  return true;
}
/* {t:'fire'}: cells the server's game has set alight. Here they flicker for their second and sting whoever stands in
   them (updateFires); what they burn down arrives as block edits. */
function ntFireIn(m){
  if(!Array.isArray(m.c)||!playing||!ntHosted())return;
  for(const c of m.c)if(Array.isArray(c)&&fires.size<600)fires.set((c[0]|0)+','+(c[1]|0)+','+(c[2]|0),0);
}
/* The furnaceTick hook: should this game leave this furnace alone? On a server that runs its own game a furnace is cooked
   by one game only: the player's who has it open (their window is live), otherwise the server's. */
function ntNoTick(be){
  if(NET.host)return false;
  return NET.hosted===true&&blockEnts.get(NET.lockK)!==be;
}
/* on the server's game, once a second: send every furnace whose items changed, and the ones that are burning every two
   seconds, so a player opening one finds it where it really is. 6.68: each copy carries the world clock it was sent at
   (ct), and the player's game catches it up from there (ntApplyBE): opening one no longer shows it up to two seconds behind */
function ntHostBeScan(){
  if(NET.acc-NET.fbT<1)return;
  NET.fbT=NET.acc;
  const beat=Math.floor(NET.acc/2);
  for(const [k,b] of blockEnts){
    if(!b||b.t!=='furnace')continue;
    const s=ntBeSig(b)+(b.burn>0?'|'+beat:'');
    if(NET.beS.get(k)===s)continue;
    const first=!NET.beS.has(k);
    NET.beS.set(k,s);
    if(!first)ntSend({t:'be',k,v:{...b,ct:+CATCH.clock.toFixed(2)}});
  }
  for(const k of NET.beS.keys())if(!blockEnts.has(k))NET.beS.delete(k);
}

/* ----- Creativity works (6.73) ----- */
/* The works are the world's: the server keeps the registry (data/works.json), numbers every work once for the whole world,
   and hands each game a few numbers ahead of need (crres), so starting a canvas never waits. A game sends every new,
   changed, finished or discarded work (ntCrWork, from Creativity's own onWork registry; edits at most once a second) and
   takes in everyone else's (ntCrIn). The block entities that show them (easels, record players, jukeboxes, paintings) are
   shared like chests; one broken in another game goes here without a second copy of its work (ntCrDropBE), and one that
   arrives before its block waits for it (ntCrPendCheck), so Creativity never thinks it was knocked down. */
function ntCrHook(){if(!NET.crHook&&typeof CRREG!=='undefined'){NET.crHook=true;CRREG.onWork.push(ntCrWork);}}
/* the crNew hook: the next number this game was handed (0: none yet; the server sends more as these are used) */
function ntCrTake(){
  const n=NET.crRes.shift();
  if(n>0&&n<=9999&&!(typeof CRW!=='undefined'&&CRW[n]))return n;
  if(typeof crToast==='function')crToast('One moment: the server is still fetching a fresh canvas.');
  return 0;
}
/* a record as it travels */
function ntCrPub(r){const o={k:r.k,st:r.st,t:r.t,by:r.by,d:r.d,u:r.u|0};if(r.k==='art'){o.w=r.w;o.h=r.h;}return o;}
/* Creativity's onWork: this game made, changed, finished or threw away work n */
function ntCrWork(n,r,op){
  if(!NET.on||NET.crIn||op==='load')return;
  if(op==='edit'){NET.crDue.add(n);return;}
  NET.crDue.delete(n);
  ntSend({t:'crw',n,r:op==='del'?null:ntCrPub(r)});
}
/* from ntFrame and the server's game: the works edited since last time, at most once a second */
function ntCrFlush(){
  if(!NET.crDue.size||NET.acc-NET.crT<1)return;
  NET.crT=NET.acc;
  for(const n of NET.crDue){const r=typeof CRW!=='undefined'?CRW[n]:null;if(r)ntSend({t:'crw',n,r:ntCrPub(r)});}
  NET.crDue.clear();
}
/* {t:'crw'}: a work of this world, new or changed (r null: thrown away) */
function ntCrIn(m){
  if(typeof CRW==='undefined'||!Number.isInteger(m.n)||!(m.n>0&&m.n<=9999))return;
  const n=m.n,r=m.r;
  NET.crIn=true;
  try{
    if(r==null){const o=CRW[n];if(!o)return;delete CRW[n];crSz(n);crDefSync(n);crEmit('onWork',n,o,'del');return;}
    if(typeof r!=='object'||(r.k!=='art'&&r.k!=='song'))return;
    const was=!!CRW[n];
    CRW[n]={k:r.k,st:r.st==='done'?'done':'wip',t:crTitle(r.t),by:crTitle(r.by),d:r.d==null?null:r.d,u:r.u|0,...(r.k==='art'?{w:r.w|0,h:r.h|0}:{})};
    CRLOST.delete(n);crSz(n);crDefSync(n);
    crEmit('onWork',n,CRW[n],was?'edit':'new');
  }finally{NET.crIn=false;}
}
/* someone else's easel, record player, jukebox or painting cell */
function ntCrApplyBE(k,v){
  const old=blockEnts.get(k),wasId=old&&old.t===v.t?old.id:0;
  let be=old;
  if(old&&old.t===v.t){const s=old.s;for(const f in old)delete old[f];Object.assign(old,v);old.s=s||0;}
  else{if(old&&CR_BET[old.t])ntCrDropBE(k,old);be=v;be.s=0;blockEnts.set(k,be);}
  NET.beS.set(k,ntBeSig(be));
  if(be.t==='crjuke'&&be.id!==wasId){if(wasId)crEmit('onJuke',k,be,'stop');if(be.id){be.s=CRF.clock;crEmit('onJuke',k,be,'play');}}
  ntCrPendCheck(k);
  const p=keyCore(k).split(',');if(keyDim(k)===DIM)markDirty(Math.floor(+p[0]/CH),Math.floor(+p[2]/CH));
}
/* index it for Creativity once its block is there (before that its sweep would take it for knocked down) */
function ntCrPendCheck(k){
  const be=blockEnts.get(k);
  if(!be||!CR_BET[be.t]){NET.crPend.delete(k);return;}
  const p=keyCore(k).split(',');
  if(keyDim(k)===DIM&&getBlock(+p[0],+p[1],+p[2])===CR_BET[be.t]){NET.crPend.delete(k);if(CRBE.get(k)!==be)crIndex(k,be);}
  else{if(CRBE.has(k))crUnindex(k);NET.crPend.set(k,be);}
}
/* one gone in another game (broken, or its block replaced): it goes here quietly; that game dropped its work */
function ntCrDropBE(k,b){
  if(b.t==='crjuke'&&b.id)crEmit('onJuke',k,b,'stop');
  if(MODAL.kind&&MODAL.bek===k)closeModal(true);
  if(typeof crOn!=='undefined'&&crOn&&CRF.ctx&&CRF.ctx.bek===k)crUIClose(true);
  if(blockEnts.get(k)===b)blockEnts.delete(k);
  if(CRBE.get(k)===b)crUnindex(k);
  NET.crPend.delete(k);NET.beS.delete(k);
  const p=keyCore(k).split(',');if(keyDim(k)===DIM)markDirty(Math.floor(+p[0]/CH),Math.floor(+p[2]/CH));
}

/* ----- disasters (6.72) ----- */
/* A disaster runs in the game of the player who started it; its blocks travel as their edits. The players near it watch
   the same one: twice a second the starter's game says what is raging, where, how long it has run and where its tornado
   is ({t:'dis'}, and k:'' once it is over), and the watchers' games show its timer and wind, follow its tornado with a copy
   that pulls them in as the real one does (and shreds nothing), and let its lava bombs burn them (ntFxPup). */
const NT_DIS={tornado:180,tsunami:90,volcano:182.5,fire:180};
/* from ntFrame: this game's own disaster, as the others hear of it */
function ntDisOut(){
  if(DIS.kind&&!DIS.remote){
    if(NET.acc-(NET.disT||0)<0.5)return;
    NET.disT=NET.acc;NET.disOn=true;
    const m={t:'dis',k:DIS.kind,x:DIS.cx,z:DIS.cz,gy:DIS.gy,at:+DIS.t.toFixed(1)},te=DIS.data&&DIS.data.te;
    if(te&&!te.dead)m.tw=[+te.x.toFixed(1),+te.z.toFixed(1)];
    ntSend(m);
  }else if(NET.disOn){NET.disOn=false;NET.disT=0;ntSend({t:'dis',k:''});}
}
/* {t:'dis'}: another player's disaster, near here */
function ntDisIn(m){
  if(!playing||!P||NET.host)return;
  if(DIS.kind&&!DIS.remote)return;                         /* this game's own disaster comes first */
  const k=typeof m.k==='string'?m.k:'';
  if(!k){if(DIS.remote&&DIS.from===m.from)endDisaster(false);return;}
  if(!NT_DIS[k])return;
  if(!DIS.remote||DIS.kind!==k||DIS.from!==m.from){
    if(DIS.kind)endDisaster(true);
    DIS.kind=k;DIS.remote=true;DIS.from=m.from;DIS.dur=NT_DIS[k];
    DIS.cx=Math.floor(+m.x||0);DIS.cz=Math.floor(+m.z||0);DIS.gy=typeof m.gy==='number'?m.gy:heightAt(DIS.cx,DIS.cz);
    DIS.data={};
    if(k==='tornado'){const s=Array.isArray(m.tw)?m.tw:[DIS.cx,DIS.cz],te=mkTwister(+s[0]||DIS.cx,DIS.gy,+s[1]||DIS.cz);te.remote=true;DIS.data.te=te;}
    showToast(ntShown(m.name||'Someone')+(k==='tornado'?' set loose a tornado!':k==='tsunami'?' raised the sea!':k==='volcano'?' woke a volcano!':' set the sky on fire!'));
    playS('dsph');
  }
  DIS.t=Math.max(0,+m.at||0);DIS.seen=NET.acc;
  const te=DIS.data&&DIS.data.te;
  if(te&&Array.isArray(m.tw)){te.tx=+m.tw[0]||te.x;te.tz=+m.tw[1]||te.z;}
}
/* the updateDisaster hook: a watched disaster's timer, wind and fires; it ends with its own end, at its time, or quietly
   when its player has not been heard of for 3 s (gone, or out of range) */
function ntDisWatch(dt){
  if(dt>0)DIS.t+=dt;
  if(NET.acc-(DIS.seen||0)>3||DIS.t>=DIS.dur){endDisaster(DIS.t<DIS.dur);return;}
  const k=DIS.kind,left=DIS.dur-DIS.t;
  if(k==='volcano'&&DIS.t<62.5){setWind(0.15);disHud('VOLCANO \u2014 eruption in '+fmtT(Math.ceil(62.5-DIS.t)));}
  else{setWind(k==='tornado'?0.85:k==='tsunami'?0.3:k==='volcano'?0.4:0.3);disHud(DISNAME[k]+' \u2014 '+fmtT(left));}
  if(dt>0)updateFires(dt);
}

/* ----- what you ride ----- */
/* a vehicle on the wire: [id, kind, x, y, z, yaw, hp, speed] */
function ntVehState(e){
  return [e.vid,e.t,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+(e.yaw||0).toFixed(2),Math.round(e.hp||1),+(+e.spd||0).toFixed(1)];
}
/* a puppet starts from where it is */
function ntVehHold(e){e.tx=e.x;e.ty=e.y;e.tz=e.z;e.tyaw=e.yaw||0;e.pupT=NET.acc;e.vx=e.vy=e.vz=0;e.spd=0;}
/* make a vehicle this game has just heard of; null if it cannot (an unknown kind, no world yet) */
function ntVehMake(a){
  if(!Array.isArray(a)||typeof a[0]!=='string'||NT_VEH[a[1]]!==1||typeof a[2]!=='number'||typeof a[3]!=='number'||typeof a[4]!=='number'||!playing||!scene)return null;
  const n=entities.length,k=a[1],yaw=+a[5]||0;
  if(k==='car')spawnCar(a[2],a[3],a[4],yaw);else if(k==='skate')spawnSkate(a[2],a[3],a[4],yaw);else if(k==='cart')spawnCart(a[2],a[3],a[4],yaw);
  else if(k==='boat')spawnBoat(a[2],a[3],a[4],yaw);else spawnPlane(a[2],a[3],a[4],yaw);
  const e=entities[entities.length-1];
  if(entities.length<=n||!e||e.t!==k)return null;
  e.vid=a[0];if(a[6]>0)e.hp=a[6];
  NET.vehs.set(e.vid,e);
  return e;
}
/* put a vehicle where a message says it is */
function ntVehPut(e,a){e.x=+a[2]||0;e.y=+a[3]||0;e.z=+a[4]||0;e.yaw=+a[5]||0;if(a[6]>0)e.hp=a[6];}
/* {t:'vehs'}: where the vehicles another game runs are right now (the server's game: the parked ones; a player: theirs) */
function ntVehsIn(m){
  if(!Array.isArray(m.v)||!playing||!P)return;
  for(const a of m.v){
    if(!Array.isArray(a))continue;
    let e=NET.vehs.get(a[0]);
    if(e&&e.dead){NET.vehs.delete(a[0]);e=null;}
    if(!e){
      if(NET.host||!ntHosted()||Math.hypot(a[2]-P.x,a[4]-P.z)>90||!chunkAt(Math.floor(a[2]),Math.floor(a[4])))continue;
      e=ntVehMake(a);
      if(!e)continue;
      e.pup=true;ntVehHold(e);
    }
    if(!e.pup)continue;                                    /* this game runs it: its own word stands */
    e.tx=+a[2]||0;e.ty=+a[3]||0;e.tz=+a[4]||0;e.tyaw=+a[5]||0;e.pupT=NET.acc;
    if(a[6]>0)e.hp=a[6];
  }
}
/* {t:'vgone'}: broken, or lost to the void */
function ntVehsGone(m){
  if(!Array.isArray(m.ids))return;
  for(const id of m.ids){
    const e=NET.vehs.get(id);
    if(!e)continue;
    NET.vehs.delete(id);
    if(P&&P.ride===e)P.ride=null;
    if(!e.dead){burstParticles(e.x,e.y+0.6,e.z,B.TNT,10,0.6);removeEnt(e);}
  }
}
/* {t:'vno'}: someone else is on it: get off again */
function ntVehNo(m){
  const e=NET.vehs.get(m.id);
  if(!e)return;
  e.mine=false;e.pup=true;ntVehHold(e);
  if(P&&P.ride===e){P.ride=null;dismountPlace(e);showToast('Someone else is driving that.');}
}
/* {t:'vhit'}: another player hit a vehicle this game runs */
function ntVehHurt(m){
  const e=NET.vehs.get(m.id);
  if(e&&!e.dead&&!e.pup&&playing)hitCar(e,+m.dmg||1);
}
/* the hitCar hook: this player hit a vehicle another game runs. It flashes here; its owner's game decides what the hit did */
function ntVehHit(e,dmg){
  if(e.dead||!(dmg>0))return;
  e.hurtT=0.4;
  if(e.mats)for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0.45,0.05,0);
  playS('thud');
  ntSend({t:'vhit',id:e.vid,dmg:Math.min(1e5,dmg)});
}
/* a vehicle puppet's whole life: ease toward where its owner says it is */
function ntVehPup(e,dt){
  const k=1-Math.exp(-Math.max(dt,0.001)*12);
  e.hurtT=Math.max(0,(e.hurtT||0)-dt);
  if(e.hurtT<0.15&&e.mats)for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0,0,0);
  e.x+=(e.tx-e.x)*k;e.y+=(e.ty-e.y)*k;e.z+=(e.tz-e.z)*k;
  let dy=e.tyaw-(e.yaw||0);dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;e.yaw=(e.yaw||0)+dy*k;
  e.mesh.position.set(e.x,e.y,e.z);
  e.mesh.rotation.y=e.yaw;
  if(e.t==='plane'){                                       /* 6.57: its rider's pose says how it is tilted (n5) */
    const live=NET.acc-(e._rpT==null?-9:e._rpT)<0.6;
    e.pitch=(e.pitch||0)+((live?e._rp:0)-(e.pitch||0))*k;e.roll=(e.roll||0)+((live?e._rr:0)-(e.roll||0))*k;
    e.mesh.rotation.x=e.pitch;e.mesh.rotation.z=e.roll;
  }
}
/* The updateEntities hook for everything that is another game's and is not a mob: a vehicle puppet, or the copy of a
   flying thing. (A mob puppet has its own, ntMobPup.) */
function ntEntPup(e,dt){
  if(e.vid)ntVehPup(e,dt);
  else if(e.fxid)ntFxPup(e,dt);
}
/* 15 times a second on a player's game: hand new vehicles to the server, take the one being ridden, give back the one
   just left, report the ridden one, and forget the puppets nobody speaks for any more */
function ntVehTick(){
  if(NET.acc-NET.vehT<0.066)return;
  NET.vehT=NET.acc;
  if(!ntHosted()){if(NET.vehs.size)NET.vehs.clear();return;}
  const mine=[];
  for(const e of entities){
    if(e.dead||NT_VEH[e.t]!==1)continue;
    const on=P.ride===e&&!P.dead;
    if(!e.vid){
      e.vid=NET.id.toString(36)+'v'+(++NET.vseq).toString(36);NET.vehs.set(e.vid,e);
      if(on){e.mine=true;ntSend({t:'vtake',id:e.vid,v:ntVehState(e)});}
      else{ntSend({t:'vgive',v:ntVehState(e)});e.pup=true;ntVehHold(e);}
      continue;
    }
    if(on&&e.pup){e.pup=false;e.mine=true;ntSend({t:'vtake',id:e.vid,v:ntVehState(e)});}
    else if(!on&&e.mine){e.mine=false;ntSend({t:'vgive',v:ntVehState(e)});e.pup=true;ntVehHold(e);}
    if(e.mine)mine.push(ntVehState(e));
  }
  if(mine.length)ntSend({t:'vehs',v:mine});
  for(const [id,e] of NET.vehs){
    if(e.dead){NET.vehs.delete(id);if(!e.pup)ntSend({t:'vgone',ids:[id]});}
    else if(e.pup&&NET.acc-e.pupT>6&&P.ride!==e){NET.vehs.delete(id);removeEnt(e);}
  }
}
/* this player changed dimension: what was the server's stays there (the stash never takes it); a vehicle that was this
   game's for the ride is the server's again */
function ntEntsDim(){
  if(P&&P.ride&&P.ride.vid)P.ride=null;
  for(const [id,e] of NET.vehs)if(e.mine)ntSend({t:'vfree',id});
  NET.vehs.clear();NET.fx.clear();
}

/* ----- on the server's game ----- */
/* 4 times a second: give ids to new vehicles, report the broken ones, and send every parked vehicle with a player within
   128 blocks (one a player is riding is theirs to report) */
function ntHostVehsOut(){
  if(NET.acc-NET.vehT<0.25)return;
  NET.vehT=NET.acc;
  for(const [id,e] of NET.vehs)if(e.dead){NET.vehs.delete(id);ntSend({t:'vgone',ids:[id]});}
  let out=[];
  for(const e of entities){
    if(e.dead||NT_VEH[e.t]!==1)continue;
    if(!e.vid){e.vid='0'+(DIM==='over'?'':DIM[0])+'v'+(++NET.vseq).toString(36);NET.vehs.set(e.vid,e);}
    if(e.pup)continue;
    let near=false;
    for(const q of NET.hpl)if(Math.hypot(q.x-e.x,q.z-e.z)<=128){near=true;break;}
    if(!near)continue;
    out.push(ntVehState(e));
    if(out.length>=40){ntSend({t:'vehs',v:out});out=[];}
  }
  if(out.length)ntSend({t:'vehs',v:out});
}
/* {t:'vgive'} / {t:'vtake'} / {t:'vfree'} on the server's game: a player handed a vehicle over (new, or after a ride), got
   on one, or left without getting off */
function ntHostVeh(m){
  const a=m.v,id=a?a[0]:m.id;
  let e=NET.vehs.get(id);
  if(e&&e.dead){NET.vehs.delete(id);e=null;}
  if(!e&&a)e=ntVehMake(a);
  if(!e)return;
  if(a)ntVehPut(e,a);
  if(m.t==='vtake'){e.pup=true;e.own=m.from|0;ntVehHold(e);}
  else{e.pup=false;e.own=0;e.vx=e.vy=e.vz=0;e.spd=0;}
}
/* every vehicle the server's game has, as the server saves them */
function ntHostVehSnap(){
  const out=[];
  for(const e of entities)if(!e.dead&&NT_VEH[e.t]===1)out.push({t:e.t,x:+e.x.toFixed(2),y:+e.y.toFixed(2),z:+e.z.toFixed(2),yaw:+(e.yaw||0).toFixed(2),hp:Math.round(e.hp||1)});
  return out;
}
