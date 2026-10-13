/* ---- PART 58: n2_world.js ---- */
/* The shared world: block edits and block entities.
   Edits use the save format's own keys: a chunk key ("cx,cz", with a dimension prefix such as "n;" outside the Overworld)
   and a local key ("lx,y,lz"). setBlock is the only writer the game has, so hooking it catches everything: the player,
   water, fire, falling blocks, explosions, structures. Every client runs those simulations itself, and their writes
   travel like any other edit and settle on the last writer.
   Block entities (chests, furnaces, terrariums, displays) have no single writer, so they are compared once a second. */

/* ----- block edits ----- */
/* the setBlock hook. An edit made by this player's own hand (ntGuard saw it coming) is marked, so the others get the
   sound and the dust of it; what water, fire and gravity do travels unmarked and silent. */
function ntEdit(k,lk,id){
  if(NET.act){NET.act=false;NET.q.push([k,lk,id,1]);}
  else NET.q.push([k,lk,id]);
}
/* send the queued block changes, at most 4000 per message */
function ntFlush(){
  const q=NET.q;
  if(!q.length)return;
  for(let i=0;i<q.length;i+=4000)ntSend({t:'edits',e:q.slice(i,i+4000)});
  NET.stats.edOut+=q.length;q.length=0;
}
/* a block change from another player. Loaded chunk in this dimension: through setBlock (so meshes, torches and
   water react) with NET.ap set so it is not sent back. Anything else: straight into chunkEdits, for when the chunk loads.
   raw: the edit is old news about a chunk that just came into range (the server sends those as the player travels), so
   even in a loaded chunk it is written without side effects: nothing falls, flows or pops because of it.
   by: another player did it by hand, just now: if it is close, it is heard and (a broken block) seen. */
function ntApplyEdit(k,lk,id,raw,by){
  if(typeof k!=='string'||typeof lk!=='string'||!(id>=0&&id<256))return;
  const kd=k[1]===';'?k.slice(0,2):'';
  const c=(kd?k.slice(2):k).split(','),p=lk.split(',');
  const cx=+c[0],cz=+c[1],lx=+p[0],y=+p[1],lz=+p[2];
  if(!(lx>=0&&lx<CH&&lz>=0&&lz<CH&&y>=0&&y<WH)||c.length!==2||p.length!==3||cx!==cx||cz!==cz)return;
  const x=cx*CH+lx,z=cz*CH+lz;
  const ch=chunks.get(k);
  if(ch&&keyDim(k)===DIM&&!raw){
    if(by&&P&&playing){
      const was=ch.bl[bidx(lx,y,lz)];
      if(was!==id){
        if(id===B.AIR&&was&&Math.hypot(x-P.x,z-P.z)<24)burstParticles(x+0.5,y+0.5,z+0.5,was,8,0.5);
        playSAt(id===B.AIR?'dig':'place',x+0.5,y+0.5,z+0.5);
      }
    }
    if(NET.host){
      /* The server's game runs what follows from a player's edit (sand falls, water moves), and those further writes must
         go out; only the echo of this very cell is taken back out of the queue. What the edit knocks loose is still the
         editing game's to drop (NET.apd), as between players. */
      const n=NET.q.length;
      NET.apd=true;
      try{setBlock(x,y,z,id);}finally{NET.apd=false;}
      for(let i=n;i<NET.q.length;i++)if(NET.q[i][0]===k&&NET.q[i][1]===lk&&NET.q[i][2]===id){NET.q.splice(i,1);break;}
      return;                                              /* whatever the cell holds now is what this game made of it (sand set in mid-air has already left) */
    }else{
      NET.ap=true;
      try{setBlock(x,y,z,id);}finally{NET.ap=false;}
    }
    if(ch.bl[bidx(lx,y,lz)]===id)return;                 /* a protected cell refused it: record it below anyway */
  }
  if(ch&&ch.bl[bidx(lx,y,lz)]!==id){ch.bl[bidx(lx,y,lz)]=id;ch.dirty=true;
    if(raw&&keyDim(k)===DIM){if(lx===0)markDirty(cx-1,cz);if(lx===CH-1)markDirty(cx+1,cz);if(lz===0)markDirty(cx,cz-1);if(lz===CH-1)markDirty(cx,cz+1);}}
  let ed=chunkEdits.get(k);
  if(!ed){ed=ch?ch.edits:new Map();chunkEdits.set(k,ed);}
  ed.set(lk,id);
  const tk=kd+x+','+y+','+z;
  if(isTorch(id))torches.add(tk);else torches.delete(tk);
}

/* ----- chests, furnaces and the other block entities ----- */
/* what counts as "changed": a furnace's burn and cook timers tick every frame on every client, so only its items do */
function ntBeSig(b){
  if(!b)return '';
  if(b.t==='furnace')return JSON.stringify([b.in,b.fuel,b.out]);
  return JSON.stringify(b);
}
/* which block entities travel: everything except Creativity works (their data lives per player) and purgatory stashes */
function ntBeShared(b){return !!b&&typeof b.t==='string'&&!(typeof CR_BET!=='undefined'&&CR_BET[b.t])&&b.t!=='stash';}
/* once a second: send every block entity whose signature changed, and a removal for every one that is gone */
function ntBeScan(){
  for(const [k,b] of blockEnts){
    if(!ntBeShared(b))continue;
    const s=ntBeSig(b);
    if(NET.beS.get(k)===s)continue;
    NET.beS.set(k,s);ntSend({t:'be',k,v:b});
  }
  for(const k of NET.beS.keys())if(!blockEnts.has(k)){NET.beS.delete(k);ntSend({t:'be',k,v:null});}
}
/* a block entity from another player (v null = removed) */
function ntApplyBE(k,v){
  if(typeof k!=='string')return;
  if(v==null){blockEnts.delete(k);NET.beS.delete(k);if(MODAL.kind&&MODAL.bek===k)closeModal(true);return;}
  if(!ntBeShared(v))return;
  if(v.t==='chest'){v.inv=(Array.isArray(v.inv)?v.inv:[]).slice(0,27);while(v.inv.length<27)v.inv.push(null);}
  const old=blockEnts.get(k);
  if(old&&old.t===v.t){for(const f in old)delete old[f];Object.assign(old,v);}   /* in place: an open chest window holds this object */
  else blockEnts.set(k,v);
  NET.beS.set(k,ntBeSig(v));
  if(MODAL.kind&&MODAL.bek===k&&typeof redrawModal==='function')redrawModal();
}

/* ----- one player in a chest at a time ----- */
/* The openModal hook. A shared block entity is asked for first: the server answers with its latest contents and then a
   lock (ntLockMsg), and only then does the window open. true = "wait, I asked"; false = open it now (nothing shared, or
   the lock is already ours). */
function ntBeAsk(kind,bek){
  if(!ntBeShared(blockEnts.get(bek))||NET.lockK===bek)return false;
  NET.lockWant={kind,bek,t:NET.acc};
  ntSend({t:'open',k:bek});
  return true;
}
/* the server's answer: the chest is ours (open the window) or someone else is in it (say who) */
function ntLockMsg(m){
  const w=NET.lockWant;
  if(!w||w.bek!==m.k)return;
  NET.lockWant=null;
  if(!m.ok){showToast(ntShown(m.by||'Someone')+' is using that.');return;}
  if(!playing||!P||P.dead||modalOpen()||!blockEnts.has(m.k)||NET.acc-w.t>3){ntSend({t:'close',k:m.k});return;}   /* too late: let go again */
  NET.lockK=m.k;
  openModal(w.kind,m.k);
}
/* every frame: once the window is shut, send what changed and give the lock back */
function ntLockTick(){
  const k=NET.lockK;
  if(!k||(MODAL.kind&&MODAL.bek===k))return;
  NET.lockK=null;
  const b=blockEnts.get(k);
  /* a furnace goes back whole even if no item moved: whoever cooks it next carries on from its timers */
  if(ntBeShared(b)){const sg=ntBeSig(b);if(NET.beS.get(k)!==sg||(b.t==='furnace'&&NET.hosted)){NET.beS.set(k,sg);ntSend({t:'be',k,v:b});}}
  ntSend({t:'close',k});
}

/* ----- spawn protection ----- */
/* The doMine and doUse hooks: may this player change the block column at x,z? Like Minecraft, a square around the world
   spawn belongs to the operators (and only on a server that has operators: NET.prot is 0 otherwise). The server refuses the
   same edits, so this is the polite half: it stops the block from changing here in the first place. */
function ntGuard(x,z){
  NET.act=true;                                            /* a hand is on a block: the next edit is this player's own (ntEdit) */
  if(!(NET.prot>0)||NET.op||DIM!=='over'||!NET.spawn)return false;
  if(Math.abs(x+0.5-NET.spawn.x)>NET.prot||Math.abs(z+0.5-NET.spawn.z)>NET.prot)return false;
  if(NET.acc-NET.guardT>2){NET.guardT=NET.acc;showToast('The spawn area is protected.');}
  return true;
}
