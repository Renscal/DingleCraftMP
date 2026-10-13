/* ----- armour that shows the skin underneath (6.36) -----
   Armour on a figure used to be plain coloured boxes that hid the skin completely. It is now a second skin: the same boxes
   as the body (features/p53b_skin.js), a little larger, wearing a picture with holes in it, so the face shows in the
   helmet's opening and the shirt at the shoulders and sides.
   One picture per armour material (iron, golden, diamond, dragon), painted here in the skin's own 64 x 64 layout, so the
   skin's box builder maps it with no new arithmetic: the helmet, the chestplate (body and arms) and the boots are painted
   where a skin keeps its first layer, the leggings (hips and legs) where it keeps its second. Every figure that wears a
   material shares that material's one picture and one THREE material: none is made per player.
   One builder (armorLayer) serves the player's own third-person figure (syncArmorModel) and the other players
   (ntPeerMesh), so the two cannot drift apart. The Hyperreal player is not touched. */
const ARMOR_TEX=[null,null,null,null];
/* how much larger than the limb each slot's boxes are, in skin pixels (helmet, chestplate, leggings, boots) */
const ARMOR_GROW=[1,1,0.5,1];
/* '#rrggbb' -> [r,g,b], scaled by k */
function armorShade(hex,k){const n=parseInt(hex.slice(1),16);return [clamp(Math.round((n>>16&255)*k),0,255),clamp(Math.round((n>>8&255)*k),0,255),clamp(Math.round((n&255)*k),0,255)];}
/* The picture for armour material m as raw pixels (64 x 64 RGBA, alpha 0 or 255). Plain arithmetic, no canvas: the suites
   read it as it is. */
function armorPixels(m){
  const px=new Uint8ClampedArray(64*64*4),col=ARM_M[m].col,main=armorShade(col,1),dark=armorShade(col,0.62),lite=armorShade(col,1.25).map((v,i)=>Math.max(v,Math.min(255,main[i]+38)));
  const put=(x,y,c)=>{const i=(y*64+x)*4;px[i]=c[0];px[i+1]=c[1];px[i+2]=c[2];px[i+3]=255;};
  const cut=(x,y)=>{px[(y*64+x)*4+3]=0;};
  /* a face of a box: its rectangle in the picture; fill rows r0..r1 of it (all columns), edged dark, lit along the top */
  const F=(B,layer2)=>skinFaces(layer2?B.ou:B.u,layer2?B.ov:B.v,B.w,B.h,B.d);
  const band=(r,r0,r1)=>{for(let y=r0;y<=r1;y++)for(let x=0;x<r[2];x++)put(r[0]+x,r[1]+y,(y===r1||x===0||x===r[2]-1)?dark:(y===r0?lite:main));};
  const hole=(r,x0,y0,x1,y1)=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)cut(r[0]+x,r[1]+y);};
  const SIDES=['px','nz','nx','pz'];
  /* helmet: the whole head, open underneath, a face opening with a nose guard, a slot over each ear, a crest on top */
  {const f=F(SKIN_BOXES.head);
    for(const k of SIDES)band(f[k],0,7);
    band(f.py,0,7);for(let y=1;y<=6;y++){put(f.py[0]+3,f.py[1]+y,lite);put(f.py[0]+4,f.py[1]+y,lite);}
    hole(f.nz,1,3,6,7);put(f.nz[0]+3,f.nz[1]+3,dark);put(f.nz[0]+4,f.nz[1]+3,dark);put(f.nz[0]+3,f.nz[1]+4,dark);put(f.nz[0]+4,f.nz[1]+4,dark);
    hole(f.px,3,4,4,5);hole(f.nx,3,4,4,5);}
  /* chestplate, body: front and back plates with a neck notch, straps over the shoulders, open sides, open below the ribs */
  {const f=F(SKIN_BOXES.body);
    band(f.nz,0,9);band(f.pz,0,9);hole(f.nz,3,0,4,1);hole(f.pz,3,0,4,0);
    for(let y=3;y<=6;y+=3)for(let x=2;x<=5;x++)put(f.nz[0]+x,f.nz[1]+y,lite);
    band(f.px,0,1);band(f.nx,0,1);band(f.px,7,9);band(f.nx,7,9);
    band(f.py,0,3);hole(f.py,2,1,5,2);}
  /* chestplate, arms: a shoulder guard and a bracer, with the elbow and the hand bare */
  for(const B of [SKIN_BOXES.armR,SKIN_BOXES.armL]){const f=F(B);
    band(f.py,0,3);for(const k of SIDES){band(f[k],0,3);band(f[k],7,9);}}
  /* boots: the bottom four rows of each leg, and the sole */
  for(const B of [SKIN_BOXES.legR,SKIN_BOXES.legL]){const f=F(B);
    for(const k of SIDES)band(f[k],8,11);
    band(f.ny,0,3);}
  /* leggings (the second layer): a belt round the hips, and each leg down to the boot with the back of the knee open */
  {const f=F(SKIN_BOXES.body,true);for(const k of SIDES)band(f[k],8,11);}
  for(const B of [SKIN_BOXES.legR,SKIN_BOXES.legL]){const f=F(B,true);
    for(const k of SIDES)band(f[k],0,8);
    hole(f.pz,1,4,2,5);
    put(f.nz[0]+1,f.nz[1]+5,lite);put(f.nz[0]+2,f.nz[1]+5,lite);}
  return px;
}
/* the shared picture and material for armour material m (made the first time anything wears it) */
function armorMat(m){
  if(ARMOR_TEX[m])return ARMOR_TEX[m].mat;
  const cv=skinCanvas(),px=armorPixels(m),g=cv.getContext&&cv.getContext('2d');
  if(g){
    const im=typeof g.createImageData==='function'&&typeof g.putImageData==='function'?g.createImageData(64,64):null;
    if(im&&im.data&&im.data.length===px.length){im.data.set(px);g.putImageData(im,0,0);}
    else{g.clearRect(0,0,64,64);for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;if(px[i+3]){g.fillStyle='rgb('+px[i]+','+px[i+1]+','+px[i+2]+')';g.fillRect(x,y,1,1);}}}
  }
  const tex=skinTexture(cv);tex.needsUpdate=true;
  const mat=new THREE.MeshLambertMaterial({map:tex,alphaTest:0.5,side:THREE.DoubleSide});
  ARMOR_TEX[m]={cv,tex,mat,px};
  return mat;
}
/* The armour boxes for a figure made by skinModel (S: head, chestA, aL, aR, lL, lR), all hidden. Returns
   {parts:[helmet boxes, chestplate boxes, leggings boxes, boots boxes], sync(ids)}: sync shows the slots worn (ids: four
   item ids, 0 or null for an empty slot) in each one's material, and returns the armour colours, slot by slot. */
function armorLayer(S){
  const parts=[[],[],[],[]],lay=[-1,-1,-1,-1];
  const add=(slot,par,B,second,cy)=>{
    const me=new THREE.Mesh(skinBoxGeo(second?B.ou:B.u,second?B.ov:B.v,B.w,B.h,B.d,ARMOR_GROW[slot],0,cy,0),armorMat(0));
    me.visible=false;me.armorSlot=slot;par.add(me);parts[slot].push(me);
  };
  const leg=-6*SKIN_PX;
  add(0,S.head,SKIN_BOXES.head,false,0);
  add(1,S.chestA,SKIN_BOXES.body,false,0);add(1,S.aR,SKIN_BOXES.armR,false,leg);add(1,S.aL,SKIN_BOXES.armL,false,leg);
  add(2,S.chestA,SKIN_BOXES.body,true,0);add(2,S.lR,SKIN_BOXES.legR,true,leg);add(2,S.lL,SKIN_BOXES.legL,true,leg);
  add(3,S.lR,SKIN_BOXES.legR,false,leg);add(3,S.lL,SKIN_BOXES.legL,false,leg);
  const sync=ids=>{
    const cols=['','','',''];
    for(let s=0;s<4;s++){
      const d=ids&&ids[s]?DEFS[ids[s]]:null,m=d&&d.armor?d.armor.m:-1;
      if(m>=0){cols[s]=ARM_M[m].col;if(lay[s]!==m){lay[s]=m;const mt=armorMat(m);for(const me of parts[s])me.material=mt;}}
      for(const me of parts[s])me.visible=m>=0;
    }
    return cols;
  };
  return {parts,sync};
}
