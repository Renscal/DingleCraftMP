/* n_static.js (v6.10, lane NET, gate x1): the multiplayer statics. No sockets, no clock.
   1 PART 58 placement (right before PART 57), its eight files in order with their markers, its size guard; every file and
     every function carries a comment
   2 names: every top-level declaration in src/net/ starts nt / NET / NT_ / NTEX and collides with nothing else in the game
   3 load-time purity: no WebSocket, THREE constructor, clock or random number outside a function body
   4 the 21 core hooks, each present exactly once and each behind NET.on (ntDropTake behind e.nid, ntMobPup and ntMobHit behind
     e.pup, which only PART 58 sets)
   5 the title markup: the Multiplayer button and the #tmp view, every id the code uses there once
   6 version, patch notes, the export seam
   7 the server: its front door and eight lib/ modules (each commented, layered), no dependencies (node: built-ins only), the protocol number matches, the Windows launcher is CRLF and names the server
   8 server/data/ is ignored by git */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const fs=require('fs'),path=require('path');
const {REPO,readSrc}=require('../lib/paths.js');
const V=boot({});
boot.run(async()=>{
  const G=fs.readFileSync(boot.BUILD+'game.js','utf8'),HH=fs.readFileSync(boot.BUILD+'head.html','utf8');
  const NFILES=['n0_contract.js','n1_link.js','n2_world.js','n3_drops.js','n4_self.js','n5_players.js','n6_menu.js','n7_mobs.js'];   /* src/net/, in load order */
  const N=NFILES.map(f=>readSrc('net/'+f)).join(''),ORDER=fs.readFileSync(path.join(REPO,'src','ORDER.txt'),'utf8');
  const count=(t,s)=>t.split(s).length-1;

  /* ---- 1. placement ---- */
  const i58=G.indexOf('/* ---- PART 58: n0_contract.js ---- */'),i57=G.indexOf('/* ---- PART 57: m0_contract.js ---- */');
  ok('PART 58 is in the build once ('+NFILES.length+' files, byte for byte, in order), right before PART 57',i58>0&&count(G,'/* ---- PART 58: ')===NFILES.length&&i57>i58&&G.slice(i58,i57)===N);
  ok('every file starts with its own marker line and ends with a newline',NFILES.every(f=>{const t=readSrc('net/'+f);return t.startsWith('/* ---- PART 58: '+f+' ---- */\n')&&t.endsWith('\n');}));
  ok('src/net/ holds exactly those files',JSON.stringify(fs.readdirSync(path.join(REPO,'src','net')).sort())===JSON.stringify(NFILES));
  ok('every file opens with a comment saying what it is for (after the marker)',NFILES.every(f=>readSrc('net/'+f).split('\n')[1].startsWith('/*')));
  {const fn=[...N.matchAll(/^function (nt\w+)\(/gm)],lines=N.split('\n');let bare=[];
    for(const m of fn){const i=N.slice(0,m.index).split('\n').length-1;if(!/\*\/\s*$/.test(lines[i-1]||'')&&!/\/\*.*\*\//.test(lines[i]))bare.push(m[1]);}
    ok('every function in PART 58 has a comment on the line above it (or on its own line)'+(bare.length?' (bare: '+bare.join(', ')+')':''),bare.length===0&&fn.length>40);}
  {const L=ORDER.split('\n').filter(l=>l&&l[0]!=='#');const i=L.indexOf('net/n0_contract.js');
    ok('src/ORDER.txt: the net/ files in order, immediately before malgorath/m0_contract.js',i>0&&JSON.stringify(L.slice(i,i+NFILES.length))===JSON.stringify(NFILES.map(f=>'net/'+f))&&L[i+NFILES.length]==='malgorath/m0_contract.js'&&L.filter(l=>l.startsWith('net/')).length===NFILES.length);}
  {const g=JSON.parse(fs.readFileSync(path.join(REPO,'scripts','guards.json'),'utf8')).sections.find(s=>s.name==='PART 58');
    ok('scripts/guards.json guards PART 58 (required, under its cap)',!!g&&g.mode==='required'&&g.to==='/* ---- PART 57: m0_contract.js ---- */'&&Buffer.byteLength(N)<g.cap);}

  /* ---- 2. names ---- */
  const decl=t=>{const out=[];const re=/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)|^(?:var|let|const)\s+([A-Za-z_$][\w$]*)(?:\s*=[^,;]*?)?/gm;let m;while((m=re.exec(t)))out.push(m[1]||m[2]);return out;};
  const mine=decl(N);
  ok('PART 58 declares only nt* / NET / NT_* / NTEX names ('+mine.length+')',mine.length>20&&mine.every(n=>/^(nt[A-Z]\w*|NET|NT_[A-Z]+|NTEX)$/.test(n)));
  {const rest=G.slice(0,i58)+G.slice(i57),other=new Set(decl(rest));
    ok('none of them is declared anywhere else in the game',mine.every(n=>!other.has(n))&&new Set(mine).size===mine.length);
    ok('nothing else in the game starts a top-level name with nt[A-Z] or NT_',![...other].some(n=>/^(nt[A-Z]|NT_|NET$)/.test(n)));}

  /* ---- 3. load-time purity ---- */
  {const top=N.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(l=>/^(const|let|var)\s/.test(l)).join('\n');
    ok('top-level declarations: no socket, THREE constructor, clock or random number',!/WebSocket|new THREE|Date\.now|performance\.now|Math\.random|fetch\(/.test(top));
    ok('the only socket is opened inside ntConnect',count(N,'new WebSocket(')===1&&N.indexOf('new WebSocket(')>N.indexOf('function ntConnect(')&&N.indexOf('new WebSocket(')<N.indexOf('function ntDown('));
    ok('booting the game opened nothing',V.NET.on===false&&V.NET.ws===null&&V.NET.st==='off'&&V.NET.peers.size===0);}

  /* ---- 4. the core hooks ---- */
  const hooks=[
    ['world/p03c_chunk_store.js',"if(NET.on&&!NET.ap)ntEdit(ckey(cx,cz),lx+','+y+','+lz,id);"],
    ['core/p07e_save_load.js','if(NET.on)return ntSave(quiet);'],
    ['core/p07f_world_lifecycle.js','ntLeave();'],
    ['core/p07h_boot_loop.js',' ntFrame(dt);'],   /* the space: hrEntFrame(dt); ends the same way */
    ['core/p04d_player_update.js','if(NET.on&&ntMelee(e,d,Math.min(tgt?tgt.t:9,hit?hit.t:9))){MINE.active=false;MINE.prog=0;return;}'],
    ['core/p04c_player.js','if(NET.on)ntDied();'],
    ['ui/p53_chat.js','if(NET.on)ntChat(t);'],
    ['ui/p53_chat.js','if(NET.on)ntTabRows(rows);'],
    ['entities/p05a_entities_drops.js','if(NET.on)ntDropSpawned();'],
    ['entities/p05a_entities_drops.js','if(ds<0.75&&!(e.nid&&ntDropTake(e))){'],
    ['ui/p53_chat.js','if(NET.on){ntCmd(t);return;}'],
    ['features/p17_beds.js','if(NET.on&&ntSleep())return;'],
    ['ui/p06d_modal_inventory.js','if(NET.on&&bek&&ntBeAsk(kind,bek))return;'],
    ['core/p04d_player_update.js','||(NET.on&&ntGuard(hit.x,hit.z))){MINE.active=false;MINE.prog=0;return;}'],
    ['core/p04d_player_update.js','if(!blocked&&NET.on&&ntGuard(tx,tz))blocked=true;'],
    ['entities/p05e_spawning_tick.js',"else if(e.t==='mob'){if(e.pup)ntMobPup(e,dt);else updateMob(e,dt);}"],
    ['entities/p05d_mobs.js','if(e.pup){ntMobHit(e,dmg,kx,kz);return;}'],
    ['entities/p05b_falling_arrows_tnt.js','if(NET.on)ntBoom(x,y,z,r,byMob);'],
    ['entities/p05b_falling_arrows_tnt.js',"if(NET.on&&e.owner==='p'&&ntShot(nx,ny,nz,e.dmg,e.vx,e.vz)){removeEnt(e);return;}"],
    ['features/p08_torches_weapons_vehicles_music.js','    if(NET.on&&ntShot(nx,ny,nz,e.dmg,e.vx,e.vz)){removeEnt(e);return;}'],
    ['features/p18_armor_boats_water_qol.js','if(NET.on&&!ntSimHere(x,z))continue;'],
  ];
  for(const [f,h] of hooks)ok('hook in '+f+': '+h.slice(0,34)+'… once, and once in the build',count(readSrc(f),h)===1&&count(G,h)===1);
  {const outside=G.slice(0,i58)+G.slice(i57);const calls=outside.match(/\bnt[A-Z]\w*\(/g)||[];
    ok('the core calls into PART 58 exactly 21 times ('+calls.length+')',calls.length===21);
    ok('the two drop guards: networked drops stay out of the dimension stash, and drops do not merge online',
      count(readSrc('world/p37_dimensions.js'),"e.t==='drop'&&e.st&&!e.nid){out.push(")===1&&count(readSrc('entities/p05a_entities_drops.js'),'&&e.st.dur==null&&!NET.on){')===1);
    ok('e.nid is only ever set by PART 58',!/\.nid\s*=[^=]/.test(outside));
    ok('e.pup and e.rid are only ever set by PART 58, and another player\'s mob never goes into the dimension stash',!/\.(pup|rid)\s*=[^=]/.test(outside)&&count(readSrc('world/p37_dimensions.js'),"if(e.t==='mob'&&e.pup){removeEnt(e);continue;}")===1);
    {const shared=Object.keys(V.MOBT).filter(mt=>V.ntMobShared({t:'mob',mt}));
      ok('what is shared (6.11): the ordinary mobs, villagers, Nuke Kegs and the plain bosses; never a Purgatory or Malgorath cast, a prop, a dragon, a snake or a blockling',
        shared.every(mt=>{const T=V.MOBT[mt];return !T.pmob&&!T.mg&&!T.pnc&&mt!=='dragon'&&mt!=='dking'&&mt!=='snake'&&mt!=='blockling';})&&
        ['zombie','pig','alien','nuker','boss','titan','infernis','valkyra'].every(mt=>shared.includes(mt))&&!V.ntMobShared({t:'mob',mt:'zombie',pkeep:1})&&!V.ntMobShared({t:'drop'}));}
    ok('ntFrame and ntLeave guard themselves; every other hook is behind NET.on',/function ntFrame\(dt\)\{\n  if\(!NET\.on\|\|!P\)return;/.test(N)&&/function ntLeave\(\)\{\n  if\(!NET\.on&&NET\.st==='off'&&!NET\.ws\)return;/.test(N));}

  /* ---- 5. the title ---- */
  const ids=['t_go_mp','tmp','t_mp_addr','t_mp_pw','t_mp_name','t_mp_status','t_back_mp','t_mp_go'];
  ok('title markup: '+ids.join(' ')+' each once',ids.every(id=>count(HH,'id="'+id+'"')===1));
  ok('every $() id PART 58 uses is in the markup',(N.match(/\$\('([\w]+)'\)/g)||[]).map(s=>s.slice(3,-2)).every(id=>count(HH,'id="'+id+'"')===1));
  ok('the Multiplayer button sits between Load World and Controls',HH.indexOf('id="t_go_load"')<HH.indexOf('id="t_go_mp"')&&HH.indexOf('id="t_go_mp"')<HH.indexOf('id="t_help"'));
  ok('the password field is a password field',/<input id="t_mp_pw"[^>]*type="password"/.test(HH));
  ok('the title menu knows the view (tmEls)',/mp:\$\('tmp'\)/.test(readSrc('ui/p07g_title.js')));
  {V.ntOpenMenu();ok('ntOpenMenu shows #tmp and hides the main menu',global.document.getElementById('tmp').hidden===false&&global.document.getElementById('tmain').hidden===true);V.tmShow('main');}

  /* ---- 6. version, notes, exports ---- */
  ok('game 6.10 or newer',(([a,b])=>a>6||(a===6&&b>=10))(V.GAME_VERSION.split('.').map(Number)));
  {const e=V.PATCH_LOG.find(p=>p.v==='6.10')||V.PATCH_LOG[0];ok('the 6.10 patch notes are written (no TODO) and say what is not shared',!!e&&e.title==='Multiplayer'&&e.lines.length>=5&&!e.lines.some(l=>/TODO/.test(l))&&e.lines.some(l=>/not shared/.test(l)));}
  ok('NTEX is spread into __vox (last: the update export objects keep their pinned order)',/\n    \.\.\.NTEX\};\n  boot\(\);/.test(readSrc('boot/export_boot.js')));

  /* ---- 7. the server ---- */
  /* the server: the front door plus its modules in server/lib/ */
  const SMODS=['cli.mjs','commands.mjs','config.mjs','http.mjs','protocol.mjs','server.mjs','websocket.mjs','world.mjs'];
  const SFILES=['dinglecraft-server.mjs',...SMODS.map(f=>'lib/'+f)],STXT=Object.fromEntries(SFILES.map(f=>[f,fs.readFileSync(path.join(REPO,'server',f),'utf8')]));
  const SV=SFILES.map(f=>STXT[f]).join('\n');
  ok('server/lib/ holds exactly the eight modules',JSON.stringify(fs.readdirSync(path.join(REPO,'server','lib')).sort())===JSON.stringify(SMODS));
  ok('every server file opens with a comment saying what it is for, and the front door lists every module',SFILES.every(f=>/^(#![^\n]*\n)?\/\/ /.test(STXT[f]))&&SMODS.every(f=>STXT['dinglecraft-server.mjs'].includes('lib/'+f)));
  {const bare=[];for(const f of SFILES){const L=STXT[f].split('\n');L.forEach((l,i)=>{const m=/^(?:export )?(?:async )?function (\w+)\(/.exec(l);if(m&&!/^\s*(\/\/|\/\*|\*)|\*\/\s*$/.test(L[i-1]||''))bare.push(f+':'+m[1]);});}
    ok('every top-level server function has a comment above it'+(bare.length?' (bare: '+bare.join(', ')+')':''),bare.length===0);}
  ok('the layering holds: the wire format knows nothing of the game, the protocol nothing of sockets, config imports no other module',
    !/from '\.\//.test(STXT['lib/websocket.mjs'])&&!/from '\.\//.test(STXT['lib/config.mjs'])&&!/websocket|node:http|node:net/.test(STXT['lib/protocol.mjs'].replace(/^\/\/.*$/gm,''))&&!/websocket|node:http|node:net|from '\.\/(server|cli|protocol)/.test(STXT['lib/commands.mjs'].replace(/^\/\/.*$/gm,''))&&!/from '\.\/(server|cli|protocol)/.test(STXT['lib/world.mjs']));
  ok('the front door still exports createServer, PROTO and RULES',/export \{ createServer \} from '\.\/lib\/server\.mjs';/.test(SV)&&/export \{ PROTO, RULES \} from '\.\/lib\/config\.mjs';/.test(SV));
  {const imps=[...SV.matchAll(/^import\s[^'"]*['"]([^'"]+)['"]/gm)].map(m=>m[1]).concat([...SV.matchAll(/import\(['"]([^'"]+)['"]\)/g)].map(m=>m[1]));
    ok('the server imports only node: built-ins and its own lib/ modules ('+imps.length+')',imps.length>=12&&imps.every(s=>s.startsWith('node:')||/^\.\/(lib\/)?[a-z]+\.mjs$/.test(s)));}
  ok('the server and the game agree on the protocol number and the default port',new RegExp('export const PROTO = '+V.NT_PROTO+';').test(SV)&&SV.includes('port: '+V.NT_PORT+','));
  {const m=/function GR_DEF\(\)\{return (\{[\s\S]*?\});\}/.exec(readSrc('ui/p27_debug_gamerules_settings.js')),D=m?new Function('return '+m[1])():{};
    const sm=/export const RULES = (\{[\s\S]*?\});/.exec(SV),R=sm?new Function('return '+sm[1])():{};
    const want=Object.keys(D).filter(k=>!/^bot/.test(k));
    ok('the server\'s game rules are the game\'s (GR_DEF) minus the AI-player ones, same defaults except Cheats off ('+Object.keys(R).length+')',want.length>10&&JSON.stringify(Object.keys(R).sort())===JSON.stringify(want.sort())&&
      want.every(k=>k==='cheats'?(R[k]===false&&D[k]===true):R[k]===D[k]));
    const RD=fs.readFileSync(path.join(REPO,'server','README.md'),'utf8');
    ok('server/README.md documents every rule',want.every(k=>RD.includes('| `'+k+'` |')&&RD.includes('"'+k+'": ')));}
  ok('the server knows the length of a day',/const DAY_LEN = 600;/.test(SV)&&/const DAY_LEN = 600;/.test(readSrc('core/p01a_prologue.js')));
  {const bat=fs.readFileSync(path.join(REPO,'server','Start Server.bat'),'utf8');
    ok('Start Server.bat: CRLF throughout, runs the server from its own folder, checks for Node',!/[^\r]\n/.test(bat)&&bat.includes('"%~dp0dinglecraft-server.mjs"')&&/where node/.test(bat));}
  ok('server/README.md exists and names what is not shared',/not shared/i.test(fs.readFileSync(path.join(REPO,'server','README.md'),'utf8')));

  /* ---- 8. git ---- */
  ok('.gitignore: server/data/',/^server\/data\/$/m.test(fs.readFileSync(path.join(REPO,'.gitignore'),'utf8')));
});
