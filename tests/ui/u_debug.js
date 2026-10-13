/* u_debug.js (v6.22, lane UI, gate x1): the debug screen (src/ui/p06f_debug.js). Headless.
   1 the text: every line it promises (position to 3 decimals, block, facing, chunk / section / spot in the chunk, biome,
     local difficulty, memory, the toggles)
   2 the section position, at negative coordinates too
   3 facing: forward is (-sin yaw, -cos yaw); positive pitch looks up
   4 local difficulty: Peaceful is 0; a new world is 1.50 // 0.00; an old, lived-in one climbs and is clamped
   5 memory: "n/a" where the browser says nothing, numbers where it does, never an error
   6 the keys: F3 toggles on key-up; F3+B and F3+G toggle their overlay and leave the screen alone, shown or not
   7 the world's age and the time spent per chunk tick while playing (not while paused), are saved, loaded, and missing
     from an old save without harm
   8 hitboxes: a box per thing with a size; on and off 50 times leaves the scene as it was
   9 chunk borders: built once, moved when the player changes chunk, gone when turned off */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:5});
const step=boot.stepper(600000);

boot.run(async()=>{
  const B=V.B,DBG=V.DBG,key=(code)=>({code,preventDefault(){this.pd=true;}});
  ok('the seams are on __vox',['dbgText','dbgSection','dbgFacing','dbgDifficulty','dbgMemory','dbgKeyDown','dbgKeyUp','dbgBoxes','dbgBorders','dbgTick'].every(k=>typeof V[k]==='function')&&!!DBG);
  V.startNewWorld('dbg','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(60);
  const P=V.P;

  /* ===== 1. the text ===== */
  {P.x=-3.25;P.z=17.5;const y=P.y,t=V.dbgText(),L=t.split('\n');
    ok('position to three decimals, and the block it is in',L.some(l=>l==='XYZ: -3.250 / '+y.toFixed(3)+' / 17.500')&&L.some(l=>l==='Block: -4 '+Math.floor(y)+' 17'));
    ok('facing, chunk, section and the spot inside the chunk',L.some(l=>/^Facing: (north|south|east|west) \([+-][XZ]\) \(yaw -?[\d.]+ \/ pitch -?[\d.]+, up is positive\)$/.test(l))&&L.some(l=>l==='Chunk: -1 1  Section: '+Math.floor(Math.floor(y)/16)+'  In chunk: 12 '+(Math.floor(y)-Math.floor(Math.floor(y)/16)*16)+' 1'));
    ok('biome, local difficulty, memory, and the two toggles',L.some(l=>/^Biome: \S.*  Seed: -?\d+$/.test(l))&&L.some(l=>/^Local Difficulty: \d+\.\d\d \/\/ \d\.\d\d \(Day \d+\)$/.test(l))&&L.some(l=>/^Memory: /.test(l))&&L.some(l=>l==='Hitboxes (F3+B): off  Chunk borders (F3+G): off'));
    ok('the lines it already had are still there (version, fps, chunks, entities, time, mode)',/^DINGLECRAFT .* \d+ fps$/.test(L[0])&&L.some(l=>/^Chunks: \d+  Entities: \d+$/.test(l))&&L.some(l=>/^Time: \d\.\d\d  Mode: Survival$/.test(l)));}

  /* ===== 2. the section position ===== */
  {const s=(x,y,z)=>{const q=V.dbgSection(x,y,z);return [q.cx,q.cz,q.sy,q.lx,q.ly,q.lz].join(',');};
    ok('in the positive corner',s(0,0,0)==='0,0,0,0,0,0'&&s(15.9,15.9,15.9)==='0,0,0,15,15,15'&&s(16,16,16)==='1,1,1,0,0,0'&&s(40.5,79.9,33.2)==='2,2,4,8,15,1');
    ok('at negative coordinates: block -1 is the last one of chunk -1, not the first of chunk 0',s(-0.1,5,-0.1)==='-1,-1,0,15,5,15'&&s(-16,0,-16)==='-1,-1,0,0,0,0'&&s(-16.01,0,-33)==='-2,-3,0,15,0,15');}

  /* ===== 3. facing ===== */
  ok('yaw 0 looks north (-Z); a quarter turn either way is west and east; half a turn is south',V.dbgFacing(0)==='north (-Z)'&&V.dbgFacing(Math.PI/2)==='west (-X)'&&V.dbgFacing(-Math.PI/2)==='east (+X)'&&V.dbgFacing(Math.PI)==='south (+Z)');
  {P.yaw=0;P.pitch=0.5;const l=V.dbgText().split('\n').find(l=>l.startsWith('Facing'));
    ok('a positive pitch is shown as positive: looking up',/pitch 28\.6,/.test(l));P.pitch=0;}

  /* ===== 4. local difficulty ===== */
  {const d=V.dbgDifficulty,r=a=>a.map(v=>v.toFixed(3)).join(' ');
    ok('Peaceful is 0',r(d(0,1e9,1e9,1))==='0.000 0.000');
    ok('a new world on normal is 1.50, clamped to 0',r(d(2,0,0,1))==='1.500 0.000');
    ok('three game hours in, still 1.50 (the world\'s age only counts after 72,000 ticks)',r(d(2,3600,0,1))==='1.500 0.000');
    ok('an old world and a lived-in chunk climb: 21 hours and 50 hours give 2*(0.75+0.25+0.75+0.25) = 4.00, clamped to 1',r(d(2,75600,180000,1))==='4.000 1.000');
    ok('halfway: the clamp is (raw - 2) / 2',Math.abs(d(2,75600,0,1)[0]-2.5)<1e-9&&Math.abs(d(2,75600,0,1)[1]-0.25)<1e-9);
    V.GR.mobSpawn=false;const l0=V.dbgText().split('\n').find(l=>l.startsWith('Local'));V.GR.mobSpawn=true;const l1=V.dbgText().split('\n').find(l=>l.startsWith('Local'));V.GR.mobSpawn=false;
    ok('the screen says 0.00 with Peaceful on and 1.50 on a new world with it off',/^Local Difficulty: 0\.00 \/\/ 0\.00 \(Day 1\)$/.test(l0)&&/^Local Difficulty: 1\.50 \/\/ 0\.00 \(Day 1\)$/.test(l1));}

  /* ===== 5. memory ===== */
  {const pm=Object.getOwnPropertyDescriptor(global.performance,'memory');
    Object.defineProperty(global.performance,'memory',{value:undefined,configurable:true});
    const na=V.dbgMemory();
    Object.defineProperty(global.performance,'memory',{value:{usedJSHeapSize:52428800,totalJSHeapSize:104857600,jsHeapSizeLimit:2147483648},configurable:true});
    const some=V.dbgMemory();
    Object.defineProperty(global.performance,'memory',{get(){throw new Error('no');},configurable:true});
    let thrown=false,bad='';try{bad=V.dbgMemory();}catch(e){thrown=true;}
    if(pm)Object.defineProperty(global.performance,'memory',pm);else delete global.performance.memory;
    ok('memory: n/a where the browser says nothing, megabytes where it does, and never an error',na==='n/a'&&some==='50 / 100 MB (limit 2048 MB)'&&thrown===false&&bad==='n/a');}

  /* ===== 6. the keys ===== */
  {const on0=V.getDebugOn();let e=key('F3');
    ok('F3 going down is the game\'s (the browser does not get it) and shows nothing yet',V.dbgKeyDown(e)===true&&e.pd===true&&V.getDebugOn()===on0);
    V.dbgKeyUp(key('F3'));
    ok('...letting it go toggles the screen',V.getDebugOn()===!on0);
    V.dbgKeyDown(key('F3'));V.dbgKeyDown(key('F3'));e=key('KeyB');const took=V.dbgKeyDown(e);V.dbgKeyUp(key('F3'));
    ok('F3+B turns hitboxes on and leaves the screen as it was (a key held down repeats: that changes nothing)',took===true&&e.pd===true&&DBG.boxes===true&&V.getDebugOn()===!on0);
    V.dbgKeyDown(key('F3'));V.dbgKeyDown(key('KeyG'));V.dbgKeyUp(key('F3'));
    ok('F3+G turns chunk borders on, the same way',DBG.borders===true&&V.getDebugOn()===!on0);
    V.dbgKeyDown(key('F3'));V.dbgKeyDown(key('KeyB'));V.dbgKeyDown(key('KeyG'));V.dbgKeyUp(key('F3'));
    ok('...and both off again in one hold',DBG.boxes===false&&DBG.borders===false&&V.getDebugOn()===!on0);
    V.dbgKeyUp(key('F3'));
    ok('they work with the screen hidden too, and B or G alone are not the debug screen\'s',(V.getDebugOn()===!on0)&&V.dbgKeyDown(key('KeyB'))===false&&DBG.boxes===false);
    V.dbgKeyDown(key('F3'));V.dbgKeyDown(key('KeyW'));V.dbgKeyUp(key('F3'));
    ok('any other key pressed while F3 is down also spoils the plain toggle',V.getDebugOn()===!on0);
    V.dbgKeyDown(key('F3'));V.dbgKeyUp(key('F3'));
    ok('a plain F3 toggles back',V.getDebugOn()===on0);
    V.dbgKeyDown(key('F3'));V.dbgKeyUp(key('F3'));step(2);
    ok('with the screen on, the plain coordinates readout hides and the screen has the text',document.getElementById('coords').style.display==='none'&&document.getElementById('debug').textContent.includes('Local Difficulty'));
    V.dbgKeyDown(key('F3'));V.dbgKeyUp(key('F3'));step(2);}

  /* ===== 7. the counters ===== */
  {V.setWAGE(0);V.INHAB.clear();P.x=8.5;P.z=8.5;step(50);
    const a1=V.getWAGE(),h1=V.INHAB.get('0,0');
    ok('the world\'s age and the time in this chunk both tick while playing (2 seconds of frames)',Math.abs(a1-2)<0.05&&Math.abs(h1-2)<0.05&&V.INHAB.size===1);
    P.x=24.5;step(25);
    ok('walking into the next chunk starts that chunk\'s own count',Math.abs(V.INHAB.get('1,0')-1)<0.05&&Math.abs(V.INHAB.get('0,0')-h1)<1e-9&&Math.abs(V.getWAGE()-3)<0.05);
    const s=JSON.parse(JSON.stringify(V.snapshot('dbg')));
    ok('both are in the save',Math.abs(s.age-3)<0.1&&Math.abs(s.inhab['0,0']-2)<0.1&&Math.abs(s.inhab['1,0']-1)<0.1);
    V.setWAGE(999);V.INHAB.clear();V.applySave(s);step(1);
    ok('...and come back from it',Math.abs(V.getWAGE()-s.age)<0.1&&Math.abs(V.INHAB.get('0,0')-2)<0.15);
    const old=JSON.parse(JSON.stringify(s));delete old.age;delete old.inhab;V.applySave(old);
    ok('a save from before 6.22 loads, with a young world and no chunk times',V.getWAGE()===0&&V.INHAB.size===0&&V.playing!==undefined);
    V.applySave(s);V.enterGame&&0;step(5);}

  /* ===== 8. hitboxes ===== */
  /* (the scene's own child count moves while chunks load: what is counted is the debug screen's own objects) */
  const mine=()=>V.getScene().children.filter(c=>c.userData&&c.userData.dbg).length;
  {const sc=V.getScene();
    for(const e of V.entities)if(e.t==='mob'||e.t==='drop')e.dead=true;step(2);
    V.spawnMob('pig',V.P.x+3,V.P.y+1,V.P.z);V.spawnDrop(V.P.x+2,V.P.y+1,V.P.z,{id:B.STONE,count:1},0,0,0);
    const base=mine();
    V.dbgBoxes(true);step(2);
    const sized=V.entities.filter(e=>!e.dead&&e.hw>0&&e.h>0).length;
    ok('hitboxes on: a box and a facing line in the scene for each thing with a size ('+sized+')',sized>=2&&base===0&&DBG.used===sized&&mine()===sized*2);
    {const pig=V.entities.find(e=>e.mt==='pig'&&!e.dead),o=DBG.pool.find(o=>o.box.visible&&Math.abs(o.box.position.x-pig.x)<1e-6&&Math.abs(o.box.position.z-pig.z)<1e-6);
      ok('the box is the thing\'s own size, standing where it stands; a mob\'s line shows, a dropped item\'s does not',!!o&&Math.abs(o.box.scale.x-pig.hw*2)<1e-9&&Math.abs(o.box.scale.y-pig.h)<1e-9&&o.dir.visible===true&&DBG.pool.some(o=>o.box.visible&&o.dir.visible===false));}
    V.dbgBoxes(false);
    ok('off: everything is taken out of the scene again',mine()===0&&DBG.pool.length===0);
    for(let i=0;i<50;i++){V.dbgBoxes(true);step(1);V.dbgBoxes(false);}
    ok('on and off 50 times: nothing of it is left in the scene',mine()===0&&DBG.pool.length===0);void sc;}

  /* ===== 9. chunk borders ===== */
  {const sc=V.getScene();
    V.P.x=8.5;V.P.z=8.5;V.dbgBorders(true);step(2);
    const g=DBG.cb;
    ok('chunk borders on: one group in the scene, at this chunk\'s corner',mine()===1&&sc.children.includes(g)&&g.position.x===0&&g.position.z===0&&g.children.length===2);
    {const near=g.children[0].geometry.attributes.position.array,far=g.children[1].geometry.attributes.position.array;
      ok('the middle chunk has 4 posts and a ring every 16 blocks from 0 to 80; the neighbours have their 12 outer posts',near.length===(4+6*4)*6&&far.length===12*6&&Math.max(...near.filter((v,i)=>i%3===1))===80);}
    V.P.x=-8.5;V.P.z=40.5;step(2);
    ok('they move when the player changes chunk (and are not rebuilt)',DBG.cb===g&&g.position.x===-16&&g.position.z===32);
    V.dbgBorders(false);
    ok('off: gone',mine()===0&&DBG.cb===null);
    for(let i=0;i<20;i++){V.dbgBorders(true);step(1);V.dbgBorders(false);}
    ok('on and off 20 times: nothing left behind',mine()===0);}
  await V.quitToTitle();await window.storage.delete('vxw:dbg').catch(()=>{});
});
