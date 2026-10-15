/* k26_chestlabel.js (v6.63, lane CORE2, gate x1): chest labels, a picture of an item on a chest's four sides.
   1 the slot: shown beside the X for a chest only, the X's size; hidden for every other window and once closed
   2 a click with an item on the cursor labels the chest with that item (its id), and the cursor keeps the very same
     stack: no item anywhere changes in number; an empty cursor clears it, and so does the right button with an item
   3 the slot is not a slot: never in MODAL.slots, so shift-click, collecting and the rest cannot reach it
   4 breaking a labelled chest drops what it held and nothing more; a label is not an item
   5 in the world: four pictures, one centred on each side (none on the lid or the bottom), the item's own icon; a new
     label rebuilds them, an empty one, a broken chest or walking away takes them away
   6 a label is saved with the world and comes back with it; it travels like the rest of the chest (ntBeSig)
   7 the markup, the style and the Controls screen
   8 the real server: a label one player puts on a chest reaches the server's world, its world file and another player */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({seed:63});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||3000)){if(f())return true;await sleep(5);}return !!f();}
const step=boot.stepper(700000);
const HH=fs.readFileSync(boot.BUILD+'head.html','utf8');

boot.run(async()=>{
  ok('the seams are on __vox',['chestLabelRefresh','chestLabelClick','chestLabelSlot','tickChestLabels','openModal','closeModal','getCursor','setCursor'].every(k=>typeof V[k]==='function')&&V.CHLM instanceof Map);
  V.startNewWorld('k26','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(160);
  const B=V.B,IT=V.IT,P=()=>V.P;
  const x=Math.floor(P().x)+2,z=Math.floor(P().z),y=Math.floor(P().y);
  V.setBlock(x,y-1,z,B.STONE);V.setBlock(x,y,z,B.CHEST);const k=x+','+y+','+z;const be=V.ensureBE(x,y,z,'chest');
  be.inv[0]={id:IT.DIAMOND,count:5};be.inv[4]={id:B.COBBLE,count:64};
  const el=()=>document.getElementById('mlabel');
  /* every item there is, by id: inventory, the chest, the cursor and anything lying on the ground */
  const total=()=>{const m={},add=s=>{if(s)m[s.id]=(m[s.id]||0)+s.count;};P().inv.forEach(add);be.inv.forEach(add);add(V.getCursor());
    for(const e of V.entities)if(e.t==='drop'&&!e.dead)add(e.st);return JSON.stringify(Object.keys(m).sort().map(i=>[i,m[i]]));};

  /* ===== 1. the slot ===== */
  V.openModal('chest',k);
  ok('opening a chest shows the label slot beside the X',V.getMODAL().kind==='chest'&&el().hidden===false);
  V.closeModal(true);
  ok('...and closing it hides it again',el().hidden===true);
  V.openModal('inv');ok('the inventory has no label slot',el().hidden===true);V.closeModal(true);
  V.openModal('craft');ok('nor a crafting table',el().hidden===true);V.closeModal(true);

  /* ===== 2. labelling ===== */
  V.openModal('chest',k);
  P().inv[3]={id:IT.IRON,count:7};const before=total();
  V.setCursor({id:IT.IRON,count:7});P().inv[3]=null;          /* picked up: the stack is on the cursor now */
  const cur=V.getCursor();
  V.chestLabelClick(false);
  ok('a click with iron on the cursor labels the chest with iron',be.lbl===IT.IRON);
  ok('...and the cursor keeps the very same stack, 7 iron',V.getCursor()===cur&&cur.id===IT.IRON&&cur.count===7);
  ok('...and no item anywhere changed in number',total()===before);
  V.setCursor({id:IT.DIAMOND,count:1});V.chestLabelClick(false);
  ok('another item on the cursor replaces the label',be.lbl===IT.DIAMOND&&V.getCursor().count===1);
  V.setCursor({id:IT.IRON,count:7});V.chestLabelClick(true);
  ok('the right button clears it, item on the cursor or not',!('lbl' in be)&&V.getCursor().count===7);
  V.chestLabelClick(false);ok('...and is put back with a left click',be.lbl===IT.IRON);
  V.setCursor(null);V.chestLabelClick(false);
  ok('a click with an empty cursor clears it',!('lbl' in be));
  V.setCursor({id:IT.IRON,count:7});V.chestLabelClick(false);V.setCursor(null);P().inv[3]={id:IT.IRON,count:7};

  /* ===== 3. not a slot ===== */
  ok('the label is not one of the window\'s slots (nothing that moves items can reach it)',V.getMODAL().slots.every(s=>s.el!==el())&&V.getMODAL().slots.length===27+36);
  {const b0=total();V.imCollectAll&&V.imCollectAll(V.getMODAL().slots[0]);V.closeModal(true);
    ok('collecting and closing the window change nothing about the label or the items',be.lbl===IT.IRON&&total()===b0);}

  /* ===== 5. in the world ===== */
  step(31);
  {const h=V.CHLM.get(k);
    ok('the chest shows the iron on its sides (4 pictures)',!!h&&h.id===IT.IRON&&h.G.children.length===4);
    const c=h.G.children.map(m=>[+m.position.x.toFixed(3),+m.position.y.toFixed(3),+m.position.z.toFixed(3)]);
    ok('one centred on each side, just outside it; none on the lid or the bottom ('+JSON.stringify(c)+')',
      JSON.stringify(c.map(p=>p.join()).sort())===JSON.stringify(['-0.502,0,0','0,0,-0.502','0,0,0.502','0.502,0,0'])&&
      Math.abs(h.G.position.x-(x+0.5))<1e-9&&Math.abs(h.G.position.y-(y+0.5))<1e-9&&Math.abs(h.G.position.z-(z+0.5))<1e-9);
    ok('each picture is the item\'s own icon, half a block wide (where the test THREE measures it)',h.G.children.every(m=>m.material.map===h.G.children[0].material.map&&!!m.material.map&&(!m.geometry.parameters||m.geometry.parameters.width===undefined||m.geometry.parameters.width===0.5)));}
  be.lbl=IT.DIAMOND;step(31);
  ok('a new label (another player, say) rebuilds them',V.CHLM.get(k).id===IT.DIAMOND);
  delete be.lbl;step(31);ok('no label: no pictures',!V.CHLM.has(k));
  be.lbl=IT.IRON;step(31);
  {const px=P().x;P().x=px+80;step(31);ok('walking 80 blocks away takes them away',!V.CHLM.has(k));P().x=px;step(31);ok('...and coming back puts them back',V.CHLM.has(k));}

  /* ===== 6. saved and shared ===== */
  {const s=JSON.parse(JSON.stringify(V.snapshot('k26')));V.applySave(s);V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(40);
    const b2=V.blockEnts.get(k);
    ok('a label is saved with the world and comes back with it',!!b2&&b2.lbl===IT.IRON&&b2.inv[0].count===5);
    step(31);ok('...pictures and all',V.CHLM.has(k));
    ok('it travels with the rest of the chest (its change signature includes it)',typeof V.ntBeSig!=='function'||V.ntBeSig(b2).includes('"lbl":'+IT.IRON));}

  /* ===== 4. breaking it ===== */
  {for(const e of V.entities)if(e.t==='drop')e.dead=true;
    const b3=V.blockEnts.get(k),held=b3.inv.filter(Boolean).reduce((a,s)=>a+s.count,0);
    P().mode='s';V.breakBlock(x,y,z,true);step(3);
    const drops=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st);
    const n=drops.reduce((a,s)=>a+s.count,0),irons=drops.filter(s=>s.id===IT.IRON).length;
    ok('breaking a labelled chest drops what it held and the chest ('+n+' items), no iron for the label',n===held+1&&irons===0);
    step(31);ok('...and its pictures are gone',!V.CHLM.has(k));}

  /* ===== 7. the html ===== */
  ok('the markup: #mlabel beside #mclose in the window, with a canvas, hidden at first',/id="mclose"[^>]*>[^<]*<\/button>\s*<div id="mlabel" hidden[^>]*><canvas/.test(HH));
  ok('the style: the slot look, square, top right',/#mlabel\{position:absolute;top:8px;[^}]*border-color:#373737 #fff #fff #373737\}/.test(HH)&&/#mlabel\[hidden\]\{display:none\}/.test(HH));
  ok('the Controls screen says how to label a chest (Inventory section)',/<div class="krow"><b>Chest label<\/b> <span>click the small slot beside a chest window/.test(HH)&&HH.indexOf('<b>Chest label</b>')>HH.indexOf('<h3>Inventory</h3>')&&HH.indexOf('<b>Chest label</b>')<HH.indexOf('<section class="hsec" data-sec="ride"'));

  /* ===== 8. the real server ===== */
  {const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
    const {createServer}=await lib('dinglecraft-server.mjs'),R=await lib('lib/region.mjs');
    const OUT=path.join(outDir('core2'),'k26_'+process.pid);fs.rmSync(OUT,{recursive:true,force:true});
    const S=createServer({port:0,data:OUT,world:'world',noGame:true,quiet:true,seed:'63',accounts:false});await S.listen();
    const join=async name=>{const ws=new WebSocket('ws://127.0.0.1:'+S.port),C={got:[],send:m=>ws.send(JSON.stringify(m)),close:()=>ws.close()};
      ws.onmessage=e=>C.got.push(JSON.parse(e.data));await new Promise((r,j)=>{ws.onopen=r;ws.onerror=()=>j(new Error('socket'));});
      C.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name});await until(()=>C.got.some(m=>m.t==='ready'));
      C.send({t:'pose',x:5,y:40,z:5,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0});await sleep(60);return C;};
    const a=await join('Ann'),b=await join('Bob'),bk='6,40,6';
    a.send({t:'be',k:bk,v:{t:'chest',inv:[{id:IT.DIAMOND,count:2}],lbl:IT.IRON}});
    await until(()=>S.world().be[bk]&&S.world().be[bk].lbl===IT.IRON,2000);
    ok('a labelled chest from one player: the server keeps the label',!!S.world().be[bk]&&S.world().be[bk].lbl===IT.IRON);
    await until(()=>b.got.some(m=>m.t==='be'&&m.k===bk),2000);
    ok('...and the other player gets it',b.got.some(m=>m.t==='be'&&m.k===bk&&m.v&&m.v.lbl===IT.IRON));
    S.saveWorld('k26');
    const doc=R.readWorldFile(path.join(OUT,'world'),'region/over/r.0.0.dcr').doc,be2=doc.chunks['0,0'].blockEntities[bk];
    ok('...and the world file holds it (the packed region keeps it)',!!be2&&be2.lbl===IT.IRON&&be2.inv[0].count===2);
    a.close();b.close();await S.close();fs.rmSync(OUT,{recursive:true,force:true});}
});
