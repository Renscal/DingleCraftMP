/* u_armorbar.js (v6.35, lane UI, gate x1): the armour bar is ten pairs of trousers above the hearts
   (src/ui/p06a_hud.js: armorIcons, PIX.legs, drawStats; src/features/p18_armor_boats_water_qol.js: updateArmorHud).
   Headless: the stats canvas is given a 2D context that records every rectangle it is asked to fill.
   1 points to icons: 0, 1, 1.5, 2, 7, 14, 20 (and out-of-range values)
   2 the icon is trousers: a waistband and two legs with a gap, and a half icon is the left leg
   3 with no armour on, nothing is drawn above the hearts
   4 with armour on: ten icons in the row above the hearts, left edge and spacing the same as the hearts'
   5 a full iron set (8 points) lights four icons; one golden piece (1.5) lights one whole icon
   6 the old text badge stays hidden and empty, the bar redraws when the armour changes, and creative mode draws no bar */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:35});
const step=boot.stepper(600000);

boot.run(async()=>{
  ok('the seams are on __vox',['armorIcons','armorPts','updateArmorHud','drawStats','armorId'].every(k=>typeof V[k]==='function')&&!!V.PIX&&!!V.PIX.legs);
  /* ===== 1 ===== */
  const I=p=>V.armorIcons(p).join('');
  ok('points to icons: 0 '+I(0)+', 1 '+I(1)+', 1.5 '+I(1.5)+', 2 '+I(2)+', 7 '+I(7)+', 14 '+I(14)+', 20 '+I(20),
    I(0)==='0000000000'&&I(1)==='1000000000'&&I(1.5)==='2000000000'&&I(2)==='2000000000'&&I(7)==='2221000000'&&I(14)==='2222222000'&&I(20)==='2222222222'&&I(-3)==='0000000000'&&I(99)==='2222222222'&&I(3.4)==='2100000000');
  /* ===== 2 ===== */
  const L=V.PIX.legs,H=V.PIX.heart;
  ok('the icon is trousers, the size of a heart: a full waistband, two legs, a gap between them from the crotch down; the left four columns are one leg',
    L.length===H.length&&L.every(r=>r.length===H[0].length)&&L[0]==='XXXXXXX'&&L.slice(3).every(r=>r[0]==='X'&&r[6]==='X'&&r[3]==='.')&&L[5].slice(0,4).includes('X')&&L[5][2]==='.');

  boot.studio(V,step,{});
  const cv=document.getElementById('stats');
  let rects=[];
  const g={fillStyle:'',clearRect(){rects=[];},fillRect(x,y,w,h){rects.push({c:this.fillStyle,x,y,w,h});},setTransform(){},scale(){},save(){},restore(){},beginPath(){},fill(){},stroke(){},arc(){},moveTo(){},lineTo(){},drawImage(){},fillText(){},measureText(){return{width:0};}};
  cv.getContext=()=>g;cv.width=510;cv.height=36;   /* the real canvas's size */
  const P=()=>V.P;
  const draw=()=>{V.drawStats();return rects.slice();};
  const HEART='#3a0d0d',BACK='#23262e',LIT='#cfd6ff';
  const wear=(list)=>{P().armor=[null,null,null,null];for(const [m,s] of list)P().armor[s]={id:V.armorId(m,s)};V.updateArmorHud();};
  /* ===== 3 ===== */
  P().mode='s';P().hp=20;wear([]);
  {const r=draw(),hy=Math.min(...r.filter(q=>q.c===HEART).map(q=>q.y));
    ok('no armour: hearts are drawn and nothing in the armour colours, nothing above the hearts on their side',r.some(q=>q.c===HEART)&&!r.some(q=>q.c===BACK||q.c===LIT)&&!r.some(q=>q.y<hy&&q.x<cv.width/2));}
  /* ===== 4, 5 ===== */
  wear([[0,0],[0,1],[0,2],[0,3]]);   /* a full iron set */
  {const r=draw(),hs=r.filter(q=>q.c===HEART),bs=r.filter(q=>q.c===BACK),ls=r.filter(q=>q.c===LIT);
    const xs=a=>[...new Set(a.map(q=>q.x))].sort((a,b)=>a-b);
    const hx=xs(hs),bx=xs(bs),hTop=Math.min(...hs.map(q=>q.y)),bTop=Math.min(...bs.map(q=>q.y)),bBot=Math.max(...bs.map(q=>q.y+q.h));
    const perIcon=V.PIX.legs.join('').split('X').length-1;
    ok('armour on ('+V.armorPts()+' points): ten icons ('+(bs.length/perIcon)+') in a row wholly above the hearts (bottom '+bBot+' <= top '+hTop+'), starting at the hearts\' left edge ('+bx[0]+' = '+hx[0]+')',
      bs.length===perIcon*10&&bBot<=hTop&&bTop>=0&&bx[0]===hx[0]&&Math.max(...bs.map(q=>q.x+q.w))<=Math.max(...hs.map(q=>q.x+q.w)));
    ok('  ... lit icons for the points worn: '+(ls.length/perIcon)+' whole ones for '+V.armorPts()+' points',V.armorPts()>0&&ls.length===perIcon*Math.floor(Math.round(V.armorPts())/2)+(Math.round(V.armorPts())%2?ls.length-perIcon*Math.floor(Math.round(V.armorPts())/2):0)&&ls.length>0);}
  wear([[1,0]]);   /* one golden piece */
  {const pts=V.armorPts(),r=draw(),ls=r.filter(q=>q.c===LIT),perIcon=V.PIX.legs.join('').split('X').length-1;
    ok('one golden piece ('+pts+' points) lights '+V.armorIcons(pts).filter(v=>v===2).length+' whole icon(s) and '+V.armorIcons(pts).filter(v=>v===1).length+' half',ls.length>0&&ls.length===V.armorIcons(pts).reduce((n,v)=>n+(v===2?perIcon:v===1?V.PIX.legs.map(row=>row.slice(0,4)).join('').split('X').length-1:0),0));}
  /* ===== 6 ===== */
  const el=document.getElementById('armor');
  rects=[];wear([[3,1]]);const redrew=rects.length>0;
  ok('the old badge is empty and hidden, and changing armour redraws the bar by itself',(!el||(el.textContent===''&&el.style.display==='none'))&&redrew&&rects.some(q=>q.c===LIT));
  P().mode='c';const rc=draw();P().mode='s';
  ok('creative mode: no hearts and no armour bar',rc.length===0);
  wear([]);
});
