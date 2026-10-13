/* PART 38 - liquid chemistry + portals */
IT.BUCKET=228;IT.BUCKET_W=229;IT.BUCKET_L=246;
idef(IT.BUCKET,{name:'Bucket',icon:'i_bucket',stack:1});
idef(IT.BUCKET_W,{name:'Water Bucket',icon:'i_bucketw',stack:1});
idef(IT.BUCKET_L,{name:'Lava Bucket',icon:'i_bucketl',stack:1});
R(['I I',' I '],{I:IT.IRON},IT.BUCKET,1);
tile('i_bucket',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#b8bcc4';c.fillRect(4,6,8,7);c.fillRect(3,6,1,5);c.fillRect(12,6,1,5);
  c.fillStyle='#8a8f96';c.fillRect(4,12,8,1);
  c.fillStyle='#d8dce4';c.fillRect(4,4,1,2);c.fillRect(11,4,1,2);c.fillRect(5,3,6,1);});
tile('i_bucketw',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#b8bcc4';c.fillRect(4,6,8,7);c.fillRect(3,6,1,5);c.fillRect(12,6,1,5);
  c.fillStyle='#3d6de8';c.fillRect(5,6,6,2);c.fillStyle='#6a9af4';c.fillRect(6,6,2,1);
  c.fillStyle='#d8dce4';c.fillRect(4,4,1,2);c.fillRect(11,4,1,2);c.fillRect(5,3,6,1);});
tile('i_bucketl',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#b8bcc4';c.fillRect(4,6,8,7);c.fillRect(3,6,1,5);c.fillRect(12,6,1,5);
  c.fillStyle='#e85d1a';c.fillRect(5,6,6,2);c.fillStyle='#ffb03d';c.fillRect(7,6,2,1);
  c.fillStyle='#d8dce4';c.fillRect(4,4,1,2);c.fillRect(11,4,1,2);c.fillRect(5,3,6,1);});
/* portals: frames are 4 wide x 5 tall with a 2x3 interior */
function frameOK(ox,oy,oz,ax,frameId){
  const dx=ax==='x'?1:0,dz=ax==='x'?0:1;
  for(let i=0;i<2;i++){
    if(getBlock(ox+dx*i,oy-1,oz+dz*i)!==frameId)return false;
    if(getBlock(ox+dx*i,oy+3,oz+dz*i)!==frameId)return false;
  }
  for(let j=0;j<3;j++){
    if(getBlock(ox-dx,oy+j,oz-dz)!==frameId)return false;
    if(getBlock(ox+dx*2,oy+j,oz+dz*2)!==frameId)return false;
  }
  for(let i=0;i<2;i++)for(let j=0;j<3;j++){
    const c2=getBlock(ox+dx*i,oy+j,oz+dz*i);
    /* 6.25: a trickle of water or lava across the doorway does not stop a portal opening (a source still does) */
    if(c2!==B.AIR&&!DEFS[c2].replace&&!(isLiq(c2)&&(getMeta(ox+dx*i,oy+j,oz+dz*i)&15)!==0))return false;
  }
  return true;
}
/* ----- dimensions that are switched off (6.33) -----
   Three game rules, nether, aether and puppet, all on unless a world turns one off. With one off nothing leads there:
   its frames do not light, its portals do not carry, the Stage Door does not come (purgatory/p0_entry.js), and a player
   found inside it (a save from before, a rule turned off mid-visit) is put back at their Overworld spawn. */
function dimOn(d){return d==='over'||GR[d]!==false;}
/* once a frame: is the player somewhere that has been switched off? */
function dimEvict(){
  if(DIM==='over'||dimOn(DIM)||!playing||!P||NET.host)return false;
  const was=DIM;
  if(DIM==='puppet'&&typeof mpExit==='function'&&mpExit({abandon:true}))return true;
  const s=P.spawn||[8.5,WH-10,8.5];
  if(modalOpen())closeModal();
  setDim('over',s[0],s[1],s[2]);forceChunksNear(Math.floor(s[0]),Math.floor(s[2]));
  showToast((was==='nether'?'The Nether':was==='aether'?'The Aether':'That place')+' is closed in this world. You are back at your spawn.');
  return true;
}
function tryIgnitePortal(x,y,z,frameId,portalId){
  if(!dimOn(portalId===B.PORTAL_A?'aether':'nether'))return false;
  if(MGP_ON&&mgNoPortal(x,y,z))return false;
  for(const ax of ['x','z']){
    const dx=ax==='x'?1:0,dz=ax==='x'?0:1;
    for(let oi=-2;oi<=2;oi++)for(let oj=-3;oj<=1;oj++){
      const ox=x+dx*oi,oy=y+oj,oz=z+dz*oi;
      if(!frameOK(ox,oy,oz,ax,frameId))continue;
      for(let i=0;i<2;i++)for(let j=0;j<3;j++)
        setBlock(ox+dx*i,oy+j,oz+dz*i,portalId);
      return true;
    }
  }
  return false;
}
function forceChunksNear(x,z){
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    const cx=Math.floor(x/CH)+dx,cz=Math.floor(z/CH)+dz;
    if(!chunks.get(ckey(cx,cz)))createChunk(cx,cz);
  }
}
function ensurePortalAt(frameId,portalId){
  forceChunksNear(P.x,P.z);
  const px2=Math.floor(P.x),py2=Math.floor(P.y),pz2=Math.floor(P.z);
  for(let dx=-9;dx<=9;dx++)for(let dy=-6;dy<=6;dy++)for(let dz=-9;dz<=9;dz++)
    if(getBlock(px2+dx,py2+dy,pz2+dz)===portalId)return;
  const bx=px2+2,by=py2,bz=pz2;
  for(let i=-1;i<=2;i++){
    setBlock(bx+i,by-1,bz,frameId);
    setBlock(bx+i,by+3,bz,frameId);
    if(getBlock(bx+i,by-2,bz)===B.AIR||getBlock(bx+i,by-2,bz)===B.LAVA)setBlock(bx+i,by-2,bz,frameId);
  }
  for(let j=0;j<3;j++){setBlock(bx-1,by+j,bz,frameId);setBlock(bx+2,by+j,bz,frameId);}
  for(let i=0;i<2;i++)for(let j=0;j<3;j++)setBlock(bx+i,by+j,bz,portalId);
}
function travelNether(){
  if(DIM==='nether'){
    const gx=Math.floor(P.x),gz=Math.floor(P.z);
    setDim('over',P.x,10,P.z);
    forceChunksNear(P.x,P.z);
    P.y=colInfo(gx,gz).h+1.2;
    ensurePortalAt(B.OBSIDIAN,B.PORTAL_N);
  }else{
    setDim('nether',P.x,20,P.z);
    forceChunksNear(P.x,P.z);
    const nc=nCol(Math.floor(P.x),Math.floor(P.z));
    const base=Math.max(nc.f,12);
    for(let dx=-2;dx<=3;dx++)for(let dz=-2;dz<=2;dz++){
      setBlock(Math.floor(P.x)+dx,base,Math.floor(P.z)+dz,B.NETHROCK);
      for(let dy=1;dy<=4;dy++)setBlock(Math.floor(P.x)+dx,base+dy,Math.floor(P.z)+dz,B.AIR);
    }
    P.y=base+1.2;
    ensurePortalAt(B.OBSIDIAN,B.PORTAL_N);
  }
  showToast(DIM==='nether'?'Welcome to the Nether. Mind the everything.':'Back to the overworld. The air tastes less like pennies.');
}
function travelAether(){
  if(DIM==='aether'){
    const gx=Math.floor(P.x),gz=Math.floor(P.z);
    setDim('over',P.x,10,P.z);
    forceChunksNear(P.x,P.z);
    P.y=colInfo(gx,gz).h+1.2;
    ensurePortalAt(B.GLOWSTONE,B.PORTAL_A);
  }else{
    setDim('aether',P.x,50,P.z);
    let isl=null;
    for(let dx=-32;dx<=32&&!isl;dx+=2)for(let dz=-32;dz<=32&&!isl;dz+=2){
      const a=aCol(Math.floor(P.x)+dx,Math.floor(P.z)+dz);
      if(a)isl=[Math.floor(P.x)+dx,Math.floor(P.z)+dz,a];
    }
    if(isl){P.x=isl[0]+0.5;P.z=isl[1]+0.5;P.y=isl[2].t+1.2;forceChunksNear(P.x,P.z);}
    else{
      forceChunksNear(P.x,P.z);
      const bx=Math.floor(P.x),bz=Math.floor(P.z);
      for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)setBlock(bx+dx,47,bz+dz,B.CLOUDSTONE);
      P.y=48.2;
    }
    ensurePortalAt(B.GLOWSTONE,B.PORTAL_A);
  }
  showToast(DIM==='aether'?'The Aether. Do not look down. (Look down once.)':'Back to solid, boring, wonderful ground.');
}
function tickPortal(dt){
  if(!playing||!P||P.dead)return;
  if(P.portalT<0){P.portalT=Math.min(0,P.portalT+dt);return;}
  const fb=getBlock(Math.floor(P.x),Math.floor(P.y+0.2),Math.floor(P.z));
  if(fb===B.PORTAL_N||fb===B.PORTAL_A){
    P.portalT+=dt;
    if(P.portalT>1.1){
      P.portalT=-2;
      if(!dimOn(fb===B.PORTAL_N?'nether':'aether'))showToast('This portal leads nowhere. '+(fb===B.PORTAL_N?'The Nether':'The Aether')+' is closed in this world.');
      else if(fb===B.PORTAL_N)travelNether();else travelAether();
    }
  }else if(P.portalT>0)P.portalT=0;
}

