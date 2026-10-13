/* ---- PART 58: n7_mobs.js ---- */
/* Shared mobs, and explosions that reach other players. The server has no terrain and runs no game, so a mob is run by
   one player's game (its owner) and shown to the others as a puppet:
     owner    an ordinary mob entity with an id (e.rid); its state goes out 8 times a second as {t:'mobs'}
     puppet   the same kind of entity with e.pup set: updateEntities sends it to ntMobPup (which only eases it toward the
              last state) instead of updateMob, and hurtMob sends a hit on it to ntMobHit (which forwards it to the owner)
   The owner is the game of the nearest player: twice a second each owner hands a mob to a player who is clearly nearer
   (ntMobHeir, ntMobGive -> {t:'mgive'} -> ntMobTaken). The mob's brain only knows the local player, so "run by the nearest
   player's game" is what makes it chase and hit the nearest player, with no change to any brain.
   NET.mobs is id -> entity for both kinds. A puppet that hears nothing for 3 seconds is removed (its owner left, or went
   out of range). Mobs are never saved by the server: like a single-player dimension stash, they belong to the moment.
   Only the ordinary mobs travel (NT_MOBS): bosses, dragons, villagers, snakes, blocklings, titans, Purgatory's and
   Malgorath's casts keep their own state machines and stay local. */

const NT_MOBS={pig:1,cow:1,sheep:1,zombie:1,skel:1,boomer:1,spider:1,imp:1,hellhog:1,cherub:1};
/* ----- shared mobs ----- */
/* does this entity travel? */
function ntMobShared(e){return e.t==='mob'&&!e.bot&&!e.pkeep&&!e.cellId&&NT_MOBS[e.mt]===1;}
/* a mob as it goes on the wire: [id, type, x, y, z, yaw, hp, flags] (flags: 1 just hurt, 2 a fuse is burning) */
function ntMobState(e){
  return [e.rid,e.mt,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+(e.yaw||0).toFixed(2),Math.round(e.hp*10)/10,(e.hurtT>0.25?1:0)|(e.fuse>0?2:0)];
}
/* the player a mob of ours should belong to instead: one who is clearly nearer to it than we are (or anyone in range,
   if this game is paused or its player is dead), else null */
function ntMobHeir(e){
  const away=P.dead||paused,mine=away?1e9:Math.hypot(P.x-e.x,P.z-e.z);
  let best=null,bd=56;
  for(const p of NET.peers.values()){
    if(!ntPeerLive(p)||(p.fl&4)||((p.fl&16)&&!away))continue;
    const d=Math.hypot(p.tx-e.x,p.tz-e.z);
    if(d<bd&&d+6<mine){bd=d;best=p;}
  }
  return best;
}
/* hand a mob to another player's game: it becomes a puppet here */
function ntMobGive(e,p){
  ntSend({t:'mgive',to:p.id,m:ntMobState(e)});
  e.pup=true;e.own=p.id;e.pupT=NET.acc;e.pfl=0;
  e.tx=e.x;e.ty=e.y;e.tz=e.z;e.tyaw=e.yaw||0;
}
/* make the puppet for a mob this game has just heard of; null if it cannot stand here (unknown kind, unloaded chunk) */
function ntMobMake(a){
  const rid=a[0],mt=a[1];
  if(typeof rid!=='string'||NT_MOBS[mt]!==1||!MOBT[mt]||typeof a[2]!=='number'||typeof a[3]!=='number'||typeof a[4]!=='number')return null;
  if(!playing||!scene||!chunkAt(Math.floor(a[2]),Math.floor(a[4])))return null;
  const n=entities.length;
  spawnMob(mt,a[2],a[3],a[4]);
  const e=entities[entities.length-1];
  if(entities.length<=n||!e||e.t!=='mob')return null;
  e.rid=rid;e.pup=true;e.own=0;e.pupT=NET.acc;e.pfl=0;
  e.tx=a[2];e.ty=a[3];e.tz=a[4];e.tyaw=+a[5]||0;e.yaw=e.tyaw;
  NET.mobs.set(rid,e);
  return e;
}
/* {t:'mobs'}: the mobs another player's game is running */
function ntMobsIn(m){
  if(!Array.isArray(m.m)||!playing||!P)return;
  for(const a of m.m){
    if(!Array.isArray(a))continue;
    let e=NET.mobs.get(a[0]);
    if(e&&(e.dead||!e.pup))continue;                       /* ours (an old owner's last word), or on its way out */
    if(!e){
      if(Math.hypot(a[2]-P.x,a[4]-P.z)>60)continue;        /* beyond where this game keeps mobs (mobsTick despawns at 64) */
      e=ntMobMake(a);
      if(!e)continue;
    }
    e.own=m.from|0;e.pupT=NET.acc;
    e.tx=+a[2]||0;e.ty=+a[3]||0;e.tz=+a[4]||0;e.tyaw=+a[5]||0;
    if(typeof a[6]==='number')e.hp=a[6];
    const fl=a[7]|0;
    if((fl&1)&&!(e.pfl&1)){e.hurtT=0.5;for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0.45,0,0);}
    e.pfl=fl;
  }
}
/* {t:'mgone'}: some of them are gone (dead: with a puff) */
function ntMobsGone(m){
  if(!Array.isArray(m.ids))return;
  for(const id of m.ids){
    const e=NET.mobs.get(id);
    if(!e||!e.pup)continue;
    NET.mobs.delete(id);
    if(e.dead)continue;
    if(m.dead)burstParticles(e.x,e.y+e.h*0.5,e.z,B.TNT,8,0.5);
    removeEnt(e);
  }
}
/* {t:'mgive'}: another player's game handed this mob over: from now on it is an ordinary mob here */
function ntMobTaken(m){
  const a=m.m;
  if(!Array.isArray(a))return;
  let e=NET.mobs.get(a[0]);
  if(e&&e.dead){NET.mobs.delete(a[0]);e=null;}
  if(!e)e=ntMobMake(a);
  if(!e)return;
  e.pup=false;e.own=0;
  e.x=+a[2]||0;e.y=+a[3]||0;e.z=+a[4]||0;e.yaw=+a[5]||0;e.vx=e.vy=e.vz=0;
  if(typeof a[6]==='number')e.hp=a[6];
  e.mode='idle';e.tT=0;e.fuse=0;e.hissed=false;
}
/* the hurtMob hook: this player hit a puppet. Flash it here; its owner's game decides what the hit did */
function ntMobHit(e,dmg,kx,kz){
  if(e.dead||e.hurtT>0.25||!(dmg>0))return;
  e.hurtT=0.5;
  for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0.45,0,0);
  playS('hit');
  ntSend({t:'mhit',to:e.own,id:e.rid,dmg,kx:+kx||0,kz:+kz||0});
}
/* {t:'mhit'}: another player hit a mob this game runs */
function ntMobHurt(m){
  const e=NET.mobs.get(m.id);
  if(!e||e.dead||e.pup||!playing)return;
  const ph=HIT_BY,pw=HIT_HOW;
  HIT_BY=ntShown(m.name);HIT_HOW='melee';
  try{hurtMob(e,+m.dmg||0,+m.kx||0,+m.kz||0);}finally{HIT_BY=ph;HIT_HOW=pw;}
}
/* the updateEntities hook: a puppet's whole life. Ease toward the last state, face it, walk the legs */
function ntMobPup(e,dt){
  const T=MOBT[e.mt],k=1-Math.exp(-Math.max(dt,0.001)*12),ox=e.x,oz=e.z;
  e.hurtT=Math.max(0,e.hurtT-dt);
  e.x+=(e.tx-e.x)*k;e.y+=(e.ty-e.y)*k;e.z+=(e.tz-e.z)*k;
  let dy=e.tyaw-e.yaw;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;e.yaw+=dy*k;
  e.vx=dt>0?(e.x-ox)/dt:0;e.vz=dt>0?(e.z-oz)/dt:0;e.vy=0;
  if(e.pfl&2){const on=((NET.acc*6)|0)%2===0?0.7:0;for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(on,on,on);}
  else if(e.hurtT<0.2)for(const mm of e.mats)mm.emissive&&mm.emissive.setRGB(0,0,0);
  e.mesh.position.set(e.x,e.y,e.z);
  e.mesh.rotation.y=e.yaw;
  if(e.hrM){if(typeof hrMobTick==='function')hrMobTick(e,dt,T,P.x-e.x,P.z-e.z,Math.hypot(P.x-e.x,P.z-e.z),null,!!T.hostile);return;}
  const hv=Math.hypot(e.vx,e.vz);
  e.anim+=dt*hv*3.2;
  for(const L of e.legs){
    const sw=Math.sin(e.anim+L.ph)*L.amp*Math.min(1,hv);
    if(L.ax==='x')L.g.rotation.x=sw;
    else L.g.rotation.z=L.base+sw*0.6;
  }
}
/* from ntFrame, 8 times a second: forget what died, give ids to new mobs of ours, hand over the ones a nearer player
   should run, and send the rest. Runs while paused too, which is when everything is handed over. */
function ntMobsTick(dt){
  if(NET.acc-NET.mobT<0.125)return;
  NET.mobT=NET.acc;
  const gone=[],dead=[];
  for(const [rid,e] of NET.mobs){
    if(e.dead){NET.mobs.delete(rid);if(!e.pup)(e.hp<=0?dead:gone).push(rid);}
    else if(e.pup&&NET.acc-e.pupT>3){NET.mobs.delete(rid);removeEnt(e);}
  }
  if(gone.length)ntSend({t:'mgone',ids:gone.slice(0,60)});
  if(dead.length)ntSend({t:'mgone',ids:dead.slice(0,60),dead:1});
  if(!NET.peers.size||!playing)return;                     /* alone: nobody to tell */
  const give=NET.acc-NET.ownT>=0.5,out=[];
  if(give)NET.ownT=NET.acc;
  for(const e of entities){
    if(e.dead||e.pup||!ntMobShared(e))continue;
    if(!e.rid){e.rid=NET.id.toString(36)+'.'+(++NET.mseq).toString(36);NET.mobs.set(e.rid,e);}
    if(give){const p=ntMobHeir(e);if(p){ntMobGive(e,p);continue;}}
    if(out.length<60)out.push(ntMobState(e));
  }
  if(out.length)ntSend({t:'mobs',m:out});
}

/* ----- explosions ----- */
/* the explode hook: tell the players nearby (the holes travel as block edits; this is the bang and the damage) */
function ntBoom(x,y,z,r,byMob){
  if(byMob&&!GR.mobGrief)return;                           /* the game itself makes that one harmless */
  ntSend({t:'boom',x:+x.toFixed(2),y:+y.toFixed(2),z:+z.toFixed(2),r,mob:byMob?1:0});
}
/* {t:'boom'}: an explosion in another player's game. Same falloff as the game's own (explode0) */
function ntBoomIn(m){
  if(!playing||!P||typeof m.x!=='number'||typeof m.y!=='number'||typeof m.z!=='number')return;
  const r=+m.r||0,pd=Math.hypot(P.x-m.x,P.y+0.9-m.y,P.z-m.z);
  if(pd>96)return;
  playS('boom');
  if(chunkAt(Math.floor(m.x),Math.floor(m.z)))burstParticles(m.x,m.y,m.z,B.TNT,40,1.2);
  if(m.hurt&&!P.dead&&pd<r*1.6){
    P.hurtT=0;LASTDMG={by:m.mob?'Boomer':ntShown(m.name),how:'tnt',t:AG_T};
    damagePlayer(Math.round((1-pd/(r*1.6))*22),P.x-m.x,P.z-m.z);
  }
}
