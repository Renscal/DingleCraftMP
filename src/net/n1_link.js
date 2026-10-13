/* ---- PART 58: n1_link.js ---- */
/* The connection to the server: open it, lose it, leave it, and the one function every incoming message goes through.
   Joining is "load a save": welcome carries the world's settings and this player's saved state, edits / bes / drops carry the
   rest, and on ready ntEnter builds a save-shaped object and hands it to applySave.
   Three ways out: ntLeave (the player quit: called from the tail of quitToTitle), ntDown (the socket closed or the server
   refused: back to the title with the reason), and a failed load in ntEnter (which closes the socket, so ntDown runs).
   A connection that was lost (not refused, not a kick, not the player's own doing) is tried again a few times from the
   title (ntRetry): joining is "load a save", so coming back is simply joining again, with whatever the server has. */

const NT_RETRIES=5;

/* ----- the socket ----- */
function ntUrl(addr){
  let a=(''+(addr||'')).trim();
  if(!a)return null;
  if(/^wss?:\/\//i.test(a))return a;
  a=a.replace(/^https?:\/\//i,'').replace(/\/.*$/,'');
  if(!a)return null;
  const secure=typeof location!=='undefined'&&location.protocol==='https:';
  if(!/:\d+$/.test(a)&&!/^\[.*\]$/.test(a)&&!secure)a+=':'+NT_PORT;
  return (secure?'wss://':'ws://')+a;
}
/* the status line on the Multiplayer screen (bad = shown as an error); also greys out Join while connecting */
function ntStatus(txt,bad){
  NET.msg=txt||'';
  const el=$('t_mp_status');if(el){el.textContent=NET.msg;if(el.classList)el.classList.toggle('bad',!!bad);}
  const b=$('t_mp_go');if(b)b.disabled=NET.st==='connecting';
}
/* send one message; false (and nothing else) when there is no open connection */
function ntSend(m){
  const ws=NET.ws;
  if(!ws||ws.readyState!==1)return false;
  try{ws.send(JSON.stringify(m));NET.stats.out++;return true;}catch(e){return false;}
}
/* open the connection and say hello. The answer arrives in ntMsg: welcome, the world, then ready -> ntEnter.
   retry: the attempt number when ntRetry is calling (a call from the menu starts over) */
function ntConnect(addr,pw,retry){
  if(NET.st==='connecting'||NET.on)return false;
  if(!retry)ntRetryStop();
  const url=ntUrl(addr);
  if(!url){ntStatus('Type the server address first.',true);return false;}
  if(typeof WebSocket!=='function'){ntStatus('This browser cannot open a connection.',true);return false;}
  let ws;
  try{ws=new WebSocket(url);}catch(e){ntStatus('That address does not look right.',true);return false;}
  NET.ws=ws;NET.st='connecting';NET.why='';NET.pend=null;NET.addr=addr;NET.pw=''+(pw||'');
  ntStatus(retry?'Lost the connection. Reconnecting (try '+retry+' of '+NT_RETRIES+') …':'Connecting to '+url.replace(/^wss?:\/\//,'')+' …');
  ws.onopen=()=>{if(NET.ws!==ws)return;ntSend({t:'hello',proto:NT_PROTO,v:GAME_VERSION,name:PNAME,pw:pw||'',rd:RD+3});ntStatus('Connected. Loading the world …');};
  ws.onmessage=ev=>{if(NET.ws!==ws)return;let m;try{m=JSON.parse(ev.data);}catch(e){return;}NET.stats.in++;NET.rxAt=Date.now();
    try{ntMsg(m);}catch(e){if(typeof console!=='undefined')console.error('[net]',e);}};
  ws.onclose=()=>{if(NET.ws===ws)ntDown(NET.why||(NET.st==='connecting'?'Could not reach the server.':'Lost the connection to the server.'));};
  ws.onerror=()=>{};
  try{window.storage.set('vox_mp',JSON.stringify({addr:''+addr})).catch(()=>{});}catch(e){}
  return true;
}
/* the connection is gone (or was refused): back to the title, with the reason. If it was simply lost, try again. */
function ntDown(why){
  const was=NET.on,told=!!NET.why,again=NET.retryN;   /* told: the server gave a reason (a kick, a refusal, a shutdown) */
  NET.ws=null;NET.pend=null;
  if(NET.st==='off')return;
  NET.st='off';
  ntStatus(why,true);
  if(was&&playing){NET.why=why;quitToTitle().then(()=>{showToast(why);if(!told)ntRetry(1);});}
  else{NET.on=false;ntClearPeers();
    if(told)ntRetryStop();else if(again>0)ntRetry(again+1);}
}
/* try to get back in: attempt n of NT_RETRIES, after 1, 2, 4, 8, 8 seconds. Anything the player does about it (Join, Back,
   opening another world) calls it off. */
function ntRetry(n){
  ntRetryStop();
  if(n>NT_RETRIES||!NET.addr||typeof setTimeout!=='function'){ntStatus('Lost the connection to the server.',true);return;}
  NET.retryN=n;
  if(!playing)ntOpenMenu();
  ntStatus('Lost the connection. Reconnecting (try '+n+' of '+NT_RETRIES+') …',true);
  NET.retryH=setTimeout(()=>{
    NET.retryH=0;
    if(NET.retryN!==n)return;
    if(playing||NET.on||NET.st!=='off'){NET.retryN=0;return;}
    ntConnect(NET.addr,NET.pw,n);
  },Math.min(8000,1000*Math.pow(2,n-1)));
}
/* call the reconnecting off */
function ntRetryStop(){
  if(NET.retryH){try{clearTimeout(NET.retryH);}catch(e){}NET.retryH=0;}
  NET.retryN=0;
}
/* leaving on purpose (the tail of quitToTitle): the last save has gone out by now */
function ntLeave(){
  if(!NET.on&&NET.st==='off'&&!NET.ws)return;
  const ws=NET.ws;NET.ws=null;
  NET.on=false;NET.st='off';NET.pend=null;NET.q.length=0;NET.beS.clear();NET.drops.clear();NET.hosted=false;NET.hdims=[];NET.fx.clear();NET.vehs.clear();
  NET.mobs.clear();NET.lockK=null;NET.lockWant=null;NET.saveT=-1;NET.sigS=undefined;NET.crS='';NET.sigT=0;NET.op=false;NET.prot=0;NET.spawn=null;
  ntClearPeers();
  if(ws){try{ws.onclose=null;ws.close();}catch(e){}}
  ntStatus(NET.why||'',!!NET.why);NET.why='';
}

/* ----- messages from the server ----- */
function ntMsg(m){
  if(!m||typeof m.t!=='string')return;
  switch(m.t){
    case 'welcome':
      NET.id=m.id|0;NET.name=''+(m.name||PNAME);NET.server=''+(m.server||'server');NET.pvp=m.pvp!==false;NET.motd=''+(m.motd||'');
      NET.hosted=m.host===true;                             /* the server runs games of its own (n8_host.js), for these dimensions */
      NET.hdims=Array.isArray(m.hdims)?m.hdims.map(String):(NET.hosted?['over']:[]);
      NET.pend={world:m.world||{},player:m.player||null,edits:{},be:{},n:0};
      ntClearPeers();
      for(const p of (m.players||[])){const q=ntPeerAdd(p.id,p.name,p.pose);if(q)q.skin=ntSkinUrl(p.skin);}
      return;
    case 'edits':
      if(!Array.isArray(m.e))return;
      NET.stats.edIn+=m.e.length;
      if(NET.pend){const E=NET.pend.edits;for(const e of m.e)(E[e[0]]||(E[e[0]]={}))[e[1]]=e[2]|0;NET.pend.n+=m.e.length;
        ntStatus('Loading the world … '+NET.pend.n+' blocks');return;}
      if(NET.on)for(const e of m.e)ntApplyEdit(e[0],e[1],e[2]|0,!!m.s,e[3]===1);   /* s: a chunk that came into range, not a live change */
      return;
    case 'pong':
      if(m.n===NET.pingN&&NET.pingAt){NET.ms=Math.max(0,Math.min(9999,Math.round(Date.now()-NET.pingAt)));NET.pingAt=0;}
      return;
    case 'mheir':if(NET.on)ntMobAdopt(m.from|0);return;
    case 'skin':{const p=NET.peers.get(m.id);if(p)p.skin=ntSkinUrl(m.png);return;}   /* another player's skin (or '' for the default) */
    case 'wd':if(NET.on)ntWdIn(m);return;
    case 'mkt':if(NET.on)ntMktIn(m);return;
    case 'fire':if(NET.on&&!NET.host)ntFireIn(m);return;
    case 'ign':if(NET.host&&Array.isArray(m.c))for(const c of m.c)if(Array.isArray(c))igniteAt(c[0]|0,c[1]|0,c[2]|0);return;   /* only the server's game is sent these */
    case 'fx':if(NET.on)ntFxIn(m);return;
    case 'fxgone':if(NET.on)ntFxGone(m);return;
    case 'vehs':if(NET.on)ntVehsIn(m);return;
    case 'vgone':if(NET.on)ntVehsGone(m);return;
    case 'vno':if(NET.on&&!NET.host)ntVehNo(m);return;
    case 'vhit':if(NET.on)ntVehHurt(m);return;
    case 'vgive':case 'vtake':case 'vfree':if(NET.host)ntHostVeh(m);return;   /* only the server's game is sent these */
    case 'hurt':                                          /* a mob the server runs hit this player */
      if(NET.on&&!NET.host&&playing&&P&&!P.dead){LASTDMG={by:m.by?''+m.by:null,how:''+(m.how||'mob')};damagePlayer(+m.dmg||1,+m.kx||0,+m.kz||0);}
      return;
    case 'xp':                                            /* ...or this player picked up XP it dropped */
      if(NET.on&&!NET.host&&playing&&P&&m.n>0){P.xp=(P.xp||0)+(m.n|0);playS('xp');ntSaveSoon();}
      return;
    case 'perm':
      NET.op=!!m.op;NET.prot=+m.prot||0;NET.spawn=m.spawn&&typeof m.spawn.x==='number'&&typeof m.spawn.y==='number'&&typeof m.spawn.z==='number'?m.spawn:null;
      return;
    case 'lock':if(NET.on)ntLockMsg(m);return;
    case 'tp':
      if(NET.on&&playing&&P&&typeof m.x==='number'&&typeof m.y==='number'&&typeof m.z==='number'){
        /* 6.32: another dimension goes the way a portal trip goes (setDim: the ride, the portal timer and the fall are cleared,
           the chunks are thrown away), then the chunks at the far end are built before the next frame. Never Purgatory. */
        if((m.dim==='over'||m.dim==='nether'||m.dim==='aether')&&m.dim!==DIM&&DIM!=='puppet'&&!P.dead){
          if(modalOpen())closeModal();
          setDim(m.dim,m.x,m.y,m.z);forceChunksNear(Math.floor(m.x),Math.floor(m.z));
        }else{P.x=m.x;P.y=m.y;P.z=m.z;P.vx=P.vy=P.vz=0;P.fallD=0;}
      }
      return;
    case 'give':
      if(NET.on&&playing&&P&&m.st&&DEFS[m.st.id]&&m.st.count>0){const st=ntDropStack(m.st);invAddTo(P.inv,st);redrawHotbar();
        if(st.count>0)spawnDrop(P.x,P.y+1,P.z,st,0,2,0);ntSaveSoon();}
      return;
    case 'mode':
      if(NET.on&&P){
        if(m.m==='spectator'){if(!P.spec)specStart();return;}   /* 6.38: this server's world is DingleCore and this player's life is over */
        specStop(m.m);
        P.mode=m.m==='c'?'c':'s';if(P.mode==='s')P.flying=false;redrawHotbar();drawStats();showToast(P.mode==='c'?'Creative mode':'Survival mode');}
      return;
    case 'mobs':if(NET.on)ntMobsIn(m);return;
    case 'mgone':if(NET.on)ntMobsGone(m);return;
    case 'mgive':if(NET.on)ntMobTaken(m);return;
    case 'mhit':if(NET.on)ntMobHurt(m);return;
    case 'boom':if(NET.on)ntBoomIn(m);return;
    case 'bes':                                           /* add: the ones in chunks that came into range, not the whole list */
      if(!m.m||typeof m.m!=='object')return;
      if(NET.pend){if(m.add)Object.assign(NET.pend.be,m.m);else NET.pend.be=m.m;return;}
      if(NET.on&&m.add)for(const k of Object.keys(m.m))ntApplyBE(k,m.m[k]);
      return;
    case 'drops':
      if(!Array.isArray(m.d))return;
      if(NET.pend){if(m.add)NET.pend.drops=(NET.pend.drops||[]).concat(m.d);else NET.pend.drops=m.d;return;}
      if(NET.on&&m.add)for(const d of m.d)ntDropIn(d);
      return;
    case 'drop':
      if(NET.pend){(NET.pend.drops||(NET.pend.drops=[])).push(m);return;}
      if(NET.on)ntDropIn(m);
      return;
    case 'undrop':
      if(NET.pend){if(NET.pend.drops)NET.pend.drops=NET.pend.drops.filter(d=>d.id!==m.id);return;}
      if(NET.on)ntDropGone(m.id);
      return;
    case 'took':if(NET.on)ntDropTook(m.id);return;
    case 'ready':ntEnter();return;
    case 'be':
      if(NET.pend){if(m.v==null)delete NET.pend.be[m.k];else NET.pend.be[m.k]=m.v;return;}
      if(NET.on)ntApplyBE(m.k,m.v);
      return;
    case 'join':ntPeerAdd(m.id,m.name,null);return;
    case 'leave':ntPeerDel(m.id);return;
    case 'pose':{const p=NET.peers.get(m.id);if(p)ntPeerPose(p,m);return;}
    case 'chat':if(NET.on)chatPush(m.w?{k:'whisper',from:ntShown(m.from),to:'Dan',txt:''+m.txt}:{k:'chat',from:ntShown(m.from),txt:''+m.txt});return;
    case 'sys':if(NET.on)sysMsg(''+m.txt);return;
    case 'hit':
      if(NET.on&&playing&&P&&!P.dead&&NET.pvp){damagePlayer(+m.dmg||1,+m.kx||0,+m.kz||0);if(m.crit)critFx(P.x,P.y+1.1,P.z);}
      return;
    case 'crit':
      if(NET.on&&playing&&typeof m.x==='number'&&typeof m.y==='number'&&typeof m.z==='number')critFx(m.x,m.y,m.z);
      return;
    case 'time':
      if(NET.on&&typeof m.v==='number'){let d=m.v-(((timeOfDay%1)+1)%1);if(d>0.5)d-=1;if(d<-0.5)d+=1;
        if(Math.abs(d)>0.003){timeOfDay+=d;NET.tPrev=timeOfDay;}}
      return;
    case 'gr':
      if(NET.on&&m.gr&&typeof m.gr==='object'){Object.assign(GR,m.gr);NET.grS=JSON.stringify(GR);if(typeof grApplyUI==='function')grApplyUI();}
      return;
    case 'kick':NET.why=''+(m.why||'Disconnected by the server.');return;
    default:
  }
}
/* a remote player called Dan must not read as "you" in chat (pnShow maps the engine's 'Dan' to the local name) */
function ntShown(n){n=''+(n||'?');return n==='Dan'?'Dan​':n;}

/* the whole world has arrived: load it exactly like a save, then go */
function ntEnter(){
  const W=NET.pend;NET.pend=null;
  if(!W)return;
  const w=W.world;
  let found=null;
  let pl=W.player&&typeof W.player==='object'&&typeof W.player.x==='number'?W.player:null;
  try{
    /* a new player starts at the world spawn; the first one of all finds it (the server has no terrain) and reports it */
    if(!pl){resetWorld();SEED=w.seed|0;const ws=NET.spawn,sp=ws?[ws.x,ws.y,ws.z]:findSpawn();pl={x:sp[0],y:sp[1],z:sp[2],spawn:sp};if(!ws)found=sp;}
    const d={...w,f:w.f||SAVE_FORMAT,edits:W.edits,be:W.be,player:pl,dim:pl.dim||'over',ents:[]};
    if('mp' in pl){d.mp=pl.mp;d.stash=pl.stash;}else{delete d.mp;delete d.stash;}   /* purgatory progress is per player */
    /* ...and so are the Snail, Malgorath, the old demon and this player's own Creativity works (6.16: they used to be lost on leaving) */
    for(const k of ['snl','mg','demon','cr']){if(pl[k]!=null)d[k]=pl[k];else delete d[k];}
    applySave(d);
  }catch(e){
    if(typeof console!=='undefined')console.error('[net]',e);
    NET.why='The server sent a world this game could not load.';
    const ws=NET.ws;if(ws){try{ws.close();}catch(e2){}}
    return;
  }
  NET.on=true;NET.st='on';NET.q.length=0;NET.acc=0;NET.poseT=0;NET.poseS='';NET.scanT=0;
  NET.grS=JSON.stringify(GR);NET.tPrev=timeOfDay;
  NET.beS.clear();for(const [k,b] of blockEnts)NET.beS.set(k,ntBeSig(b));
  NET.drops.clear();NET.dim=DIM;NET.dseq=0;NET.dropIn=false;
  NET.mobs.clear();NET.mseq=0;NET.mobT=0;NET.ownT=0;NET.lockK=null;NET.lockWant=null;NET.saveT=-1;NET.rdS=RD;NET.dmgRef=LASTDMG;NET.guardT=-9;
  NET.fx.clear();NET.fseq=0;NET.vehs.clear();NET.vseq=0;NET.vehT=0;NET.ignQ.length=0;
  ntWdReset();NET.mktT=0;
  ntRetryStop();NET.pingT=0;NET.pingN=0;NET.pingAt=0;NET.ms=0;NET.rxAt=Date.now();NET.act=false;
  if(found)ntSend({t:'spawn',x:found[0],y:found[1],z:found[2]});
  if(SKINS.url)ntSkinSend();                                /* what this player wears (nothing is sent for the default) */
  for(const d of (W.drops||[]))ntDropKnow(d);   /* they appear as their chunks load (ntDropsScan) */
  WORLD.name='';enterGame();WORLD.name=(w.name||NET.server||'server');   /* never becomes this browser's "last world" */
  sysMsg('Connected to '+NET.server+' as '+NET.name+'. '+(NET.peers.size?NET.peers.size+' other player'+(NET.peers.size===1?'':'s')+' online.':'You are the first one here.'));
  if(NET.motd)sysMsg(NET.motd);
  ntStatus('');
}
