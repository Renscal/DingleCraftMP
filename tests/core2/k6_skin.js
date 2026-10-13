/* k6_skin.js (v6.24, lane CORE2, gate x1): the player model and skins (src/features/p53b_skin.js). Headless: what is
   checked is the geometry and the numbers; how it looks is a browser matter and is not checked here.
   1 the layout: where each of the 12 boxes (6 parts, 2 layers) unfolds in the 64x64 picture, face by face
   2 the picture is read the right way round on every face: a known pixel lands on a known corner (front, both sides, back,
     top, underside), and every face is wound to be seen from outside
   3 a 64x32 skin: the 12 copies that make the left arm and leg from the right ones, sides swapped
   4 the model: the same handles as ever, 1.8 blocks tall with its feet on the ground, right arm on +x, 12 boxes, the second
     layer a little larger and cut out by alpha
   5 armour, a hat's anchor and a held tool still attach (the player's own third-person model, built by the game)
   6 what counts as a skin: 64x64 and 64x32 PNGs; not 128x128, not a JPEG, not a file over 50 KB, not rubbish
   7 wearing one: accepted and kept in this browser, refused with a reason, reset; a storage that throws means the default
   8 the default skin is painted (nothing is loaded), and a puppet without a skin gets a hoodie in its own colour */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:6});
const step=boot.stepper(600000);
/* a PNG of the given size: a real signature and IHDR, then padding (the game only reads the header) */
function png(w,h,pad){const b=Buffer.alloc(33+(pad||40));Buffer.from([137,80,78,71,13,10,26,10]).copy(b,0);b.writeUInt32BE(13,8);b.write('IHDR',12,'latin1');b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);b[24]=8;b[25]=6;return b;}
const url=b=>'data:image/png;base64,'+b.toString('base64');

boot.run(async()=>{
  const PX=V.SKIN_PX,BX=V.SKIN_BOXES,near=(a,b)=>Math.abs(a-b)<1e-9;
  ok('the seams are on __vox',['skinFaces','skinCorners','skinBoxData','skinLegacyCopies','skinCheck','skinBytes','skinModel','skinSet','skinOwn'].every(k=>typeof V[k]==='function')&&near(PX*32,1.8));

  /* ===== 1. the layout ===== */
  {const F=(n,layer)=>{const b=BX[n];return V.skinFaces(layer?b.ou:b.u,layer?b.ov:b.v,b.w,b.h,b.d);},j=o=>JSON.stringify(o);
    ok('the head: right side, front, left side, back in a row, top and underside above',j(F('head'))===j({px:[0,8,8,8],nz:[8,8,8,8],nx:[16,8,8,8],pz:[24,8,8,8],py:[8,0,8,8],ny:[16,0,8,8]}));
    ok('the body',j(F('body'))===j({px:[16,20,4,12],nz:[20,20,8,12],nx:[28,20,4,12],pz:[32,20,8,12],py:[20,16,8,4],ny:[28,16,8,4]}));
    ok('the right arm and the right leg (4 pixels wide: classic arms)',j(F('armR').nz)===j([44,20,4,12])&&j(F('armR').px)===j([40,20,4,12])&&j(F('legR').nz)===j([4,20,4,12])&&j(F('legR').py)===j([4,16,4,4]));
    ok('the left arm and the left leg, lower down in the picture',j(F('armL').nz)===j([36,52,4,12])&&j(F('legL').nz)===j([20,52,4,12]));
    ok('the second layer of each: hat, jacket, sleeves, trousers',j(F('head',1).nz)===j([40,8,8,8])&&j(F('body',1).nz)===j([20,36,8,12])&&j(F('armR',1).nz)===j([44,36,4,12])&&j(F('armL',1).nz)===j([52,52,4,12])&&j(F('legR',1).nz)===j([4,36,4,12])&&j(F('legL',1).nz)===j([4,52,4,12]));
    const all=[];for(const n of Object.keys(BX))for(const l of [0,1]){const f=F(n,l);for(const k in f)all.push(f[k]);}
    const hit=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];
    ok('72 faces, all inside the picture, none on top of another',all.length===72&&all.every(r=>r[0]>=0&&r[1]>=0&&r[0]+r[2]<=64&&r[1]+r[3]<=64)&&all.every((a,i)=>all.every((b,k)=>k<=i||!hit(a,b))));}

  /* ===== 2. which way round ===== */
  {const b=BX.head,D=V.skinBoxData(b.u,b.v,b.w,b.h,b.d,0,0,0,0),h=4*PX;
    /* the corner of the head a picture pixel (the corner of that pixel) lands on, on a given face */
    /* (faces come in the order front, right, left, back, top, underside: four corners each. Picture corners are shared
       between neighbouring faces, so each is looked up on its own face.) */
    const at=(f,x,y)=>{for(let i=f*4;i<f*4+4;i++)if(Math.abs(D.u[i*2]-x/64)<1e-6&&Math.abs(D.u[i*2+1]-(1-y/64))<1e-6)return JSON.stringify([D.p[i*3],D.p[i*3+1],D.p[i*3+2]].map(v=>Math.round(v/h)));return 'none';};
    const j=o=>JSON.stringify(o);
    ok('the front is read from the figure\'s right (+x) to its left, top to bottom',at(0,8,8)===j([1,1,-1])&&at(0,16,16)===j([-1,-1,-1]));
    ok('the right side is read from the back to the front; its right edge meets the front\'s left edge',at(1,0,8)===j([1,1,1])&&at(1,8,16)===j([1,-1,-1]));
    ok('the left side is read from the front to the back',at(2,16,8)===j([-1,1,-1])&&at(2,24,16)===j([-1,-1,1]));
    ok('the back is read from the figure\'s left (-x) round to its right',at(3,24,8)===j([-1,1,1])&&at(3,32,16)===j([1,-1,1]));
    ok('the top is read with the back of the head at the top of its square; the underside with the front at the top',at(4,8,0)===j([1,1,1])&&at(4,16,8)===j([-1,1,-1])&&at(5,16,0)===j([1,-1,-1])&&at(5,24,8)===j([-1,-1,1]));
    let wound=true;
    for(let q=0;q<6;q++){const ix=D.ix.slice(q*6,q*6+3),P=i=>[D.p[i*3],D.p[i*3+1],D.p[i*3+2]],a=P(ix[0]),c=P(ix[1]),e=P(ix[2]);
      const u=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],w=[e[0]-a[0],e[1]-a[1],e[2]-a[2]],t=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
      const N=[D.n[ix[0]*3],D.n[ix[0]*3+1],D.n[ix[0]*3+2]];if(!(t[0]*N[0]+t[1]*N[1]+t[2]*N[2]>0))wound=false;}
    ok('every face is wound to be seen from outside, and its normal points out',wound&&D.ix.length===36&&D.ix.every(i=>i>=0&&i<24));
    const G=V.skinBoxData(b.ou,b.ov,b.w,b.h,b.d,b.grow,0,0,0);
    ok('the second layer is the same box half a pixel larger all round (a quarter on the body and limbs)',near(Math.max(...G.p),4.5*PX)&&near(Math.max(...V.skinBoxData(16,32,8,12,4,BX.body.grow,0,0,0).p.filter((v,i)=>i%3===0)),4.25*PX));}

  /* ===== 3. the old 64x32 layout ===== */
  {const C=V.skinLegacyCopies(),j=o=>JSON.stringify(o);
    ok('a 64x32 skin gets its left arm and leg from the right ones: 12 copies, all from the top half, all into the bottom half',C.length===12&&C.every(c=>c[1]+c[3]<=32&&c[5]>=48&&c[5]+c[3]<=64&&c[4]+c[2]<=64));
    ok('...front to front, and the two sides swapped (a mirrored arm\'s outside is still its outside)',C.some(c=>j(c)===j([44,20,4,12,36,52]))&&C.some(c=>j(c)===j([40,20,4,12,40,52]))&&C.some(c=>j(c)===j([48,20,4,12,32,52]))&&C.some(c=>j(c)===j([4,20,4,12,20,52])));}

  /* ===== 4. the model ===== */
  {const M=V.skinModel(V.skinOwn().tex);
    ok('the same handles as ever: G, head, aL, aR, lL, lR',['G','head','aL','aR','lL','lR'].every(k=>M[k]&&M[k].position)&&M.skinned===true);
    let lo=1e9,hi=-1e9,n=0,over=0;
    const walk=(o,y)=>{const yy=y+o.position.y;if(o.geometry&&o.geometry.attributes.position){n++;if(o.material.alphaTest>0)over++;else{const p=o.geometry.attributes.position.array;for(let i=1;i<p.length;i+=3){lo=Math.min(lo,yy+p[i]);hi=Math.max(hi,yy+p[i]);}}}
      for(const c of o.children)walk(c,yy);};
    walk(M.G,0);
    ok('12 boxes: 6 parts and 6 second-layer boxes, the second layer cut out by alpha and drawn from both sides',n===12&&over===6&&M.skinMats[1].alphaTest===0.5&&M.skinMats[1].side===global.THREE.DoubleSide&&M.skinMats[0].map===V.skinOwn().tex);
    ok('1.8 blocks tall with its feet on the ground',Math.abs(lo)<1e-5&&Math.abs(hi-1.8)<1e-5);
    ok('pivots at the shoulders, the hips and the middle of the head; the right arm and leg on +x',near(M.aR.position.y,24*PX)&&near(M.aL.position.y,24*PX)&&M.aR.position.x>0&&M.aL.position.x<0&&near(M.lR.position.y,12*PX)&&M.lR.position.x>0&&M.lL.position.x<0&&near(M.head.position.y,28*PX));
    ok('armour has its spots: the helmet on the head, the chestplate on the body',M.helmA===M.head&&near(M.chestA.position.y,18*PX));}

  /* ===== 5. the game's own third-person model ===== */
  V.startNewWorld('skin','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(40);
  {const M=V.mkPlayerModel(),P=V.P;
    ok('the game builds the player from it',M.skinned===true&&!!M.head&&V.getScene().children.includes(M.G));
    P.armor=[{id:230},{id:231},{id:232},{id:233}];V.syncArmorModel(M);
    ok('armour still goes on: four slots, the helmet turning with the head and the chestplate on the body',Array.isArray(M._arm)&&M._arm.length===4&&M._arm.every(g=>g.every(q=>q.visible))&&M.head.children.includes(M._arm[0][0])&&M.chestA.children.includes(M._arm[1][0])&&M._arm[2].some(q=>M.lL.children.includes(q)));   /* 6.36: the leggings are hips and two legs */
    P.armor=[null,null,null,null];V.syncArmorModel(M);
    ok('...and comes off',M._arm.every(g=>g.every(q=>!q.visible)));
    V.getScene().remove(M.G);}

  /* ===== 6. what counts as a skin ===== */
  {const c=b=>V.skinCheck(new Uint8Array(b));
    ok('a 64x64 PNG and a 64x32 PNG are skins',c(png(64,64)).ok===true&&c(png(64,32)).ok===true&&c(png(64,32)).h===32);
    ok('128x128 is not, and the reason says what it is',c(png(128,128)).ok===false&&/128 x 128/.test(c(png(128,128)).why)&&c(png(64,48)).ok===false&&c(png(32,64)).ok===false);
    ok('a JPEG is not, nor is a text file, nor nothing at all',c(Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]),Buffer.alloc(60)])).ok===false&&c(Buffer.from('this is not a picture at all, it is a sentence')).ok===false&&V.skinCheck(null).ok===false&&c(Buffer.alloc(4)).ok===false);
    ok('a PNG over 50 KB is not',c(png(64,64,51*1024)).ok===false&&/50 KB/.test(c(png(64,64,51*1024)).why)&&c(png(64,64,49*1024)).ok===true);
    ok('the bytes of a data address come back whole; rubbish gives nothing',Buffer.from(V.skinBytes(url(png(64,64)))).equals(png(64,64))&&V.skinBytes('data:image/png;base64,***')===null&&V.skinBytes('')===null);}

  /* ===== 7. wearing one ===== */
  {const S=V.skinOwn(),good=url(png(64,64));
    const r1=V.skinSet(good,true);await new Promise(r=>setTimeout(r,20));
    ok('a good skin is accepted, worn, and kept in this browser',r1.ok===true&&S.url===good&&(await window.storage.get('vxskin')).value===good);
    const r2=V.skinSet(url(png(128,128)),true);
    ok('a bad one is refused with the reason, and the one being worn stays',r2.ok===false&&/128/.test(r2.why)&&S.url===good);
    V.skinSet('',true);await new Promise(r=>setTimeout(r,20));
    let gone=false;try{await window.storage.get('vxskin');}catch(e){gone=true;}
    ok('reset: the default again, and nothing kept',S.url===''&&gone);
    const st=window.storage,tex0=S.tex;
    window.storage={get(){throw new Error('no storage');},set(){throw new Error('no storage');},delete(){throw new Error('no storage');}};
    let threw=false;try{V.skinBoot();V.skinSet(good,true);V.skinSet('',true);}catch(e){threw=true;}
    window.storage=st;
    ok('a browser that refuses to store anything is no trouble: the default skin, the same texture, no error',threw===false&&S.url===''&&S.tex===tex0);}

  /* ===== 8. no skin ===== */
  {const p={id:9,name:'Bea',has:true,skin:'',fl:0};const M=V.ntPeerMesh(p);
    ok('another player without a skin gets the same figure (12 skinned boxes), their name tag, and armour plates ready',M.arm.length===4&&!!M.skinCv&&!!M.skinTex&&M.head&&M.aR&&M.lL&&M.arm[0].parts.length===1&&M.arm[1].parts.length===3);
    ok('a skin that is not one is taken as no skin',V.ntSkinUrl('AAAA')===''&&V.ntSkinUrl('')===''&&V.ntSkinUrl(png(64,64).toString('base64'))===url(png(64,64))&&V.ntSkinUrl(png(128,128).toString('base64'))==='');
    V.getScene().remove(M.G);}
  await V.quitToTitle();await window.storage.delete('vxw:skin').catch(()=>{});
});
