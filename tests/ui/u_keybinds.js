/* u_keybinds.js (v6.56, lane UI, gate x1): your own keys (src/ui/p06h_keybinds.js) and the Controls screen's index. Headless:
   keys are pressed through the game's real window listeners (tests/lib/stubs_K.js records them).
   1 every key at home: no map, kbEv hands back the very same event, the settings carry no "kb", the keys do what they did
   2 a moved key: the new key does the action (held and let go), the old one does nothing
   3 a key another action had swaps over; the inventory and the hotbar follow their keys
   4 the replay listener follows F2 / F8
   5 left alone: typing in a text field, chat, F3's own B and G
   6 a keyup goes where its keydown went, whatever opened in between
   7 Esc, F3, Enter and the like cannot be taken; the Change keys page listens for one key, eats it, and Esc cancels
   8 saved with the settings (only what differs), loaded back, a broken or missing "kb" gives the defaults
   9 key names; the Controls html: an index button per section, every kbd names a real action, the labels follow the keys
   10 Credits link both repositories; Renscal.net replaces the old subreddit
   11 mouse buttons 4 and 5: never back / forward, a key the Change keys page can take, then that action held and let go */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs');
const V=boot({seed:56,stubs:['K']});
const step=boot.stepper(600000);
const K=global.__K;
const HH=fs.readFileSync(boot.BUILD+'head.html','utf8');
const read=async()=>{try{return JSON.parse((await global.storage.get('vox_settings')).value);}catch(e){return null;}};
const write=async(o)=>global.storage.set('vox_settings',JSON.stringify(o));
const tap=c=>{K.press(c);K.release(c);};

boot.run(async()=>{
  ok('the seams are on __vox',['kbEv','kbSet','kbReset','kbLoad','kbSaveVal','kbName','kbCode','kbRebuild','kbSec','kbRender','kbHelp','getRP'].every(k=>typeof V[k]==='function')&&
    !!V.KB&&Array.isArray(V.KB_ACTS)&&V.KB_ACTS.length===29);
  ok('the game added its key listeners (keydown + keyup in p06b, the replay listener)',K.listeners.filter(l=>l.type==='keydown').length>=2&&K.listeners.some(l=>l.type==='keyup'));
  V.startNewWorld('kb','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;step(60);
  const P=V.P,KEY=V.KEY;
  for(const k in KEY)KEY[k]=false;

  /* ===== 1. every key at home ===== */
  {V.kbReset();
   const e={code:'KeyW'};let same=true;
   for(const c of ['KeyW','KeyE','Space','Digit3','F8','ArrowUp','KeyZ','Tab'])if(V.kbEv(Object.assign(e,{code:c}))!==e)same=false;
   ok('every key at home: no map, and kbEv hands back the very same event',V.KB.map===null&&same&&V.kbSaveVal()===undefined);
   V.saveSettings();const s=await read();
   ok('...and the settings carry no "kb"',!!s&&!('kb' in s));
   K.press('KeyW');const w=!!KEY.KeyW;K.release('KeyW');
   P.sel=4;tap('Digit2');
   ok('...W walks and 2 picks slot 2, as before',w&&!KEY.KeyW&&P.sel===1);}

  /* ===== 2. a moved key ===== */
  {ok('forward onto the up arrow',V.kbSet('fwd','ArrowUp')&&V.kbCode('fwd')==='ArrowUp');
   K.press('ArrowUp');const held=!!KEY.KeyW,arrow=!!KEY.ArrowUp;
   const z0=P.z,x0=P.x;step(20);const moved=Math.hypot(P.x-x0,P.z-z0);
   K.release('ArrowUp');
   ok('...the arrow holds "forward" ('+moved.toFixed(2)+' blocks in 20 frames) and lets go of it',held&&!arrow&&moved>0.3&&!KEY.KeyW);
   step(40);                                                /* let the walk coast to a stop */
   K.press('KeyW');const w=!!KEY.KeyW||!!KEY.ArrowUp;const x1=P.x,z1=P.z;step(10);const m2=Math.hypot(P.x-x1,P.z-z1);K.release('KeyW');
   ok('...and W does nothing now ('+m2.toFixed(2)+')',!w&&m2<0.05);}

  /* ===== 3. swaps ===== */
  {V.kbSet('jump','KeyE');
   ok('jump onto E: inventory swaps over to Space',V.kbCode('jump')==='KeyE'&&V.kbCode('inv')==='Space');
   K.press('KeyE');const sp=!!KEY.Space,inv=!!V.getMODAL().kind;K.release('KeyE');
   ok('...E jumps and opens nothing',sp&&!inv&&!KEY.Space);
   tap('Space');const open=V.getMODAL().kind;
   ok('...Space opens the inventory ('+open+')',open==='inv');
   tap('Space');
   ok('...and closes it',!V.getMODAL().kind);
   V.kbSet('hot1','KeyZ');P.sel=6;tap('KeyZ');const z=P.sel;P.sel=6;tap('Digit1');
   ok('hotbar slot 1 onto Z: Z picks it ('+z+'), 1 no longer does ('+P.sel+')',z===0&&P.sel===6);
   V.kbSet('hot1','Digit1');
   ok('putting a key back home drops it from the list',!('hot1' in V.KB.bind));}

  /* ===== 4. the replay listener ===== */
  {const RP=V.getRP();RP.shot=false;
   V.kbSet('shot','F9');tap('F2');const f2=!!RP.shot;tap('F9');
   ok('screenshot onto F9: F9 takes it, F2 does not',!f2&&RP.shot===true);RP.shot=false;V.kbSet('shot','F2');}

  /* ===== 5. left alone ===== */
  {K.press('ArrowUp',{target:{tagName:'INPUT'}});const typed=!!KEY.KeyW;K.release('ArrowUp',{target:{tagName:'INPUT'}});
   ok('a key typed into a text field is not translated',!typed);
   V.kbSet('drop','KeyB');
   K.press('F3');const b0=!!V.DBG.boxes;K.press('KeyB');const b1=!!V.DBG.boxes;K.release('KeyB');K.release('F3');
   ok('drop onto B: F3 + B still toggles the hitboxes',b1!==b0&&V.DBG.held===false);
   if(V.DBG.boxes)V.dbgBoxes(false);
   ok('...and B on its own drops (Q no longer does)',(()=>{P.inv[P.sel]={id:V.B.DIRT,count:5};tap('KeyQ');const a=P.inv[P.sel]&&P.inv[P.sel].count;tap('KeyB');const b=P.inv[P.sel]?P.inv[P.sel].count:0;return a===5&&b===4;})());
}

  /* ===== 6. a keyup goes where its keydown went ===== */
  {K.press('ArrowUp');const d=!!KEY.KeyW;
   const saveLive=V.KB.cap;V.KB.cap='laser';K.release('ArrowUp');V.KB.cap=saveLive;
   ok('a key pressed as "forward" is let go as "forward" even while the Change keys page listens',d&&!KEY.KeyW);}

  /* ===== 7. fixed keys, the Change keys page ===== */
  {ok('Esc, F3, Enter cannot be taken',['Escape','F3','Enter','NumpadEnter','MetaLeft'].every(c=>!V.kbSet('cam',c))&&V.kbCode('cam')==='KeyF');
   V.openHelp();
   ok('Controls opens on the index, Moving first, nothing listening',V.getHelp()===true&&V.KB.cap===null&&V.KB.wired===true);
   V.KB.cap='laser';
   const before=V.P.sel,e=K.press('KeyK');
   ok('the page takes the next key for Laser Eyes, and nobody else sees it',V.kbCode('laser')==='KeyK'&&V.KB.cap===null&&e.stopped&&e.pd&&V.P.sel===before);
   V.KB.cap='laser';K.press('Escape');
   ok('...Esc cancels without a change and without the Controls toast',V.kbCode('laser')==='KeyK'&&V.KB.cap===null&&V.getHelp()===true);
   V.KB.cap='laser';K.press('F3');
   ok('...F3 is refused and the page keeps listening',V.kbCode('laser')==='KeyK'&&V.KB.cap==='laser'&&!V.DBG.held);
   V.closeHelp();
   ok('closing Controls stops it listening',V.KB.cap===null&&V.getHelp()===false);
   K.press('KeyK');const las=!!KEY.KeyL;K.release('KeyK');
   ok('...and K is now Laser Eyes',las&&!KEY.KeyL);}

  /* ===== 8. saved and loaded ===== */
  {V.saveSettings();const s=await read();
   ok('saved: only what differs ('+JSON.stringify(s&&s.kb)+')',!!s&&s.kb&&s.kb.fwd==='ArrowUp'&&s.kb.jump==='KeyE'&&s.kb.inv==='Space'&&s.kb.laser==='KeyK'&&s.kb.drop==='KeyB'&&!('hot1' in s.kb)&&!('cam' in s.kb));
   const keep=JSON.parse(JSON.stringify(s));
   V.kbReset();await V.loadSettings();
   ok('loaded back: every moved key where it was',V.kbCode('fwd')==='ArrowUp'&&V.kbCode('inv')==='Space'&&V.kbCode('laser')==='KeyK'&&V.KB.map&&V.KB.map.KeyW==='');
   await write(Object.assign({},keep,{kb:{fwd:'KeyD'}}));await V.loadSettings();
   ok('two actions on one key (a hand-edited file): every key back home',V.KB.map===null&&V.kbCode('right')==='KeyD'&&V.kbCode('fwd')==='KeyW');
   await write(Object.assign({},keep,{kb:{fwd:'Escape',jump:12,nope:'KeyZ'}}));await V.loadSettings();
   ok('fixed keys, numbers and unknown actions in the file are ignored',V.KB.map===null);
   const old=Object.assign({},keep);delete old.kb;await write(old);await V.loadSettings();
   ok('settings from before 6.56 (no "kb"): the defaults',V.KB.map===null&&Object.keys(V.KB.bind).length===0);}

  /* ===== 9. names and the Controls html ===== */
  {const N=V.kbName;
   ok('key names',N('KeyW')==='W'&&N('Digit7')==='7'&&N('ShiftLeft')==='Shift'&&N('ControlLeft')==='Ctrl'&&N('ArrowUp')==='↑'&&N('Slash')==='/'&&N('Numpad4')==='Num 4'&&N('F8')==='F8'&&N('Space')==='Space');
   const a=HH.indexOf('<div id="help"'),h=HH.slice(a,HH.indexOf('<button id="h_close"',a));
   const idx=[...h.matchAll(/<button class="mc-btn[^"]*" data-sec="([a-z]+)">/g)].map(m=>m[1]),secs=[...h.matchAll(/<section class="hsec" data-sec="([a-z]+)"/g)].map(m=>m[1]);
   ok('Controls is an index: '+idx.length+' buttons, one section each, in the same order, the first one shown',idx.length===9&&idx.join()===secs.join()&&idx[idx.length-1]==='keys'&&
     /<section class="hsec" data-sec="move">/.test(h)&&(h.match(/data-sec="[a-z]+" hidden>/g)||[]).length===8);
   const ks=[...h.matchAll(/<kbd data-k="([a-z0-9]+)">([^<]*)<\/kbd>/g)],ids=V.KB_ACTS.map(a=>a[0]);
   ok('every key on the page ('+ks.length+') names a real action and shows its default key',ks.length>20&&ks.every(m=>ids.includes(m[1])&&V.kbName(V.KB_ACTS.find(a=>a[0]===m[1])[3])===m[2]));
   ok('the stale rows are gone (Laser Eyes is L, not sneak + right-click; no /think)',!/Sneak \+ Right-click/.test(h)&&!/\/think/.test(h)&&/id="h_binds"/.test(h)&&/id="h_reset"/.test(h));
   ok('the Controls css: an index column that folds into rows on a phone',/\.hwrap\{display:flex/.test(HH)&&/@media \(max-width:620px\)\{\s*\.hwrap\{flex-direction:column\}/.test(HH));}

  /* ===== 10. credits and the site ===== */
  {const a=HH.indexOf('<section id="tcred"'),cr=HH.slice(a,HH.indexOf('</section>',a));
   ok('Credits links both repositories',/href="https:\/\/github\.com\/Renscal\/DingleCraftMP\/"/.test(cr)&&/href="https:\/\/github\.com\/dandingle\/dinglecraft"/.test(cr)&&(cr.match(/rel="noopener"/g)||[]).length===2);
   const src=boot.readSrc('features/replay.js')+boot.readSrc('ui/p07g_title.js');
   ok('Renscal.net replaces r/DanDingle (menu, sharing screen, toasts, the link)',/id="t_reddit" class="mc-btn">Renscal\.net</.test(HH)&&/Open Renscal\.net</.test(HH)&&!/r\/dandingle/i.test(HH)&&
     !/reddit\.com/.test(src)&&src.split('https://renscal.net/').length===3);}

  /* ===== 11. mouse buttons 4 and 5 ===== */
  {global.KeyboardEvent=class{constructor(type,o){this.type=type;Object.assign(this,o);}};
   global.dispatchEvent=e=>{if(e.type==='keydown')K.press(e.code);else K.release(e.code);return true;};
   V.kbReset();
   const m=(b,up)=>{const e={button:b,pd:false,preventDefault(){this.pd=true;}};const r=V.kbMouse(e,up);return [r,e.pd];};
   ok('left, middle and right click are not the module\'s business',[0,1,2].every(b=>m(b,false)[0]===false&&m(b,false)[1]===false));
   const un=m(3,false),un2=m(4,true);
   ok('buttons 4 and 5 never go back or forward, even unbound',un[0]&&un[1]&&un2[0]&&un2[1]&&V.KB.map===null);
   V.KB.cap='cam';m(4,false);
   ok('the Change keys page takes mouse 5 for the camera ("Mouse 5")',V.kbCode('cam')==='Mouse5'&&V.KB.cap===null&&V.kbName('Mouse5')==='Mouse 5');
   V.kbSet('jump','Mouse4');m(3,false);const held=!!KEY.Space;m(3,true);
   ok('mouse 4 as jump: held while down, let go when up',held&&!KEY.Space);
   V.saveSettings();const s2=await read();
   ok('saved as Mouse4 / Mouse5',s2&&s2.kb&&s2.kb.jump==='Mouse4'&&s2.kb.cam==='Mouse5');}

  V.kbReset();
});
