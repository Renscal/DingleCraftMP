/* ===================================================================== */
/* PART 18 — armor, boats, flowing water, QOL  (2.0)                     */
/* ===================================================================== */
/* ----- liquids with levels (6.25) ----- */
/* Water and lava have a level. Beside every block id a chunk keeps one more byte (ch.mt, "meta"):
     bits 0-2   the level: 0 is a source, 1 to 7 is flowing, lower and lower
     bit 3      falling: fed from above; it stands as tall as a source and spreads like one where it lands
   Only liquids use it. In a save, on the wire and in a region file a block is still one number: the id, plus the meta
   shifted up 8 bits when there is any, so a world from before 6.25 (all plain ids: every water block a source) loads as it is.
   The rules are the usual ones:
     down first; a liquid that can fall does not spread sideways, unless it is a source
     sideways it loses 1 a block (lava in the Overworld 2), toward the nearest drop within 4 blocks (lava 2) if there is one
     a flowing block is whatever its neighbours feed it: take the source away and the stream runs dry
     still water between two sources, standing on something solid or on a source, becomes a source; lava never does
     water on a lava source makes obsidian, on flowing lava cobblestone; lava falling onto water makes stone
     it washes away what a hand could brush aside (tall grass, flowers, torches), which drop as items
   Only cells that something happened next to are ever looked at (LIQ.w, LIQ.l: the cells due at the next tick): the sea
   does nothing until somebody digs beside it. Water ticks every 0.25 s, lava every 1.5 s (0.5 s in the Nether), at most
   600 cells a tick; the rest wait. */
const LIQ={w:new Map(),l:new Map(),wT:0,lT:0};
const LIQ_H4=[[1,0],[-1,0],[0,1],[0,-1]];
/* the numbers for a liquid in a dimension: how much it loses a block sideways, how far it looks for a drop, how often it ticks */
function liqRule(L,dim){
  const w=L===B.WATER,n=dim==='nether';
  return {drop:(w||n)?1:2,far:(w||n)?4:2,every:w?0.25:(n?0.5:1.5)};
}
/* is this block id a liquid that flows? */
function isLiq(id){return id===B.WATER||id===B.LAVA;}
/* the meta byte of a cell (0 outside the world or an unbuilt chunk) */
function getMeta(x,y,z){
  if(y<0||y>=WH)return 0;
  const cx=Math.floor(x/CH),cz=Math.floor(z/CH),ch=chunks.get(ckey(cx,cz));
  return ch?ch.mt[bidx(x-cx*CH,y,z-cz*CH)]:0;
}
/* how much liquid a meta stands for, 8 (a source, or falling) down to 1 */
function liqAmt(m){return (m&8)||!(m&7)?8:8-(m&7);}
/* how tall the liquid in a cell stands, as a part of the block: 8/9 for a source, less as it thins (1 when the same
   liquid is above it: the mesher and the swim checks ask for that themselves) */
function liqHeight(m){return liqAmt(m)/9;}
/* the top of the liquid at a block cell, as a height above the cell's floor: 0 if there is none */
function liqTop(x,y,z){
  const id=getBlock(x,y,z);
  if(!isLiq(id))return 0;
  return getBlock(x,y+1,z)===id?1:liqHeight(getMeta(x,y,z));
}
/* which way the liquid in a cell is running, as [x, z] (length 1, or 0 0 where it stands still: a source is a spring, it
   feeds the stream but does not run itself) */
function liqFlow(x,y,z){
  const id=getBlock(x,y,z);
  if(!isLiq(id))return [0,0];
  const m0=getMeta(x,y,z);
  if((m0&15)===0)return [0,0];
  const a=liqAmt(m0);
  let fx=0,fz=0;
  for(const o of LIQ_H4){
    const nid=getBlock(x+o[0],y,z+o[1]);
    let d=0;
    if(nid===id)d=a-liqAmt(getMeta(x+o[0],y,z+o[1]));
    else if(nid===B.AIR&&a<8)d=a;
    fx+=o[0]*d;fz+=o[1]*d;
  }
  const l=Math.hypot(fx,fz);
  return l>0?[fx/l,fz/l]:[0,0];
}
/* something changed at a cell: it and its six neighbours are due a look, if they hold a liquid */
function liqWake(x,y,z){
  for(const o of [[0,0,0],[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const X=x+o[0],Y=y+o[1],Z=z+o[2],id=getBlock(X,Y,Z);
    if(id!==B.WATER&&id!==B.LAVA)continue;
    const set=id===B.WATER?LIQ.w:LIQ.l;
    if(set.size<8000)set.set(X+','+Y+','+Z,[X,Y,Z]);
  }
}
/* (the names the rest of the game calls: they mean "look here") */
function flowPush(x,y,z){liqWake(x,y,z);}
function flowAround(x,y,z){liqWake(x,y,z);}
/* may a liquid move into a cell holding this block? Air, and the things a hand could brush aside */
function liqCanEnter(id){
  if(id===B.AIR)return true;
  const d=DEFS[id];
  return !!d&&d.solid===false&&!isLiq(id)&&d.hard>=0&&(!!d.replace||!!d.cross||isTorch(id));
}
/* lava that water has reached: a source becomes obsidian, a flow becomes cobblestone */
function liqHarden(x,y,z){
  if(getBlock(x,y,z)!==B.LAVA)return;
  const to=(getMeta(x,y,z)&15)?B.COBBLE:B.OBSIDIAN;
  setBlock(x,y,z,to);
  if(getBlock(x,y,z)!==to)return;
  burstParticles(x+0.5,y+0.7,z+0.5,to,8,0.7);playS('dig');
}
/* a liquid has just arrived in (or been poured into) a cell: where water and lava touch, the lava hardens */
function lavaWaterCheck(x,y,z){
  const here=getBlock(x,y,z);
  if(here===B.LAVA){
    if(getBlock(x,y+1,z)===B.WATER){liqHarden(x,y,z);return;}
    for(const o of LIQ_H4)if(getBlock(x+o[0],y,z+o[1])===B.WATER){liqHarden(x,y,z);return;}
  }else if(here===B.WATER){
    if(getBlock(x,y-1,z)===B.LAVA)liqHarden(x,y-1,z);
    for(const o of LIQ_H4)if(getBlock(x+o[0],y,z+o[1])===B.LAVA)liqHarden(x+o[0],y,z+o[1]);
  }
}
/* put a liquid into a cell it may enter; what was there (a flower, a torch) is washed out and drops */
function liqPut(L,x,y,z,meta,old){
  if(old!==B.AIR){
    const dr=blockDrop(old);
    setBlock(x,y,z,B.AIR);
    if(getBlock(x,y,z)!==B.AIR)return;
    if(dr)spawnDrop(x+0.5,y+0.4,z+0.5,{id:dr.id,count:dr.count},0,1.5,0);
  }
  setBlock(x,y,z,L,meta);
  if(getBlock(x,y,z)===L)lavaWaterCheck(x,y,z);
}
/* is there a way down under this cell for the liquid? */
function liqHole(L,x,y,z){
  if(y<=0)return false;
  const b=getBlock(x,y-1,z);
  return liqCanEnter(b)||(b===L&&(getMeta(x,y-1,z)&15)!==0);
}
/* The sideways directions a liquid at a cell spreads in: the ones that reach a drop soonest (looking at most far blocks
   along the floor), or every open one if no drop is in reach. */
function liqDirs(L,x,y,z,far){
  const open=[],dist=[];
  const pass=(X,Z)=>{const id=getBlock(X,y,Z);return liqCanEnter(id)||(id===L&&(getMeta(X,y,Z)&15)!==0);};
  for(const o of LIQ_H4){
    const sx=x+o[0],sz=z+o[1];
    if(!pass(sx,sz))continue;
    let d=1000,front=[[sx,sz]];
    const seen=new Set([x+','+z,sx+','+sz]);
    for(let step=0;step<far&&d===1000;step++){
      const next=[];
      for(const c of front){
        if(liqHole(L,c[0],y,c[1])){d=step;break;}
        for(const q of LIQ_H4){const X=c[0]+q[0],Z=c[1]+q[1],k=X+','+Z;if(seen.has(k)||!pass(X,Z))continue;seen.add(k);next.push([X,Z]);}
      }
      front=next;
    }
    open.push(o);dist.push(d);
  }
  const best=Math.min(1000,...dist);
  return best===1000?open:open.filter((o,i)=>dist[i]===best);
}
/* One cell of liquid L, one tick: first what it is (a flowing cell is what its neighbours make it), then where it goes. */
function liqCell(L,x,y,z){
  if(getBlock(x,y,z)!==L)return;
  const water=L===B.WATER,RL=liqRule(L,DIM),drop=RL.drop;
  let m=getMeta(x,y,z);
  const src=(m&15)===0;
  if(!src){
    let nm=-1;
    if(getBlock(x,y+1,z)===L)nm=8;
    else{
      let best=0,srcs=0;
      for(const o of LIQ_H4){
        if(getBlock(x+o[0],y,z+o[1])!==L)continue;
        const mm=getMeta(x+o[0],y,z+o[1]);
        if((mm&15)===0)srcs++;
        if(liqAmt(mm)>best)best=liqAmt(mm);
      }
      if(water&&srcs>=2){
        const b=getBlock(x,y-1,z);
        if(DEFS[b].solid!==false||(b===L&&(getMeta(x,y-1,z)&15)===0))nm=0;
      }
      if(nm<0&&best-drop>0)nm=8-(best-drop);
    }
    if(nm<0){setBlock(x,y,z,B.AIR);return;}
    if(nm!==m){setBlock(x,y,z,L,nm);if(getBlock(x,y,z)!==L)return;m=nm;}
  }
  /* down */
  let fell=false;
  if(y>0){
    const b=getBlock(x,y-1,z);
    if(b===L){
      const bm=getMeta(x,y-1,z);
      if((bm&15)!==0){fell=true;if(!(bm&8))setBlock(x,y-1,z,L,8);}
    }else if(liqCanEnter(b)){liqPut(L,x,y-1,z,8,b);fell=getBlock(x,y-1,z)===L;}
    else if(isLiq(b)){
      if(water)liqHarden(x,y-1,z);                          /* water onto lava */
      else{setBlock(x,y-1,z,B.STONE);if(getBlock(x,y-1,z)===B.STONE){burstParticles(x+0.5,y-0.3,z+0.5,B.STONE,8,0.7);playS('dig');}}   /* lava onto water: stone */
    }
  }
  if(!water&&GR.fireTick&&Math.random()<0.12){const o=LIQ_H4[(Math.random()*4)|0];igniteAt(x+o[0],y+((Math.random()*2)|0),z+o[1]);}
  if(fell&&!((getMeta(x,y,z)&15)===0))return;
  /* sideways */
  const na=liqAmt(m)-drop;
  if(na<=0)return;
  const nl=8-na;
  for(const o of liqDirs(L,x,y,z,RL.far)){
    const X=x+o[0],Z=z+o[1],nid=getBlock(X,y,Z);
    if(nid===L){const mm=getMeta(X,y,Z);if((mm&15)!==0&&!(mm&8)&&(mm&7)>nl)setBlock(X,y,Z,L,nl);}
    else if(liqCanEnter(nid))liqPut(L,X,y,Z,nl,nid);
  }
  for(const o of LIQ_H4){                                   /* the other liquid beside it */
    const nid=getBlock(x+o[0],y,z+o[1]);
    if(nid!==L&&isLiq(nid)){if(water)liqHarden(x+o[0],y,z+o[1]);else{liqHarden(x,y,z);return;}}
  }
}
/* one tick of one liquid: every cell that is due, up to the budget */
function liqStep(L,set){
  if(!set.size)return;
  const cells=[...set.values()];
  set.clear();
  let n=0;
  for(const c of cells){
    if(n>=600){set.set(c[0]+','+c[1]+','+c[2],c);continue;}
    const x=c[0],y=c[1],z=c[2];
    if(!chunkAt(x,z))continue;
    if(NET.on&&!ntSimHere(x,z))continue;   /* PART 58: one game flows the water here, the others get its edits */
    n++;
    liqCell(L,x,y,z);
  }
}
/* a chunk was built: the liquid in it that was still moving when it was last seen moves on */
function liqResume(ch){
  for(const [lk,v] of ch.edits){
    if(!(v>>8))continue;
    const p=lk.split(','),X=ch.cx*CH+ +p[0],Y=+p[1],Z=ch.cz*CH+ +p[2],set=(v&255)===B.WATER?LIQ.w:LIQ.l;
    if(set.size<8000)set.set(X+','+Y+','+Z,[X,Y,Z]);
  }
}
let flowT=0;
function tickFlow(dt){
  LIQ.wT-=dt;
  if(LIQ.wT<=0){LIQ.wT=liqRule(B.WATER,DIM).every;liqStep(B.WATER,LIQ.w);}
  LIQ.lT-=dt;
  if(LIQ.lT<=0){LIQ.lT=liqRule(B.LAVA,DIM).every;liqStep(B.LAVA,LIQ.l);}
}

/* ----- armor ----- */
IT.DSCALE=224;
idef(IT.DSCALE,{name:'Dragon Scale',icon:'i_dscale'});
tile('i_dscale',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#8f2222';c.beginPath();c.moveTo(8,1);c.lineTo(14,7);c.lineTo(8,15);c.lineTo(2,7);c.closePath();c.fill();
  c.fillStyle='#c24545';c.fillRect(6,4,4,2);
  c.fillStyle='#5e1414';c.fillRect(7,9,2,4);});
function armorId(m,s){return 230+m*4+s;}
const ARM_M=[
  {n:'Iron',   pts:2,  dur:140, it:()=>IT.IRON,   col:'#d8d8d8'},
  {n:'Golden', pts:1.5,dur:70,  it:()=>IT.GOLD,   col:'#ffe34d'},
  {n:'Diamond',pts:3.5,dur:380, it:()=>IT.DIAMOND,col:'#46e2cf'},
  {n:'Dragon', pts:5,  dur:600, it:()=>IT.DSCALE, col:'#8f2222'}];
const ARM_S=['Helmet','Chestplate','Leggings','Boots'];
for(let m=0;m<4;m++)for(let s=0;s<4;s++){
  idef(armorId(m,s),{name:ARM_M[m].n+' '+ARM_S[s],icon:'arm_'+m+'_'+s,stack:1,armor:{m,s}});
  tile('arm_'+m+'_'+s,((m,s)=>c=>{
    c.clearRect(0,0,16,16);c.fillStyle=ARM_M[m].col;
    if(s===0){c.fillRect(3,3,10,6);c.fillRect(3,9,3,3);c.fillRect(10,9,3,3);}
    else if(s===1){c.fillRect(5,2,6,3);c.fillRect(2,4,12,7);c.fillRect(2,4,3,9);c.fillRect(11,4,3,9);}
    else if(s===2){c.fillRect(3,2,10,4);c.fillRect(3,6,4,8);c.fillRect(9,6,4,8);}
    else{c.fillRect(3,8,4,6);c.fillRect(9,8,4,6);c.fillRect(2,12,5,2);c.fillRect(9,12,5,2);}
    c.fillStyle='rgba(0,0,0,.25)';c.fillRect(4,4,2,1);
  })(m,s));
}
const ARM_PAT=[['MMM','M M'],['M M','MMM','MMM'],['MMM','M M','M M'],['M M','M M']];
for(let m=0;m<4;m++)for(let s=0;s<4;s++)
  R(ARM_PAT[s],{M:ARM_M[m].it()},armorId(m,s),1);
function armorPts(){
  let p=0;
  for(const a of (P.armor||[]))if(a)p+=ARM_M[DEFS[a.id].armor.m].pts;
  return p;
}
function armorAbsorb(n){
  const pts=armorPts();
  if(pts<=0)return n;
  const red=Math.min(0.8,pts*0.04);
  /* the hit chews a random piece */
  const worn=[];
  for(let i=0;i<4;i++)if(P.armor[i])worn.push(i);
  if(worn.length){
    const i=worn[(Math.random()*worn.length)|0];
    const a=P.armor[i];
    const mx=ARM_M[DEFS[a.id].armor.m].dur;
    a.dur=(a.dur===undefined?mx:a.dur)-1;
    if(a.dur<=0){
      showToast('Your '+DEFS[a.id].name+' shattered!');
      playS('break2');
      P.armor[i]=null;
    }
  }
  return n*(1-red);
}
function equipArmor(){
  const st=heldStack();
  if(!st||!DEFS[st.id].armor)return;
  const s=DEFS[st.id].armor.s;
  const old=P.armor[s];
  P.armor[s]={id:st.id,...(st.dur!=null?{dur:st.dur}:{})};
  P.inv[P.sel]=old?{id:old.id,count:1,...(old.dur!=null?{dur:old.dur}:{})}:null;
  redrawHotbar();
  playS('place');
  showToast(DEFS[P.armor[s].id].name+' equipped \u2014 \u26e8 '+armorPts());
}
let _armLast='';
function updateArmorHud(){
  const el=$('armor');
  if(!el)return;
  const pts=armorPts();
  const s=pts>0?'\u26e8 '+pts:'';
  if(s!==_armLast){
    _armLast=s;
    el.textContent=s;
    el.style.display=s?'block':'none';
  }
}
/* ----- boats ----- */
IT.BOAT=223;
idef(IT.BOAT,{name:'Boat',icon:'i_boat',stack:1,boat:true});
tile('i_boat',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#7d5634';c.fillRect(2,8,12,4);
  c.fillStyle='#553a22';c.fillRect(2,12,12,2);
  c.fillStyle='#9a6b39';c.fillRect(2,8,2,4);c.fillRect(12,8,2,4);});
R(['P P','PPP'],{P:'planks'},IT.BOAT,1);
function mkBoatMesh(){
  const G=new THREE.Group(),mats=[];
  const reg=m=>{mats.push(m.material);return m;};
  const hull=reg(boxMesh(1.1,0.25,1.9,'#7d5634'));hull.position.y=0.12;G.add(hull);
  for(const sx of[-1,1]){
    const w=reg(boxMesh(0.12,0.3,1.9,'#9a6b39'));w.position.set(sx*0.55,0.32,0);G.add(w);
  }
  const bow=reg(boxMesh(0.9,0.3,0.14,'#9a6b39'));bow.position.set(0,0.32,-0.95);G.add(bow);
  const aft=reg(boxMesh(0.9,0.3,0.14,'#9a6b39'));aft.position.set(0,0.32,0.95);G.add(aft);
  const seat=reg(boxMesh(0.7,0.08,0.5,'#553a22'));seat.position.set(0,0.3,0.25);G.add(seat);
  return {G,mats};
}
function spawnBoat(x,y,z,yaw){
  const {G,mats}=mkBoatMesh();
  scene.add(G);
  entities.push({t:'boat',hp:6,hw:0.6,h:0.5,x,y,z,vx:0,vy:0,vz:0,yaw:yaw||0,
    spd:0,seatY:0.38,eyeH:1.1,onGround:false,hurtT:0,sprayT:0,mesh:G,mats});
}
function updateBoat(e,dt){
  if(!chunkAt(Math.floor(e.x),Math.floor(e.z)))return;
  e.hurtT=Math.max(0,e.hurtT-dt);
  if(e.hurtT<0.15)for(const m of e.mats)m.emissive&&m.emissive.setRGB(0,0,0);
  const ridden=P&&P.ride===e&&!P.dead;
  let f=0,s=0;
  if(ridden&&!modalOpen()&&!paused){
    f=clamp((KEY.KeyW?1:0)-(KEY.KeyS?1:0)+TOUCH.f,-1,1);
    s=clamp((KEY.KeyD?1:0)-(KEY.KeyA?1:0)+TOUCH.s,-1,1);
  }
  const fx=Math.floor(e.x),fz=Math.floor(e.z);
  const inW=getBlock(fx,Math.floor(e.y+0.05),fz)===B.WATER||getBlock(fx,Math.floor(e.y-0.2),fz)===B.WATER;
  if(inW){
    let wy=Math.floor(e.y+0.05);
    while(wy<WH&&getBlock(fx,wy,fz)===B.WATER)wy++;
    e.y=lerp(e.y,wy-0.18,1-Math.exp(-dt*9));
    e.vy=0;
    const top=f<0?-3:9;
    if(f!==0)e.spd=lerp(e.spd,f*Math.abs(top),1-Math.exp(-dt*1.4));
    else e.spd*=Math.exp(-dt*0.5);
    e.yaw-=s*dt*2.0*clamp(Math.abs(e.spd)/3,0.25,1.2)*Math.sign(e.spd||1);
    e.sprayT-=dt;
    if(Math.abs(e.spd)>3&&e.sprayT<=0){
      e.sprayT=0.16;
      burstParticles(e.x-Math.sin(e.yaw)*0.6,e.y+0.15,e.z-Math.cos(e.yaw)*0.6,B.WATER,2,0.5);
    }
  }else{
    e.vy-=GRAV*dt;
    if(e.vy<-45)e.vy=-45;
    if(f!==0&&e.onGround)e.spd=lerp(e.spd,f*1.4,1-Math.exp(-dt*3));
    else e.spd*=Math.exp(-dt*(e.onGround?5:0.3));
  }
  const dx=-Math.sin(e.yaw),dz=-Math.cos(e.yaw);
  e.vx=dx*e.spd;e.vz=dz*e.spd;
  moveBody(e,e.vx*dt,e.vy*dt,e.vz*dt,false);
  /* push a parked boat */
  if(!ridden&&P&&!P.dead&&!P.ride){
    const px=Math.abs(P.x-e.x),pz=Math.abs(P.z-e.z);
    if(px<P.hw+e.hw&&pz<P.hw+e.hw&&P.y<e.y+0.9&&P.y+1.6>e.y){
      const ddx=e.x-P.x,ddz=e.z-P.z,dd=Math.hypot(ddx,ddz)||0.01;
      e.x+=ddx/dd*2.2*dt;e.z+=ddz/dd*2.2*dt;
    }
  }
  e.mesh.position.set(e.x,e.y,e.z);
  e.mesh.rotation.y=e.yaw;
  e.mesh.rotation.z=lerp(e.mesh.rotation.z||0,Math.sin(Date.now()*0.002)*(inW?0.04:0),0.1);
  if(e.y<-40)removeEnt(e);
}
/* ----- inventory sort ----- */
function sortInv(){
  const items=[];
  for(let i=9;i<36;i++){
    if(P.inv[i]){items.push(P.inv[i]);P.inv[i]=null;}
  }
  /* merge stackables */
  const merged=[];
  for(const st of items){
    let done=false;
    if(st.dur==null&&!st.ench&&!st.mob){
      for(const m of merged){
        if(m.id===st.id&&m.dur==null&&!m.ench&&!m.mob){
          const mx=stackMax(m.id);
          const take=Math.min(st.count,mx-m.count);
          m.count+=take;st.count-=take;
          if(st.count<=0){done=true;break;}
        }
      }
    }
    if(!done)merged.push(st);
  }
  merged.sort((a,b)=>a.id-b.id||(b.count||0)-(a.count||0));
  for(let i=0;i<merged.length&&i<27;i++)P.inv[9+i]=merged[i];
  if(MODAL.kind)redrawModal();
  playS('pop');
  showToast('Inventory sorted');
}


