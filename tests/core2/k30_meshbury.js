/* k30_meshbury.js (v6.67, lane CORE2, gate x1): the mesher's shortcuts for what nobody can see (src/world/p03d_mesher.js).
   6.67 skips a block buried inside its chunk (stone in stone, water under water) before asking about its six faces,
   and a liquid works out its corner heights only when one of its faces shows. Nothing drawn may change:
   1 the mesh of 108 real chunks (land, sea, caves) is what 6.66's mesher made, vertex for vertex (golden hash)
   2 a 3 x 3 block of chunks filled at random with stone, water at every level, lava, ice, glass, leaves, sand, torches
     and air (seeded): the middle chunk's mesh is 6.66's too (every pairing of neighbours, chunk edges included)
   3 the shortcut is where it should be: after the special shapes, lava left out, and its tables built from faceVisible */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:67});
const GOLD_WORLD=1235046058,GOLD_MIX=-205636817;         /* made with the 6.66 build */

boot.run(async()=>{
  const B=V.B,CH=16,WH=80;
  ok('the seams are on __vox',['meshChunk','forceChunksNear'].every(k=>typeof V[k]==='function')&&!!V.chunks);
  V.startNewWorld('k30','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;
  const hashB=b=>{let h=0;for(const k of ['p','n','u','c','ix','l'])if(b[k])for(const v of b[k])h=(Math.imul(h,31)+Math.round(v*4096))|0;return h^b.vc;};
  const hashCh=ch=>{const bs=V.meshChunk(ch);let h=0;for(const k of ['op','cut','wat'])h=(Math.imul(h,17)+hashB(bs[k]))|0;return h;};

  /* ===== 1. real chunks ===== */
  {const chs=[];
    for(const [cx0,cz0] of [[200,200],[-300,40],[40,-500]]){
      for(let i=0;i<8;i++)for(let j=0;j<8;j++)V.forceChunksNear((cx0+i)*CH+8,(cz0+j)*CH+8);
      for(let i=1;i<7;i++)for(let j=1;j<7;j++)chs.push(V.chunks.get((cx0+i)+','+(cz0+j)));}
    let h=0,water=0;for(const ch of chs){h=(Math.imul(h,13)+hashCh(ch))|0;for(let k=0;k<ch.bl.length;k++)if(ch.bl[k]===B.WATER)water++;}
    ok('108 real chunks ('+((water/chs.length)|0)+' water blocks a chunk) mesh exactly as 6.66 did (hash '+h+')',chs.every(Boolean)&&h===GOLD_WORLD);}

  /* ===== 2. a random mixture ===== */
  {let a=670067;const R=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
    const ids=[B.AIR,B.STONE,B.STONE,B.WATER,B.WATER,B.WATER,B.LAVA,B.ICE,B.GLASS,B.LEAF_O,B.SAND,B.TORCH];
    const cx0=-900,cz0=900;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)V.forceChunksNear((cx0+i)*CH+8,(cz0+j)*CH+8);
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const ch=V.chunks.get((cx0+i)+','+(cz0+j));
      for(let k=0;k<ch.bl.length;k++){
        const y=Math.floor(k/CH)%WH;
        if(y<20||y>60){continue;}                          /* the band in between is the mixture; below and above stay as built */
        const id=R()<0.5?(R()<0.6?B.STONE:B.WATER):ids[Math.floor(R()*ids.length)];
        ch.bl[k]=id;ch.mt[k]=(id===B.WATER||id===B.LAVA)?Math.floor(R()*8):0;
      }
    }
    const mid=V.chunks.get(cx0+','+cz0),h=hashCh(mid);
    ok('a random mixture of 12 kinds of block meshes exactly as 6.66 did (hash '+h+')',h===GOLD_MIX);}

  /* ===== 3. the source ===== */
  {const s=boot.readSrc('world/p03d_mesher.js'),m=s.indexOf('function meshChunk('),body=s.slice(m,s.indexOf('\nfunction ',m+10)),
      at=body.indexOf('T[bl[i+SX]]'),liq=body.indexOf('addLiquid(bufs.wat'),cross=body.indexOf('if(d.cross)');
    ok('the buried test comes after the special shapes and before the liquids and the face loop',at>cross&&cross>0&&at<liq);
    ok('...leaves lava out, and builds its tables from opq and faceVisible',/id!==B\.LAVA&&lx>0/.test(body)&&/hidW\[i\]=faceVisible\(B\.WATER,i\)\?0:1/.test(body)&&/opq\[i\]=DEFS\[i\]\.opq\?1:0/.test(body));
    ok('a liquid asks for its corner heights only when a face shows',/if\(!vis\)return;\n  const H=/.test(s));}
});
