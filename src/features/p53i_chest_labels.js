/* ----- chest labels (6.63): a picture of an item on a chest's four sides -----
   The chest window has a small slot beside its X. Clicked with an item on the cursor, the slot takes a picture of that
   item (its id, as be.lbl on the chest's block entity) and the item stays on the cursor: a label is never an item, never
   in be.inv, never dropped (scatterBE drops be.inv only), so it cannot duplicate anything. Clicked with an empty cursor,
   or right-clicked, it clears. A label is saved and shared like the rest of the chest (the whole block entity travels).
   In the world: four flat pictures, one centred on each side (not the lid or the bottom), drawn with the item's own
   icon as a dropped item shows it, built within CHL_NEAR blocks of the player and rebuilt when the label changes. */
const CHLM=new Map();                              /* block key -> {G: THREE.Group, id} */
const CHL_MAT={};                                  /* item id -> the material all its pictures share */
const CHL_NEAR=48,CHL_SIZE=0.5,CHL_OUT=0.502;
/* the material for one item's picture: its icon, see-through where the icon is */
function chlMat(id){
  if(CHL_MAT[id])return CHL_MAT[id];
  return CHL_MAT[id]=new THREE.MeshBasicMaterial({map:iconTex(id).map,transparent:true,alphaTest:0.5});
}
/* is this a label a chest may show? */
const chlOK=id=>Number.isInteger(id)&&id>0&&!!DEFS[id];
/* build (or take away) the pictures on the chest at x,y,z, from what its block entity says now */
function chestLabelRefresh(x,y,z){
  const k=bkey(x,y,z),cur=CHLM.get(k);
  if(cur){scene.remove(cur.G);CHLM.delete(k);}
  const be=blockEnts.get(k);
  if(!be||be.t!=='chest'||!chlOK(be.lbl)||getBlock(x,y,z)!==B.CHEST)return;
  const G=new THREE.Group(),geo=new THREE.PlaneGeometry(CHL_SIZE,CHL_SIZE),mat=chlMat(be.lbl);
  for(let i=0;i<4;i++){                            /* +z, +x, -z, -x: each faces out of its side */
    const m=new THREE.Mesh(geo,mat),a=i*Math.PI/2;
    m.position.set(Math.sin(a)*CHL_OUT,0,Math.cos(a)*CHL_OUT);
    m.lookAt(Math.sin(a)*2,0,Math.cos(a)*2);
    G.add(m);
  }
  G.position.set(x+0.5,y+0.5,z+0.5);
  G.name='chestLabel';
  scene.add(G);
  CHLM.set(k,{G,id:be.lbl});
}
/* every half second or so: pictures for the labelled chests near the player, none for the rest */
function tickChestLabels(){
  if(frameCount%30!==0)return;
  for(const [k,be] of blockEnts){
    if(be.t!=='chest')continue;
    const p=dimP(k);
    if(!p)continue;
    const x=+p[0],y=+p[1],z=+p[2],near=Math.hypot(x+0.5-P.x,z+0.5-P.z)<CHL_NEAR,want=near&&chlOK(be.lbl)&&!!chunkAt(x,z);
    const have=CHLM.get(k);
    if(want&&(!have||have.id!==be.lbl||!have.G.parent))chestLabelRefresh(x,y,z);
    else if(!want&&have){scene.remove(have.G);CHLM.delete(k);}   /* far, unlabelled or unloaded: just take them away */
  }
  for(const [k,h] of CHLM){                        /* the chest is gone, or in another dimension now */
    const be=blockEnts.get(k),p=dimP(k);
    if(!be||!p||be.t!=='chest'||getBlock(+p[0],+p[1],+p[2])!==B.CHEST){scene.remove(h.G);CHLM.delete(k);}
  }
}
/* the slot beside the chest window's X: shown for a chest only, the X's own size, the label's picture in it */
function chestLabelSlot(){
  const el=$('mlabel');
  if(!el)return;
  const be=MODAL.kind==='chest'?MODAL.be:null;
  el.hidden=!be;
  if(!be)return;
  const x=$('mclose'),w=(x&&x.offsetWidth)||30,h=(x&&x.offsetHeight)||30;   /* exactly the X's size, at any UI scale */
  el.style.width=w+'px';el.style.height=h+'px';el.style.right=(8+w+4)+'px';
  const cv=el.firstElementChild||el.firstChild;
  if(cv&&cv.getContext){const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,cv.width,cv.height);
    if(chlOK(be.lbl)){const ic=getIcon(be.lbl);if(ic)g.drawImage(ic,0,0,cv.width,cv.height);}}
  el.title=chlOK(be.lbl)?'Label: '+DEFS[be.lbl].name+' (click with an empty hand to clear)':'Label: click with an item to show it on the chest';
}
/* a click on that slot: an item on the cursor labels the chest with it (the item stays on the cursor); an empty cursor,
   or the right button, clears the label */
function chestLabelClick(right){
  const be=MODAL.kind==='chest'?MODAL.be:null;
  if(!be)return false;
  if(!right&&cursorStack&&chlOK(cursorStack.id))be.lbl=cursorStack.id;else delete be.lbl;
  const p=MODAL.bek&&dimP(MODAL.bek);
  if(p)chestLabelRefresh(+p[0],+p[1],+p[2]);
  chestLabelSlot();playS('click');
  return true;
}
{
  const el=$('mlabel');
  if(el){el.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();chestLabelClick(ev.button===2);});
    el.addEventListener('contextmenu',ev=>ev.preventDefault());}
}
