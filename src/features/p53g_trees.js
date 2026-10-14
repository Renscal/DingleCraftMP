/* ----- saplings and leaf decay (6.43) -----
   Trees could be cut down and never grown. Now leaves drop saplings, saplings grow into trees, and the leaves of a tree
   whose trunk is gone wither away.
   Saplings: one block (249, the last free block id) for all three kinds. Its meta byte holds the kind in bits 0-1 (0 oak,
   1 birch, 2 spruce) and how far it has grown in bits 2-3 (0 to 3). Three items (379-381) place it, on grass or dirt.
   Once a second a sapling with open sky or enough light over it may grow a step; at the last step it becomes a tree of
   its kind, in the same shape the world generator makes (treeShape), if the trunk has room. Without room it waits.
   Leaves: one broken by hand drops a sapling of its kind about once in 20, and an oak leaf an apple about once in 200.
   When a log is taken away the leaves around it are looked at a little later, a few at a time: a leaf with no log within
   four blocks along connected leaves withers, with the same drops. A leaf a player placed (meta bit 0) never does.
   On a server all of it runs once, in the game that runs the land (the server's own, where there is one). */
B.SAPLING=249;
IT.SAPLING=379;
const TREE={q:new Map(),dq:[],t:0,dim:null,p:1/150,reach:4,rnd:null};
const TREE_KINDS=[{n:'Oak',log:()=>B.LOG_O,leaf:()=>B.LEAF_O},{n:'Birch',log:()=>B.LOG_B,leaf:()=>B.LEAF_B},{n:'Spruce',log:()=>B.LOG_S,leaf:()=>B.LEAF_S}];
function treeRnd(){return TREE.rnd?TREE.rnd():Math.random();}
/* which kind of tree a log or leaf block belongs to (-1: neither) */
function treeKindOf(id){return id===B.LOG_O||id===B.LEAF_O?0:id===B.LOG_B||id===B.LEAF_B?1:id===B.LOG_S||id===B.LEAF_S?2:-1;}
/* the pictures (a sapling of each kind, and its item), registered at boot with farming's (farmTiles) */
function treeTiles(){
  const pal=[['#3e7a25','#4f9430','#6b4a25'],['#5f9a3f','#74b450','#d8d4c4'],['#2e5d3a','#3a7048','#4a3520']];
  for(let k=0;k<3;k++)(kk=>tile('sapling_'+kk,c=>{c.clearRect(0,0,16,16);const [a,b,st]=pal[kk];
    c.fillStyle=st;c.fillRect(7,9,2,7);c.fillRect(6,12,1,1);c.fillRect(9,11,1,1);
    if(kk===2){for(let r=0;r<5;r++){c.fillStyle=r%2?a:b;c.fillRect(8-1-r,3+r*2,2+r*2,2);}c.fillStyle=b;c.fillRect(7,1,2,2);}
    else{c.fillStyle=a;c.fillRect(4,3,8,6);c.fillRect(5,2,6,1);c.fillRect(3,5,10,3);c.fillStyle=b;for(const p of [[5,4],[8,3],[10,5],[4,6],[7,6],[9,7],[6,8]])c.fillRect(p[0],p[1],2,1);
      c.clearRect(3,5,1,1);c.clearRect(12,7,1,1);}}))(k);
}
def(B.SAPLING,{name:'Sapling',tiles:'sapling_0',hard:0,solid:false,opq:false,bucket:'cut',cross:true,drop:null,hide:true,sapling:true,
  crossM:m=>Tl['sapling_'+Math.min(2,m&3)],pdrop:()=>{const L=TREE.last;TREE.last=null;return L?{id:IT.SAPLING+L.kind,count:1}:null;}});
for(let k=0;k<3;k++)idef(IT.SAPLING+k,{name:TREE_KINDS[k].n+' Sapling',icon:'sapling_'+k,sap:k});
/* what a leaf of this kind gives when it is broken or withers: a sapling now and then, an apple (oak) rarely, else nothing */
function leafDrop(kind){
  const r=treeRnd();
  if(r<0.05)return {id:IT.SAPLING+kind,count:1};
  if(kind===0&&r<0.055)return {id:IT.APPLE,count:1};
  return null;
}
for(let k=0;k<3;k++)(kk=>{DEFS[TREE_KINDS[kk].leaf()].pdrop=()=>leafDrop(kk);})(k);
/* The shape of a tree, as calls to put(x, y, z, id, keep): keep means "only where there is nothing yet". t: {h: the
   ground's height, th: how tall, type: the kind}. The world generator and a grown sapling both draw with this. */
function treeShape(x,z,t,put){
  const logId=TREE_KINDS[t.type].log(),leafId=TREE_KINDS[t.type].leaf();
  const baseY=t.h+1,topY=t.h+t.th;
  if(t.type===2){ /* spruce cone */
    for(let y=baseY;y<=topY;y++)put(x,y,z,logId);
    for(let y=baseY+1;y<=topY-1;y++){
      const rr=((topY-1-y)%2===0)?1:2;
      for(let dx=-rr;dx<=rr;dx++)for(let dz=-rr;dz<=rr;dz++){
        if(dx===0&&dz===0)continue;
        if(rr===2&&Math.abs(dx)===2&&Math.abs(dz)===2)continue;
        put(x+dx,y,z+dz,leafId,true);
      }
    }
    put(x,topY+1,z,leafId,true);
    put(x+1,topY,z,leafId,true);put(x-1,topY,z,leafId,true);
    put(x,topY,z+1,leafId,true);put(x,topY,z-1,leafId,true);
  }else{
    for(let y=baseY;y<topY;y++)put(x,y,z,logId);
    for(let y=topY-2;y<=topY-1;y++)
      for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        if(dx===0&&dz===0)continue;
        if(Math.abs(dx)===2&&Math.abs(dz)===2&&h2(x+dx+y*7,z+dz,SEED+71)<.5)continue;
        put(x+dx,y,z+dz,leafId,true);
      }
    for(let y=topY;y<=topY+1;y++)
      for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
        if(y===topY+1&&Math.abs(dx)+Math.abs(dz)>1)continue;
        put(x+dx,y,z+dz,leafId,true);
      }
  }
}
/* may a tree's trunk or crown take this cell's place? */
function treeSoft(id){return id===B.AIR||id===B.SAPLING||isLeafId(id)||!!DEFS[id].replace;}
/* turn the sapling at x,y,z into a tree of its kind, th tall (4 to 6 if not given). false, and nothing changed, if the
   trunk has no room or the world's ceiling is too close. */
function treeGrow(x,y,z,kind,th){
  th=th||4+Math.floor(treeRnd()*3);
  if(y+th+2>=WH-3)return false;
  for(let i=1;i<=th;i++)if(!treeSoft(getBlock(x,y+i,z)))return false;
  treeShape(x,z,{h:y-1,th,type:kind},(wx,wy,wz,id,keep)=>{
    const cur=getBlock(wx,wy,wz);
    if(keep?cur!==B.AIR:!treeSoft(cur))return;
    setBlock(wx,wy,wz,id);
  });
  return true;
}
/* the right click of a sapling item: onto grass or dirt, with air above (from doUse, with the hoe and the seeds) */
function treeUse(st,d,hit){
  if(!hit||hit.ny!==1)return false;
  if(hit.id!==B.GRASS&&hit.id!==B.DIRT&&hit.id!==B.SNOWGRASS)return false;
  if(getBlock(hit.x,hit.y+1,hit.z)!==B.AIR)return false;
  setBlock(hit.x,hit.y+1,hit.z,B.SAPLING,d.sap&3);
  if(P.mode!=='c'){st.count--;if(st.count<=0)P.inv[P.sel]=null;}
  redrawHotbar();playS('place');P.swing=1;
  return true;
}
/* is the leaf at x,y,z still part of a tree: a log within TREE.reach steps along leaves? */
function leafHeld(x,y,z){
  const seen=new Set([x+','+y+','+z]);
  let ring=[[x,y,z]];
  for(let d=0;d<TREE.reach;d++){
    const next=[];
    for(const c of ring)for(const o of LGT_N){
      const X=c[0]+o[0],Y=c[1]+o[1],Z=c[2]+o[2],k=X+','+Y+','+Z;
      if(seen.has(k))continue;
      seen.add(k);
      const id=getBlock(X,Y,Z);
      if(isLogId(id))return true;
      if(isLeafId(id))next.push([X,Y,Z]);
    }
    ring=next;
    if(!ring.length)break;
  }
  return false;
}
/* from setBlock, when the kind of block at a cell changed. Keeps the list of saplings, remembers a sapling just removed
   (for its drop), and when a log goes, puts the leaves around it on the list to be looked at. */
function treeNote(x,y,z,old,om,id,meta){
  if(id===B.SAPLING)TREE.q.set(x+','+y+','+z,[x,y,z]);
  else if(old===B.SAPLING){TREE.q.delete(x+','+y+','+z);TREE.last={kind:om&3};}
  if(!isLogId(old)||isLogId(id))return;
  if(NET.on&&(NET.ap||ntHosted()))return;
  const R=TREE.reach+1;
  for(let dx=-R;dx<=R;dx++)for(let dy=-R;dy<=R;dy++)for(let dz=-R;dz<=R;dz++){
    if(TREE.dq.length>=6000)return;
    if(isLeafId(getBlock(x+dx,y+dy,z+dz)))TREE.dq.push([x+dx,y+dy,z+dz,1+treeRnd()*6]);
  }
}
/* a chunk was built: the saplings in it go on the list (a sapling is always an edit) */
function treeResume(ch){
  if(TREE.dim!==DIM){TREE.dim=DIM;TREE.q.clear();TREE.dq.length=0;}
  for(const [lk,v] of ch.edits){
    if((v&255)!==B.SAPLING)continue;
    const p=lk.split(','),X=ch.cx*CH+ +p[0],Y=+p[1],Z=ch.cz*CH+ +p[2];
    TREE.q.set(X+','+Y+','+Z,[X,Y,Z]);
  }
}
/* every frame (from tickFlow): the leaves waiting to be looked at count down, at most 40 withering a frame; and once a
   second every sapling may grow */
function treeTick(dt){
  if(TREE.dim!==DIM){TREE.dim=DIM;TREE.q.clear();TREE.dq.length=0;TREE.t=0;return;}
  if(TREE.dq.length){
    let done=0;
    for(let i=TREE.dq.length-1;i>=0&&done<40;i--){
      const L=TREE.dq[i];
      L[3]-=dt;
      if(L[3]>0)continue;
      TREE.dq.splice(i,1);
      const x=L[0],y=L[1],z=L[2],id=getBlock(x,y,z);
      if(!isLeafId(id)||(getMeta(x,y,z)&1)||leafHeld(x,y,z))continue;
      done++;
      setBlock(x,y,z,B.AIR);
      for(const o of LGT_N)if(TREE.dq.length<6000&&isLeafId(getBlock(x+o[0],y+o[1],z+o[2])))TREE.dq.push([x+o[0],y+o[1],z+o[2],0.3+treeRnd()*2]);   /* and the ones it was holding up are looked at in turn */
      const dr=leafDrop(treeKindOf(id));
      if(dr)spawnDrop(x+0.5,y+0.4,z+0.5,dr,(treeRnd()-0.5)*1.5,1.5,(treeRnd()-0.5)*1.5);
    }
  }
  TREE.t+=dt;
  if(TREE.t<1)return;
  TREE.t-=1;
  for(const [k,c] of TREE.q){
    const x=c[0],y=c[1],z=c[2];
    if(!chunkAt(x,z))continue;
    if(getBlock(x,y,z)!==B.SAPLING){TREE.q.delete(k);continue;}
    if(NET.on&&ntSimHere(x,z)===false)continue;
    const under=getBlock(x,y-1,z);
    if(under!==B.GRASS&&under!==B.DIRT&&under!==B.SNOWGRASS){                 /* the ground went: it comes loose */
      const kind=getMeta(x,y,z)&3;
      setBlock(x,y,z,B.AIR);TREE.last=null;
      spawnDrop(x+0.5,y+0.3,z+0.5,{id:IT.SAPLING+kind,count:1},0,1.5,0);
      continue;
    }
    if(!skyOpen(x,y,z)&&getLight(x,y+1,z)<9&&getLight(x,y,z)<9)continue;      /* it wants light */
    if(!CATCH.due.delete(k)&&treeRnd()>=TREE.p)continue;   /* 6.50: due after catching up: it grows now */
    const m=getMeta(x,y,z),stage=(m>>2)&3;
    if(stage<3){setBlock(x,y,z,B.SAPLING,(m&3)|((stage+1)<<2));continue;}
    treeGrow(x,y,z,m&3);                                                     /* no room: it tries again another second */
  }
}
/* forget everything (a new world, a loaded one) */
function treeReset(){TREE.q.clear();TREE.dq.length=0;TREE.t=0;TREE.dim=null;TREE.last=null;}
