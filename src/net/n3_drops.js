/* ---- PART 58: n3_drops.js ---- */
/* Dropped items. NET.drops is every dropped item the server knows, in every dimension:
     id -> {id, dim, x, y, z, st (the item stack), e (its body, or null), mine (this game dropped it), fix (its resting
            place has been reported), sx sy sz (where the server thinks it is)}
   An item has a body (an ordinary 'drop' entity, tagged e.nid) only while its chunk is loaded in the dimension the
   player is in; each client runs the physics of its own copy. The life of a drop:
     made here     spawnDrop -> ntDropSpawned gives it an id and sends {t:'drop'}; later one {t:'dropAt'} when it lands
     made there    {t:'drop'} -> ntDropIn -> ntDropKnow, and ntDropShow if it is nearby
     picked up     updateDrop -> ntDropTake asks {t:'take'}; the server answers the first asker with {t:'took'}
                   (ntDropTook: into the inventory) and everyone else with {t:'undrop'} (ntDropGone)
     expired       the server sends {t:'undrop'} after 5 minutes
     destroyed     a body that died here (the void) is reported by ntDropsScan as {t:'take', gone:1}
   Drops spawned while another player's block edit is being applied (NET.ap) are suppressed: the other game makes them. */

/* ----- dropped items ----- */
/* a clean copy of an item stack, as it goes on the wire */
function ntDropStack(st){return {id:st.id,count:st.count,...(st.dur!=null?{dur:st.dur}:{}),...(st.mob?{mob:st.mob}:{}),...(st.ench?{ench:st.ench}:{})};}
/* put a drop from the server into NET.drops (no body yet); null if the message makes no sense */
function ntDropKnow(m){
  if(!m||typeof m.id!=='string'||!m.st||!DEFS[m.st.id]||!(m.st.count>0)||typeof m.x!=='number'||typeof m.y!=='number'||typeof m.z!=='number')return null;
  const d={id:m.id,dim:''+(m.dim||'over'),x:m.x,y:m.y,z:m.z,st:ntDropStack(m.st),e:null,mine:false,fix:true,sx:m.x,sy:m.y,sz:m.z};
  NET.drops.set(d.id,d);return d;
}
/* the tail of spawnDrop: a drop this game just made */
function ntDropSpawned(){
  const e=entities[entities.length-1];
  if(!e||e.t!=='drop'||e.dead||e.nid||NET.dropIn)return;
  if(NET.ap){removeEnt(e);return;}                       /* a side effect of someone else's block edit (a popped torch): theirs to drop */
  const id=(Math.random().toString(36).slice(2,10)||'d')+'.'+(++NET.dseq).toString(36);
  e.nid=id;
  const d={id,dim:DIM,x:+e.x.toFixed(2),y:+e.y.toFixed(2),z:+e.z.toFixed(2),st:ntDropStack(e.st),e,mine:true,fix:false};
  d.sx=d.x;d.sy=d.y;d.sz=d.z;
  NET.drops.set(id,d);
  ntSaveSoon();   /* if it came out of the inventory, the server should hear that the inventory no longer has it */
  ntSend({t:'drop',id,dim:d.dim,x:d.x,y:d.y,z:d.z,vx:+e.vx.toFixed(2),vy:+e.vy.toFixed(2),vz:+e.vz.toFixed(2),st:d.st});
}
/* give a known drop its body: an ordinary drop entity, tagged with its id */
function ntDropShow(d,vx,vy,vz){
  const n=entities.length;
  NET.dropIn=true;
  try{spawnDrop(d.x,d.y,d.z,d.st,vx||0,vy||0,vz||0);}finally{NET.dropIn=false;}
  const e=entities[entities.length-1];
  if(entities.length>n&&e&&e.t==='drop'){e.nid=d.id;d.e=e;}
}
/* is this drop in a loaded chunk of the dimension the player is in? */
function ntDropHere(d){return d.dim===DIM&&!!chunkAt(Math.floor(d.x),Math.floor(d.z));}
/* another player dropped something */
function ntDropIn(m){
  if(NET.drops.has(m.id))return;
  const d=ntDropKnow(m);
  if(d&&playing&&ntDropHere(d))ntDropShow(d,+m.vx||0,+m.vy||0,+m.vz||0);
}
/* someone else took it, or it expired */
function ntDropGone(id){
  const d=NET.drops.get(id);if(!d)return;
  NET.drops.delete(id);
  if(d.e&&!d.e.dead)removeEnt(d.e);
}
/* the server says this one is yours */
function ntDropTook(id){
  const d=NET.drops.get(id);if(!d)return;
  NET.drops.delete(id);
  const e=d.e&&!d.e.dead?d.e:null,st=e?e.st:ntDropStack(d.st);
  if(e)removeEnt(e);
  if(!playing||!P)return;
  if(!P.dead){const before=st.count;invAddTo(P.inv,st);if(st.count<before){playS('pop');redrawHotbar();}}
  if(st.count>0)spawnDrop(e?e.x:P.x,e?e.y:P.y+1,e?e.z:P.z,st,0,2,0);   /* what did not fit goes back on the ground, as a new drop */
  ntSaveSoon();
}
/* updateDrop, within reach: ask instead of taking. true = handled here */
function ntDropTake(e){
  if(!NET.on)return false;
  if(NET.host)return true;                                 /* the server's game picks nothing up: its "player" is a stand-in */
  if(NET.acc-(e.nreq==null?-9:e.nreq)<0.6)return true;
  const st=e.st,mx=stackMax(st.id);
  if(!P.inv.some(s=>!s||(mx>1&&st.dur==null&&s.id===st.id&&s.dur==null&&s.count<mx)))return true;   /* no room: leave it for someone else */
  e.nreq=NET.acc;ntSend({t:'take',id:e.nid});
  return true;
}
/* once a second, and at once on a dimension change: give bodies to the drops whose chunk is loaded here, take them from the
   ones whose chunk is not, remember where each one is, and report the ones this game destroyed (the void, old age) */
function ntDropsScan(){
  if(NET.dim!==DIM){for(const d of NET.drops.values())d.e=null;NET.dim=DIM;}   /* stashEnts removed every body */
  for(const d of NET.drops.values()){
    const e=d.e;
    if(e){
      if(e.dead){NET.drops.delete(d.id);ntSend({t:'take',id:d.id,gone:1});continue;}
      d.x=+e.x.toFixed(2);d.y=+e.y.toFixed(2);d.z=+e.z.toFixed(2);
      if(!chunkAt(Math.floor(e.x),Math.floor(e.z))){removeEnt(e);d.e=null;continue;}
      /* tell the server where it lies: once when our own drop lands, and again whenever any drop has moved (water, a slope),
         because the server only lets a player pick up what they are standing next to */
      if(e.onGround&&((d.mine&&!d.fix)||Math.hypot(d.x-d.sx,d.y-d.sy,d.z-d.sz)>1.5)){d.fix=true;d.sx=d.x;d.sy=d.y;d.sz=d.z;ntSend({t:'dropAt',id:d.id,x:d.x,y:d.y,z:d.z});}
    }else if(ntDropHere(d))ntDropShow(d,0,0,0);
  }
}
