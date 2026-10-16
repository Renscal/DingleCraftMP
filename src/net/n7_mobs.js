/* ---- PART 58: n7_mobs.js ---- */
/* Shared mobs, and explosions that reach other players. The server has no terrain and runs no game, so a mob is run by
   one player's game (its owner) and shown to the others as a puppet:
     owner    an ordinary mob entity with an id (e.rid); its state goes out 8 times a second as {t:'mobs'}
     puppet   the same kind of entity with e.pup set: updateEntities sends it to ntMobPup (which only eases it toward the
              last state) instead of updateMob, and hurtMob sends a hit on it to ntMobHit (which forwards it to the owner)
   The owner is the game of the nearest player: twice a second each owner hands a mob to a player who is clearly nearer
   (ntMobHeir, ntMobGive -> {t:'mgive'} -> ntMobTaken). The mob's brain only knows the local player, so "run by the nearest
   player's game" is what makes it chase and hit the nearest player, with no change to any brain.
   NET.mobs is id -> entity for both kinds. A puppet that hears nothing for 3 seconds is removed (its owner went out of
   range); if the owner itself has gone quiet (a bad line) it waits up to 25 seconds, and when the server gives the owner up
   it names an heir (mheir -> ntMobAdopt), who runs those mobs from then on. Mobs are never saved by the server: like a
   single-player dimension stash, they belong to the moment.
   What travels (NT_MOBS): the ordinary mobs, and since 6.11 the villagers, the Nuke Kegs and the bosses that are plain
   mobs underneath (the dungeon boss, the titan, the Nether's and the Aether's). A boss fights the player whose game runs it
   and stays with that game while its player is in the fight (ntMobHeir); everyone else sees it and can hurt it.
   The ones a structure spawns (NT_UNIQ) would otherwise appear once per player, each game populating the same village or
   dungeon: each carries the spot it was spawned at, and two of a kind from the same spot are one mob (ntMobTwin).
   Dragons (tamed and ridden by one player), snakes, blocklings, Purgatory's and Malgorath's casts stay local. */

const NT_MOBS={pig:1,cow:1,sheep:1,zombie:1,skel:1,boomer:1,spider:1,imp:1,hellhog:1,cherub:1,
  alien:1,creep:1,nuker:1,boss:1,titan:1,infernis:1,valkyra:1};
/* the kinds a structure spawns at a fixed spot: one per spot, whoever's game got there first */
const NT_UNIQ={alien:1,boss:1,titan:1,infernis:1,valkyra:1};
/* ----- shared mobs ----- */
/* does this entity travel? */
function ntMobShared(e){return e.t==='mob'&&!e.pkeep&&!e.cellId&&NT_MOBS[e.mt]===1;}
/* a mob as it goes on the wire: [id, type, x, y, z, yaw, hp, flags, name, ox, oz] (flags: 1 just hurt, 2 a fuse is burning;
   name: a villager's; ox oz: where it was spawned, for the kinds in NT_UNIQ) */
function ntMobState(e){
  const a=[e.rid,e.mt,+e.x.toFixed(2),+e.y.toFixed(2),+e.z.toFixed(2),+(e.yaw||0).toFixed(2),Math.round(e.hp*10)/10,(e.hurtT>0.25?1:0)|(e.fuse>0?2:0)];
  if(NT_UNIQ[e.mt]===1)a.push((''+(e.name||'')).slice(0,24),e.ox==null?a[2]:e.ox,e.oz==null?a[4]:e.oz);
  return a;
}
/* a mob as it is handed to the server's game: the same, always with a name and a spawn spot, plus how fast it is moving
   (a pig out of the cannon is on its way somewhere) */
function ntMobFull(e){
  const a=ntMobState(e).slice(0,8);
  a.push((''+(e.name||'')).slice(0,24),e.ox==null?a[2]:e.ox,e.oz==null?a[4]:e.oz,[e.vx,e.vy,e.vz].map(v=>+(+v||0).toFixed(2)).join(','));
  return a;
}
/* the mob of this kind, other than e, that was spawned at the same spot (within 3 blocks) and that pup says is (true) or
   is not (false) another player's; null if there is none */
function ntMobTwin(mt,ox,oz,pup,e){
  for(const o of entities){
    if(o===e||o.dead||o.t!=='mob'||o.mt!==mt||!!o.pup!==pup)continue;
    const x=o.ox==null?o.x:o.ox,z=o.oz==null?o.z:o.oz;
    if(Math.abs(x-ox)<3&&Math.abs(z-oz)<3)return o;
  }
  return null;
}
/* the player a mob of ours should belong to instead: one who is clearly nearer to it than we are (or anyone in range,
   if this game is paused or its player is dead), else null */
function ntMobHeir(e){
  if(NET.host)return null;                                 /* the server's game keeps what it has */
  if(ntHosted())return NT_HOST;                            /* ...and where it runs the mobs, everything goes to it */
  const away=P.dead||paused,mine=away?1e9:Math.hypot(P.x-e.x,P.z-e.z);
  if(MOBT[e.mt].boss&&mine<40)return null;                 /* a boss stays with the game it is fighting */
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
  ntSend({t:'mgive',to:p.id,m:p.id===0?ntMobFull(e):ntMobState(e)});
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
  if(typeof a[8]==='string'&&a[8]&&mt==='alien')e.name=a[8];
  if(typeof a[9]==='number'&&typeof a[10]==='number'){e.ox=a[9];e.oz=a[10];}
  ntHostDress(e);
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
      if(NT_UNIQ[a[1]]===1&&typeof a[9]==='number'&&typeof a[10]==='number'){
        /* this game spawned the same one (both games populated the same village or dungeon at once): the game with the
           lower id keeps its own, the other one's becomes the puppet */
        const mine=ntMobTwin(a[1],a[9],a[10],false,null);
        if(mine){if((m.from|0)>NET.id)continue;removeEnt(mine);}
      }
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
  if(!NET.host)return;
  /* on the server's game: a second villager or boss from a spot that already has one is refused (every player's game
     populates the same village: the first one in is the one), and the mob keeps the speed and the home it came with */
  if(NT_UNIQ[e.mt]===1&&e.ox!=null&&ntMobTwin(e.mt,e.ox,e.oz,false,e)){NET.mobs.delete(e.rid);removeEnt(e);ntSend({t:'mgone',ids:[a[0]]});return;}
  if(typeof a[11]==='string'){const v=a[11].split(',').map(Number);if(v.length===3&&v.every(Number.isFinite)){e.vx=v[0];e.vy=v[1];e.vz=v[2];}}
  if(e.mt==='alien'&&e.ox!=null){e.hx=e.ox;e.hz=e.oz;}
}
/* {t:'mheir'}: the player whose game ran these mobs is gone, and the server picked this game to carry on with them */
function ntMobAdopt(from){
  for(const e of NET.mobs.values()){
    if(!e.pup||e.dead||e.own!==from)continue;
    e.pup=false;e.own=0;e.vx=e.vy=e.vz=0;
    e.mode='idle';e.tT=0;e.fuse=0;e.hissed=false;
  }
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
  const ph=HIT_BY,pw=HIT_HOW,p0=P;
  if(NET.host){const q=NET.hpl.find(o=>o.nid===(m.from|0));if(q){P=q;if(MOBT[e.mt]&&MOBT[e.mt].boss){e.aggro=q.nid;e.aggroT=NET.acc;}}}   /* on the server's game: the one who hit it is "the player" it flees or turns on; a boss remembers them (6.70, ntHostAim) */
  HIT_BY=ntShown(m.name);HIT_HOW='melee';
  try{hurtMob(e,+m.dmg||0,+m.kx||0,+m.kz||0);}finally{HIT_BY=ph;HIT_HOW=pw;P=p0;}
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
    else if(e.pup){
      /* silence: 3 seconds if its owner is still talking (the mob left their range), 25 if the owner has gone quiet too
         (their line is bad: the server will either hear from them again or name an heir) */
      const o=NET.peers.get(e.own);
      if(NET.acc-e.pupT>(o&&NET.acc-o.pt>2.5?25:3)){NET.mobs.delete(rid);removeEnt(e);}
    }
  }
  if(gone.length)ntSend({t:'mgone',ids:gone.slice(0,60)});
  if(dead.length)ntSend({t:'mgone',ids:dead.slice(0,60),dead:1});
  if((!NET.peers.size&&!ntHosted())||!playing)return;      /* alone, and no server game to hand them to: nobody to tell */
  const give=ntHosted()||NET.acc-NET.ownT>=0.5,out=[];
  if(give)NET.ownT=NET.acc;
  for(const e of entities){
    if(e.dead||e.pup||!ntMobShared(e))continue;
    if(!e.rid){
      if(NT_UNIQ[e.mt]===1){
        e.ox=+e.x.toFixed(1);e.oz=+e.z.toFixed(1);
        if(ntMobTwin(e.mt,e.ox,e.oz,true,e)){removeEnt(e);continue;}   /* another player's game already runs the one from this spot */
      }
      e.rid=NET.id.toString(36)+'.'+(++NET.mseq).toString(36);NET.mobs.set(e.rid,e);
    }
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
    P.hurtT=0;LASTDMG={by:m.mob?'Boomer':ntShown(m.name),how:'tnt'};
    damagePlayer(Math.round((1-pd/(r*1.6))*22),P.x-m.x,P.z-m.z);
  }
}
