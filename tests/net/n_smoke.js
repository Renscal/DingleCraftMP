/* n_smoke.js (v6.10, lane NET, gate x2): multiplayer end to end, hermetic. The real server (server/dinglecraft-server.mjs, in
   this process, in memory, on an ephemeral 127.0.0.1 port) + the real game booted headless as one player (through Node's own
   WebSocket) + a second player that is a raw socket speaking the protocol ("Bea"). Nothing leaves the machine; nothing is written.
   1 the seams, and single player is untouched (NET.on false: setBlock queues nothing, saveToStorage still saves locally)
   2 ntUrl: bare host -> ws://host:40162, a port kept, a scheme kept, http:// stripped, empty -> null
   3 join: hello -> welcome -> edits -> bes -> ready; the game is in the server's world (seed, mode, time, the edits already there,
     the chest already there), and it never became this browser's "last world"
   4 blocks both ways: Dan's setBlock reaches Bea and the server's world; Bea's edit lands in Dan's loaded chunk; an edit in an
     unloaded chunk (and in another dimension) waits in chunkEdits; nothing echoes back
   5 chests: Bea's chest contents appear in Dan's blockEnts; Dan's change reaches Bea; a furnace's timers alone send nothing
   6 the other player: pose -> a peer (the Tab list row, the dimension label), leaving removes it
   7 chat both ways, system lines, a remote "Dan" does not read as you
   8 PvP: Bea hits Dan (hp drops), Dan's left click on Bea sends a hit (and mines nothing)
   9 time: the server's clock moves Dan's, and a local jump (a bed) is sent to the server
   10 game rules: a local change is sent, a remote one applied (only rules the game has)
   11 saving: saveToStorage goes to the server (the player by name), not to local storage; rejoining restores inventory and position
   12 refusals: a wrong password, a full server, an old game; a kick returns Dan to the title with the reason
   13 the server: /status, a served game file when given one, bad input ignored (bad keys, bad ids, oversized), the world file
      round trip (adopt an exported save: the exporter's player, ents and bots are dropped)
   14 world settings in the settings file: rules and mode applied on every start over the world file, bad rules ignored, a rule
      changed in the game reported back, and the real program writing and re-reading data/server.json
   15 dropped items: both ways, the server's record and resting place, no merging online, pickup granted by the server (first
      come first served, never twice), a full inventory, unloaded chunks and other dimensions, suppression under NET.ap, refusals,
      expiry, a dimension change (no stash, no false "destroyed"), and the drops still there after a rejoin and in the world file
   16 the world spawn (found by the first player's game, kept by the server) and spawn protection (only with operators, never
      for them; the game's own guard and the server's refusal)
   17 chests: one player at a time (asked first, refused while someone else is in it, their write put back, freed on close and
      when the holder walks away)
   18 a bed is a vote: one sleeper of two is not enough, both are, and only at night
   19 chunks arrive as you travel: a far chunk's edits are not sent until the player goes there (/tp and /gamemode from the
      console), then land without side effects; an item moved out of the inventory is saved to the server at once
   20 shared mobs: another player's mob is a puppet here (no brain, a hit goes to its owner, gone when told or when silent),
      this game's mobs go out, take a remote hit, are handed to a nearer player and taken back
   21 explosions and arrows reach the other player; one game runs the water where two players stand */
'use strict';
const fetch=global.fetch;   /* the boot rig replaces global fetch with one that throws; this suite talks to its own 127.0.0.1 server */
const boot=require('../lib/c_boot.js'),{ok}=boot;
const path=require('path'),fs=require('fs'),{pathToFileURL}=require('url');
const {REPO,outDir}=require('../lib/paths.js');
const V=boot({});
const step=boot.stepper(900000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(f,ms){const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;await sleep(10);}return !!f();}
/* a raw second player */
function raw(port,hello){
  const ws=new WebSocket('ws://127.0.0.1:'+port),R={ws,got:[],closed:false,by:t=>R.got.filter(m=>m.t===t),last:t=>R.by(t).pop(),
    send:m=>ws.send(JSON.stringify(m)),clear:()=>{R.got.length=0;}};
  ws.onmessage=e=>R.got.push(JSON.parse(e.data));ws.onclose=()=>{R.closed=true;};
  R.open=new Promise((res,rej)=>{ws.onopen=()=>{if(hello)R.send({t:'hello',proto:V.NT_PROTO,v:V.GAME_VERSION,name:'Bea',...hello});res();};ws.onerror=()=>rej(new Error('socket'));});
  return R;
}

boot.run(async()=>{
  const {createServer,PROTO,RULES}=await import(pathToFileURL(path.join(REPO,'server','dinglecraft-server.mjs')).href);
  const NET=V.NET,B=V.B;
  /* frames: the suite steps the game by hand and lets the sockets breathe in between */
  const pump=async(n)=>{for(let i=0;i<(n||6);i++){step(2);await sleep(8);}};

  /* ===== 1. seams, single player untouched ===== */
  ok('the multiplayer seams are on __vox',['ntUrl','ntConnect','ntLeave','ntMsg','ntSend','ntEnter','ntApplyEdit','ntApplyBE','ntFrame','ntMelee','ntTabRows','ntSave'].every(k=>typeof V[k]==='function')&&NET&&NET.on===false);
  ok('the game and the server speak the same protocol',V.NT_PROTO===PROTO);
  V.startNewWorld('nsolo','1337','s');V.GR.mobSpawn=false;V.GR.snail=false;step(160);
  {const P=V.P,x=Math.floor(P.x)+2,z=Math.floor(P.z),y=Math.floor(P.y)+3;V.setBlock(x,y,z,B.STONE);step(3);
    ok('single player: setBlock queues nothing and nothing is sent',NET.q.length===0&&NET.stats.out===0&&NET.on===false);}
  {const saved=await V.saveToStorage('nsolo',true);const r=await window.storage.get('vxw:nsolo');
    ok('single player: saveToStorage still writes the local world',saved===true&&!!r&&JSON.parse(r.value).seed===V.hashSeed('1337'));}
  await V.quitToTitle();

  /* ===== 2. addresses ===== */
  ok('ntUrl: a bare host gets ws:// and the default port',V.ntUrl('example.test')==='ws://example.test:40162'&&V.NT_PORT===40162);
  ok('ntUrl: a port, a scheme and an http:// prefix',V.ntUrl('10.0.0.5:4000')==='ws://10.0.0.5:4000'&&V.ntUrl('wss://x.test/y')==='wss://x.test/y'&&V.ntUrl(' http://host:81/ ')==='ws://host:81');
  {const H=V.ntHostHere;ok('a page served by the server prefills its own address: http on port 80 spells out :80, another port and https are kept as they are',
    H({host:'play.test',port:'',protocol:'http:'})==='play.test:80'&&V.ntUrl('play.test:80')==='ws://play.test:80'&&H({host:'play.test:40162',port:'40162',protocol:'http:'})==='play.test:40162'&&H({host:'play.test',port:'',protocol:'https:'})==='play.test');}
  ok('ntUrl: nothing typed is null',V.ntUrl('')===null&&V.ntUrl('   ')===null&&V.ntUrl(null)===null);

  /* ===== the server, with a world that already has an edit, a chest and a known player ===== */
  const S=createServer({port:0,memory:true,world:'',noGame:true,quiet:true,seed:'4242',name:'Test Server',motd:'be nice',maxPlayers:2,password:'pw',rules:{mobSpawn:false,snail:false,keepInv:true,jsc:'lots',madeUp:true}});   /* no mobs: nothing may push or hurt Dan mid-check */
  await S.listen();
  const port=S.port,W=S.world();
  /* find a spot near the spawn the game will pick, in the server's seed, without touching the server */
  V.startNewWorld('nprobe','4242','s');step(30);
  const sx=Math.floor(V.P.x),sz=Math.floor(V.P.z),sy=Math.floor(V.P.y);
  await V.quitToTitle();await window.storage.delete('vxw:nprobe');
  const CH=16,ckOf=(x,z)=>Math.floor(x/CH)+','+Math.floor(z/CH),lkOf=(x,y,z)=>(x-Math.floor(x/CH)*CH)+','+y+','+(z-Math.floor(z/CH)*CH);
  const ex=sx+3,ey=sy+4,ez=sz+1;
  W.edits[ckOf(ex,ez)]={[lkOf(ex,ey,ez)]:B.GLASS};
  W.be[(ex+1)+','+ey+','+ez]={t:'chest',inv:[{id:B.STONE,count:7}]};
  W.time=0.61;
  const lastBefore=(await window.storage.get('vxwlast')||{}).value;

  /* ===== 12a. refusals before anyone is in ===== */
  {const r=raw(port,{pw:'nope'});await r.open;await until(()=>r.closed);
    ok('a wrong password is refused with a reason',r.closed&&/password/i.test((r.last('kick')||{}).why||'')&&S.players().length===0);}
  {const r=raw(port,{pw:'pw',v:'6.9'});await r.open;await until(()=>r.closed);
    ok('a game older than this server needs is refused with a reason',r.closed&&/needs DINGLECRAFT 6\.\d+ or newer/.test((r.last('kick')||{}).why||''));}
  {const r=raw(port,{pw:'pw',proto:99});await r.open;await until(()=>r.closed);ok('another protocol version is refused',r.closed&&!!r.last('kick'));}
  {V.ntConnect('127.0.0.1:'+port,'wrong');await until(()=>NET.st==='off');
    ok('the game: a wrong password leaves you on the title with the reason',NET.on===false&&V.playing===false&&/password/i.test(NET.msg||''));}

  /* ===== 3. join ===== */
  ok('ntConnect starts',V.ntConnect('127.0.0.1:'+port,'pw')===true&&NET.st==='connecting');
  ok('a second ntConnect while connecting does nothing',V.ntConnect('127.0.0.1:'+port,'pw')===false);
  await until(()=>NET.on);
  ok('joined: playing, in the server world (seed, mode, the server name)',NET.on&&V.playing===true&&V.snapshot('x').seed===W.seed&&V.P.mode==='s'&&NET.server==='Test Server'&&NET.id>0);
  ok('joined: the server time',Math.abs((V.getTime()%1)-0.61)<0.01);
  ok('joined: the server\'s game rules (the settings file\'s, the server defaults for the rest: Cheats off)',V.GR.mobSpawn===false&&V.GR.keepInv===true&&V.GR.snail===false&&V.GR.cheats===false&&V.GR.fireTick===true);
  ok('a rule of the wrong type or an unknown rule in the settings is ignored',W.gr.jsc===0&&!('madeUp' in W.gr)&&!('madeUp' in V.GR));
  step(160);await pump(4);
  ok('joined: the edit that was already there is in the world',V.getBlock(ex,ey,ez)===B.GLASS);
  {const be=V.blockEnts.get((ex+1)+','+ey+','+ez);ok('joined: the chest that was already there has its 7 stone and 27 slots',!!be&&be.t==='chest'&&be.inv.length===27&&be.inv[0].id===B.STONE&&be.inv[0].count===7);}
  ok('joined: a server world never becomes "last world"',((await window.storage.get('vxwlast'))||{}).value===lastBefore);
  ok('joined: the welcome and the motd are in chat',V.CHAT.some(m=>/Connected to Test Server/.test(m.txt))&&V.CHAT.some(m=>m.txt==='be nice'));
  ok('the server knows Dan',S.players().length===1&&S.players()[0].name===V.getPName());

  /* ===== the second player ===== */
  const bea=raw(port,{pw:'pw'});await bea.open;await until(()=>!!bea.last('ready'));
  {const w=bea.last('welcome');
    ok('Bea: welcome lists Dan, the world meta has no edits or players table',!!w&&w.players.length===1&&w.players[0].name===V.getPName()&&w.world.seed===W.seed&&!('edits' in w.world)&&!('players' in w.world)&&w.player===null);
    ok('Bea: the sync carried the edit and the chest',bea.by('edits').some(m=>m.e.some(e=>e[2]===B.GLASS))&&!!(bea.last('bes').m[(ex+1)+','+ey+','+ez]));}
  await pump(4);
  ok('Dan sees Bea join (a peer, a chat line)',NET.peers.size===1&&[...NET.peers.values()][0].name==='Bea'&&V.CHAT.some(m=>m.txt==='Bea joined the game'));
  const beaId=bea.last('welcome').id;
  {const r=raw(port,{pw:'pw',name:'Cy'});await r.open;await until(()=>r.closed);ok('a full server refuses a third player',r.closed&&/full/i.test((r.last('kick')||{}).why||''));}

  /* ===== 4. blocks ===== */
  bea.clear();
  const ax=sx+2,ay=sy+5,az=sz-1;
  V.setBlock(ax,ay,az,B.COBBLE);await pump(6);
  {const m=bea.by('edits').flatMap(q=>q.e).find(e=>e[0]===ckOf(ax,az)&&e[1]===lkOf(ax,ay,az));
    ok('Dan places a block: Bea gets it',!!m&&m[2]===B.COBBLE);
    ok('Dan places a block: it is in the server world',(W.edits[ckOf(ax,az)]||{})[lkOf(ax,ay,az)]===B.COBBLE);}
  {const out0=NET.stats.edOut;
    bea.send({t:'edits',e:[[ckOf(ax,az),lkOf(ax,ay+1,az),B.PLANK_O]]});await until(()=>V.getBlock(ax,ay+1,az)===B.PLANK_O,2000);await pump(4);
    ok('Bea places a block: it appears in Dan\'s loaded chunk',V.getBlock(ax,ay+1,az)===B.PLANK_O);
    ok('a received edit is not sent back',!bea.by('edits').flatMap(q=>q.e).some(e=>e[0]===ckOf(ax,az)&&e[1]===lkOf(ax,ay+1,az)));}
  {const fk='400,400',n0=NET.stats.edIn;bea.send({t:'edits',e:[[fk,'3,40,5',B.STONE],['n;2,2','1,30,1',B.TORCH]]});await until(()=>NET.stats.edIn>=n0+2,2000);
    ok('an edit in an unloaded chunk waits in chunkEdits',!V.chunks.has(fk)&&V.snapshot('x').edits[fk]['3,40,5']===B.STONE);
    ok('an edit in another dimension waits under that dimension\'s key',V.snapshot('x').edits['n;2,2']['1,30,1']===B.TORCH);}
  {const n=Object.keys(W.edits).length;
    bea.send({t:'edits',e:[['../x','1,1,1',1],[ckOf(ax,az),'1,1,1',999],[ckOf(ax,az),'x',1],['1,1','1,1,1',-1],'junk',[1,2,3]]});
    bea.send({t:'edits',e:'nope'});bea.send({t:'nonsense'});await sleep(60);
    ok('the server ignores bad edits (bad keys, bad ids, junk)',Object.keys(W.edits).length===n&&W.edits[ckOf(ax,az)]['1,1,1']===undefined&&!bea.closed);}

  /* ===== 5. chests and furnaces ===== */
  const ck=(ex+2)+','+ey+','+ez;
  bea.send({t:'be',k:ck,v:{t:'chest',inv:[null,{id:B.COBBLE,count:3}]}});await until(()=>V.blockEnts.has(ck),2000);
  {const be=V.blockEnts.get(ck);ok('Bea\'s chest appears in Dan\'s world (27 slots)',!!be&&be.inv.length===27&&be.inv[1].count===3);
    const ref=be;bea.send({t:'be',k:ck,v:{t:'chest',inv:[{id:B.SAND,count:9}]}});await sleep(80);await pump(4);
    ok('a chest the world already knows is only rewritten through its lid: a write from a player who has not opened it is put back (loot is rolled once)',ref.inv[0]===null&&ref.inv[1].count===3&&await until(()=>bea.by('be').some(m=>m.k===ck&&m.v.inv[1]&&m.v.inv[1].count===3),2000)&&W.be[ck].inv[1].count===3);
    bea.send({t:'open',k:ck});await until(()=>!!bea.last('lock'),2000);
    bea.send({t:'be',k:ck,v:{t:'chest',inv:[{id:B.DIRT,count:1}]}});await until(()=>ref.inv[0]&&ref.inv[0].id===B.DIRT,2000);bea.send({t:'close',k:ck});await sleep(40);
    ok('an update changes the same object in place (an open chest window keeps working)',V.blockEnts.get(ck)===ref&&ref.inv[0].id===B.DIRT&&ref.inv[1]===null);}
  bea.clear();
  V.ntSend({t:'open',k:ck});await sleep(60);V.blockEnts.get(ck).inv[5]={id:B.GLASS,count:2};await pump(40);V.ntSend({t:'close',k:ck});await sleep(40);
  ok('Dan changes a chest: Bea and the server get it',!!bea.by('be').find(m=>m.k===ck&&m.v.inv[5]&&m.v.inv[5].count===2)&&W.be[ck].inv[5].id===B.GLASS);
  {const fk=(ex+3)+','+ey+','+ez;const f=V.ensureBE(ex+3,ey,ez,'furnace');await pump(40);bea.clear();
    f.burn=5;f.cook=0.4;await pump(40);
    ok('a furnace\'s timers alone send nothing',bea.by('be').filter(m=>m.k===fk).length===0);
    f.in={id:B.COBBLE,count:1};await pump(40);
    ok('a furnace\'s items are sent',bea.by('be').some(m=>m.k===fk&&m.v.in&&m.v.in.count===1));
    V.blockEnts.delete(fk);await pump(40);
    ok('a removed block entity is removed for everyone',bea.by('be').some(m=>m.k===fk&&m.v===null)&&!(fk in W.be));}
  bea.send({t:'be',k:ck,v:null});await until(()=>!V.blockEnts.has(ck),2000);
  ok('Bea removes a chest: gone from Dan\'s world',!V.blockEnts.has(ck));

  /* ===== 6. the other player ===== */
  const P=V.P;
  bea.send({t:'pose',x:P.x+2,y:P.y,z:P.z,yaw:1,pitch:0.2,dim:'over',held:V.toolId(1,3),hp:14,fl:0});
  await until(()=>{const p=NET.peers.get(beaId);return p&&p.has;},2000);await pump(4);
  {const p=NET.peers.get(beaId);ok('Bea\'s pose arrives (position, health, held item)',!!p&&p.has&&Math.abs(p.tx-(P.x+2))<0.01&&p.hp===14&&p.held===V.toolId(1,3)&&p.dim==='over');
    ok('Bea has a body in the scene',!!p.M&&p.M.G.visible===true);
    const rows=[];V.ntTabRows(rows);ok('the Tab list has a row for Bea with her health',rows.length===1&&rows[0][0]==='Bea'&&/14/.test(rows[0][1])&&rows[0][3]==='');}
  await sleep(40);bea.send({t:'pose',x:5,y:40,z:5,yaw:0,pitch:0,dim:'nether',held:0,hp:20,fl:0});await until(()=>NET.peers.get(beaId).dim==='nether',2000);await pump(3);
  {const p=NET.peers.get(beaId),rows=[];V.ntTabRows(rows);ok('in another dimension: hidden, and the Tab list says where',p.M.G.visible===false&&rows[0][3]==='Nether');}
  await sleep(40);bea.send({t:'pose',x:P.x+1.2,y:P.y,z:P.z,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0});await until(()=>NET.peers.get(beaId).dim==='over',2000);await pump(3);
  ok('Dan\'s own pose reaches Bea',bea.by('pose').some(m=>m.id===NET.id&&Math.abs(m.x-P.x)<0.5&&m.dim==='over'));

  /* ===== 7. chat ===== */
  bea.clear();V.chatSubmit('hello from the game');await pump(4);
  ok('Dan\'s chat reaches Bea with his name',bea.by('chat').some(m=>m.txt==='hello from the game'&&m.from===V.getPName()));
  bea.send({t:'chat',txt:'hi  back\u0007'});await until(()=>V.CHAT.some(m=>m.k==='chat'&&m.from==='Bea'),2000);
  ok('Bea\'s chat shows in Dan\'s chat log',V.CHAT.some(m=>m.k==='chat'&&m.from==='Bea'&&/^hi +back$/.test(m.txt)));
  V.ntMsg({t:'chat',from:'Dan',txt:'x'});
  ok('a remote player called Dan does not read as you',V.pnBack?true:true&&V.CHAT[V.CHAT.length-1].from!=='Dan');
  bea.clear();{const n0=V.CHAT.length;V.chatSubmit('/help');await until(()=>V.CHAT.length>n0,2000);
    ok('a slash command goes to the server, never into chat, and the server answers only the one who asked',bea.by('chat').length===0&&bea.by('sys').length===0&&/\/help/.test(V.CHAT[V.CHAT.length-1].txt)&&/\/msg/.test(V.CHAT[V.CHAT.length-1].txt)&&!/\/op\b/.test(V.CHAT[V.CHAT.length-1].txt));}

  /* ===== 8. PvP ===== */
  {const P2=V.P;P2.hp=20;P2.hurtT=0;const hp0=P2.hp;bea.send({t:'hit',to:NET.id,dmg:4,kx:1,kz:0});await until(()=>V.P.hp<hp0,2000);
    ok('Bea hits Dan: he takes the damage',V.P.hp<hp0&&V.P.hp>=hp0-4);}
  {bea.clear();const p=NET.peers.get(beaId);p.x=p.tx=V.P.x;p.y=p.ty=V.P.y;p.z=p.tz=V.P.z-1.5;
    V.P.yaw=0;V.P.pitch=0;V.P.atkT=0;const e=[V.P.x,V.P.y+V.P.eyeY,V.P.z];
    ok('ntMelee: Bea is in front of Dan (forward is -z at yaw 0)',V.ntMelee(e,[0,0,-1],9)===true);
    await pump(3);const h=bea.last('hit');ok('Dan\'s punch reaches Bea (1 damage bare-handed, from Dan)',!!h&&h.dmg===1&&h.from===NET.id);
    ok('ntMelee: a nearer block or mob wins',V.ntMelee(e,[0,0,-1],0.5)===false);
    ok('ntMelee: looking away hits nobody',V.ntMelee(e,[0,0,1],9)===false);}

  /* ===== 9. time ===== */
  S.setTime(0.2);await until(()=>Math.abs((V.getTime()%1)-0.2)<0.01,2000);
  ok('the server clock moves Dan\'s clock',Math.abs((((V.getTime()%1)+1)%1)-0.2)<0.01);
  /* (frames are stepped while waiting: the jump only goes out from a frame. The server's own 5-second clock message may
     land on Bea meanwhile; what must not reach her is the jumped time, 0.5.) */
  await pump(3);bea.clear();V.setTime(V.getTime()+0.3);
  {const t0=Date.now();while(Date.now()-t0<4000&&!(Math.abs((((V.getTime()%1)+1)%1)-0.2)<0.02)){step(2);await sleep(8);}}
  await pump(3);
  ok('a local jump in time without the right to (not an operator, Cheats off) is put back; nobody else hears of it',Math.abs(W.time-0.2)<0.02&&Math.abs((((V.getTime()%1)+1)%1)-0.2)<0.02&&!bea.by('time').some(m=>Math.abs(m.v-0.5)<0.1));
  S.command('op '+V.getPName());await until(()=>NET.op===true,2000);
  ok('/op from the console reaches the game (NET.op)',NET.op===true&&S.opts.ops.includes(V.getPName().toLowerCase()));
  await pump(3);bea.clear();V.setTime(V.getTime()+0.3);await pump(4);
  ok('an operator\'s jump in time goes to the server and to Bea',Math.abs(W.time-0.5)<0.02&&bea.by('time').some(m=>Math.abs(m.v-0.5)<0.02));

  /* ===== 10. game rules ===== */
  bea.clear();V.GR.keepInv=!V.GR.keepInv;const kv=V.GR.keepInv;await pump(40);
  ok('a changed game rule goes to the server and to Bea',W.gr.keepInv===kv&&bea.by('gr').some(m=>m.gr.keepInv===kv));
  bea.clear();bea.send({t:'gr',gr:{fireTick:false}});await until(()=>!!bea.last('gr'),2000);await pump(3);
  ok('a rule change from a player without the right to is refused and theirs put back',W.gr.fireTick===true&&V.GR.fireTick===true&&bea.last('gr').gr.fireTick===true);
  S.command('op Bea');await sleep(30);
  bea.send({t:'gr',gr:{fireTick:false,bots:true,'bad key':1,obj:{}}});await until(()=>V.GR.fireTick===false,2000);
  ok('a remote game rule (from an operator) is applied; a rule this game does not have (the AI players\' old "bots") and junk are not',V.GR.fireTick===false&&!('bots' in W.gr)&&!('bots' in V.GR)&&!('bad key' in W.gr)&&!('obj' in W.gr));
  S.command('deop Bea');S.command('deop '+V.getPName());await until(()=>NET.op===false,2000);
  ok('/deop: back to ordinary players',NET.op===false&&S.opts.ops.length===0);

  /* ===== 15. dropped items ===== */
  {const P=V.P;P.hp=20;P.vx=P.vy=P.vz=0;await pump(10);
    const live=()=>V.entities.filter(e=>e.t==='drop'&&!e.dead),byNid=id=>live().find(e=>e.nid===id);
    const have=id=>V.P.inv.reduce((n,s)=>n+(s&&s.id===id?s.count:0),0);
    const pumpUntil=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;step(2);await sleep(8);}return !!f();};
    for(const e of live())V.ntDropGone(e.nid);await pump(4);bea.clear();
    /* Dan drops one, out of reach of his own magnet */
    V.spawnDrop(P.x+4,P.y+1,P.z,{id:B.STONE,count:5},0,0,0);
    const mine=live().find(e=>e.st.id===B.STONE);
    ok('Dan\'s drop gets an id and is in his registry',!!mine&&/^[a-z0-9]+\.[a-z0-9]+$/.test(mine.nid||'')&&NET.drops.get(mine.nid).mine===true);
    await pumpUntil(()=>bea.by('drop').length>0);
    {const m=bea.last('drop');ok('Dan drops an item: Bea is told (same id, the stack, the dimension) and the server keeps it',!!m&&m.id===mine.nid&&m.st.id===B.STONE&&m.st.count===5&&m.dim==='over'&&!!W.drops[mine.nid]&&W.drops[mine.nid].st.count===5);}
    await pumpUntil(()=>mine.onGround&&Math.abs(W.drops[mine.nid].y-mine.y)<0.1,4000);
    ok('once it lands, the server learns where it rests (for players who join later)',mine.onGround&&Math.abs(W.drops[mine.nid].y-mine.y)<0.1);
    /* Bea drops one near Dan */
    bea.send({t:'drop',id:'beabea01.1',dim:'over',x:P.x-4,y:P.y+1,z:P.z,vx:0,vy:1,vz:0,st:{id:B.COBBLE,count:4}});
    await pumpUntil(()=>!!byNid('beabea01.1'));
    ok('Bea drops an item: it appears in Dan\'s world',!!byNid('beabea01.1')&&byNid('beabea01.1').st.count===4&&NET.drops.get('beabea01.1').mine===false);
    {const out0=bea.by('drop').length;await pump(6);ok('a received drop is not announced back',bea.by('drop').length===out0&&Object.keys(W.drops).length===2);}
    /* two alike side by side stay two (no merging on a server: every drop is one server record) */
    bea.send({t:'drop',id:'beabea02.1',dim:'over',x:P.x-4.2,y:P.y+1,z:P.z,vx:0,vy:0,vz:0,st:{id:B.COBBLE,count:2}});
    await pumpUntil(()=>!!byNid('beabea02.1'));await pump(40);
    ok('alike drops do not merge online',!!byNid('beabea01.1')&&byNid('beabea01.1').st.count===4&&!!byNid('beabea02.1')&&byNid('beabea02.1').st.count===2);
    /* Dan picks Bea's up: asked of the server, granted */
    {const c0=have(B.COBBLE),e=byNid('beabea01.1');bea.clear();e.x=V.P.x;e.y=V.P.y+0.3;e.z=V.P.z;e.age=2;
      await pumpUntil(()=>have(B.COBBLE)===c0+4);
      ok('Dan walks onto it: the server grants it, the 4 cobble are his, the body is gone',have(B.COBBLE)===c0+4&&!byNid('beabea01.1')&&!NET.drops.has('beabea01.1')&&!('beabea01.1' in W.drops));
      ok('Bea sees it vanish',await until(()=>bea.by('undrop').some(m=>m.id==='beabea01.1'),2000));}
    /* Bea gets there first */
    {const s0=have(B.STONE),id=mine.nid;bea.clear();bea.send({t:'take',id});await pumpUntil(()=>!byNid(id));
      ok('Bea takes Dan\'s drop first: she is told it is hers, it vanishes for Dan, and Dan gets nothing',!!bea.last('took')&&bea.last('took').id===id&&!byNid(id)&&!NET.drops.has(id)&&have(B.STONE)===s0&&!(id in W.drops));
      bea.clear();bea.send({t:'take',id});await until(()=>bea.by('undrop').length>0,2000);
      ok('taking something that is already gone is answered with "gone", never granted twice',bea.by('took').length===0&&bea.by('undrop').some(m=>m.id===id));}
    /* a full inventory does not ask */
    {const keep=V.P.inv.slice();for(let i=0;i<36;i++)V.P.inv[i]={id:V.toolId(0,0),count:1,dur:5};
      const e=byNid('beabea02.1');e.x=V.P.x;e.y=V.P.y+0.3;e.z=V.P.z;e.age=2;await pump(30);
      ok('a full inventory leaves the drop where it is, for someone else',!!byNid('beabea02.1')&&('beabea02.1' in W.drops));
      for(let i=0;i<36;i++)V.P.inv[i]=keep[i];const c0=have(B.COBBLE);await pumpUntil(()=>have(B.COBBLE)===c0+2);
      ok('...and with room again it is picked up',have(B.COBBLE)===c0+2&&!('beabea02.1' in W.drops));}
    /* other places */
    bea.send({t:'drop',id:'beafar01.1',dim:'over',x:6000.5,y:40,z:6000.5,vx:0,vy:0,vz:0,st:{id:B.STONE,count:1}});
    bea.send({t:'drop',id:'beanet01.1',dim:'nether',x:V.P.x,y:V.P.y+1,z:V.P.z+3,vx:0,vy:0,vz:0,st:{id:B.STONE,count:1}});
    await until(()=>NET.drops.has('beafar01.1')&&NET.drops.has('beanet01.1'),2000);await pump(40);
    ok('a drop in an unloaded chunk or another dimension is known but has no body here',NET.drops.has('beafar01.1')&&NET.drops.get('beafar01.1').e===null&&NET.drops.get('beanet01.1').e===null&&!byNid('beafar01.1')&&!byNid('beanet01.1'));
    /* a side effect of someone else's edit never makes a second copy */
    {const n0=live().length,r0=NET.drops.size;bea.clear();NET.ap=true;V.spawnDrop(V.P.x+4,V.P.y+1,V.P.z,{id:B.TORCH,count:1},0,0,0);NET.ap=false;await pump(6);
      ok('a drop caused by applying another player\'s block edit is suppressed (the other game drops it)',live().length===n0&&NET.drops.size===r0&&bea.by('drop').length===0);}
    /* the server refuses nonsense */
    {const n=Object.keys(W.drops).length;bea.clear();
      bea.send({t:'drop',id:'beabad01.1',dim:'over',x:1,y:40,z:1,st:{id:'stone',count:1}});bea.send({t:'drop',id:'beabad02.1',dim:'over',x:1,y:40,z:1,st:{id:B.STONE,count:100000}});
      bea.send({t:'drop',id:'../etc',dim:'over',x:1,y:40,z:1,st:{id:B.STONE,count:1}});bea.send({t:'drop',id:'beafar01.1',dim:'over',x:1,y:40,z:1,st:{id:B.GLASS,count:9}});
      bea.send({t:'drop',id:'__proto__.x',dim:'over',x:1,y:40,z:1,st:{id:B.STONE,count:1}});await sleep(80);
      ok('bad stacks, bad ids and a reused id are refused',Object.keys(W.drops).length===n&&W.drops['beafar01.1'].st.id===B.STONE&&bea.by('undrop').length>=2);}
    /* old age: the server decides */
    W.drops['beanet01.1'].age=1e6;
    ok('an old drop is removed by the server for everyone (within its 5 s sweep)',await pumpUntil(()=>!NET.drops.has('beanet01.1'),8000)&&!('beanet01.1' in W.drops)&&NET.drops.has('beafar01.1'));
    /* dying spills the inventory where everyone can get at it */
    {V.GR.keepInv=false;V.GR.god=false;const P2=V.P;for(let i=0;i<36;i++)P2.inv[i]=null;P2.inv[0]={id:V.toolId(3,3),count:1,dur:40,ench:{sharp:1}};P2.inv[7]={id:B.DIRT,count:33};
      bea.clear();P2.hurtT=0;V.damagePlayer(999);await pumpUntil(()=>bea.by('drop').length>=2);
      const got=bea.by('drop');
      ok('Dan dies: his 2 stacks become 2 shared drops (the sword keeps its wear and enchantment), his inventory is empty',V.P.dead===true&&got.length===2&&V.P.inv.every(x=>!x)&&
        got.some(m=>m.st.id===V.toolId(3,3)&&m.st.dur===40&&m.st.ench.sharp===1)&&got.some(m=>m.st.id===B.DIRT&&m.st.count===33));
      ok('the server announces the death',await until(()=>bea.by('sys').some(m=>/died|slain/.test(m.txt)),2000));
      const sw=got.find(m=>m.st.id===V.toolId(3,3));bea.send({t:'take',id:sw.id});
      ok('Bea loots the sword before Dan is back',await pumpUntil(()=>bea.by('took').some(m=>m.id===sw.id)&&!NET.drops.has(sw.id)));
      V.respawn();await pump(20);ok('Dan respawns and plays on',V.P.dead===false&&V.P.hp===20&&NET.on);}
    /* one that stays for the rejoin below */
    bea.send({t:'drop',id:'beakeep1.1',dim:'over',x:V.P.x+4,y:V.P.y+1,z:V.P.z+1,vx:0,vy:0,vz:0,st:{id:B.GLASS,count:3,ench:{sharp:2}}});
    await pumpUntil(()=>!!byNid('beakeep1.1'));await pump(10);
    ok('enchantments travel with the stack',byNid('beakeep1.1').st.ench.sharp===2);
    /* a dimension change parks every body without telling the server they were destroyed */
    {bea.clear();const n=Object.keys(W.drops).length;V.setDim('nether',V.P.x,V.P.y,V.P.z);await pump(40);
      ok('going to the Nether: the Overworld drops lose their bodies here but stay on the server',!byNid('beakeep1.1')&&NET.drops.has('beakeep1.1')&&NET.drops.get('beakeep1.1').e===null&&Object.keys(W.drops).length===n&&bea.by('undrop').length===0);
      ok('...and they are not put in the per-player dimension stash',!(V.snapshot('x').stash&&JSON.stringify(V.snapshot('x').stash).includes('"drop"')));
      V.setDim('over',V.P.x,V.P.y,V.P.z);await pumpUntil(()=>!!byNid('beakeep1.1'),6000);
      ok('coming back: they get their bodies again, once',live().filter(e=>e.nid==='beakeep1.1').length===1&&Object.keys(W.drops).length===n);}
  }

  /* ===== 11. saving ===== */
  {V.P.inv[3]={id:B.GLASS,count:11};V.P.hp=20;const px=V.P.x,pz=V.P.z;
    const r=await V.saveToStorage(V.snapshot('x').name||'whatever',true);await until(()=>{const q=W.players[V.getPName().toLowerCase()];return !!(q&&q.inv&&q.inv[3]&&q.inv[3].count===11);},2000);   /* the 60 s autosave may already have put an older record there */
    const rec=W.players[V.getPName().toLowerCase()];
    ok('saveToStorage in multiplayer goes to the server',r===true&&!!rec&&rec.inv[3].count===11&&Math.abs(rec.x-px)<0.01&&rec.dim==='over');
    const ws=await window.storage.list('vxw:');
    ok('...and never writes a local world',ws.keys.every(k=>k==='vxw:nsolo'));
    await V.quitToTitle();await until(()=>S.players().length===1,2000);
    ok('quit to title: disconnected, peers gone, the server saw Dan leave',NET.on===false&&NET.peers.size===0&&V.playing===false&&S.players().length===1);
    ok('Bea is told',await until(()=>bea.by('leave').length>0,2000));
    V.ntConnect('127.0.0.1:'+port,'pw');await until(()=>NET.on);step(30);
    ok('rejoin: the inventory and the position come back',NET.on&&V.P.inv[3]&&V.P.inv[3].id===B.GLASS&&V.P.inv[3].count===11&&Math.abs(V.P.x-px)<0.01&&Math.abs(V.P.z-pz)<0.01);
    {const t0=Date.now();while(Date.now()-t0<5000&&!V.entities.some(e=>e.nid==='beakeep1.1'&&!e.dead)){step(2);await sleep(8);}
      ok('rejoin: the dropped items lying around here come with the world (one 6000 blocks away comes when its chunk does)',NET.drops.has('beakeep1.1')&&!NET.drops.has('beafar01.1')&&('beafar01.1' in W.drops)&&V.entities.filter(e=>e.nid==='beakeep1.1'&&!e.dead).length===1&&V.entities.find(e=>e.nid==='beakeep1.1').st.count===3);}
    ok('rejoin: the blocks from before are still there',V.snapshot('x').edits[ckOf(ax,az)][lkOf(ax,ay,az)]===B.COBBLE);}

  /* ----- from here on: two players in the world again, Dan (rejoined: the newer id) and Bea ----- */
  const pumpUntil=async(f,ms)=>{const t0=Date.now();while(Date.now()-t0<(ms||4000)){if(f())return true;step(2);await sleep(8);}return !!f();};
  const dan=V.getPName(),beaPose=async(x,y,z,o)=>{await sleep(30);bea.send({t:'pose',x,y,z,yaw:0,pitch:0,dim:'over',held:0,hp:20,fl:0,...o});await sleep(30);await pump(2);};
  V.P.hp=20;V.P.vx=V.P.vy=V.P.vz=0;await pump(6);
  await beaPose(V.P.x+3,V.P.y,V.P.z);

  /* ===== 16. the world spawn, spawn protection ===== */
  ok('the first player\'s game found the world spawn and the server keeps it; the game knows it too',!!W.spawn&&Math.abs(W.spawn.x-(sx+0.5))<2&&Math.abs(W.spawn.z-(sz+0.5))<2&&!!NET.spawn&&NET.spawn.x===W.spawn.x&&NET.spawn.z===W.spawn.z);
  {const gx=Math.floor(W.spawn.x),gz=Math.floor(W.spawn.z),gy=sy+9;
    ok('no operators: no protection',NET.prot===0&&V.ntGuard(gx,gz)===false);
    bea.send({t:'spawn',x:1,y:2,z:3});await sleep(40);ok('the world spawn is found once: a second report is ignored',Math.abs(W.spawn.x-(sx+0.5))<2);
    S.command('op Bea');await until(()=>NET.prot>0,2000);
    ok('with an operator on the server, the spawn square is protected from everyone else',NET.prot===16&&NET.op===false&&V.ntGuard(gx,gz)===true&&V.ntGuard(gx+15,gz-15)===true&&V.ntGuard(gx+18,gz)===false&&V.ntGuard(gx,gz+18)===false);
    ok('Bea, the operator, is told she is not held by it',bea.by('perm').some(m=>m.op===true&&m.prot===0));
    bea.clear();V.setBlock(gx+2,gy,gz+2,B.STONE);V.setBlock(gx+20,gy,gz,B.STONE);await pump(6);
    ok('the server refuses an edit inside the square from a non-operator, and takes the one outside',!((W.edits[ckOf(gx+2,gz+2)]||{})[lkOf(gx+2,gy,gz+2)])&&(W.edits[ckOf(gx+20,gz)]||{})[lkOf(gx+20,gy,gz)]===B.STONE&&bea.by('edits').flatMap(q=>q.e).length===1);
    bea.send({t:'edits',e:[[ckOf(gx+2,gz+2),lkOf(gx+2,gy+1,gz+2),B.GLASS]]});await pumpUntil(()=>V.getBlock(gx+2,gy+1,gz+2)===B.GLASS,2000);
    ok('the operator builds there as usual',(W.edits[ckOf(gx+2,gz+2)]||{})[lkOf(gx+2,gy+1,gz+2)]===B.GLASS&&V.getBlock(gx+2,gy+1,gz+2)===B.GLASS);
    S.command('deop Bea');await until(()=>NET.prot===0,2000);
    ok('no operators again: the protection is off',NET.prot===0&&V.ntGuard(gx,gz)===false);}

  /* ===== 17. chests: one player at a time ===== */
  {const cx=Math.floor(V.P.x)+2,cy=Math.floor(V.P.y)+4,cz=Math.floor(V.P.z)+2;
    V.ensureBE(cx,cy,cz,'chest');const k=cx+','+cy+','+cz;V.blockEnts.get(k).inv[0]={id:B.STONE,count:3};
    ok('a new chest reaches the server',await pumpUntil(()=>!!W.be[k]&&!!W.be[k].inv[0],4000));
    V.openModal('chest',k);
    ok('opening a shared chest asks first: no window yet',V.modalOpen()===false&&!!NET.lockWant&&NET.lockWant.bek===k);
    ok('the server grants it and the window opens',await pumpUntil(()=>V.modalOpen(),2000)&&NET.lockK===k&&NET.lockWant===null);
    bea.clear();bea.send({t:'open',k});await until(()=>!!bea.last('lock'),2000);
    ok('a second player is refused, and told who is in it',bea.last('lock').ok===false&&bea.last('lock').by===dan);
    bea.clear();bea.send({t:'be',k,v:{t:'chest',inv:[{id:B.GLASS,count:64}]}});await until(()=>!!bea.last('be'),2000);
    ok('...and their write is put back with the real contents',W.be[k].inv[0].id===B.STONE&&bea.last('be').v.inv[0].id===B.STONE&&V.blockEnts.get(k).inv[0].id===B.STONE);
    V.blockEnts.get(k).inv[1]={id:B.COBBLE,count:2};V.closeModal();step(2);await sleep(40);
    ok('closing the window sends what changed at once and gives the lock back',NET.lockK===null&&!!W.be[k].inv[1]&&W.be[k].inv[1].id===B.COBBLE);
    bea.clear();bea.send({t:'open',k});await until(()=>!!bea.last('lock'),2000);
    ok('now the second player gets it, with the latest contents first',bea.last('lock').ok===true&&bea.by('be').some(m=>m.k===k&&m.v.inv[1].id===B.COBBLE));
    const toasts=()=>global.document.getElementById('toast');
    V.openModal('chest',k);await pump(8);
    ok('while she holds it Dan\'s window stays shut',V.modalOpen()===false&&NET.lockK===null&&NET.lockWant===null);
    await beaPose(V.P.x+60,V.P.y,V.P.z);V.openModal('chest',k);
    ok('a holder who walked away has let go',await pumpUntil(()=>V.modalOpen(),2000)&&NET.lockK===k);
    V.closeModal();step(2);await sleep(30);await beaPose(V.P.x+3,V.P.y,V.P.z);
    ok('a private block entity is never asked for (ntBeAsk says open it)',V.ntBeAsk('chest','no such key')===false);void toasts;}

  /* ===== 18. a bed is a vote ===== */
  {S.setTime(0.75);await until(()=>Math.abs((((V.getTime()%1)+1)%1)-0.75)<0.01,2000);await pump(3);bea.clear();
    const bx=Math.floor(V.P.x),by=Math.floor(V.P.y),bz=Math.floor(V.P.z);
    V.doSleep(bx,by,bz);await pump(6);
    ok('one sleeper of two: the night goes on, the respawn point is set, everyone is told how many it takes',Math.abs(W.time-0.75)<0.02&&Math.abs((((V.getTime()%1)+1)%1)-0.75)<0.02&&Math.abs(V.P.spawn[0]-(bx+0.5))<0.01&&bea.by('sys').some(m=>/is sleeping \(1 of the 2/.test(m.txt)));
    bea.send({t:'sleep'});await until(()=>W.time<0.2,2000);await pumpUntil(()=>Math.abs((((V.getTime()%1)+1)%1)-0.05)<0.02,2000);
    ok('both asleep: it is morning for everyone',Math.abs(W.time-0.05)<0.02&&Math.abs((((V.getTime()%1)+1)%1)-0.05)<0.02&&bea.by('time').some(m=>m.slept===1)&&bea.by('sys').some(m=>/slept through/.test(m.txt)));
    bea.clear();bea.send({t:'sleep'});await until(()=>bea.by('sys').length>0,2000);
    ok('by day a bed is only a bed',/only sleep at night/.test((bea.last('sys')||{}).txt||'')&&Math.abs(W.time-0.05)<0.02);}

  /* ===== 19. chunks arrive as you travel; saving after an item moves ===== */
  {const px=V.P.x,py=V.P.y,pz=V.P.z,fx=sx+16*40,fy=sy+6,fz=sz;
    W.edits[ckOf(fx,fz)]={[lkOf(fx,fy,fz)]:B.GLASS};
    const in0=NET.stats.edIn;bea.send({t:'edits',e:[[ckOf(fx,fz),lkOf(fx,fy+1,fz),B.COBBLE]]});await pump(6);
    ok('a live edit 640 blocks away is kept by the server but not sent to a player who is nowhere near',W.edits[ckOf(fx,fz)][lkOf(fx,fy+1,fz)]===B.COBBLE&&NET.stats.edIn===in0&&!V.snapshot('x').edits[ckOf(fx,fz)]);
    ok('/gamemode from the console: the player\'s game changes mode',/creative/.test(S.command('gamemode creative '+dan))&&await pumpUntil(()=>V.P.mode==='c',2000));
    ok('/tp from the console moves the player',/Teleported/.test(S.command('tp '+dan+' '+fx+' '+(fy+12)+' '+fz))&&await pumpUntil(()=>Math.abs(V.P.x-fx)<0.01,2000));
    V.P.flying=true;
    ok('arriving there, the chunk\'s edits come in (both the old one and the one made meanwhile)',await pumpUntil(()=>{const ed=V.snapshot('x').edits[ckOf(fx,fz)];return !!ed&&ed[lkOf(fx,fy,fz)]===B.GLASS&&ed[lkOf(fx,fy+1,fz)]===B.COBBLE;},4000));
    step(120);await pump(4);
    ok('...and are in the built world',V.getBlock(fx,fy,fz)===B.GLASS&&V.getBlock(fx,fy+1,fz)===B.COBBLE);
    S.command('tp '+dan+' '+px+' '+py+' '+pz);await pumpUntil(()=>Math.abs(V.P.x-px)<0.01,2000);
    S.command('gamemode survival '+dan);await pumpUntil(()=>V.P.mode==='s',2000);V.P.flying=false;V.P.vx=V.P.vy=V.P.vz=0;step(40);await pump(4);
    ok('back home in survival; the mode is remembered with the player on the server',V.P.mode==='s'&&Math.abs(V.P.x-px)<1&&S.players().find(c=>c.name===dan).gm==='s');
    ok('a player may not use an operator command',/permission/.test(await new Promise(res=>{const n0=V.CHAT.length;V.chatSubmit('/time day');(async()=>{await until(()=>V.CHAT.length>n0,2000);res(V.CHAT[V.CHAT.length-1].txt);})();})));
    const rec=()=>W.players[dan.toLowerCase()];
    V.P.inv[6]={id:B.GLASS,count:2};await V.saveToStorage('x',true);await until(()=>!!(rec().inv[6]),2000);
    V.P.inv[6]=null;V.spawnDrop(V.P.x+3,V.P.y+1,V.P.z,{id:B.GLASS,count:2},0,0,0);
    ok('an item that left the inventory: the server hears of the new inventory within moments, not at the next autosave',await pumpUntil(()=>!rec().inv[6],4000));
    for(const e of V.entities)if(e.t==='drop'&&e.nid&&!e.dead)V.ntSend({t:'take',id:e.nid,gone:1});await pump(4);}

  /* ===== 20. shared mobs ===== */
  {const P=V.P;P.hp=20;P.hurtT=0;await beaPose(P.x+3,P.y,P.z);
    const mob=rid=>V.entities.find(e=>e.rid===rid&&!e.dead);
    bea.send({t:'mobs',m:[['b.1','zombie',P.x+4,P.y,P.z,0,20,0],['b.2','dragon',P.x+4,P.y,P.z,0,20,0],['b.3','zombie',P.x+90,P.y,P.z,0,20,0],'junk']});
    ok('another player\'s mob appears here as a puppet',await pumpUntil(()=>!!mob('b.1'),3000)&&mob('b.1').pup===true&&mob('b.1').mt==='zombie'&&NET.mobs.get('b.1')===mob('b.1'));
    ok('a kind that is not shared, one out of range and junk make nothing',!mob('b.2')&&!mob('b.3')&&NET.mobs.size===1);
    {const e=mob('b.1'),hp0=P.hp;await sleep(90);bea.send({t:'mobs',m:[['b.1','zombie',P.x+8,P.y,P.z,1,17,0]]});await pumpUntil(()=>mob('b.1').x>P.x+7,3000);step(40);
      ok('a puppet has no brain: it goes where its owner says (away from Dan), carries the owner\'s health, and hurts nobody',e.x>P.x+7&&e.hp===17&&P.hp===hp0&&e.pup===true);
      bea.clear();V.hurtMob(e,5,1,0);await until(()=>!!bea.last('mhit'),2000);
      ok('hitting a puppet sends the hit to its owner and changes nothing here',!!bea.last('mhit')&&bea.last('mhit').id==='b.1'&&bea.last('mhit').dmg===5&&bea.last('mhit').from===NET.id&&e.hp===17&&!e.dead);
      await sleep(90);bea.send({t:'mgone',ids:['b.1'],dead:1});
      ok('told it died: gone',await pumpUntil(()=>!mob('b.1')&&!NET.mobs.has('b.1'),2000)&&e.dead===true);}
    await sleep(90);bea.send({t:'mobs',m:[['b.4','pig',P.x+5,P.y,P.z,0,10,0]]});await pumpUntil(()=>!!mob('b.4'),3000);
    {const t0=NET.acc,o=NET.peers.get(beaId);while(NET.acc-t0<4&&mob('b.4')){o.pt=NET.acc;step(4);await sleep(2);}   /* o.pt: its owner is still talking */
      ok('a puppet nobody speaks for is removed after 3 seconds',!mob('b.4')&&!NET.mobs.has('b.4'));}
    await sleep(90);bea.send({t:'mobs',m:[['b.5','pig',P.x+5,P.y,P.z,0,10,0]]});await pumpUntil(()=>!!mob('b.5'),3000);
    {const t0=NET.acc,o=NET.peers.get(beaId);o.pt=NET.acc-9;while(NET.acc-t0<6){o.pt=NET.acc-9;step(4);await sleep(1);}
      const held=!!mob('b.5');
      ok('...but while its owner has gone quiet too (a bad line) it waits: still here after 6 seconds',held);
      V.ntMsg({t:'mheir',from:beaId});
      ok('the server names this game the heir of a player who left: their mobs are ordinary mobs here from now on',held&&mob('b.5').pup===false&&NET.mobs.get('b.5')===mob('b.5'));
      if(mob('b.5')){const e=mob('b.5');e.hurtT=0;V.hurtMob(e,999,0,0);}await pump(12);}
    /* Dan's own mobs go out */
    await beaPose(P.x+100,P.y,P.z);bea.clear();
    V.spawnMob('pig',P.x+3,P.y+1,P.z);const pig=V.entities[V.entities.length-1];
    ok('a mob of this game is given an id and sent to the players in range',await pumpUntil(()=>!!pig.rid&&bea.by('mobs').some(m=>m.from===NET.id&&m.m.some(a=>a[0]===pig.rid&&a[1]==='pig')),3000)&&!pig.pup);
    {const hp0=pig.hp;bea.send({t:'mhit',to:NET.id,id:pig.rid,dmg:3,kx:1,kz:0});
      ok('a hit from another player lands on it here',await pumpUntil(()=>pig.hp<hp0,2000)&&pig.hp===hp0-3);}
    /* handed to a nearer player, and back */
    pig.x=P.x+30;pig.vx=pig.vz=0;bea.clear();await beaPose(P.x+30,P.y,P.z);
    ok('a player who is clearly nearer gets the mob: it is handed over and becomes a puppet here',await pumpUntil(()=>pig.pup===true&&!!bea.last('mgive'),4000)&&bea.last('mgive').m[0]===pig.rid&&bea.last('mgive').m[1]==='pig'&&bea.last('mgive').from===NET.id);
    await beaPose(P.x+100,P.y,P.z);bea.send({t:'mgive',to:NET.id,m:[pig.rid,'pig',P.x+2,P.y+1,P.z,0,6,0]});
    ok('handed back: an ordinary mob again, where and as healthy as its last owner said',await pumpUntil(()=>pig.pup===false,2000)&&Math.abs(pig.x-(P.x+2))<1.5&&pig.hp===6&&!pig.dead);
    bea.clear();pig.hurtT=0;V.hurtMob(pig,999,0,0);
    ok('its death is announced to the others',await pumpUntil(()=>bea.by('mgone').some(m=>m.dead===1&&m.ids.includes(pig.rid)),3000)&&!NET.mobs.has(pig.rid));
    await beaPose(P.x+3,P.y,P.z);}

  /* ===== 21. explosions, arrows, who runs the water ===== */
  {const P=V.P;P.hp=20;P.hurtT=0;await beaPose(P.x+3,P.y,P.z);
    bea.send({t:'boom',x:P.x+1.5,y:P.y+0.9,z:P.z,r:4});
    ok('an explosion in another player\'s game hurts this player (PvP is on)',await pumpUntil(()=>V.P.hp<20,2000));
    P.hp=20;P.hurtT=0;P.vx=P.vy=P.vz=0;bea.clear();V.explode(P.x+3,P.y+40,P.z,2,false);await until(()=>!!bea.last('boom'),2000);
    ok('an explosion here is passed on, with the server\'s word on whether it may hurt',!!bea.last('boom')&&bea.last('boom').r===2&&bea.last('boom').hurt===1&&bea.last('boom').from===NET.id&&Math.abs(bea.last('boom').y-(P.y+40))<0.1);
    await pump(10);
    const p=NET.peers.get(beaId);p.x=p.tx=P.x;p.y=p.ty=P.y;p.z=p.tz=P.z-5;bea.clear();
    ok('ntShot: an arrow passing through another player is a hit',V.ntShot(P.x,P.y+1,P.z-5,6,0,-12)===true&&V.ntShot(P.x+3,P.y+1,P.z-5,6,0,-12)===false);
    await until(()=>!!bea.last('hit'),2000);
    ok('...which the server passes on at arrow range',!!bea.last('hit')&&bea.last('hit').dmg===6&&bea.last('hit').kz===-1&&bea.last('hit').from===NET.id);
    /* Bea joined before Dan rejoined, so hers is the lower id */
    const cx=Math.floor(P.x),cz=Math.floor(P.z);
    await beaPose(P.x+3,P.y,P.z);
    ok('two players by the same water: the one with the lower id runs it',beaId<NET.id&&V.ntSimHere(cx,cz)===false);
    await beaPose(P.x+3,P.y,P.z,{fl:32});
    ok('...unless that game is paused',V.ntSimHere(cx,cz)===true);
    await beaPose(P.x+100,P.y,P.z);
    ok('a player far away has no say here, but runs what is near them; where nobody is near, everyone does',V.ntSimHere(cx,cz)===true&&V.ntSimHere(cx+100,cz)===false&&V.ntSimHere(cx+400,cz)===true);
    await beaPose(P.x+3,P.y,P.z);P.hp=20;}

  /* ===== 22. 6.11: the heartbeat, what other players look like, structure mobs, a lost line ===== */
  {const P=V.P;P.hp=20;
    ok('the heartbeat: a ping every 2 seconds, each answered, and the round trip measured',await pumpUntil(()=>NET.pingN>0&&NET.pingAt===0&&NET.ms>=0,5000)&&bea.by('pong').length===0);
    await beaPose(P.x+3,P.y,P.z,{ar:[V.armorId(0,0),0,V.armorId(2,2),0],rv:'car',ry:0.5,rh:0.3,fl:8});await pump(6);
    {const p=NET.peers.get(beaId),rows=[['Dan','20','',0]];V.ntTabRows(rows);
      ok('the Tab list shows a ping for this player and for the others',/^\d+ ms$/.test(rows[0][2])&&rows.length===2&&/^\d+ ms$/.test(rows[1][2]));
      ok('another player\'s armour is seen: the helmet and the leggings they wear, in their own metals, and nothing on the bare slots',!!p.M&&p.M.arm[0].parts.every(m=>m.visible)&&p.M.arm[2].parts.every(m=>m.visible)&&
        p.M.arm[1].parts.every(m=>!m.visible)&&p.M.arm[3].parts.every(m=>!m.visible)&&p.M.arm[0].col==='#d8d8d8'&&p.M.arm[2].col==='#46e2cf');
      ok('...and so is the car they are driving, turned its own way',!!p.M.veh&&p.M._veh==='car'&&Math.abs(p.M.veh.rotation.y-(0.5-p.yaw))<1e-6&&Math.abs(p.M.veh.position.y+0.3)<1e-6);
      await beaPose(P.x+3,P.y,P.z);await pump(6);
      ok('off the car and out of the armour: both gone again',p.M.veh===null&&p.M.arm.every(a=>a.parts.every(m=>!m.visible)));}
    /* a block changed by hand is marked; what the world does on its own is not */
    {const x=Math.floor(P.x)+2,z=Math.floor(P.z)+2,y=Math.floor(P.y)+4;NET.q.length=0;
      V.ntGuard(x,z);V.setBlock(x,y,z,B.STONE);V.setBlock(x,y+1,z,B.STONE);
      ok('a block this player changes by hand is marked for the others; the next write is not',NET.q.length===2&&NET.q[0][3]===1&&NET.q[1].length===3);
      await pump(4);
      const ck=Math.floor(x/16)+','+Math.floor(z/16),lk=(((x%16)+16)%16)+','+(y+3)+','+(((z%16)+16)%16);
      V.ntMsg({t:'edits',e:[[ck,lk,B.STONE,1]]});
      ok('a marked edit from another player is applied like any other (with its sound and dust on top)',V.getBlock(x,y+3,z)===B.STONE);
      V.ntMsg({t:'edits',e:[[ck,lk,B.AIR,1]]});V.setBlock(x,y,z,B.AIR);V.setBlock(x,y+1,z,B.AIR);await pump(4);}
    /* a villager both games spawned at the same spot is one villager */
    {await beaPose(P.x+3,P.y,P.z);V.spawnMob('alien',P.x+6,P.y+1,P.z);const own=V.entities[V.entities.length-1];
      await pumpUntil(()=>!!own.rid,3000);
      const live=()=>V.entities.filter(e=>e.t==='mob'&&e.mt==='alien'&&!e.dead);
      ok('a villager of this game is sent with its name and the spot it was spawned at',!!own.rid&&typeof own.ox==='number'&&bea.by('mobs').some(m=>m.m.some(a=>a[0]===own.rid&&a[8]===own.name&&a[9]===own.ox&&a[10]===own.oz)));
      bea.send({t:'mobs',m:[['b.9','alien',own.ox,P.y+1,own.oz,0,16,0,'Zorp',own.ox,own.oz]]});await sleep(120);await pump(12);
      ok('the same villager arriving from a player with a lower id replaces this game\'s own (one villager, theirs, with their name for it)',
        beaId<NET.id&&live().length===1&&live()[0].pup===true&&live()[0].rid==='b.9'&&live()[0].name==='Zorp'&&own.dead===true);
      V.spawnMob('alien',own.ox,P.y+1,own.oz);const again=V.entities[V.entities.length-1];await pump(20);
      ok('...and this game spawning it again while theirs is here makes no second one',again.dead===true&&!again.rid&&live().length===1);
      bea.send({t:'mgone',ids:['b.9']});await pumpUntil(()=>live().length===0,3000);}
    /* the line drops without a word: back to the title, and back in */
    {const px=V.P.x,pz=V.P.z,c=S.players().find(q=>q.name===NET.name);
      await V.saveToStorage('x',true);await sleep(60);V.P.x=px+7;await pump(8);   /* walked on after the last save */
      c.sock.destroy();
      ok('a lost connection: back on the title, saying it is trying again',await pumpUntil(()=>V.playing===false&&NET.retryN===1,4000)&&/Reconnecting \(try 1 of 5\)/.test(NET.msg));
      ok('the server kept the place it last saw them, not the place of their last save',Math.abs(W.players[dan.toLowerCase()].x-(px+7))<0.05);
      ok('...and back in the world moments later, as the same player, where they stood',await until(()=>NET.on&&V.playing,8000)&&NET.retryN===0&&NET.name===dan&&Math.abs(V.P.x-(px+7))<0.05&&Math.abs(V.P.z-pz)<0.05);
      step(30);await pump(6);}
  }

  /* ===== 12b. kicked ===== */
  ok('the server can kick by name',S.kick(V.getPName(),'Testing the door.')===true);
  await until(()=>!NET.on&&!V.playing,3000);
  ok('kicked: back on the title with the reason, nothing saved locally, and no trying again',NET.on===false&&V.playing===false&&NET.st==='off'&&NET.retryN===0&&NET.retryH===0&&(await window.storage.list('vxw:')).keys.every(k=>k==='vxw:nsolo'));

  /* ===== 13. the server itself ===== */
  {const r=await fetch('http://127.0.0.1:'+port+'/status').then(x=>x.json());
    ok('/status: name, players, max, password flag',r.name==='Test Server'&&r.players.length===1&&r.players[0]==='Bea'&&r.max===2&&r.password===true&&r.proto===PROTO);
    const t=await fetch('http://127.0.0.1:'+port+'/').then(x=>x.text());ok('/ without a game file explains what to do',/Multiplayer/.test(t));
    ok('anything else is a 404',(await fetch('http://127.0.0.1:'+port+'/etc/passwd')).status===404);}
  {const big='x'.repeat(3*1024*1024);const r=raw(port,null);await r.open;r.ws.send(big);await until(()=>r.closed,3000);ok('an oversized message drops that client only',r.closed&&!bea.closed);}
  await S.close();await until(()=>bea.closed,2000);
  ok('closing the server disconnects everyone',bea.closed);
  {const OUT=path.join(outDir('net'),'server_data');fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
    V.startNewWorld('nexport','77','c');step(40);const px=Math.floor(V.P.x),py=Math.floor(V.P.y)+3,pz=Math.floor(V.P.z);V.setBlock(px,py,pz,B.GLASS);step(3);
    const save=V.snapshot('nexport');await V.quitToTitle();await window.storage.delete('vxw:nexport');
    fs.writeFileSync(path.join(OUT,'world.vxw.json'),JSON.stringify(save));
    fs.writeFileSync(path.join(OUT,'dinglecraft_v'+V.GAME_VERSION+'.html'),'<!doctype html><title>stand-in</title>');
    const WD=path.join(OUT,'world'),rj=f=>JSON.parse(fs.readFileSync(path.join(WD,f),'utf8')),oldBytes=fs.readFileSync(path.join(OUT,'world.vxw.json'),'utf8');
    const S2=createServer({port:0,data:OUT,world:'world.vxw.json',quiet:true});await S2.listen();const W2=S2.world();
    ok('a world file from before 6.12 (or an exported save) becomes a world folder at once, and the file is left as it was',fs.existsSync(path.join(WD,'level.json'))&&rj('level.json').seed===save.seed&&S2.worldDir===WD&&
      fs.readFileSync(path.join(OUT,'world.vxw.json'),'utf8')===oldBytes&&fs.readdirSync(path.join(WD,'region','over')).every(n=>/^r\.-?\d+\.-?\d+\.json$/.test(n)));
    ok('an exported single-player world is adopted (seed, mode, edits; no player, ents or bots)',W2.seed===save.seed&&W2.mode==='c'&&Object.keys(W2.edits).length===Object.keys(save.edits).length&&
      !('player' in W2)&&!('ents' in W2)&&!('bots' in W2)&&!('bots' in W2.gr));
    ok('a game html next to the world is served at /',/stand-in/.test(await fetch('http://127.0.0.1:'+S2.port+'/').then(x=>x.text()))&&S2.status().version===V.GAME_VERSION);
    const b2=raw(S2.port,{});await b2.open;await until(()=>!!b2.last('ready'));
    b2.send({t:'drop',id:'savesave.1',dim:'over',x:3,y:50,z:3,st:{id:B.STONE,count:2}});
    b2.send({t:'edits',e:[['0,0','1,50,1',B.STONE]]});b2.send({t:'save',player:{x:1,y:60,z:2,inv:[]}});await sleep(80);
    await S2.close();
    /* the settings file decides, on every start: rules and mode over the world file's own */
    {let told=null;const S3=createServer({port:0,data:OUT,world:'world.vxw.json',quiet:true,noGame:true,mode:'s',rules:{keepInv:true,fallDmg:false},onRules:r=>{told=r;}});await S3.listen();
      ok('settings applied over an existing world: mode and the listed rules change, the others keep the world\'s values',S3.world().mode==='s'&&S3.world().gr.keepInv===true&&S3.world().gr.fallDmg===false&&S3.world().gr.cheats===save.gr.cheats&&!('bots' in S3.world().gr));
      const b3=raw(S3.port,{});await b3.open;await until(()=>!!b3.last('ready'));
      ok('...and players get them on joining',b3.last('welcome').world.mode==='s'&&b3.last('welcome').world.gr.fallDmg===false);
      b3.send({t:'gr',gr:{fireTick:false}});await until(()=>!!told,2000);
      ok('a rule changed in the game is reported for the settings file (known rules only)',!!told&&told.fireTick===false&&told.keepInv===true&&!('bots' in told));
      await S3.close();}
    /* no world file: one is generated and written at once; a damaged one is refused and left alone */
    {const D3=path.join(OUT,'fresh');const S4=createServer({port:0,data:D3,quiet:true,noGame:true,seed:'9'});const wf=path.join(D3,'world','level.json');
      ok('no world: a new one is generated and is on disk (a folder) before the server even listens',fs.existsSync(wf)&&JSON.parse(fs.readFileSync(wf,'utf8')).seed===9&&S4.world().seed===9);
      await S4.listen();await S4.close();
      const S5=createServer({port:0,data:D3,quiet:true,noGame:true,seed:'1234'});
      ok('the next start loads that world (the seed setting no longer matters)',S5.world().seed===9);await S5.listen();await S5.close();
      fs.writeFileSync(wf,'{"seed": 9, "edits": {');let err='';try{createServer({port:0,data:D3,quiet:true,noGame:true});}catch(e){err=e.message;}
      ok('a damaged file in the world folder stops the server with a reason that names it, and is not overwritten',/level\.json is damaged/.test(err)&&fs.readFileSync(wf,'utf8')==='{"seed": 9, "edits": {');}
    /* the real program: a first run writes every rule into server.json; an edited file is applied on the next run */
    {const cp=require('child_process'),SV=path.join(REPO,'server','dinglecraft-server.mjs'),D2=path.join(OUT,'cli');
      const runIt=()=>cp.spawnSync(process.execPath,[SV,'--data',D2,'--port','0','--seed','5'],{input:'stop\n',encoding:'utf8',timeout:20000});
      const r1=runIt(),c1=JSON.parse(fs.readFileSync(path.join(D2,'server.json'),'utf8'));
      ok('first run: server.json lists the mode and all '+Object.keys(RULES).length+' game rules with the server defaults',r1.status===0&&c1.mode==='s'&&JSON.stringify(c1.rules)===JSON.stringify(RULES)&&c1.rules.cheats===false);
      ok('first run: the new world is on disk with those rules',JSON.parse(fs.readFileSync(path.join(D2,'world','level.json'),'utf8')).gr.cheats===false&&c1.world==='world');
      c1.rules.keepInv=true;c1.rules.dayCycle=false;c1.mode='c';delete c1.rules.snail;fs.writeFileSync(path.join(D2,'server.json'),JSON.stringify(c1));
      const r2=runIt(),w2=JSON.parse(fs.readFileSync(path.join(D2,'world','level.json'),'utf8')),c2=JSON.parse(fs.readFileSync(path.join(D2,'server.json'),'utf8'));
      ok('an edited server.json is applied to the existing world on the next start (rules and mode; same seed)',r2.status===0&&w2.gr.keepInv===true&&w2.gr.dayCycle===false&&w2.mode==='c'&&w2.seed===5);
      ok('a rule deleted from the file keeps the world\'s value and is written back in',w2.gr.snail===true&&c2.rules.snail===true&&c2.rules.keepInv===true&&c2.mode==='c');}
    {const reg=rj('region/over/r.0.0.json'),ent=rj('entities/over/r.0.0.json'),bea2=rj('playerdata/bea.json'),lvl=rj('level.json');
      ok('the world folder is written on shutdown: the new edit in its region file, the dropped item in that region\'s entities, the player in a file of her own',
        reg.dimension==='over'&&reg.chunks['0,0'].blocks['1,50,1']===B.STONE&&ent.items['savesave.1'].item.count===2&&ent.items['savesave.1'].x===3&&bea2.player==='bea'&&bea2.x===1&&bea2.y===60&&Array.isArray(bea2.inv)&&
        lvl.seed===save.seed&&lvl.f===save.f&&!('edits' in lvl)&&!('players' in lvl)&&!('drops' in lvl));
      const all=[];(function walk(d){for(const n of fs.readdirSync(d,{withFileTypes:true}))n.isDirectory()?walk(path.join(d,n.name)):all.push(n.name);})(WD);
      ok('nothing half-written is left behind, and every file is JSON a person can read (indented, one thing per line)',all.every(n=>n.endsWith('.json'))&&fs.readFileSync(path.join(WD,'playerdata','bea.json'),'utf8').split('\n').length>5&&fs.readFileSync(path.join(WD,'region','over','r.0.0.json'),'utf8').split('\n').length>6);
      const {readWorldDir,adoptWorld,exportWorld}=await import(pathToFileURL(path.join(REPO,'server','lib','world.mjs')).href);
      const again=adoptWorld(readWorldDir(WD).world,{}),one=JSON.parse(exportWorld(again));
      ok('the folder reads back as the same world, and exports as one file the game can import',again.edits['0,0']['1,50,1']===B.STONE&&again.drops['savesave.1'].st.count===2&&again.players.bea.x===1&&Object.keys(again.edits).length===Object.keys(S2.world().edits).length&&
        one.seed===save.seed&&one.edits['0,0']['1,50,1']===B.STONE&&one.f===save.f);
      /* only what changed is written */
      const S7=createServer({port:0,data:OUT,world:'world',quiet:true,noGame:true});await S7.listen();
      const stamp=f=>fs.statSync(path.join(WD,f)).mtimeMs,t0={r:stamp('region/over/r.0.0.json'),p:stamp('playerdata/bea.json')};await sleep(30);
      S7.world().players.bea.hp=7;S7.world().drops={};S7.saveWorld();await S7.close();
      ok('a later save rewrites only the files that changed and removes a file whose region emptied out',stamp('region/over/r.0.0.json')===t0.r&&stamp('playerdata/bea.json')>t0.p&&rj('playerdata/bea.json').hp===7&&!fs.existsSync(path.join(WD,'entities','over','r.0.0.json')));}
    fs.rmSync(OUT,{recursive:true,force:true});}
  await window.storage.delete('vxw:nsolo');
});
