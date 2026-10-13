/* ----- the player model and skins (6.24) ----- */
/* The OG player is a blocky figure wearing a skin: a 64x64 picture in the standard layout (a head, a body, two arms, two
   legs, each unfolded into six faces, and a second layer over each for hats, jackets, sleeves and trousers). Arms are the
   classic 4 pixels wide. One builder (skinModel) makes the body for the player's own third-person view and for the other
   players on a server; the Hyperreal model is its own thing and is not touched.
   Sizes: the figure is 32 pixels and 1.8 blocks tall, so a pixel is 0.05625 of a block. Feet at y = 0, facing -z (the way
   the player looks), right arm on +x. The handles the rest of the game uses are the same as before: {G, head, aL, aR, lL, lR}
   (head turns about its centre; arms and legs hang from pivots at the shoulders and hips), plus helmA and chestA, the spots
   armour is hung on.
   A skin comes from a PNG the player picks in Settings: 64x64, or the older 64x32 (no second layer but the hat; the left
   arm and leg are the right ones mirrored). Nothing is fetched from anywhere. It is kept in this browser (storage key
   vxskin), not in a world. With no skin, the default is painted here: the orange hoodie and charcoal trousers the game has
   always worn. */
const SKIN_PX=0.05625;
/* each box of the layout: where its base layer and its second layer start in the picture, and its size in pixels */
const SKIN_BOXES={
  head:{u:0,v:0,w:8,h:8,d:8,ou:32,ov:0,grow:0.5},
  body:{u:16,v:16,w:8,h:12,d:4,ou:16,ov:32,grow:0.25},
  armR:{u:40,v:16,w:4,h:12,d:4,ou:40,ov:32,grow:0.25},
  armL:{u:32,v:48,w:4,h:12,d:4,ou:48,ov:48,grow:0.25},
  legR:{u:0,v:16,w:4,h:12,d:4,ou:0,ov:32,grow:0.25},
  legL:{u:16,v:48,w:4,h:12,d:4,ou:0,ov:48,grow:0.25}};
const SKINS={cv:null,tex:null,url:'',img:null,def:null};

/* The six faces of a box unfolded at (u,v): each as [x, y, width, height] in the picture.
   px: the figure's right side (+x); nz: its front (-z); nx: its left; pz: its back; py: the top; ny: the underside. */
function skinFaces(u,v,w,h,d){
  return {px:[u,v+d,d,h],nz:[u+d,v+d,w,h],nx:[u+d+w,v+d,d,h],pz:[u+d+w+d,v+d,w,h],py:[u+d,v,w,d],ny:[u+d+w,v,w,d]};
}
/* The corners of each face of a box of half-sizes (X,Y,Z), in the order the picture is read: top-left, top-right,
   bottom-right, bottom-left AS SEEN FROM OUTSIDE. That one rule gives every face its mirroring: the front is read from the
   figure's right to its left, each side from the edge that meets the back... and so on round. The top is read with the
   back of the head at the top of its square; the underside with the front at the top. */
function skinCorners(X,Y,Z){
  return {
    nz:[[ X, Y,-Z],[-X, Y,-Z],[-X,-Y,-Z],[ X,-Y,-Z]],
    px:[[ X, Y, Z],[ X, Y,-Z],[ X,-Y,-Z],[ X,-Y, Z]],
    nx:[[-X, Y,-Z],[-X, Y, Z],[-X,-Y, Z],[-X,-Y,-Z]],
    pz:[[-X, Y, Z],[ X, Y, Z],[ X,-Y, Z],[-X,-Y, Z]],
    py:[[ X, Y, Z],[-X, Y, Z],[-X, Y,-Z],[ X, Y,-Z]],
    ny:[[ X,-Y,-Z],[-X,-Y,-Z],[-X,-Y, Z],[ X,-Y, Z]]};
}
const SKIN_NORM={nz:[0,0,-1],px:[1,0,0],nx:[-1,0,0],pz:[0,0,1],py:[0,1,0],ny:[0,-1,0]};
/* One box as raw buffers {p, n, u, ix}: w x h x d pixels (plus grow on every side), centred on (cx,cy,cz) in blocks,
   textured from the box unfolded at (u,v) in a 64x64 picture. */
function skinBoxData(u,v,w,h,d,grow,cx,cy,cz){
  const g=grow||0,X=(w/2+g)*SKIN_PX,Y=(h/2+g)*SKIN_PX,Z=(d/2+g)*SKIN_PX;
  const F=skinFaces(u,v,w,h,d),C=skinCorners(X,Y,Z),o={p:[],n:[],u:[],ix:[]};
  let k=0;
  for(const f of ['nz','px','nx','pz','py','ny']){
    const r=F[f],c=C[f],N=SKIN_NORM[f];
    const uv=[[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]];
    for(let i=0;i<4;i++){
      o.p.push(c[i][0]+cx,c[i][1]+cy,c[i][2]+cz);o.n.push(N[0],N[1],N[2]);
      o.u.push(uv[i][0]/64,1-uv[i][1]/64);
    }
    o.ix.push(k,k+3,k+2,k,k+2,k+1);                         /* top-left, bottom-left, bottom-right: counter-clockwise from outside */
    k+=4;
  }
  return o;
}
/* ...and as a geometry */
function skinBoxGeo(u,v,w,h,d,grow,cx,cy,cz){
  const o=skinBoxData(u,v,w,h,d,grow,cx,cy,cz),g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(o.p),3));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(o.n),3));
  g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(o.u),2));
  g.setIndex(o.ix);
  return g;
}
/* A 64x32 skin has no left arm or leg of its own: the copies that make them from the right ones, as
   [fromX, fromY, width, height, toX, toY] (each copied mirrored left to right). The two side faces swap places. */
function skinLegacyCopies(){
  const out=[];
  for(const [R,L] of [[SKIN_BOXES.armR,SKIN_BOXES.armL],[SKIN_BOXES.legR,SKIN_BOXES.legL]]){
    const a=skinFaces(R.u,R.v,R.w,R.h,R.d),b=skinFaces(L.u,L.v,L.w,L.h,L.d);
    for(const [from,to] of [['py','py'],['ny','ny'],['nz','nz'],['pz','pz'],['px','nx'],['nx','px']])
      out.push([a[from][0],a[from][1],a[from][2],a[from][3],b[to][0],b[to][1]]);
  }
  return out;
}
/* Is this file a skin? bytes: a Uint8Array of the whole file. {ok, w, h, why}: a PNG, 64x64 or 64x32, under 50 KB. */
function skinCheck(bytes){
  const SIG=[137,80,78,71,13,10,26,10];
  if(!bytes||bytes.length<33)return {ok:false,why:'That is not a PNG picture.'};
  for(let i=0;i<8;i++)if(bytes[i]!==SIG[i])return {ok:false,why:'That is not a PNG picture.'};
  if(bytes[12]!==73||bytes[13]!==72||bytes[14]!==68||bytes[15]!==82)return {ok:false,why:'That is not a PNG picture.'};
  if(bytes.length>50*1024)return {ok:false,why:'That picture is too big: a skin is under 50 KB.'};
  const be=i=>((bytes[i]<<24)|(bytes[i+1]<<16)|(bytes[i+2]<<8)|bytes[i+3])>>>0,w=be(16),h=be(20);
  if(w!==64||(h!==64&&h!==32))return {ok:false,w,h,why:'A skin is 64 x 64 pixels (or the older 64 x 32). This one is '+w+' x '+h+'.'};
  return {ok:true,w,h};
}
/* the bytes of a "data:image/png;base64,..." address (or of bare base64); null if it is not one */
function skinBytes(url){
  try{
    const b=(''+url).replace(/^data:image\/png;base64,/,'');
    if(!b||/[^A-Za-z0-9+/=]/.test(b))return null;
    const s=atob(b),a=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i);
    return a;
  }catch(e){return null;}
}

/* ----- the pictures ----- */
/* a blank 64x64 picture */
function skinCanvas(){const c=document.createElement('canvas');c.width=64;c.height=64;return c;}
/* The default skin, painted: skin-coloured head with dark hair and two eyes, a hoodie (orange unless told otherwise),
   charcoal trousers, dark shoes. Original art: flat colours laid out by the table above. */
function skinPaintDefault(cv,hoodie){
  const g=cv.getContext('2d');
  g.clearRect(0,0,64,64);
  const fill=(B,col)=>{const F=skinFaces(B.u,B.v,B.w,B.h,B.d);g.fillStyle=col;for(const k in F)g.fillRect(F[k][0],F[k][1],F[k][2],F[k][3]);return F;};
  const H=fill(SKIN_BOXES.head,'#e8b88f');
  g.fillStyle='#3a2a1e';
  g.fillRect(H.py[0],H.py[1],8,8);                          /* hair: the top, the back, a fringe and the sides */
  g.fillRect(H.pz[0],H.pz[1],8,6);g.fillRect(H.nz[0],H.nz[1],8,2);g.fillRect(H.px[0],H.px[1],8,3);g.fillRect(H.nx[0],H.nx[1],8,3);
  g.fillStyle='#ffffff';g.fillRect(H.nz[0]+1,H.nz[1]+4,2,1);g.fillRect(H.nz[0]+5,H.nz[1]+4,2,1);
  g.fillStyle='#2b2430';g.fillRect(H.nz[0]+2,H.nz[1]+4,1,1);g.fillRect(H.nz[0]+5,H.nz[1]+4,1,1);
  g.fillStyle='#a8644a';g.fillRect(H.nz[0]+3,H.nz[1]+6,2,1);
  const hd=hoodie||'#d9822b';
  const Bd=fill(SKIN_BOXES.body,hd);
  g.fillStyle='rgba(0,0,0,0.18)';g.fillRect(Bd.nz[0]+3,Bd.nz[1],2,12);g.fillRect(Bd.nz[0],Bd.nz[1]+10,8,2);   /* the zip and the hem */
  for(const k of ['armR','armL']){const A=fill(SKIN_BOXES[k],hd);g.fillStyle='#e8b88f';
    for(const f of ['nz','px','nx','pz'])g.fillRect(A[f][0],A[f][1]+10,A[f][2],2);g.fillRect(A.ny[0],A.ny[1],4,4);}   /* hands */
  for(const k of ['legR','legL']){const L=fill(SKIN_BOXES[k],'#34343a');g.fillStyle='#2b2b30';
    for(const f of ['nz','px','nx','pz'])g.fillRect(L[f][0],L[f][1]+10,L[f][2],2);g.fillRect(L.ny[0],L.ny[1],4,4);}   /* shoes */
  return cv;
}
/* a texture of a skin picture: hard pixels, no smoothing */
function skinTexture(cv){
  const t=new THREE.CanvasTexture(cv);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  return t;
}
/* draw a loaded picture into a skin picture: as it is if it is 64x64; a 64x32 one gets its left limbs made */
function skinDrawInto(cv,img){
  const g=cv.getContext('2d');
  g.clearRect(0,0,64,64);
  g.drawImage(img,0,0);
  if(img.height>=64)return;
  for(const c of skinLegacyCopies()){
    g.save();g.translate(c[4]+c[2],c[5]);g.scale(-1,1);
    g.drawImage(img,c[0],c[1],c[2],c[3],0,0,c[2],c[3]);
    g.restore();
  }
}
/* put a skin (a data address, or '' for the default) into a picture and its texture; done(ok) when it is there */
function skinLoadInto(cv,tex,url,hoodie,done){
  const fin=ok=>{if(tex)tex.needsUpdate=true;if(done)done(ok);};
  if(!url||typeof Image==='undefined'){skinPaintDefault(cv,hoodie);fin(!url);return;}
  const img=new Image();
  img.onload=()=>{try{skinDrawInto(cv,img);fin(true);}catch(e){skinPaintDefault(cv,hoodie);fin(false);}};
  img.onerror=()=>{skinPaintDefault(cv,hoodie);fin(false);};
  img.src=url;
}
/* this player's own skin picture and texture (made on first use) */
function skinOwn(){
  if(!SKINS.cv){SKINS.cv=skinCanvas();skinPaintDefault(SKINS.cv);SKINS.tex=skinTexture(SKINS.cv);}
  return SKINS;
}
/* Wear a skin (a "data:image/png;base64,..." address) or go back to the default (''). It is checked first; a bad one is
   refused with the reason. save: also keep it in this browser. Returns {ok, why}. */
function skinSet(url,save){
  url=url?''+url:'';
  if(url){const c=skinCheck(skinBytes(url));if(!c.ok)return c;}
  const S=skinOwn();
  S.url=url;
  skinLoadInto(S.cv,S.tex,url,null,()=>{skinPreview();});
  if(save){try{const p=url?window.storage.set('vxskin',url):window.storage.delete('vxskin');if(p&&p.catch)p.catch(()=>{});}catch(e){}}
  if(NET.on)ntSkinSend();
  return {ok:true};
}
/* at start-up: the skin kept in this browser, if there is one and it can be read (storage may refuse: then the default) */
function skinBoot(){
  try{
    const p=window.storage.get('vxskin');
    if(p&&p.then)p.then(r=>{if(r&&r.value)skinSet(''+r.value,false);}).catch(()=>{});
  }catch(e){}
}

/* ----- the body ----- */
/* A player's body wearing the skin in tex. The same handles as ever: G (the whole figure, feet at its origin), head,
   aL, aR, lL, lR; and helmA / chestA for armour. Nothing is added to the scene here. */
function skinModel(tex){
  const G=new THREE.Group();
  const base=new THREE.MeshLambertMaterial({map:tex});
  const over=new THREE.MeshLambertMaterial({map:tex,alphaTest:0.5,side:THREE.DoubleSide});
  const part=(B,par,cy)=>{
    par.add(new THREE.Mesh(skinBoxGeo(B.u,B.v,B.w,B.h,B.d,0,0,cy,0),base));
    par.add(new THREE.Mesh(skinBoxGeo(B.ou,B.ov,B.w,B.h,B.d,B.grow,0,cy,0),over));
  };
  const head=new THREE.Group();head.position.y=28*SKIN_PX;G.add(head);          /* its centre: it turns about that, and hats sit on it */
  part(SKIN_BOXES.head,head,0);
  const chestA=new THREE.Group();chestA.position.y=18*SKIN_PX;G.add(chestA);
  part(SKIN_BOXES.body,chestA,0);
  const limb=(B,x,y)=>{const piv=new THREE.Group();piv.position.set(x,y,0);G.add(piv);part(B,piv,-6*SKIN_PX);return piv;};
  const aR=limb(SKIN_BOXES.armR,6*SKIN_PX,24*SKIN_PX),aL=limb(SKIN_BOXES.armL,-6*SKIN_PX,24*SKIN_PX);
  const lR=limb(SKIN_BOXES.legR,2*SKIN_PX,12*SKIN_PX),lL=limb(SKIN_BOXES.legL,-2*SKIN_PX,12*SKIN_PX);
  return {G,head,aL,aR,lL,lR,shoes:null,helmA:head,chestA,skinned:true,skinMats:[base,over]};
}

/* ----- Settings ----- */
/* the small picture in Settings: the figure from the front and from the back, flat */
function skinPreview(){
  const pv=$('s_skinpv'),S=SKINS;
  if(!pv||!pv.getContext||!S.cv)return;
  const g=pv.getContext('2d'),k=4;
  g.imageSmoothingEnabled=false;g.clearRect(0,0,pv.width,pv.height);
  const put=(B,face,x,y,layer)=>{const F=skinFaces(layer?B.ou:B.u,layer?B.ov:B.v,B.w,B.h,B.d)[face];g.drawImage(S.cv,F[0],F[1],F[2],F[3],x*k,y*k,F[2]*k,F[3]*k);};
  for(const [face,ox,flip] of [['nz',1,false],['pz',19,true]])for(const layer of [0,1]){
    put(SKIN_BOXES.head,face,ox+4,0,layer);put(SKIN_BOXES.body,face,ox+4,8,layer);
    put(flip?SKIN_BOXES.armL:SKIN_BOXES.armR,face,ox,8,layer);put(flip?SKIN_BOXES.armR:SKIN_BOXES.armL,face,ox+12,8,layer);
    put(flip?SKIN_BOXES.legL:SKIN_BOXES.legR,face,ox+4,20,layer);put(flip?SKIN_BOXES.legR:SKIN_BOXES.legL,face,ox+8,20,layer);
  }
}
/* a file was picked in Settings */
function skinPick(file){
  if(!file)return;
  if(file.size>50*1024){showToast('That picture is too big: a skin is under 50 KB.');return;}
  if(typeof FileReader==='undefined')return;
  const fr=new FileReader();
  fr.onload=()=>{const r=skinSet(''+fr.result,true);showToast(r.ok?'Skin changed.':r.why);};
  fr.onerror=()=>showToast('That file could not be read.');
  fr.readAsDataURL(file);
}
{
  const f=$('s_skin');if(f&&f.addEventListener)f.addEventListener('change',()=>{skinPick(f.files&&f.files[0]);try{f.value='';}catch(e){}});
  const r=$('s_skinreset');if(r)r.onclick=()=>{skinSet('',true);showToast('Back to the default skin.');playS('click');};
  skinBoot();                                              /* the skin kept in this browser, if any */
}
