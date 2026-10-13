/* ===================================================================== */
/* PART 53 — chat, the player list, and a few things everything shares    */
/* ===================================================================== */
/* What is left of the 5.9 AI Players update after the AI players themselves were removed in 6.10 (multiplayer brought real
   ones). These were born in that update but belong to the whole game:
     - who did it: HIT_BY / ACTOR / LASTDMG say who the next hit, block change or death is from (HIT_HOW and EXPL_BY are
       beside GAME_VERSION in core/p01a_prologue.js)
     - playSAt: a sound that is quieter with distance
     - the chat box (T, Enter or /), the Tab player list, and the Player Compass, which now tracks the other players on a
       server (PART 58)
     - the nine biome flowers (block ids 140-148): worldgen places them, so they can never go
     - mobAnchor / mobFarFromAll / mobClearOfPlayers: where the mob spawner measures from */
var HIT_BY=null;            /* who the next hurtMob() is from */
var ACTOR=null;             /* who is changing blocks right now */
var LASTDMG={by:null,how:null};   /* what last hurt the player: a new object every time (death messages compare identity) */
var SNDMUL=1;

/* positional sound: quieter with distance, silent past 30 blocks */
function playSAt(n,x,y,z){
  if(!P)return;
  const d=Math.hypot(x-P.x,y-P.y,z-P.z);
  if(d>30)return;
  SNDMUL=Math.pow(1-d/30,1.4);
  try{playS(n);}finally{SNDMUL=1;}
}

/* ----- what a mob is called (death messages) ----- */
const MOB_NAME={zombie:'Zombie',skel:'Skeleton',boomer:'Boomer',spider:'Spider',alien:'Alien',
  dragon:'Dragon',dking:'Dragon King',titan:'Stone Titan',demon:'Malgorath',imp:'Imp',hellhog:'Hellhog',
  cherub:'Cherub',warden:'Warden',valkyra:'Valkyra',infernis:'Infernis',creep:'Nuke Keg',nuker:'Armed Nuke Keg',snake:'Snake',blockling:'Blockling'};
function mobNameOf(mt){return MOB_NAME[mt]||(mt?mt[0].toUpperCase()+mt.slice(1):'something');}

/* ----- where the mob spawner measures from: this player ----- */
function mobAnchor(){return P;}
function mobFarFromAll(e){return Math.hypot(e.x-P.x,e.z-P.z)>64;}
function mobClearOfPlayers(x,z){return Math.hypot(x-P.x,z-P.z)>12;}

/* ----- flowers (each biome grows its own) ----- */
B.TULIP_R=140;B.TULIP_O=141;B.CORNFLOWER=142;B.ALLIUM=143;B.LILY=144;B.SNOWDROP=145;B.MARIGOLD=146;B.EDELWEISS=147;B.SEALAV=148;
const NEW_FLOWERS=[
  [B.TULIP_R,'Red Tulip','fl_tulr','plains'],[B.TULIP_O,'Orange Tulip','fl_tulo','plains'],
  [B.CORNFLOWER,'Cornflower','fl_corn','plains and forests'],[B.ALLIUM,'Allium','fl_all','forests'],
  [B.LILY,'Lily of the Valley','fl_lily','birch forests'],[B.SNOWDROP,'Snowdrop','fl_snow','snowy tundra'],
  [B.MARIGOLD,'Desert Marigold','fl_mari','deserts'],[B.EDELWEISS,'Edelweiss','fl_edel','high mountains'],
  [B.SEALAV,'Sea Lavender','fl_slav','beaches'],
];
for(const [id,n,t] of NEW_FLOWERS)def(id,{name:n,tiles:t,hard:0,solid:false,opq:false,bucket:'cut',cross:true,replace:true});
const FLOWER_IDS=new Set([B.FLOWER_R,B.FLOWER_Y].concat(NEW_FLOWERS.map(f=>f[0])));
tile('fl_tulr',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#3f7a26';c.fillRect(7,8,1,8);c.fillRect(8,11,2,1);
  c.fillStyle='#d8343a';c.fillRect(6,4,4,4);c.fillRect(5,3,1,3);c.fillRect(10,3,1,3);c.fillRect(7,2,2,1);px(c,7,5,'#f06a6a');});
tile('fl_tulo',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#3f7a26';c.fillRect(7,8,1,8);c.fillRect(5,12,2,1);
  c.fillStyle='#f0832e';c.fillRect(6,4,4,4);c.fillRect(5,3,1,3);c.fillRect(10,3,1,3);c.fillRect(7,2,2,1);px(c,8,5,'#ffb46a');});
tile('fl_corn',(c,R)=>flower(c,R,'#3c6fe0'));
tile('fl_all',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#3f7a26';c.fillRect(7,7,1,9);
  c.fillStyle='#a45ad8';for(const [x,y] of [[6,3],[8,3],[5,4],[7,4],[9,4],[6,5],[8,5],[7,2],[7,6]])c.fillRect(x,y,1,1);px(c,7,4,'#d6a6f2');});
tile('fl_lily',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#3f7a26';c.fillRect(7,6,1,10);c.fillRect(8,5,2,1);c.fillRect(5,9,2,4);
  c.fillStyle='#f6f6ee';c.fillRect(9,6,2,2);c.fillRect(10,9,2,2);c.fillRect(9,12,2,2);});
tile('fl_snow',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#4a8a3a';c.fillRect(7,8,1,8);c.fillRect(8,7,1,1);
  c.fillStyle='#eef6ff';c.fillRect(8,8,3,3);c.fillStyle='#bcd8f5';c.fillRect(9,11,1,1);});
tile('fl_mari',(c,R)=>flower(c,R,'#f2b21c'));
tile('fl_edel',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#6c8a5a';c.fillRect(7,8,1,8);
  c.fillStyle='#f4f2e8';for(const [x,y] of [[7,3],[5,5],[9,5],[6,7],[8,7],[4,5],[10,5],[7,2]])c.fillRect(x,y,1,1);
  c.fillStyle='#e6d36a';c.fillRect(6,4,3,3);});
tile('fl_slav',(c,R)=>{c.clearRect(0,0,16,16);c.fillStyle='#4f7a46';c.fillRect(7,6,1,10);c.fillRect(5,9,2,1);c.fillRect(9,8,2,1);
  c.fillStyle='#9f8ce8';for(const [x,y] of [[6,3],[7,2],[8,3],[5,5],[9,5],[7,4],[4,7],[10,7],[11,6],[3,6]])c.fillRect(x,y,1,1);});
/* which new flower (if any) grows on this column */
function bioFlower(b,top,h,wx,wz){
  const r=h2(wx,wz,SEED+7171);
  if(top===B.GRASS){
    if(r>=0.012)return 0;
    const k=h2(wx,wz,SEED+7272);
    if(b===BIOME.PLAINS)return k<0.4?B.TULIP_R:k<0.8?B.TULIP_O:B.CORNFLOWER;
    if(b===BIOME.FOREST)return k<0.6?B.ALLIUM:B.CORNFLOWER;
    if(b===BIOME.BIRCH)return B.LILY;
    return 0;
  }
  if(top===B.SNOWGRASS)return r<0.008?(h>=58?B.EDELWEISS:B.SNOWDROP):0;
  if(top===B.SAND&&b===BIOME.DESERT)return r<0.003?B.MARIGOLD:0;
  if(top===B.SAND&&b===BIOME.BEACH)return r<0.012?B.SEALAV:0;
  return 0;
}

/* ----- the Player Compass: points at another player on a server ----- */
IT.PCOMPASS=284;
idef(IT.PCOMPASS,{name:'Player Compass',icon:'i_pcmp',stack:1});
tile('i_pcmp',c=>{c.clearRect(0,0,16,16);
  c.fillStyle='#c9a227';c.beginPath();c.arc(8,8,7,0,7);c.fill();
  c.fillStyle='#262230';c.beginPath();c.arc(8,8,5.4,0,7);c.fill();
  c.fillStyle='#5ad1ff';c.beginPath();c.moveTo(8,3);c.lineTo(10,9);c.lineTo(8,8);c.closePath();c.fill();
  c.fillStyle='#f3f3f8';c.beginPath();c.moveTo(8,13);c.lineTo(6,8);c.lineTo(8,9);c.closePath();c.fill();
  c.fillStyle='#ffd84d';c.fillRect(7,7,2,2);});
R([' I ','IGI',' I '],{I:IT.IRON,G:IT.GOLD},IT.PCOMPASS,1);
/* the players it can track: everyone else on the server, as {name, dead, dim, x, y, z} */
function pcmpPlayers(){
  const out=[];
  if(typeof NET!=='undefined'&&NET.on)for(const p of NET.peers.values())if(p.has)out.push({name:p.name,dead:!!(p.fl&4),dim:p.dim,x:p.tx,y:p.ty,z:p.tz});
  return out;
}
function pcmpTargets(){return pcmpPlayers().map(p=>p.name);}
/* compass points, N at -z */
function dir8(dx,dz){const dirs=['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(((Math.atan2(dx,-dz)/Math.PI*180+360)%360)/45)%8];}
function pcmpCycle(dir){
  dir=dir<0?-1:1;
  const L=pcmpTargets();
  if(!L.length){showToast('No other players online');P.pcmpT=null;return;}
  let i=L.indexOf(P.pcmpT);
  i=i<0?(dir>0?0:L.length-1):(i+dir+L.length)%L.length;
  P.pcmpT=L[i];
  showToast('Tracking: '+P.pcmpT);
  playS('click');
}
let _pcLast='';
function tickPCompass(dt){
  const el=$('pcmphud');
  if(!el)return;
  const st=P&&!P.dead?heldStack():null;
  const held=st&&st.id===IT.PCOMPASS&&!CUT.on;
  if(!held){if(_pcLast!==''){_pcLast='';el.style.display='none';}return;}
  const PL=pcmpPlayers(),L=PL.map(p=>p.name);
  if(P.pcmpT&&!L.includes(P.pcmpT))P.pcmpT=null;
  if(!P.pcmpT&&L.length)P.pcmpT=L[0];
  let txt,ang=null,spin=false;
  const a=PL.find(p=>p.name===P.pcmpT)||null;
  if(!a)txt='No other players online';
  else if(a.dead)txt=a.name+' — respawning';
  else if(a.dim!==DIM){txt=a.name+' ('+(a.dim==='over'?'Overworld':a.dim==='nether'?'Nether':a.dim==='puppet'?'Puppet Purgatory':'Aether')+')';spin=true;}
  else{
    const dx=a.x-P.x,dz=a.z-P.z,d=Math.hypot(dx,dz),dy=Math.round(a.y-P.y);
    txt=d<8?a.name+' — HERE':a.name+'  '+Math.round(d)+'m '+dir8(dx,dz)+(Math.abs(dy)>=3?(dy>0?' ↑':' ↓')+Math.abs(dy):'');
    if(d>=8)ang=Math.atan2(-dx,-dz);
  }
  if(txt!==_pcLast){_pcLast=txt;el.style.display='flex';const t=$('pcmptext');if(t)t.textContent=txt;}
  const nd=$('pcmpneedle');
  if(!nd)return;
  if(ang!==null){let rel=ang-P.yaw;rel=((rel+Math.PI*3)%(Math.PI*2))-Math.PI;
    nd.style.transform='rotate('+(-rel*180/Math.PI).toFixed(1)+'deg)';nd.textContent='⬆';}
  else if(spin){nd.style.transform='rotate('+((performance.now()/3)%360).toFixed(0)+'deg)';nd.textContent='⬆';}
  else{nd.style.transform='';nd.textContent=a?'★':'?';}
}

/* ----- chat log ----- */
const CHAT=[];   /* {t,txt,k:'chat'|'sys'|'whisper'|'death'|'me',from,to} */
var chatOpen=false,tabHeld=false;
let _chatDirty=true;
function chatPush(m){
  m.t=performance.now();CHAT.push(m);
  if(CHAT.length>120)CHAT.splice(0,CHAT.length-120);
  _chatDirty=true;
}
function sysMsg(txt){chatPush({k:'sys',txt});}
function chatLine(from,txt,to,whisper){chatPush({k:whisper?'whisper':'chat',from,txt,to:to||null});}

/* ----- chat box, commands, Tab list ----- */
function renderChat(force){
  const box=$('chatlog');if(!box)return;
  const now=performance.now();
  if(!force&&!_chatDirty&&frameCount%20!==0)return;
  _chatDirty=false;
  const lines=CHAT.slice(chatOpen?-22:-10).filter(m=>chatOpen||now-m.t<14000);
  box.innerHTML='';
  for(const m of lines){
    const d=document.createElement('div');
    d.className='cl cl-'+m.k;
    if(m.k==='chat')d.textContent='<'+pnShow(m.from)+'> '+pnText(m.txt);
    else if(m.k==='whisper')d.textContent=m.from==='Dan'?'You whisper to '+m.to+': '+pnText(m.txt):m.from+' whispers to you: '+pnText(m.txt);
    else d.textContent=pnText(m.txt);
    if(!chatOpen){const age=(now-m.t)/1000;if(age>11)d.style.opacity=Math.max(0,1-(age-11)/3).toFixed(2);}
    box.appendChild(d);
  }
}
function openChat(pre){
  if(chatOpen||!playing||paused||!P||P.dead||modalOpen())return;
  chatOpen=true;
  const inp=$('chatin');
  if(inp){inp.style.display='block';inp.value=pre||'';setTimeout(()=>{try{inp.focus();}catch(e){}},0);}
  const bx=$('chatbox');if(bx)bx.classList.add('open');
  try{document.exitPointerLock&&document.exitPointerLock();}catch(e){}
  for(const k in KEY)KEY[k]=false;MB.l=MB.r=false;
  renderChat(true);
}
function closeChat(){
  if(!chatOpen)return;
  chatOpen=false;
  const inp=$('chatin');if(inp){inp.style.display='none';try{inp.blur();}catch(e){}}
  const bx=$('chatbox');if(bx)bx.classList.remove('open');
  renderChat(true);
  setTimeout(()=>{try{tryLock();}catch(e){}},30);
}
function chatKey(e){
  if(chatOpen){
    if(e.code==='Enter'||e.code==='NumpadEnter'){e.preventDefault();const inp=$('chatin');const v=inp?inp.value:'';closeChat();chatSubmit(v);}
    else if(e.code==='Escape'){e.preventDefault();closeChat();}
    return true;
  }
  if(!playing||paused||!P||P.dead||modalOpen())return false;
  if(e.code==='KeyT'||e.code==='Enter'){e.preventDefault();openChat('');return true;}
  if(e.code==='Slash'){e.preventDefault();openChat('/');return true;}
  return false;
}
/* a line typed into chat. On a server it goes to everyone, and a slash command is the server's (PART 58); alone, chat is
   a note to yourself and there are no commands. */
function chatSubmit(raw){
  const t=(''+(raw||'')).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,200);
  if(!t)return;
  if(t[0]!=='/'){chatLine('Dan',t,null,false);if(NET.on)ntChat(t);return;}
  if(NET.on){ntCmd(t);return;}   /* PART 58: on a server, slash commands are the server's */
  sysMsg('Commands work on a multiplayer server (main menu: Multiplayer). Alone, T or Enter just talks.');
}
let _tabLast='';
function renderTab(){
  const el=$('tablist');if(!el)return;
  const show=tabHeld&&playing&&!chatOpen&&!modalOpen();
  if(!show){if(_tabLast!==''){_tabLast='';el.style.display='none';}return;}
  const rows=[[PNAME,P.mode==='c'?'creative':Math.round(P.hp)+'❤','',0]];
  if(NET.on)ntTabRows(rows);
  const s=JSON.stringify(rows);
  if(s===_tabLast)return;
  _tabLast=s;el.style.display='block';el.innerHTML='';
  const h=document.createElement('div');h.className='tabh';h.textContent='DINGLECRAFT — '+rows.length+' online';el.appendChild(h);
  for(const r of rows){const d=document.createElement('div');d.className='tabr';
    d.textContent=r[0].padEnd(18,' ')+'  '+(''+r[1]).padStart(9,' ')+'  '+(''+r[2]).padStart(9,' ')+(r[3]?'  '+r[3]:'');el.appendChild(d);}
}
/* tick the chat and the player list every frame (even while paused, so Tab and chat stay live) */
function tickChatHud(dt){
  if(!playing)return;
  renderChat(false);
  renderTab();
}
