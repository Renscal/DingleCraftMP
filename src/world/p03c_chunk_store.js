/* ----- chunk store ----- */
const chunks=new Map();        /* ckey -> {bl,mt,cx,cz,dirty,meshes,edits}  (mt: a meta byte per block, 6.25: liquid levels, p18) */
const chunkEdits=new Map();    /* ckey -> Map("lx,y,lz" -> id, or id | meta<<8)  (persists across unload) */
const blockEnts=new Map();     /* bkey -> {t:'furnace'|'chest',...} */
const torches=new Set();       /* bkey of placed torches */
let frameCount=0;

function createChunk(cx,cz){
  const k=ckey(cx,cz);
  const bl=genChunk(cx,cz);
  let ed=chunkEdits.get(k);
  if(!ed){ed=new Map();chunkEdits.set(k,ed);}
  const mt=new Uint8Array(bl.length);
  for(const [lk,id] of ed){
    const p=lk.split(','),i=bidx(+p[0],+p[1],+p[2]);
    bl[i]=id&255;mt[i]=id>>8;
  }
  for(const [lk,id] of ed){
    if(id!==B.FLOWER_R&&id!==B.FLOWER_Y&&id!==B.TALLGRASS&&id!==B.CACTUS)continue;
    const p=lk.split(',');
    if(+p[1]>0&&bl[bidx(+p[0],+p[1]-1,+p[2])]===B.LAWN)
      LWN.set(bkey(cx*CH+ +p[0],+p[1],cz*CH+ +p[2]),{p:id,cd:0});
  }
  applyCraters(bl,ed,cx,cz);
  const ch={bl,mt,cx,cz,dirty:true,meshes:null,edits:ed};
  chunks.set(k,ch);
  liqResume(ch);
  lightChunk(ch);                                          /* 6.26: block light (world/p03e_light.js) */
  markDirty(cx-1,cz);markDirty(cx+1,cz);markDirty(cx,cz-1);markDirty(cx,cz+1);
  return ch;
}
function markDirty(cx,cz){
  const ch=chunks.get(ckey(cx,cz));
  if(ch)ch.dirty=true;
}
function chunkAt(x,z){
  return chunks.get(ckey(Math.floor(x/CH),Math.floor(z/CH)));
}
function getBlock(x,y,z){
  if(y<0)return B.BEDROCK;
  if(y>=WH)return B.AIR;
  const cx=Math.floor(x/CH),cz=Math.floor(z/CH);
  const ch=chunks.get(ckey(cx,cz));
  if(!ch)return B.AIR;
  return ch.bl[bidx(x-cx*CH,y,z-cz*CH)];
}
function setBlock(x,y,z,id,meta){
  if(y<0||y>=WH)return;
  meta=meta|0;
  if(MGP_ON&&mgProtect(x,y,z,id))return;
  const cx=Math.floor(x/CH),cz=Math.floor(z/CH);
  const ch=chunks.get(ckey(cx,cz));
  if(!ch)return;
  const lx=x-cx*CH,lz=z-cz*CH;
  const i=bidx(lx,y,lz);
  const old=ch.bl[i];
  if(old===id&&ch.mt[i]===meta)return;
  ch.bl[i]=id;ch.mt[i]=meta;
  const ev=meta?id|(meta<<8):id;                            /* what is saved and sent: the id, with the meta above it when there is any */
  ch.edits.set(lx+','+y+','+lz,ev);
  if(NET.on&&!NET.ap)ntEdit(ckey(cx,cz),lx+','+y+','+lz,ev);   /* PART 58: multiplayer */
  if(old===id){ch.dirty=true;liqWake(x,y,z);              /* only the level changed: the mesh and the liquid next door, nothing else */
    if(lx===0)markDirty(cx-1,cz);if(lx===CH-1)markDirty(cx+1,cz);if(lz===0)markDirty(cx,cz-1);if(lz===CH-1)markDirty(cx,cz+1);
    return;}
  const k=bkey(x,y,z);
  if(isTorch(old))torches.delete(k);
  if(isTorch(id))torches.add(k);
  if(isDoorId(old)&&!isDoorId(id)){
    const py=DEFS[old].door.half?y-1:y+1;
    if(isDoorId(getBlock(x,py,z)))setBlock(x,py,z,B.AIR);
  }
  ch.dirty=true;
  liqWake(x,y,z);
  if(old!==id)lightEdit(x,y,z);                            /* 6.26: block light follows every change */
  if(id===B.TCORE)TITQ.push({x,y,z,t:2.2,pT:0});
  if(lx===0)markDirty(cx-1,cz);
  if(lx===CH-1)markDirty(cx+1,cz);
  if(lz===0)markDirty(cx,cz-1);
  if(lz===CH-1)markDirty(cx,cz+1);
  checkFalling(x,y+1,z);
  if(id!==B.AIR&&DEFS[id].gravity)checkFalling(x,y,z);
  if(DEFS[id].solid===false)checkTorchPop(x,y,z);
}
function surfaceTop(x,z){
  const ch=chunkAt(x,z);
  if(!ch)return DIM==='puppet'?mpSurf(x,z):colInfo(x,z).h;
  const lx=x-ch.cx*CH,lz=z-ch.cz*CH;
  for(let y=WH-1;y>=0;y--){
    const id=ch.bl[bidx(lx,y,lz)];
    if(id!==B.AIR&&DEFS[id].solid!==false)return y;
  }
  return 0;
}
function skyOpen(x,y,z){
  const ch=chunkAt(x,z);
  if(!ch)return true;
  const lx=x-ch.cx*CH,lz=z-ch.cz*CH;
  for(let yy=y+1;yy<WH;yy++){
    if(DEFS[ch.bl[bidx(lx,yy,lz)]].opq)return false;
  }
  return true;
}

