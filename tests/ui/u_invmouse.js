/* u_invmouse.js (v6.23, lane UI, gate x1): the inventory's mouse controls (src/ui/p06g_invmouse.js). Headless: the real
   window (openModal builds its real slots) driven through the handlers the mouse events call.
   1 the plain clicks still do what they did (pick up, put down, merge, swap; right: half, one; Shift: quick-move)
   2 double-click gathers every matching item onto the cursor, part stacks first, up to a full stack
   3 a left drag over empty slots shares the stack out evenly, live, the rest on the cursor; full and foreign slots are
     skipped; a press that never leaves its slot is a plain click
   4 a right drag puts one in each slot entered, and one more each time it is entered again
   5 a left drag that starts on a slot of the cursor's item gathers; with Shift it quick-moves each
   6 Shift + left drag with an empty hand quick-moves every slot crossed
   7 the wheel: down sends one out to the other section, up brings one in (searching from the last slot)
   8 1-9 swaps with the hotbar; Q and Ctrl+Q throw (as a throw); a click outside throws the cursor's stack, or one
   9 middle click in creative gives a full stack; not in survival
   10 wear, enchantments and jarred mobs survive every split
   11 2,000 random actions (fixed seed): not one item made or lost, and no enchantment or wear changed
   12 closing the window in the middle of a drag gives everything back */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:23});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,IM=V.IM,SWORD=V.toolId(2,3);
  ok('the seams are on __vox',['imDown','imOver','imUp','imWheel','imOutside','imKey','stackPart','slotClick','quickMove'].every(k=>typeof V[k]==='function')&&!!IM);
  boot.studio(V,step,{});
  const P=V.P,CK='7,60,7';
  V.blockEnts.set(CK,{t:'chest',inv:Array(27).fill(null)});
  const be=()=>V.blockEnts.get(CK);
  const M=()=>V.getMODAL();
  const inv=i=>M().slots.find(s=>s.home==='inv'&&s.idx===i);
  const ch=i=>M().slots.filter(s=>s.home==='be')[i];
  const cur=()=>V.getCursor();
  let T=10;
  const click=(s,btn,shift)=>{T+=1;V.imDown(s,btn||0,!!shift,T);V.imUp();};
  const drag=(list,btn,shift)=>{T+=1;V.imDown(list[0],btn||0,!!shift,T);for(let i=1;i<list.length;i++)V.imOver(list[i]);V.imUp();};
  const wipe=()=>{V.setCursor(null);for(let i=0;i<36;i++)P.inv[i]=null;for(let i=0;i<27;i++)be().inv[i]=null;for(const e of V.entities)if(e.t==='drop')e.dead=true;};
  const open=k=>{V.closeModal(true);if(k==='chest')V.openModal('chest',CK);else V.openModal(k);};
  const drops=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead);
  /* every item there is, as "id|dur|ench|mob" -> count: the inventory, the chest, the crafting grid, the cursor, the floor */
  const census=()=>{const m={},add=st=>{if(!st||!(st.count>0))return;const k=st.id+'|'+(st.dur==null?'':st.dur)+'|'+(st.ench?JSON.stringify(st.ench):'')+'|'+(st.mob?JSON.stringify(st.mob):'');m[k]=(m[k]||0)+st.count;};
    P.inv.forEach(add);be().inv.forEach(add);(M().grid||[]).forEach(add);add(cur());drops().forEach(e=>add(e.st));return m;};
  const same=(a,b)=>JSON.stringify(Object.keys(a).sort().map(k=>[k,a[k]]))===JSON.stringify(Object.keys(b).sort().map(k=>[k,b[k]]));
  const n=st=>st?st.count:0;

  /* ===== 1. plain clicks ===== */
  open('chest');wipe();P.inv[9]={id:B.STONE,count:10};P.inv[10]={id:B.STONE,count:60};P.inv[11]={id:B.DIRT,count:5};
  click(inv(9));ok('left click picks the stack up',n(cur())===10&&!P.inv[9]);
  click(inv(12));ok('...and puts it down in an empty slot',!cur()&&n(P.inv[12])===10);
  click(inv(12));click(inv(10));ok('...merges into a matching stack, keeping what does not fit',n(P.inv[10])===64&&n(cur())===6);
  click(inv(11));ok('...and swaps with a different item',cur().id===B.DIRT&&n(cur())===5&&P.inv[11].id===B.STONE&&n(P.inv[11])===6);
  click(inv(13));click(inv(13),2);ok('right click takes half, rounded up',n(cur())===3&&n(P.inv[13])===2);
  click(inv(14),2);ok('...and places one',n(cur())===2&&n(P.inv[14])===1);
  click(inv(15));
  click(inv(10),0,true);ok('Shift+click quick-moves to the chest',!P.inv[10]&&n(be().inv[0])===64);
  click(ch(0),0,true);ok('...and back',!be().inv[0]&&P.inv.some(s=>s&&s.id===B.STONE&&s.count===64));

  /* ===== 2. double-click ===== */
  open('chest');wipe();P.inv[9]={id:B.STONE,count:5};P.inv[10]={id:B.STONE,count:64};P.inv[11]={id:B.STONE,count:7};be().inv[3]={id:B.STONE,count:9};P.inv[12]={id:B.DIRT,count:4};
  {T+=1;V.imDown(inv(9),0,false,T);V.imUp();const t=T;V.imDown(inv(9),0,false,t+0.2);V.imUp();
    ok('double-click gathers every matching item in the window, part stacks before full ones',n(cur())===64&&!P.inv[11]&&!be().inv[3]&&n(P.inv[10])===21&&n(P.inv[12])===4);}
  {const c0=n(cur());T+=5;V.imDown(inv(9),0,false,T);V.imUp();
    ok('two slow clicks are two clicks, not a gather',!cur()&&n(P.inv[9])===c0);}

  /* ===== 3. left drag shares ===== */
  open('chest');wipe();V.setCursor({id:B.STONE,count:10});
  {T+=1;V.imDown(ch(0),0,false,T);
    ok('pressing on an empty slot does nothing yet: it may become a drag',n(cur())===10&&!be().inv[0]);
    V.imOver(ch(1));ok('two slots: 5 and 5, shown as you drag',n(be().inv[0])===5&&n(be().inv[1])===5&&!cur());
    V.imOver(ch(2));ok('three slots: 3, 3, 3 and 1 left on the cursor',[0,1,2].every(i=>n(be().inv[i])===3)&&n(cur())===1);
    V.imOver(ch(3));ok('four slots: 2 each, 2 left',[0,1,2,3].every(i=>n(be().inv[i])===2)&&n(cur())===2);
    V.imOver(ch(2));ok('crossing a slot again changes nothing',[0,1,2,3].every(i=>n(be().inv[i])===2)&&n(cur())===2);
    V.imUp();ok('letting go keeps it',[0,1,2,3].every(i=>n(be().inv[i])===2)&&n(cur())===2&&IM.mode===null);}
  wipe();V.setCursor({id:B.STONE,count:9});be().inv[1]={id:B.STONE,count:63};be().inv[2]={id:B.DIRT,count:1};be().inv[3]={id:B.STONE,count:64};
  drag([ch(0),ch(1),ch(2),ch(3),ch(4)]);
  ok('a nearly full slot takes what fits, a full one and a different item are skipped',n(be().inv[0])===3&&n(be().inv[1])===64&&n(be().inv[2])===1&&be().inv[2].id===B.DIRT&&n(be().inv[3])===64&&n(be().inv[4])===3&&n(cur())===2);
  wipe();V.setCursor({id:B.STONE,count:10});click(ch(5));
  ok('a press that never leaves its slot is the plain click it always was',n(be().inv[5])===10&&!cur());

  /* ===== 4. right drag ===== */
  wipe();V.setCursor({id:B.STONE,count:10});be().inv[2]={id:B.STONE,count:4};be().inv[3]={id:B.DIRT,count:1};
  {T+=1;V.imDown(ch(0),2,false,T);V.imOver(ch(1));V.imOver(ch(2));V.imOver(ch(3));V.imOver(ch(1));V.imOver(ch(0));V.imUp();
    ok('right drag: one into each slot entered (a matching stack too, a different item not), and one more each time it is entered again',n(be().inv[0])===2&&n(be().inv[1])===2&&n(be().inv[2])===5&&n(be().inv[3])===1&&n(cur())===5);}

  /* ===== 5. left drag gathers ===== */
  wipe();V.setCursor({id:B.STONE,count:10});be().inv[0]={id:B.STONE,count:4};be().inv[1]={id:B.STONE,count:6};be().inv[2]={id:B.DIRT,count:9};be().inv[3]={id:B.STONE,count:60};
  drag([ch(0),ch(1),ch(2),ch(3)]);
  ok('a left drag that starts on a slot of the same item gathers: every such slot is pulled onto the cursor, up to a full stack',!be().inv[0]&&!be().inv[1]&&n(be().inv[2])===9&&n(be().inv[3])===16&&n(cur())===64);
  wipe();V.setCursor({id:B.STONE,count:10});be().inv[0]={id:B.STONE,count:4};click(ch(0));
  ok('...but a plain click on such a slot still merges the cursor into it',n(be().inv[0])===14&&!cur());
  wipe();V.setCursor({id:B.STONE,count:1});be().inv[0]={id:B.STONE,count:4};be().inv[1]={id:B.STONE,count:6};be().inv[2]={id:B.DIRT,count:9};
  drag([ch(0),ch(1),ch(2)],0,true);
  ok('with Shift held, each matching slot crossed is quick-moved to the inventory instead',!be().inv[0]&&!be().inv[1]&&n(be().inv[2])===9&&P.inv.reduce((a,s)=>a+(s&&s.id===B.STONE?s.count:0),0)===10&&n(cur())===1);

  /* ===== 6. Shift drag, empty hand ===== */
  wipe();be().inv[0]={id:B.STONE,count:4};be().inv[1]={id:B.DIRT,count:6};be().inv[3]={id:B.GLASS,count:2};
  drag([ch(0),ch(1),ch(2),ch(3)],0,true);
  ok('Shift + left drag with an empty hand quick-moves every slot crossed',be().inv.every(s=>!s)&&[B.STONE,B.DIRT,B.GLASS].every(id=>P.inv.some(s=>s&&s.id===id))&&!cur());

  /* ===== 7. the wheel ===== */
  wipe();be().inv[0]={id:B.STONE,count:3};
  ok('wheel down over a stack sends one item to the other section',V.imWheel(ch(0),100)===true&&n(be().inv[0])===2&&P.inv.reduce((a,s)=>a+(s&&s.id===B.STONE?s.count:0),0)===1);
  V.imWheel(ch(0),100);V.imWheel(ch(0),100);
  ok('...down to the last one',!be().inv[0]&&P.inv.reduce((a,s)=>a+(s&&s.id===B.STONE?s.count:0),0)===3&&V.imWheel(ch(0),100)===false);
  wipe();be().inv[0]={id:B.STONE,count:3};P.inv[9]={id:B.STONE,count:5};P.inv[20]={id:B.STONE,count:2};P.inv[21]={id:B.DIRT,count:9};
  ok('wheel up brings one matching item in, taken from the last matching slot',V.imWheel(ch(0),-100)===true&&n(be().inv[0])===4&&n(P.inv[20])===1&&n(P.inv[9])===5);
  V.imWheel(ch(0),-100);
  ok('...and from the one before when that is empty',n(be().inv[0])===5&&!P.inv[20]&&(V.imWheel(ch(0),-100),n(P.inv[9])===4&&n(be().inv[0])===6));
  open('inv');wipe();P.inv[0]={id:B.STONE,count:2};
  ok('with no container open, the other section is hotbar against backpack',V.imWheel(inv(0),100)===true&&n(P.inv[0])===1&&P.inv.slice(9).some(s=>s&&s.id===B.STONE&&s.count===1));

  /* ===== 8. keys and the outside ===== */
  open('chest');wipe();be().inv[0]={id:B.STONE,count:7};P.inv[2]={id:B.DIRT,count:3};
  V.imOver(ch(0));
  ok('3 over a slot swaps it with hotbar slot 3',V.imKey({code:'Digit3'})===true&&be().inv[0].id===B.DIRT&&n(be().inv[0])===3&&P.inv[2].id===B.STONE&&n(P.inv[2])===7);
  V.imOver(inv(2));ok('...and does nothing over that hotbar slot itself',V.imKey({code:'Digit3'})===false&&n(P.inv[2])===7);
  V.imOver(ch(0));
  {const c0=census();
    ok('Q over a slot throws one, as a throw',V.imKey({code:'KeyQ'})===true&&n(be().inv[0])===2&&drops().length===1&&drops()[0].by==='me'&&drops()[0].st.count===1&&same(c0,census()));
    ok('Ctrl+Q throws the whole stack',V.imKey({code:'KeyQ',ctrlKey:true})===true&&!be().inv[0]&&drops().some(e=>e.st.count===2)&&same(c0,census()));
    V.setCursor({id:B.GLASS,count:5});const c1=census();
    ok('a right click outside the window throws one from the cursor',V.imOutside(2)===true&&n(cur())===4&&same(c1,census()));
    ok('...a left click throws it all',V.imOutside(0)===true&&!cur()&&same(c1,census())&&drops().every(e=>e.by==='me'));
    ok('...and with an empty hand it is just a click on nothing',V.imOutside(0)===false);}

  /* ===== 9. middle click ===== */
  wipe();be().inv[0]={id:B.STONE,count:1};
  V.imDown(ch(0),1,false,++T);V.imUp();
  ok('middle click does nothing in survival',!cur()&&n(be().inv[0])===1);
  P.mode='c';V.imDown(ch(0),1,false,++T);V.imUp();
  ok('...and in creative gives a full stack of the item, leaving the slot as it was',n(cur())===64&&cur().id===B.STONE&&n(be().inv[0])===1);
  P.mode='s';

  /* ===== 10. what an item is, it stays ===== */
  wipe();be().inv[0]={id:SWORD,count:1,dur:40,ench:{sharp:3}};
  click(ch(0),2);
  ok('right-clicking an enchanted, worn sword out of a slot keeps its enchantment and its wear',!!cur()&&cur().dur===40&&cur().ench&&cur().ench.sharp===3&&!be().inv[0]);
  click(ch(4),2);
  ok('...and so does putting it down with a right click',!cur()&&be().inv[4].dur===40&&be().inv[4].ench.sharp===3);
  {const p=V.stackPart({id:300,count:5,mob:{t:'pig',hp:6}},2);ok('a part of a stack is the same thing, fewer of it (a jarred mob stays in its jar)',p.count===2&&p.mob.t==='pig'&&!('dur' in p)&&!('ench' in p));}

  /* ===== 11. a long random run ===== */
  {open('chest');wipe();let seed=20261013;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296;};
    const kinds=[{id:B.STONE},{id:B.DIRT},{id:B.GLASS},{id:SWORD,dur:33,ench:{sharp:2}},{id:SWORD,dur:90}];
    for(let i=0;i<36;i++)if(rnd()<0.5){const k=kinds[(rnd()*kinds.length)|0];P.inv[i]={...k,count:k.dur!=null?1:1+((rnd()*64)|0)};}
    for(let i=0;i<27;i++)if(rnd()<0.4){const k=kinds[(rnd()*kinds.length)|0];be().inv[i]={...k,count:k.dur!=null?1:1+((rnd()*64)|0)};}
    const c0=census(),all=()=>M().slots,pick=()=>all()[(rnd()*all().length)|0];
    let bad=-1;
    for(let i=0;i<2000&&bad<0;i++){
      const r=rnd(),btn=rnd()<0.3?2:0,shift=rnd()<0.25;
      if(r<0.30)click(pick(),btn,shift);
      else if(r<0.60){const L=[];for(let j=0,m=2+((rnd()*5)|0);j<m;j++)L.push(pick());drag(L,btn,shift);}
      else if(r<0.75)V.imWheel(pick(),rnd()<0.5?100:-100);
      else if(r<0.82){V.imOver(pick());V.imKey({code:'Digit'+(1+((rnd()*9)|0))});}
      else if(r<0.88){T+=1;const s=pick();V.imDown(s,0,false,T);V.imUp();V.imDown(s,0,false,T+0.1);V.imUp();}
      else if(r<0.92){V.imOver(pick());V.imKey({code:'KeyQ',ctrlKey:rnd()<0.5});}
      else if(r<0.95)V.imOutside(btn);
      else{const k=M().kind;V.closeModal(true);open(k==='chest'&&rnd()<0.3?'inv':'chest');}
      if(i%50===49&&!same(c0,census()))bad=i;
    }
    ok('2,000 random clicks, drags, wheel turns, hotkeys, throws and reopenings: every item is still there, with its wear and enchantments'+(bad>=0?' [first seen wrong after action '+bad+']':''),bad<0&&same(c0,census()));
    ok('...and no stack ever went over its limit or under one',P.inv.concat(be().inv).every(s=>!s||(s.count>=1&&s.count<=64&&(s.dur==null||s.count===1))));}

  /* ===== 12. closing in the middle of a drag ===== */
  open('chest');wipe();V.setCursor({id:B.STONE,count:10});
  {const c0=census();T+=1;V.imDown(ch(0),0,false,T);V.imOver(ch(1));V.imOver(ch(2));V.closeModal(true);
    ok('closing the window in the middle of a drag: the drag is forgotten, the cursor\'s share goes back to the inventory, nothing is lost',IM.mode===null&&IM.btn===-1&&!cur()&&same(c0,census()));
    V.imUp();V.imOver({});ok('...and a button coming up afterwards does nothing',same(c0,census()));}
  await V.quitToTitle();
});
