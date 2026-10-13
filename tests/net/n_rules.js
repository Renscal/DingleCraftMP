/* n_rules.js (v6.10, lane NET, gate x1): the server's own rules, the ones that make it behave like a Minecraft server instead
   of a relay. The real server (in this process, in memory, on an ephemeral 127.0.0.1 port) and raw sockets speaking the
   protocol; the game is booted only for its version number. Nothing leaves the machine; nothing is written.
   1 names: two live players with one name become name and name_2; a silent twin is replaced ("logged in from another
     location") and the newcomer keeps the name and its saved player
   2 bans, the whitelist, operators: /ban kicks and refuses, /pardon lets back in, the whitelist admits the listed and the ops
   3 commands: who may run what, /help by rights, /list, /me, /msg (only the two of them see it), /tp, /give, /gamemode (kept
     with the player across a rejoin), /gamerule, /setworldspawn, /kick, unknown commands, the settings callback
   4 deaths are worded by the server: a cause, a mob's name, a killer the server saw; free text from a client is never shown
   5 PvP hits are checked: reach, dimension, the dead, the cooldown; arrows reach further
   6 dropped items: only a player standing by one picks it up; its resting place can be corrected; it ages only while someone
     is online, and an old world file's wall-clock "born" becomes an age of 0
   7 sleeping is a vote (sleepPercent), valid for 30 s and only at night
   8 chests: one holder, others refused and their writes put back, freed on close and on leaving
   9 the world spawn (set once) and spawn protection (ops only)
   10 chunks: a joining player gets the edits around them, the rest as they travel (s:1), and live edits only for chunks they
      have; poses reach players nearby at full rate and everyone else once a second
   11 mobs and explosions are passed on to the players in range, a hand-over and a mob hit to the one they are for; junk is
      dropped; time and game rules need the right to change them
   12 the line (6.11): ping and pong, what a pose carries (ping, armour, a vehicle), marked edits, per-type and total message
      limits, chests and drops sent by range like edits, a chest write about a chunk not yet sent, the place of a player
      whose line dropped, the heir to their mobs, the origin check, compressed messages */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),{pathToFileURL}=require('url');
const {REPO}=require('../lib/paths.js');
const V=boot({});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||3000)){if(f())return true;await sleep(5);}return !!f();}

boot.run(async()=>{
  const lib=f=>import(pathToFileURL(path.join(REPO,'server',f)).href);
  const {createServer}=await lib('dinglecraft-server.mjs');
  const {worldTick}=await lib('lib/protocol.mjs'),{adoptWorld}=await lib('lib/world.mjs'),{LIMITS}=await lib('lib/config.mjs');
  let settingsCalls=0;
  const S=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,seed:'77',maxPlayers:6,sleepPercent:100,rules:{dayCycle:false},onSettings:()=>{settingsCalls++;}});
  await S.listen();
  const port=S.port,W=S.world();
  /* a raw player: joins, waits for ready, remembers its id */
  async function join(name,extra){
    const ws=new WebSocket('ws://127.0.0.1:'+port),R={ws,name,got:[],closed:false,by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),
      send:m=>ws.send(JSON.stringify(m)),clear:()=>{R.got.length=0;},quit:async()=>{ws.close();await until(()=>R.closed);await sleep(20);}};
    ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
    await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=()=>rej(new Error('socket'));});
    R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name,pw:'',...extra});
    await until(()=>!!R.last('ready')||R.closed);
    const w=R.last('welcome');R.id=w?w.id:0;R.as=w?w.name:'';
    R.pose=async(x,y,z,o)=>{await sleep(30);R.send({t:'pose',x,y,z,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0,...o});await sleep(25);};
    R.cmd=async txt=>{await sleep(130);R.clear();R.send({t:'cmd',txt});await until(()=>!!R.last('sys'),1500);return (R.last('sys')||{}).txt||'';};
    return R;
  }
  const srv=name=>S.players().find(c=>c.name===name);

  /* ===== 1. names ===== */
  const ann=await join('Ann');
  {const twin=await join('Ann');
    ok('two live players with one name: the second becomes Ann_2 and nobody is thrown out',twin.as==='Ann_2'&&!ann.closed&&S.players().length===2);
    await twin.quit();}
  {ann.send({t:'save',player:{x:5,y:40,z:5,inv:[{id:1,count:9}]}});await sleep(40);
    srv('Ann').seen=Date.now()-5000;                       /* the server has heard nothing from her for 5 s */
    const again=await join('ann');
    ok('a silent twin is replaced: the old connection is told why and closed',await until(()=>ann.closed)&&/another location/.test((ann.last('kick')||{}).why||''));
    ok('...and the newcomer has the name and its saved player',again.as==='ann'&&again.last('welcome').player.inv[0].count===9&&S.players().length===1);
    await again.quit();}
  const a=await join('Ann'),b=await join('Bob'),c=await join('Cy');
  await a.pose(0,40,0);await b.pose(3,40,0);await c.pose(500,40,0);

  /* ===== 2. bans, the whitelist, operators ===== */
  ok('the console may do everything; a banned player is kicked with the reason',/banned/.test(S.command('ban Cy rude'))&&await until(()=>c.closed)&&/banned.*rude/i.test((c.last('kick')||{}).why||''));
  {const r=await join('CY');ok('...and refused at the door (names compare without case)',r.closed&&/banned/i.test((r.last('kick')||{}).why||'')&&S.opts.bans.includes('cy'));}
  ok('/banlist, /pardon',/cy/.test(S.command('banlist'))&&/pardoned/.test(S.command('pardon Cy'))&&S.opts.bans.length===0&&/not banned/.test(S.command('pardon Cy')));
  S.command('whitelist add Ann');S.command('whitelist add Bob');S.command('whitelist on');
  {const r=await join('Cy');ok('the whitelist keeps out who is not on it',r.closed&&/whitelist/i.test((r.last('kick')||{}).why||''));}
  S.command('op Cy');
  {const r=await join('Cy');ok('...but always admits an operator',!r.closed&&r.as==='Cy'&&r.by('perm').some(m=>m.op===true));await r.quit();}
  S.command('deop Cy');S.command('whitelist off');
  ok('every change to ops, bans and the whitelist was reported for the settings file',settingsCalls>=7&&/off/.test(S.command('whitelist list')));
  const cy=await join('Cy');await cy.pose(500,40,0);

  /* ===== 3. commands ===== */
  ok('a player without rights may not run an operator command',/permission/.test(await a.cmd('/time day'))&&/permission/.test(await a.cmd('/op Ann'))&&/permission/.test(await a.cmd('/stop')));
  {const h=await a.cmd('/help');ok('/help lists only what that player may run',/\/msg/.test(h)&&/\/list/.test(h)&&!/\/ban\b/.test(h)&&!/\/gamemode/.test(h));}
  ok('/list, an unknown command, an empty one',/3 of 6 online: /.test(await a.cmd('/list'))&&/Unknown command/.test(await a.cmd('/frobnicate'))&&/\(127|\(::/.test(S.command('list'))&&S.command('')==='');
  {b.clear();cy.clear();const out=await a.cmd('/msg Bob psst over here');await until(()=>!!b.last('chat'),1500);
    ok('/msg: the target gets a whisper, the sender a receipt, nobody else anything',!!b.last('chat')&&b.last('chat').w===1&&b.last('chat').txt==='psst over here'&&b.last('chat').from==='Ann'&&/You whisper to Bob/.test(out)&&cy.got.length===0);
    ok('/msg to nobody',/No player called/.test(await a.cmd('/w Zed hi'))&&/Usage/.test(await a.cmd('/msg')));}
  {b.clear();await a.cmd('/me waves');await until(()=>b.by('sys').length>0,1500);ok('/me reaches everyone',b.by('sys').some(m=>m.txt==='* Ann waves'));}
  S.command('op Ann');await until(()=>a.by('perm').some(m=>m.op===true),1500);
  {const h=await a.cmd('/help');ok('an operator sees the operator commands (never /stop: that is the console\'s)',/\/ban\b/.test(h)&&/\/gamemode/.test(h)&&!/\/stop/.test(h));}
  {b.clear();const out=await a.cmd('/tp Bob 10 50 -4');await until(()=>!!b.last('tp'),1500);
    ok('/tp <who> <x y z> tells that player\'s game',/Teleported Bob/.test(out)&&b.last('tp').x===10&&b.last('tp').y===50&&b.last('tp').z===-4);
    a.clear();await a.cmd('/tp Bob');ok('/tp <player> takes the operator to them',!!a.last('tp')&&a.last('tp').x===3);
    ok('/tp refuses nonsense and other dimensions',/Usage/.test(await a.cmd('/tp 1 2 3 4 5'))&&/No player/.test(await a.cmd('/tp Zed'))&&(await cy.pose(500,40,0,{dim:'nether'}),/another dimension/.test(await a.cmd('/tp Cy'))));
    await cy.pose(500,40,0);}
  {b.clear();const out=await a.cmd('/give Bob 5 12');await until(()=>!!b.last('give'),1500);
    ok('/give sends a clean stack',/Gave 12/.test(out)&&b.last('give').st.id===5&&b.last('give').st.count===12&&/Usage/.test(await a.cmd('/give Bob stone'))&&/Usage/.test(await a.cmd('/give Bob 5 100000')));}
  {b.clear();await a.cmd('/gamemode creative Bob');await until(()=>!!b.last('mode'),1500);
    ok('/gamemode tells that player\'s game',b.last('mode').m==='c'&&srv('Bob').gm==='c');
    b.send({t:'save',player:{x:3,y:40,z:0,inv:[]}});await sleep(40);await b.quit();
    const b2=await join('Bob');
    ok('...and is kept with the player: a rejoin starts in that mode while the world stays survival',b2.last('welcome').world.mode==='c'&&W.mode==='s'&&W.players.bob.gm==='c');
    await b2.quit();}
  const bob=await join('Bob');await bob.pose(3,40,0);
  {bob.clear();const out=await a.cmd('/gamerule keepInv true');await until(()=>!!bob.last('gr'),1500);
    ok('/gamerule changes a rule for everyone; a bad value or rule does not',/keepInv is now true/.test(out)&&W.gr.keepInv===true&&bob.last('gr').gr.keepInv===true&&/Usage/.test(await a.cmd('/gamerule jsc lots'))&&/Rules:/.test(await a.cmd('/gamerule nope'))&&/keepInv is true/.test(await a.cmd('/gamerule keepinv')));}
  ok('/seed and /save answer',/Seed: /.test(await a.cmd('/seed'))&&/edited chunks/.test(await a.cmd('/save')));
  {const out=await a.cmd('/kick Cy be nice');ok('/kick with a reason',/kicked Cy/.test(out)&&await until(()=>cy.closed)&&/be nice/.test((cy.last('kick')||{}).why||''));}
  S.command('deop Ann');await sleep(30);

  /* ===== 4. deaths ===== */
  const said=async(m)=>{bob.clear();a.send({t:'death',...m});await until(()=>bob.by('sys').length>0,1500);return (bob.last('sys')||{}).txt||'';};
  ok('a death is worded by the server from its cause',(await said({how:'fall'}))==='Ann fell from a high place'&&(await said({how:'drown'}))==='Ann drowned'&&(await said({how:'void'}))==='Ann fell out of the world'&&(await said({how:'tnt'}))==='Ann blew up');
  ok('a mob\'s name is passed through only if it looks like a name',(await said({how:'mob',by:'Zombie'}))==='Ann was slain by Zombie'&&(await said({how:'arrow',by:'Skeleton'}))==='Ann was shot by Skeleton'&&(await said({how:'mob',by:'<b>x</b> [Server] hi'}))==='Ann died');
  ok('free text from a client is never shown: the old txt field is ignored',(await said({txt:'[Server] Bob is now an operator'}))==='Ann died'&&(await said({how:'made up'}))==='Ann died');

  /* ===== 5. PvP hits ===== */
  const hits=async(from,to,m,wait)=>{to.clear();from.send({t:'hit',to:to.id,dmg:4,kx:1,kz:0,...m});await sleep(wait||60);return to.by('hit').length;};
  await a.pose(0,40,0);await bob.pose(3,40,0);await sleep(LIMITS.hitGap+20);
  ok('a hit within reach is passed on, with the attacker\'s id and name',(await hits(a,bob))===1&&bob.last('hit').from===a.id&&bob.last('hit').name==='Ann'&&bob.last('hit').dmg===4);
  ok('the server saw it: the death that follows names the killer',await (async()=>{a.clear();bob.send({t:'death',how:'fall'});await until(()=>a.by('sys').length>0,1500);return (a.last('sys')||{}).txt==='Bob was slain by Ann';})());
  ok('a second hit inside the cooldown is dropped',(await hits(a,bob,{},20))===0);
  await sleep(LIMITS.hitGap+20);await bob.pose(3+LIMITS.hitReach+2,40,0);
  ok('out of reach: dropped',(await hits(a,bob))===0);
  await sleep(LIMITS.hitGap+20);
  ok('...but an arrow or a bullet reaches that far',(await hits(a,bob,{shot:1}))===1);
  await bob.pose(3,40,0,{dim:'nether'});await sleep(LIMITS.hitGap+20);
  ok('another dimension: dropped',(await hits(a,bob))===0);
  await bob.pose(3,40,0,{fl:4});await sleep(LIMITS.hitGap+20);
  ok('the dead are not hit',(await hits(a,bob))===0);
  await bob.pose(3,40,0);await sleep(LIMITS.hitGap+20);
  ok('a hit on yourself, on nobody, with a silly damage',(await hits(a,a))===0&&(a.send({t:'hit',to:9999,dmg:1}),true)&&(await hits(a,bob,{dmg:1e9}))===1&&bob.last('hit').dmg===40);

  /* ===== 6. dropped items ===== */
  a.send({t:'drop',id:'rules001.1',dim:'over',x:1,y:40,z:1,vx:0,vy:0,vz:0,st:{id:1,count:5}});await until(()=>'rules001.1' in W.drops,1500);
  ok('a new drop starts at age 0 (no wall-clock time in the record)',W.drops['rules001.1'].age===0&&!('born' in W.drops['rules001.1']));
  await bob.pose(60,40,0);bob.clear();bob.send({t:'take',id:'rules001.1'});await sleep(60);
  ok('a player nowhere near it cannot pick it up, and it is not taken from them either',('rules001.1' in W.drops)&&bob.by('took').length===0&&bob.by('undrop').length===0);
  a.send({t:'dropAt',id:'rules001.1',x:58,y:40,z:1});await sleep(40);
  ok('its resting place can be corrected by a player who sees it',W.drops['rules001.1'].x===58);
  bob.send({t:'take',id:'rules001.1'});await until(()=>bob.by('took').length>0,1500);
  ok('standing by it: taken, and everyone else sees it go',bob.by('took').length===1&&!('rules001.1' in W.drops)&&a.by('undrop').some(m=>m.id==='rules001.1'));
  {const F={world:{time:0.3,gr:{},drops:{d1:{dim:'over',x:0,y:0,z:0,st:{id:1,count:1},age:LIMITS.dropLife-3},art:{dim:'over',x:0,y:0,z:0,st:{id:10001,count:1},age:1e9}}},clients:new Map(),dirty:false};
    const sent=[],net={broadcast:m=>sent.push(m)},T={time:0,drops:0};
    for(let i=0;i<20;i++)worldTick(F,net,T,Date.now(),1);
    ok('an empty server ages nothing: the drop is still there after 20 s, and the clock has not moved',F.world.drops.d1.age===LIMITS.dropLife-3&&F.world.time===0.3&&sent.length===0);
    F.clients.set(1,{});for(let i=0;i<6;i++)worldTick(F,net,T,Date.now(),1);
    ok('with a player online it ages, and goes when its 5 minutes are up (a Creativity work never does)',!('d1' in F.world.drops)&&('art' in F.world.drops)&&sent.some(m=>m.t==='undrop'&&m.id==='d1'));
    const old=adoptWorld({seed:1,drops:{x:{dim:'over',x:0,y:0,z:0,st:{id:1,count:1},born:1}},spawn:{x:1,y:2,z:'no'}},{name:'w'});
    ok('a world file from before: "born" becomes an age of 0 (nothing expires on load), a bad spawn is dropped',old.drops.x.age===0&&!('born' in old.drops.x)&&old.spawn===null);}

  /* ===== 7. sleeping ===== */
  await a.pose(0,40,0);await bob.pose(3,40,0);
  S.setTime(0.25);a.clear();a.send({t:'sleep'});await until(()=>a.by('sys').length>0,1500);
  ok('by day: no vote',/only sleep at night/.test(a.last('sys').txt)&&W.time===0.25);
  S.setTime(0.75);await sleep(20);bob.clear();a.send({t:'sleep'});await until(()=>bob.by('sys').length>0,1500);
  ok('at night, one of two: everyone is told the count',/Ann is sleeping \(1 of the 2/.test(bob.last('sys').txt)&&W.time===0.75);
  await a.pose(20,40,0);bob.clear();bob.send({t:'sleep'});await until(()=>bob.by('sys').length>0,1500);
  ok('a sleeper who walked away no longer counts',/Bob is sleeping \(1 of the 2/.test(bob.last('sys').txt)&&W.time===0.75);
  a.send({t:'sleep'});await until(()=>W.time<0.2,1500);
  ok('both in bed: morning, for everyone',W.time===0.05&&bob.by('time').some(m=>m.slept===1&&m.v===0.05));
  {S.opts.sleepPercent=50;S.setTime(0.75);await sleep(20);a.send({t:'sleep'});await until(()=>W.time<0.2,1500);
    ok('sleepPercent 50: one of two is enough',W.time===0.05);S.opts.sleepPercent=100;}

  /* ===== 8. chests ===== */
  await a.pose(0,40,0);await bob.pose(3,40,0);
  {const k='2,40,2';a.send({t:'be',k,v:{t:'chest',inv:[{id:1,count:1}]}});await until(()=>k in W.be,1500);
    a.clear();a.send({t:'open',k});await until(()=>!!a.last('lock'),1500);
    ok('open: the latest contents, then the lock',a.last('lock').ok===true&&a.got.findIndex(m=>m.t==='be')<a.got.findIndex(m=>m.t==='lock')&&a.got.findIndex(m=>m.t==='be')>=0);
    bob.clear();bob.send({t:'open',k});await until(()=>!!bob.last('lock'),1500);
    ok('a second player is refused and told who has it',bob.last('lock').ok===false&&bob.last('lock').by==='Ann');
    bob.clear();bob.send({t:'be',k,v:{t:'chest',inv:[{id:2,count:64}]}});await until(()=>!!bob.last('be'),1500);
    ok('their write does not land; they get the real contents back',W.be[k].inv[0].id===1&&bob.last('be').v.inv[0].id===1);
    a.send({t:'be',k,v:{t:'chest',inv:[{id:3,count:2}]}});await until(()=>W.be[k].inv[0].id===3,1500);
    ok('the holder\'s write lands and reaches the others',W.be[k].inv[0].id===3&&await until(()=>bob.by('be').some(m=>m.v&&m.v.inv[0].id===3),1500));
    bob.send({t:'close',k});await sleep(30);bob.clear();bob.send({t:'open',k});await until(()=>!!bob.last('lock'),1500);
    ok('only the holder can let go',bob.last('lock').ok===false);
    a.send({t:'close',k});await sleep(30);bob.clear();bob.send({t:'open',k});await until(()=>!!bob.last('lock'),1500);
    ok('closed: the next player gets it',bob.last('lock').ok===true);
    await bob.quit();a.clear();a.send({t:'open',k});await until(()=>!!a.last('lock'),1500);
    ok('a holder who left the server has let go',a.last('lock').ok===true);a.send({t:'close',k});
    a.send({t:'open',k:'../../x'});a.send({t:'open',k:5});await sleep(30);ok('a bad key is ignored',!a.closed);}
  const bo=await join('Bob');await bo.pose(3,40,0);

  /* ===== 9. the world spawn, spawn protection ===== */
  ok('no spawn yet: a joining player is told so (their game will look for one)',bo.by('perm').some(m=>m.spawn===null&&m.prot===0)&&W.spawn===null);
  bo.clear();a.send({t:'spawn',x:'no',y:1,z:1});a.send({t:'spawn',x:100.5,y:42,z:-20.5});await until(()=>!!W.spawn,1500);a.send({t:'spawn',x:1,y:1,z:1});await sleep(30);
  ok('the first good report sets it, for good; everyone is told',W.spawn.x===100.5&&W.spawn.z===-20.5&&bo.by('perm').some(m=>m.spawn&&m.spawn.x===100.5&&m.prot===0));
  const ck=(x,z)=>Math.floor(x/16)+','+Math.floor(z/16),lk=(x,y,z)=>(x-Math.floor(x/16)*16)+','+y+','+(z-Math.floor(z/16)*16);
  const edit=async(r,x,y,z,id,key)=>{r.send({t:'edits',e:[[(key||'')+ck(x,z),lk(x,y,z),id]]});await sleep(40);return (W.edits[(key||'')+ck(x,z)]||{})[lk(x,y,z)]===id;};
  await a.pose(100,40,-20);await bo.pose(101,40,-20);
  ok('no operators: anyone builds at spawn',await edit(bo,100,50,-21,7));
  S.command('op Ann');await until(()=>bo.by('perm').some(m=>m.prot===16),1500);
  ok('with an operator: the others are told the radius, the operator that it does not hold them',bo.by('perm').some(m=>m.prot===16&&m.op===false)&&a.by('perm').some(m=>m.op===true&&m.prot===0));
  ok('a non-operator\'s edit inside the square is dropped, on its edge too',!(await edit(bo,100,51,-21,7))&&!(await edit(bo,116,51,-21,7))&&!(await edit(bo,100,51,-37,7)));
  ok('...just outside it, in another dimension, or from the operator, it lands',(await edit(bo,117,51,-21,7))&&(await edit(bo,100,51,-21,7,'n;'))&&(await edit(a,100,52,-21,7)));
  {const out=await a.cmd('/setworldspawn 0 40 0');ok('/setworldspawn moves it (and the protection with it)',/world spawn is now 0 40 0/.test(out)&&W.spawn.x===0&&(await edit(bo,100,53,-21,7))&&!(await edit(bo,1,53,1,7)));}
  S.command('deop Ann');await sleep(30);

  /* ===== 10. chunks and poses by distance ===== */
  W.edits['0,0']={'1,50,1':9};W.edits['60,0']={'2,50,2':9};W.edits['n;0,0']={'3,50,3':9};
  {const d=await join('Dee');const got=()=>d.by('edits').flatMap(m=>m.e);
    ok('a new player gets the edits around the world spawn, not the far chunk or the other dimension',got().some(e=>e[0]==='0,0')&&!got().some(e=>e[0]==='60,0')&&!got().some(e=>e[0]==='n;0,0'));
    d.clear();await a.pose(962,40,2);a.send({t:'edits',e:[['60,0','4,50,4',9],['0,0','5,50,5',9]]});await sleep(60);
    ok('a live edit goes only to players who have that chunk',got().length===1&&got()[0][0]==='0,0'&&W.edits['60,0']['4,50,4']===9);
    d.clear();await d.pose(960,40,0);await until(()=>got().some(e=>e[0]==='60,0'),1500);
    ok('travelling there brings the whole chunk (marked s:1: old news, no side effects), the edit made meanwhile included',got().filter(e=>e[0]==='60,0').length===2&&d.by('edits').every(m=>m.s===1));
    d.clear();await d.pose(961,40,0);await d.pose(962,40,1);await sleep(40);
    ok('...once: moving about inside known chunks sends nothing again',got().length===0);
    d.clear();await d.pose(5,40,5,{dim:'nether'});await until(()=>got().length>0,1500);
    ok('another dimension has its own chunks',got().some(e=>e[0]==='n;0,0')&&got().every(e=>e[0].startsWith('n;')));
    d.clear();d.send({t:'rd',v:4});await sleep(30);ok('a draw distance is clamped and never resends what is known',srv('Dee').rd===4&&got().length===0);
    await d.pose(0,40,0);await a.pose(2,40,0);await bo.pose(700,40,0);await sleep(1050);
    d.clear();bo.clear();for(let i=0;i<5;i++)await a.pose(2+i*0.1,40,0);await sleep(40);
    ok('poses: a player nearby sees every one, a player far away one a second',d.by('pose').filter(m=>m.id===a.id).length===5&&bo.by('pose').filter(m=>m.id===a.id).length===1);
    bo.clear();await a.pose(2,40,0,{dim:'nether'});await sleep(30);
    ok('...and a change of dimension at once',bo.by('pose').some(m=>m.id===a.id&&m.dim==='nether'));
    await a.pose(2,40,0);await d.quit();}

  /* ===== 11. mobs, explosions, rights ===== */
  await a.pose(0,40,0);await bo.pose(3,40,0);
  const far=await join('Far');await far.pose(900,40,0);
  bo.clear();far.clear();a.send({t:'mobs',m:[['a.1','zombie',1,40,1,0,20,0],'junk',['a.2','pig',1,40,1,0,{},0],[1,2],['a.3','cow',2,40,2,0.5,10,0]]});await until(()=>!!bo.last('mobs'),1500);
  ok('mobs go to the players in range, with their owner; junk entries are dropped',bo.last('mobs').from===a.id&&bo.last('mobs').m.length===2&&bo.last('mobs').m[1][0]==='a.3'&&far.by('mobs').length===0);
  bo.clear();a.send({t:'mgone',ids:['a.1',5,'x'.repeat(40)],dead:1});await until(()=>!!bo.last('mgone'),1500);
  ok('...and so do their deaths',bo.last('mgone').ids.length===1&&bo.last('mgone').dead===1&&far.by('mgone').length===0);
  bo.clear();far.clear();a.send({t:'mgive',to:bo.id,m:['a.3','cow',2,40,2,0.5,10,0]});a.send({t:'mgive',to:far.id,m:['a.3','cow',2,40,2,0.5,10,0]});await until(()=>!!bo.last('mgive'),1500);
  ok('a hand-over reaches only the player it is for, and only one in range',bo.by('mgive').length===1&&bo.last('mgive').from===a.id&&far.by('mgive').length===0);
  a.clear();bo.send({t:'mhit',to:a.id,id:'a.3',dmg:4,kx:1,kz:0});await until(()=>!!a.last('mhit'),1500);
  ok('a hit on a mob goes to the player whose game runs it',a.last('mhit').id==='a.3'&&a.last('mhit').dmg===4&&a.last('mhit').from===bo.id&&a.last('mhit').name==='Bob');
  bo.clear();far.clear();a.send({t:'boom',x:1,y:40,z:1,r:3});a.send({t:'boom',x:5000,y:40,z:1,r:3});await until(()=>!!bo.last('boom'),1500);
  ok('an explosion reaches the players near it and may hurt (PvP on); one claimed far from the sender is dropped',bo.by('boom').length===1&&bo.last('boom').hurt===1&&bo.last('boom').name==='Ann'&&far.by('boom').length===0);
  {S.opts.pvp=false;bo.clear();a.send({t:'boom',x:1,y:40,z:1,r:3});a.send({t:'boom',x:1,y:40,z:1,r:3,mob:1});await until(()=>bo.by('boom').length===2,1500);
    ok('with PvP off a player\'s explosion is only a bang; a mob\'s still hurts',bo.by('boom').length===2&&bo.by('boom')[0].hurt===0&&bo.by('boom')[1].hurt===1);S.opts.pvp=true;}
  {const t0=W.time;a.clear();a.send({t:'time',v:0.9});await until(()=>!!a.last('time'),1500);
    ok('the clock: a player without the right is sent the real time back',W.time===t0&&Math.abs(a.last('time').v-t0)<0.001);
    a.clear();a.send({t:'gr',gr:{god:true}});await until(()=>!!a.last('gr'),1500);
    ok('game rules: the same',W.gr.god===false&&a.last('gr').gr.god===false);
    W.gr.cheats=true;a.send({t:'gr',gr:{god:true}});a.send({t:'time',v:0.9});await until(()=>W.gr.god===true&&Math.abs(W.time-0.9)<1e-6,1500);
    ok('with Cheats on, anyone may (the host chose that)',W.gr.god===true&&Math.abs(W.time-0.9)<1e-6);W.gr.cheats=false;}
  {a.clear();await sleep(1010);for(let i=0;i<12;i++)a.send({t:'cmd',txt:'/list'});await sleep(80);
    ok('commands are rate limited',a.by('sys').some(m=>m.txt==='Slow down.'));}

  /* ===== 6b. a thrown item and its thrower (6.21) ===== */
  {await a.pose(0,40,0);await bo.pose(1,40,0);bo.clear();
    a.send({t:'drop',id:'thrown01.1',dim:'over',x:0,y:40,z:0,vx:0,vy:0,vz:0,st:{id:1,count:1},by:1});await until(()=>'thrown01.1' in W.drops,1500);
    ok('a throw is passed on with its thrower\'s name (the server\'s word for it, not the game\'s), and that is not written into the world',bo.last('drop').by==='Ann'&&!JSON.stringify(W.drops['thrown01.1']).includes('by'));
    a.clear();a.send({t:'take',id:'thrown01.1'});await sleep(120);
    ok('the thrower cannot pick it straight back up: no answer, like a lost race, and it stays where it is',a.by('took').length===0&&a.by('undrop').length===0&&('thrown01.1' in W.drops));
    await sleep(LIMITS.throwWait+100);a.send({t:'take',id:'thrown01.1'});await until(()=>!!a.last('took'),1500);
    ok('...and can after 2 seconds',!!a.last('took')&&!('thrown01.1' in W.drops));
    a.send({t:'drop',id:'thrown02.1',dim:'over',x:0,y:40,z:0,vx:0,vy:0,vz:0,st:{id:1,count:1},by:1});await until(()=>'thrown02.1' in W.drops,1500);
    bo.clear();bo.send({t:'take',id:'thrown02.1'});await until(()=>!!bo.last('took'),1500);
    ok('anybody else takes a throw at once',!!bo.last('took')&&!('thrown02.1' in W.drops));
    a.send({t:'drop',id:'plain001.1',dim:'over',x:0,y:40,z:0,vx:0,vy:0,vz:0,st:{id:1,count:1}});await until(()=>'plain001.1' in W.drops,1500);
    a.clear();a.send({t:'take',id:'plain001.1'});await until(()=>!!a.last('took'),1500);
    ok('a drop that was not thrown (a broken block) is its own maker\'s to take at once, as before',!!a.last('took'));}

  /* ===== 12. the line (6.11) ===== */
  const {textFrame,readFrames,DEFLATE_MIN}=await lib('lib/websocket.mjs'),{RATE}=await lib('lib/config.mjs'),zlib=require('zlib'),net=require('net');
  await sleep(1010);
  {a.clear();a.send({t:'ping',n:7,ms:42});await until(()=>!!a.last('pong'),1500);
    ok('a ping is answered at once with its own number',!!a.last('pong')&&a.last('pong').n===7);
    const seen=async o=>{bo.clear();await a.pose(1,40,0,o);await until(()=>bo.by('pose').some(m=>m.id===a.id),1500);return bo.by('pose').filter(m=>m.id===a.id).pop()||{};};
    const p1=await seen({ar:[230,0,0,243],rv:'car',ry:1.5,rh:0.4,fl:8});
    ok('a pose is passed on with the ping the game measured, the armour worn and the vehicle ridden',p1.ms===42&&JSON.stringify(p1.ar)==='[230,0,0,243]'&&p1.rv==='car'&&p1.ry===1.5&&p1.rh===0.4);
    const p2=await seen({ar:[0,0,0,0],rv:'rocket',ry:9});
    ok('bare armour slots and a vehicle the game does not have are left out',!('ar' in p2)&&!('rv' in p2)&&!('ry' in p2));
    await sleep(1010);a.clear();for(let i=0;i<RATE.ping+5;i++)a.send({t:'ping',n:i});await sleep(150);
    ok('each kind of message has its own limit per second: '+RATE.ping+' pings are answered, the rest dropped',a.by('pong').length===RATE.ping);}
  {const sp0=S.opts.spawnProtection;S.opts.spawnProtection=0;bo.clear();
    a.send({t:'edits',e:[['1,1','1,50,1',5,1],['1,1','2,50,1',5],['1,1','3,50,1',5,7]]});await until(()=>!!bo.last('edits'),1500);
    const e=(bo.last('edits')||{e:[]}).e;
    ok('an edit made by hand keeps its mark on the way to the others; anything else in that place is dropped',e.length===3&&e[0][3]===1&&e[1].length===3&&e[2].length===3);
    S.opts.spawnProtection=sp0;}
  /* chests and dropped items by range */
  {W.be['2,40,2']={t:'chest',inv:[]};W.be['4000,40,4000']={t:'chest',inv:[]};W.be['n;2,40,2']={t:'chest',inv:[]};
    W.drops['nearnear.1']={dim:'over',x:2,y:40,z:2,st:{id:1,count:1},age:0};W.drops['farfar01.1']={dim:'over',x:4000,y:40,z:4000,st:{id:1,count:1},age:0};
    W.players.scout={x:1,y:40,z:1,dim:'over',yaw:0,pitch:0};
    const sc=await join('Scout');
    const beKeys=()=>sc.by('bes').flatMap(m=>Object.keys(m.m)),dropIds=()=>sc.by('drops').flatMap(m=>m.d.map(d=>d.id));
    ok('joining: the chests and dropped items around the player come with the world, marked as "more", not the ones far away or in another dimension',
      sc.by('bes').every(m=>m.add===1)&&beKeys().includes('2,40,2')&&!beKeys().includes('4000,40,4000')&&!beKeys().includes('n;2,40,2')&&dropIds().includes('nearnear.1')&&!dropIds().includes('farfar01.1'));
    sc.send({t:'be',k:'9000,40,9000',v:{t:'chest',inv:[1]}});await sleep(60);
    ok('a chest write about a chunk the player has not been sent is ignored (their game made that chunk afresh; the server\'s copy stands)',!('9000,40,9000' in W.be));
    sc.clear();await sc.pose(4000,40,4000);await until(()=>beKeys().includes('4000,40,4000'),1500);
    ok('travelling: the far chest and the far drop arrive with their chunk',beKeys().includes('4000,40,4000')&&dropIds().includes('farfar01.1')&&!beKeys().includes('2,40,2'));
    sc.send({t:'be',k:'4001,40,4001',v:{t:'chest',inv:[]}});await until(()=>'4001,40,4001' in W.be,1500);
    ok('...and from then on their chest writes there count',('4001,40,4001' in W.be));
    {const c=srv('Scout'),n0=c.sent.size;for(let i=1;i<=40;i++){c.pose.x=4000+i*400;c.sk='';sc.send({t:'pose',x:4000+i*400,y:40,z:4000,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0});await sleep(28);}
      ok('the list of chunks a player has is trimmed as they travel ('+n0+' at the start, '+c.sent.size+' after 16000 blocks)',c.sent.size<n0*4&&c.sent.size>=n0);}
    await sc.pose(4000,40,4000);await sc.pose(4010,41,4020,{yaw:1.25});
    await sc.quit();
    ok('a player whose line dropped is remembered where the server last saw them',W.players.scout.x===4010&&W.players.scout.y===41&&W.players.scout.z===4020&&W.players.scout.yaw===1.25);
    W.players.scout.dim='over';const s2=await join('Scout');await s2.pose(5,40,5,{dim:'nether'});await s2.quit();
    ok('...but never moved into a dimension they were not saved in',W.players.scout.x===4010&&W.players.scout.dim==='over');
    delete W.be['2,40,2'];delete W.be['4000,40,4000'];delete W.be['n;2,40,2'];delete W.be['4001,40,4001'];delete W.drops['nearnear.1'];delete W.drops['farfar01.1'];}
  /* the heir */
  {await a.pose(0,40,0);await bo.pose(3,40,0);const g=await join('Gone');await g.pose(1,40,0);const gid=g.id;a.clear();bo.clear();far.clear();await g.quit();await sleep(60);
    ok('the mobs of a player who left go to the nearest player: that one is told, nobody else',a.by('mheir').length===1&&a.last('mheir').from===gid&&bo.by('mheir').length===0&&far.by('mheir').length===0&&
      a.got.findIndex(m=>m.t==='mheir')<a.got.findIndex(m=>m.t==='leave'));
    await a.pose(0,40,0,{fl:32});const g2=await join('Gone');await g2.pose(1,40,0);const gid2=g2.id;a.clear();bo.clear();await g2.quit();await sleep(60);
    ok('...never to one whose game is paused',a.by('mheir').length===0&&bo.by('mheir').length===1&&bo.last('mheir').from===gid2);await a.pose(0,40,0);}
  /* too many messages */
  {const m0=LIMITS.msgsPerSec,f0=LIMITS.floodSecs;LIMITS.msgsPerSec=20;LIMITS.floodSecs=1;
    const fl=await join('Flood');await sleep(1010);for(let i=0;i<40;i++)fl.send({t:'rd',v:8});await sleep(1050);for(let i=0;i<40;i++)fl.send({t:'rd',v:8});await sleep(1050);for(let i=0;i<40;i++)fl.send({t:'rd',v:8});
    await until(()=>fl.closed,3000);
    ok('a player who keeps sending far more than a game does is dropped, with the reason',fl.closed&&/Too many/.test((fl.last('kick')||{}).why||'')&&!srv('Flood')&&!a.closed);
    LIMITS.msgsPerSec=m0;LIMITS.floodSecs=f0;}
  /* who may connect, and compression */
  {const shake=(port,extra)=>new Promise(res=>{let d='';const s=net.connect(port,'127.0.0.1',()=>s.write('GET / HTTP/1.1\r\nHost: 127.0.0.1:'+port+'\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n'+(extra||'')+'\r\n'));
      s.on('data',b=>{d+=b;if(d.includes('\r\n\r\n')){s.destroy();res(d);}});s.on('close',()=>res(d));s.on('error',()=>res(d));});
    const ok101=d=>/^HTTP\/1\.1 101/.test(d);
    ok('by default a page from anywhere may connect (that is what "open your own copy of the game" needs)',ok101(await shake(port,'Origin: http://elsewhere.test\r\n')));
    const S6=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,origins:['https://good.test/','Other.Test']});await S6.listen();const p6=S6.port;
    ok('with origins listed: other pages are refused',!ok101(await shake(p6,'Origin: http://evil.test\r\n')));
    ok('...the listed ones, the server\'s own page, a game opened from a file and a program that is not a browser are let in',ok101(await shake(p6,'Origin: https://good.test\r\n'))&&ok101(await shake(p6,'Origin: http://other.test\r\n'))&&
      ok101(await shake(p6,'Origin: http://127.0.0.1:'+p6+'\r\n'))&&ok101(await shake(p6,'Origin: null\r\n'))&&ok101(await shake(p6,'Origin: file://\r\n'))&&ok101(await shake(p6,'')));
    const hs=await shake(p6,'Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits\r\n');
    ok('compression is agreed when the game offers it (each message on its own), and not otherwise',/Sec-WebSocket-Extensions: permessage-deflate; server_no_context_takeover; client_no_context_takeover\r\n/.test(hs)&&!/Sec-WebSocket-Extensions/.test(await shake(p6,'')));
    await S6.close();
    const big=JSON.stringify({t:'edits',e:Array.from({length:600},(_,i)=>['0,0',(i%16)+',40,'+((i>>4)%16),1])}),small='{"t":"pose","x":1}';
    const z=textFrame(big,true),pl=textFrame(big,false);
    const body=z.subarray(z[1]===126?4:z[1]===127?10:2);
    ok('a big message to a player who agreed goes out compressed ('+pl.length+' -> '+z.length+' bytes) and opens to the same text; a small one, or one for a player who did not, goes as it is',
      z[0]===0xc1&&pl[0]===0x81&&z.length<pl.length/4&&zlib.inflateRawSync(Buffer.concat([body,Buffer.from([0,0,255,255])]),{finishFlush:zlib.constants.Z_SYNC_FLUSH}).toString()===big&&
      textFrame(small,true)[0]===0x81&&small.length<DEFLATE_MIN);
    /* the other way: a masked, compressed frame as a browser sends it */
    const frame=(text,zip)=>{let b=Buffer.from(text);if(zip){const q=zlib.deflateRawSync(b,{finishFlush:zlib.constants.Z_SYNC_FLUSH});b=q.subarray(0,q.length-4);}
      const h=b.length<126?Buffer.from([zip?0xc1:0x81,0x80|b.length]):Buffer.from([zip?0xc1:0x81,0x80|126,b.length>>8,b.length&255]),mk=Buffer.from([7,11,13,17]),p=Buffer.from(b);
      for(let i=0;i<p.length;i++)p[i]^=mk[i&3];return Buffer.concat([h,mk,p]);};
    const feed=(buf,deflate,max)=>{let got=null,fail=null;readFrames({sock:{write(){}},buf:Buffer.alloc(0),parts:null,partLen:0,closed:false,deflate,zip:false},buf,max||LIMITS.frame,t=>{got=t;},w=>{fail=w;});return {got,fail};};
    ok('a compressed message from a game is opened; from one that never agreed to it, it is a bad frame',feed(frame(big,true),true).got===big&&feed(frame(big,true),false).fail==='bad frame'&&feed(frame(small,false),true).got===small);
    ok('a small message that would unfold past the size limit is refused, not unfolded',feed(frame('x'.repeat(60000),true),true,5000).fail==='message too big');}

  await S.close();
});
