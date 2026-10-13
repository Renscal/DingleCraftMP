/* ---- dimensions: keys carry an 'n;'/'a;' prefix outside the overworld ---- */
var DIM='over';
function dimPfx(){return DIM==='over'?'':(DIM==='nether'?'n;':(DIM==='puppet'?'m;':'a;'));}
function keyDim(k){return k[1]===';'?(k[0]==='n'?'nether':(k[0]==='m'?'puppet':'aether')):'over';}
function keyCore(k){return k[1]===';'?k.slice(2):k;}
function dimP(k){
  if(keyDim(k)!==DIM)return null;
  return keyCore(k).split(',');
}
function ckey(cx,cz){return dimPfx()+cx+','+cz;}
function bkey(x,y,z){return dimPfx()+x+','+y+','+z;}

function stampTree(blocks,x0,z0,x,z,t){
  function put(wx,wy,wz,id,keep){
    const lx=wx-x0,lz=wz-z0;
    if(lx<0||lx>=CH||lz<0||lz>=CH||wy<1||wy>=WH)return;
    const i=bidx(lx,wy,lz);
    if(keep&&blocks[i]!==B.AIR)return;
    blocks[i]=id;
  }
  treeShape(x,z,t,put);                                    /* 6.43: the shape itself is shared with a grown sapling (features/p53g_trees.js) */
}

function genChunk(cx,cz){
  if(DIM==='nether')return genChunkNether(cx,cz);
  if(DIM==='aether')return genChunkAether(cx,cz);
  if(DIM==='puppet')return genChunkPuppet(cx,cz);
  const blocks=new Uint8Array(CH*WH*CH);
  const x0=cx*CH,z0=cz*CH;
  const cf=genCaveField(x0,z0);
  for(let lx=0;lx<CH;lx++)for(let lz=0;lz<CH;lz++){
    const wx=x0+lx,wz=z0+lz;
    const ci=colInfo(wx,wz),h=ci.h,b=ci.b;
    const caveLimit=(h>=SEA+1)?h:h-4;
    for(let y=0;y<WH;y++){
      let id=B.AIR;
      if(y===0)id=B.BEDROCK;
      else if(y<=h){
        if(y>3&&y<=caveLimit&&caveSample(cf,lx,y,lz))id=(y<9?B.LAVA:B.AIR);
        else if(y===h)id=topBlock(b,h,wx,wz);
        else if(b===BIOME.DESERT&&y>=h-7&&y<h-3)id=B.SANDSTONE;
        else if(y>=h-3)id=fillerBlock(b);
        else id=stoneOrOre(wx,y,wz);
      }else if(y<=SEA){
        id=(b===BIOME.SNOWY&&y===SEA)?B.ICE:B.WATER;
      }
      blocks[bidx(lx,y,lz)]=id;
    }
  }
  /* trees (with 3-block margin so canopies cross chunk borders) */
  for(let wx=x0-3;wx<x0+CH+3;wx++)for(let wz=z0-3;wz<z0+CH+3;wz++){
    const t=treeAt(wx,wz);
    if(t)stampTree(blocks,x0,z0,wx,wz,t);
  }
  /* small plants, cactus */
  for(let lx=0;lx<CH;lx++)for(let lz=0;lz<CH;lz++){
    const wx=x0+lx,wz=z0+lz;
    const ci=colInfo(wx,wz),h=ci.h;
    if(h+1>=WH)continue;
    const top=blocks[bidx(lx,h,lz)],above=blocks[bidx(lx,h+1,lz)];
    if(above!==B.AIR)continue;
    if(ci.b===BIOME.DESERT&&top===B.SAND){
      if(h2(wx,wz,SEED+1212)<.01){
        const ch_=2+((h2(wx,wz,SEED+1313)*2)|0);
        for(let i=1;i<=ch_&&h+i<WH;i++)blocks[bidx(lx,h+i,lz)]=B.CACTUS;
      }else{const f=bioFlower(ci.b,top,h,wx,wz);if(f)blocks[bidx(lx,h+1,lz)]=f;}
    }else if(top===B.GRASS){
      const r=h2(wx,wz,SEED+606);
      if(r<.09)blocks[bidx(lx,h+1,lz)]=B.TALLGRASS;
      else if(r<.105)blocks[bidx(lx,h+1,lz)]=B.FLOWER_Y;
      else if(r<.12)blocks[bidx(lx,h+1,lz)]=B.FLOWER_R;
      else{const f=bioFlower(ci.b,top,h,wx,wz);if(f)blocks[bidx(lx,h+1,lz)]=f;
        else{const w=farmWild(wx,wz);if(w)blocks[bidx(lx,h+1,lz)]=w;}}   /* 6.39: a wild carrot now and then. Or, very rarely (6.44), not a carrot */
    }else if(top===B.SNOWGRASS||top===B.SAND){const f=bioFlower(ci.b,top,h,wx,wz);if(f)blocks[bidx(lx,h+1,lz)]=f;}
  }
  /* alien villages */
  stampVillages(blocks,x0,z0);
  /* theme parks */
  stampParks(blocks,x0,z0);
  /* buried dungeons + lone spawner vaults */
  stampWDungeons(blocks,x0,z0);
  stampCells(blocks,x0,z0);
  stampRoosts(blocks,x0,z0);
  mgStampChunk(blocks,x0,z0);
  return blocks;
}

