/* k17_poison.js (v6.40, lane CORE2, gate x1): poison (src/features/p53f_poison.js).
   1 the things: Glass Bottle (three glass), Jar of Poison (a hemlock root and a bottle), and a watering can is made empty
   2 the effect: 1 damage every 1.25 s, never below 1 health, for its time and no longer; hearts drawn green meanwhile; a
     save keeps it; creative and spectators are not poisoned
   3 eating a hemlock root always poisons
   4 a jar with a food: one piece of that food, poisoned, that looks like any other (same id, same name, nothing shown)
   5 the owner's example: 1 poisoned beef among 19. Over many stacks the poisoned piece is found at each of the 20 bites
     about equally often, exactly once a stack, and a stack with none never poisons
   6 merging adds the hidden counts; splitting sends each poisoned piece one way or the other by chance and never makes
     or loses one: 1,000 random operations on the real window (halves, single pieces, merges, drags, shift-clicks, throws
     and pick-ups) with the count of poisoned pieces checked after every one
   7 a jar with a sword: the same sword (wear and enchantments kept) with 10 poisoned hits, shown in its name; each hit on
     a mob spends one and poisons the mob, which loses health over time but is not killed by it
   8 the dropped item and the saved game keep both marks; the server's stack cleaner keeps them and refuses nonsense */
'use strict';
const path=require('path'),{pathToFileURL}=require('url');
const boot=require('../lib/c_boot.js'),{ok}=boot;
const {REPO}=require('../lib/paths.js');
const V=boot({seed:40});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IT=V.IT,D=V.DEFS,PSN=V.PSN;
  ok('the seams are on __vox',['psnDraw','psnSplit','psnMoved','psnCraft','psnHit','psnBite','fxPoison','fxTick','fxPoisoned','calcCraft','stackPart','slotClick','quickMove'].every(k=>typeof V[k]==='function')&&!!PSN);
  let rs=12345;const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
  PSN.rnd=rnd;
  /* ===== 1 ===== */
  const craft=(list,w)=>{const g=Array(9).fill(null);list.forEach((s,i)=>{if(s)g[i]=typeof s==='number'?{id:s,count:1}:s;});return V.calcCraft(g,3);};
  const bot=craft([B.GLASS,0,B.GLASS,0,B.GLASS]),jar=craft([IT.HROOT,IT.BOTTLE]),can=craft([IT.IRON,0,IT.IRON,IT.IRON,IT.BUCKET,IT.IRON,0,IT.IRON]);
  ok('three glass make '+(bot&&bot.count)+' Glass Bottles; a hemlock root and a bottle make a Jar of Poison; a watering can is made empty',
    !!bot&&bot.id===IT.BOTTLE&&bot.count===3&&!!jar&&jar.id===IT.POISON&&jar.count===1&&D[IT.POISON].name==='Jar of Poison'&&!!can&&can.id===IT.WCAN&&can.dur===0&&V.wcanUses(can)===0);

  const o=boot.studio(V,step,{});V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;
  const P=()=>V.P;
  const rest=()=>{const p=P();p.mode='s';p.spec=false;p.dead=false;p.hp=20;p.hunger=20;p.fx={};p.hurtT=0;p.x=o.x+0.5;p.z=o.z+0.5;p.y=o.y;p.vx=p.vy=p.vz=0;for(const e of V.entities)if(e.mob||e.t==='drop')e.dead=true;};
  /* ===== 2 ===== */
  rest();V.fxPoison(5);const hp=[];for(let i=0;i<140;i++){step(1);if(i%25===24)hp.push(P().hp);}
  ok('5 seconds of poison: health '+hp.join(' ')+' (one a 1.25 s, four in all), then it is over',hp[hp.length-1]===16&&!V.fxPoisoned()&&hp[1]<20);
  rest();P().hp=3;V.fxPoison(30);for(let i=0;i<400;i++)step(1);
  ok('30 seconds of poison from 3 health: it stops at '+P().hp+' and does not kill',P().hp===1&&!P().dead);
  {rest();V.fxPoison(20);step(5);const snap=JSON.parse(JSON.stringify(V.snapshot('psn')));const t=snap.player.fx&&snap.player.fx.poison&&snap.player.fx.poison.t;
    P().fx={};V.applySave(snap);step(45);
    ok('a save keeps the poison ('+t+' s left) and it goes on after loading',t>18&&t<=20&&V.fxPoisoned()&&V.P.hp<20);V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;}
  {const cv=document.getElementById('stats');let cols=new Set();const g={fillStyle:'',clearRect(){cols=new Set();},fillRect(){cols.add(this.fillStyle);}};cv.getContext=()=>g;cv.width=510;cv.height=36;
    rest();V.drawStats();const plain=new Set(cols);V.fxPoison(5);V.drawStats();const sick=new Set(cols);P().fx={};
    ok('poisoned hearts are drawn green, healthy ones red',sick.has('#9bbf2a')&&!sick.has('#e23b3b')&&plain.has('#e23b3b')&&!plain.has('#9bbf2a'));}
  rest();P().mode='c';const c1=V.fxPoison(5);P().mode='s';P().spec=true;const c2=V.fxPoison(5);P().spec=false;
  ok('creative players and spectators are not poisoned',c1===false&&c2===false&&!V.fxPoisoned());
  /* ===== 3 ===== */
  const eat=()=>{boot.aim(V,o.x+0.5,o.y+30,o.z+0.6);V.MB.r=true;for(let i=0;i<50&&P().inv[0];i++){const c=P().inv[0].count;step(1);if(!P().inv[0]||P().inv[0].count<c)break;}V.MB.r=false;step(1);};
  rest();P().hunger=10;P().inv[0]={id:IT.HROOT,count:2};P().sel=0;V.refreshHand();eat();
  ok('eating a hemlock root: poisoned, every time',V.fxPoisoned()&&P().inv[0]&&P().inv[0].count===1);
  {const tRoot=P().fx.poison.t;P().fx={};const st={id:IT.BEEF,count:1,psn:1};V.psnBite(st,D[IT.BEEF]);const tFood=P().fx.poison?P().fx.poison.t:0;P().fx={};
    ok('eaten poison lasts two minutes, from the root ('+Math.round(tRoot)+' s) and from a poisoned piece of food ('+Math.round(tFood)+' s); a coated blade still gives six seconds',tRoot>118&&tRoot<=120&&tFood===120&&PSN.hitT===6);}
  /* ===== 4 ===== */
  const pb=craft([IT.POISON,IT.BEEF]),ps=craft([IT.POISON,{id:IT.STEAK,count:7}]);
  ok('a jar and a food: one piece of that food, marked only by a number nobody is shown (same id, same name, same icon)',
    !!pb&&pb.id===IT.BEEF&&pb.count===1&&pb.psn===1&&!!ps&&ps.id===IT.STEAK&&ps.psn===1&&V.stackName(pb)===V.stackName({id:IT.BEEF,count:1})&&V.psnName(pb)===''&&Object.keys(pb).sort().join()==='count,id,psn');
  ok('a jar with something that is neither food nor sword, or with a hemlock root, or two jars: no such recipe',!craft([IT.POISON,B.STONE])&&!craft([IT.POISON,IT.HROOT])&&!craft([IT.POISON,IT.POISON,IT.BEEF]));
  /* ===== 5 ===== */
  {const at=Array(21).fill(0);let twice=0,never=0;const N=400;
    for(let s=0;s<N;s++){const st={id:IT.BEEF,count:20,psn:1};let hits=0;
      for(let bite=1;bite<=20;bite++){const before=st.psn|0;rest.call?0:0;P().fx={};const was=V.psnBite(st,D[IT.BEEF]);st.count--;if(was){at[bite]++;hits++;}}
      if(hits>1)twice++;if(hits===0)never++;}
    const lo=Math.min(...at.slice(1)),hi=Math.max(...at.slice(1));
    ok('1 poisoned beef among 19, eaten down '+N+' times: found exactly once a stack ('+twice+' twice, '+never+' never), at each of the 20 bites between '+lo+' and '+hi+' times (20 expected)',
      twice===0&&never===0&&lo>=6&&hi<=40);
    let clean=0;for(let i=0;i<200;i++){const st={id:IT.BEEF,count:20};P().fx={};if(V.psnBite(st,D[IT.BEEF]))clean++;}
    ok('a stack with no poisoned piece never poisons',clean===0);P().fx={};}
  /* ===== 6 ===== */
  {rest();const CK='7,60,7';V.blockEnts.set(CK,{t:'chest',inv:Array(27).fill(null)});
    const be=()=>V.blockEnts.get(CK),M=()=>V.getMODAL();
    for(let i=0;i<36;i++)P().inv[i]=null;
    P().inv[9]={id:IT.BEEF,count:40,psn:5};P().inv[10]={id:IT.BEEF,count:30,psn:2};P().inv[11]={id:IT.STEAK,count:20,psn:20};P().inv[12]={id:IT.BEEF,count:25};
    V.openModal('chest',CK);
    const drops=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead);
    const tally=()=>{const t={n:{},p:{},bad:0};const add=st=>{if(!st||!(st.count>0))return;t.n[st.id]=(t.n[st.id]||0)+st.count;t.p[st.id]=(t.p[st.id]||0)+(st.psn|0);if((st.psn|0)>st.count||(st.psn|0)<0)t.bad++;};
      P().inv.forEach(add);be().inv.forEach(add);add(V.getCursor());drops().forEach(e=>add(e.st));return t;};
    const T0=JSON.stringify(tally());let wrong=0,ops=0,T=100,mixed=false;
    const slots=()=>M().slots.filter(s=>s.kind==='n'||!s.kind);
    for(let i=0;i<1000;i++){const S=slots(),a=S[Math.floor(rnd()*S.length)],b=S[Math.floor(rnd()*S.length)],r=rnd();T+=3;
      if(r<0.25)V.slotClick(a,false,false);else if(r<0.5)V.slotClick(a,true,false);else if(r<0.62)V.quickMove(a);
      else if(r<0.75){V.imDown(a,0,false,T);V.imOver(b);V.imOver(S[Math.floor(rnd()*S.length)]);V.imUp();}
      else if(r<0.85){V.imDown(a,2,false,T);V.imOver(b);V.imUp();}
      else if(r<0.92)V.imWheel(a,rnd()<0.5?1:-1);
      else if(r<0.96){if(V.getCursor())V.imOutside(rnd()<0.5?0:2);}
      else{for(const e of drops()){const left=V.invAddTo(P().inv,e.st);if(left<=0)e.dead=true;}}
      ops++;const now=JSON.stringify(tally());if(now!==T0){wrong++;if(wrong===1)console.log('  first difference after op '+i+' (r '+r.toFixed(2)+'): '+now+' vs '+T0);}
      if(be().inv.some(s=>s&&s.psn>0))mixed=true;}
    if(V.getCursor()){const c=V.getCursor();V.setCursor(null);V.invAddTo(P().inv,c);}
    V.closeModal(true);
    ok(ops+' random window operations: the number of pieces and the number of poisoned pieces of each food never changed ('+wrong+' times wrong), no stack ever held more poison than pieces, and poisoned pieces did travel',wrong===0&&JSON.parse(T0).bad===0&&mixed);
    const a={id:IT.BEEF,count:10,psn:3},b2={id:IT.BEEF,count:5,psn:1};b2.count+=10;a.count-=10;V.psnMoved(a,b2,10);
    ok('a whole stack poured into another: the counts add (4 poisoned of 15)',b2.psn===4&&b2.count===15&&!a.psn);}
  /* ===== 7 ===== */
  {rest();const SW=V.toolId(3,3);const sw=craft([{id:SW,count:1,dur:77,ench:{sharp:2}},IT.POISON]);
    ok('a jar and a sword: the same sword, wear 77 and Sharpness II kept, with 10 poisoned hits, named so ('+V.psnName(sw||{}).trim()+')',!!sw&&sw.id===SW&&sw.dur===77&&sw.ench.sharp===2&&sw.pz===10&&/poisoned \(10\)/.test(V.psnName(sw)));
    V.spawnMob('cow',o.x+2.5,o.y,o.z+0.5);step(2);const cow=V.entities.find(e=>e.mob&&!e.dead&&e.mt==='cow');
    cow.hp=5000;P().inv[0]=sw;P().sel=0;V.refreshHand();P().atkT=0;boot.aim(V,cow.x,cow.y+0.7,cow.z);V.MB.l=true;step(1);V.MB.l=false;
    const after=5000-cow.hp,left=P().inv[0].pz,marked=cow.psnT>0;cow.x=o.x+2.5;cow.z=o.z+0.5;const h0=cow.hp;for(let i=0;i<200;i++){step(1);cow.vx=cow.vz=0;}
    ok('a hit with it: '+left+' poisoned hits left, the cow is poisoned and loses '+(h0-cow.hp)+' more over the next six seconds',left===9&&marked&&h0-cow.hp>=3&&h0-cow.hp<=6&&after>0);
    cow.hp=1;cow.psnT=30;for(let i=0;i<200;i++)step(1);
    ok('poison does not kill a mob either: at 1 health it stays alive',!cow.dead&&cow.hp===1);cow.dead=true;
    const one={id:SW,count:1,pz:1};V.psnHit(one,null);ok('the last poisoned hit leaves a plain sword',!('pz' in one)&&V.psnHit(one,null)===false);}
  /* ===== 8 ===== */
  {rest();V.spawnDrop(o.x+3.5,o.y+0.5,o.z+0.5,{id:IT.BEEF,count:6,psn:2},0,0,0);V.spawnDrop(o.x+3.5,o.y+0.5,o.z+2.5,{id:V.toolId(2,3),count:1,dur:50,pz:4},0,0,0);step(2);
    const snap=JSON.parse(JSON.stringify(V.snapshot('psn')));const dr=snap.ents.filter(e=>e.t==='drop');
    P().inv[5]={id:IT.STEAK,count:9,psn:3};P().inv[6]={id:V.toolId(2,3),count:1,dur:40,pz:7};
    const snap2=JSON.parse(JSON.stringify(V.snapshot('psn')));V.applySave(snap2);step(30);
    const d2=V.entities.filter(e=>e.t==='drop'&&!e.dead).map(e=>e.st);
    ok('dropped items and the saved game keep both marks: on the ground, in the inventory, and after loading',
      dr.some(e=>e.id===IT.BEEF&&e.psn===2)&&dr.some(e=>e.pz===4)&&V.P.inv[5].psn===3&&V.P.inv[6].pz===7&&d2.some(s=>s.id===IT.BEEF&&s.psn===2)&&d2.some(s=>s.pz===4));
    const W=await import(pathToFileURL(path.join(REPO,'server','lib','world.mjs')).href);
    const c=W.cleanStack({id:IT.BEEF,count:20,psn:3}),c2=W.cleanStack({id:V.toolId(2,3),count:1,dur:5,pz:9}),c3=W.cleanStack({id:IT.BEEF,count:20,psn:-4,pz:'lots'});
    ok('the server keeps both marks on a stack it stores or passes on, and drops a nonsense one',c.psn===3&&c2.pz===9&&c2.dur===5&&!('psn' in c3)&&!('pz' in c3));}
  PSN.rnd=null;
});
