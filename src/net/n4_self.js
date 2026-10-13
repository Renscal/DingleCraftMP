/* ---- PART 58: n4_self.js ---- */
/* What this player sends about themselves, and ntFrame: the one place multiplayer runs every frame. ntFrame is called
   from frame() (core/p07h_boot_loop.js) outside the pause gate, because the world goes on while one player has a menu
   open. Its timers run on NET.acc (summed frame time), never on the wall clock, so the suites can step it by hand. */

/* ----- this player: save, pose, chat, death ----- */
function ntSave(quiet){
  const s=snapshot('',true);         /* the server keeps the blocks, chests and entities itself */
  const pl={...s.player,dim:s.dim,mp:s.mp,stash:s.stash,snl:s.snl,mg:s.mg,demon:s.demon};   /* the last three, and cr: this player's own, see na_data.js */
  /* the Creativity works can be most of a megabyte: sent when they change, and the server keeps the last ones it was sent */
  const crS=s.cr===undefined?'':JSON.stringify(s.cr);
  if(crS!==NET.crS)pl.cr=s.cr;
  const ok=ntSend({t:'save',player:pl});
  if(ok){NET.crS=crS;NET.sigS=ntSaveSig();NET.posS=ntSavePos();NET.posT=NET.acc;}
  if(!quiet)showToast(ok?'Saved to the server':'Not connected');
  return ok;
}
/* ----- the server always has the player as they are now (6.34) -----
   Twice a second what the save holds about this player (not where they stand) is put side by side with what was last
   sent; a difference asks for a save half a second on, so a change reaches the server within a second and a burst of
   changes is one save. Where they stand goes with any save, and by itself every ten seconds while they move. The last
   word is sent as the page goes away (ntBye) and by Disconnect (quitToTitle saves before it leaves). */
function ntSaveSig(){
  const st=s=>s?[s.id,s.count,s.dur,s.ench,s.mob,s.psn]:0;
  return JSON.stringify([Math.round(P.hp),Math.round(P.hunger),P.sel,Math.round(P.xp||0),P.mode,P.dead?1:0,DIM,P.spawn,P.inv.map(st),(P.armor||[]).map(st),
    Math.round(P.db||0),(P.own||[]).length,P.stox?+P.stox.bal.toFixed(2):0,P.bp?1:0,P.bpLvl|0,P.cos,P.fx||0]);
}
/* where they stand, to the block */
function ntSavePos(){return Math.round(P.x)+','+Math.round(P.y)+','+Math.round(P.z);}
/* twice a second (from ntFrame): has anything changed since the last save? */
function ntSaveWatch(){
  if(NET.acc-(NET.sigT||0)<0.5)return;
  NET.sigT=NET.acc;
  if(NET.sigS===undefined){NET.sigS=ntSaveSig();NET.posS=ntSavePos();NET.posT=NET.acc;return;}   /* the first look: this is what the server handed us */
  const due=NET.acc+0.5;
  if(ntSaveSig()!==NET.sigS||(NET.acc-NET.posT>=10&&ntSavePos()!==NET.posS)){if(NET.saveT<0||NET.saveT>due)NET.saveT=due;}
}
/* the page is going away: one last save */
function ntBye(){if(NET.on&&playing&&P)try{ntSave(true);}catch(e){}}
/* ask for a save about a second from now (several askings make one save): after anything that moved an item between the
   inventory and the world, so the server never remembers an inventory that still holds what now lies on the ground */
function ntSaveSoon(){if(NET.saveT<0)NET.saveT=NET.acc+1;}
/* this player as others need to see them. fl bits: 1 swinging, 2 sneaking, 4 dead, 8 riding, 16 creative, 32 paused (this
   game is not running the world right now, so it must not be anyone's simulation owner).
   ar: the four armour slots as item ids (only when something is worn). rv ry rh: the kind of vehicle being ridden, which
   way it points and how far below the player it sits (only on a vehicle). */
function ntPoseNow(){
  const st=heldStack(),r=P.ride;
  const m={t:'pose',x:+P.x.toFixed(2),y:+P.y.toFixed(2),z:+P.z.toFixed(2),yaw:+P.yaw.toFixed(3),pitch:+P.pitch.toFixed(3),
    dim:DIM,held:st?st.id:0,hp:Math.round(P.hp),fl:(P.swing>0.3?1:0)|(P.sneak?2:0)|(P.dead||P.spec?4:0)|(P.ride?8:0)|(P.mode==='c'?16:0)|(paused?32:0)};
  if(P.armor&&P.armor.some(a=>a))m.ar=P.armor.slice(0,4).map(a=>a?a.id:0);
  if(r&&NT_RIDES[r.t]===1){m.rv=r.t;m.ry=+(r.yaw||0).toFixed(2);m.rh=+(P.y-r.y).toFixed(2);}
  return m;
}
/* the heartbeat, every 2 seconds: the server answers each ping at once, which times the round trip (shown in the Tab list)
   and proves the line is alive. Nothing at all from the server for 12 seconds (it sends the time every 5) means the line is
   dead even if the browser has not noticed: close it, and ntDown takes it from there (and tries to reconnect). */
function ntPing(){
  if(NET.acc-NET.pingT>=2){NET.pingT=NET.acc;NET.pingAt=Date.now();ntSend({t:'ping',n:++NET.pingN,ms:NET.ms});}
  if(NET.rxAt&&Date.now()-NET.rxAt>12000){
    const ws=NET.ws;NET.rxAt=0;
    if(ws){try{ws.close();}catch(e){}if(NET.ws===ws&&typeof ws.onclose==='function')ws.onclose();}
  }
}
/* the chatSubmit hook: a normal chat line goes to everyone */
function ntChat(txt){ntSend({t:'chat',txt});}
/* the other chatSubmit hook: on a server every slash command is the server's (/help lists them) */
function ntCmd(txt){ntSend({t:'cmd',txt});}
/* the die hook: tell the server the cause (if this hurt set one), and the server words the announcement */
function ntDied(){
  const fresh=LASTDMG!==NET.dmgRef&&LASTDMG;
  ntSend({t:'death',how:fresh?''+(fresh.how||''):'',by:fresh&&fresh.by?''+fresh.by:''});
  NET.dmgRef=LASTDMG;
}
/* the doSleep hook: a bed is a vote. The server skips the night once enough players are in bed. true = handled here */
function ntSleep(){
  ntSend({t:'sleep'});
  showToast('Respawn point set. The night is skipped when enough players are in bed.');
  playS('sleep');
  return true;
}
/* once a frame while playing (paused or not: the world goes on without you) */
function ntFrame(dt){
  if(!NET.on||!P)return;
  NET.acc+=dt;
  NET.act=false;                     /* a hand that changed nothing this frame marks nothing */
  ntPing();
  if(!NET.on)return;                 /* the line was dead: ntDown has taken the game back to the title */
  /* a dimension change: before anything else looks at the drops, and the server hears of it before any message meant for
     the game that runs the new dimension */
  if(NET.dim!==DIM){ntEntsDim();ntDropsScan();NET.poseS='';NET.poseT=NET.acc;ntSend(ntPoseNow());}
  if(P.hurtT<=0)NET.dmgRef=LASTDMG;
  ntLockTick();
  if(!NET.bye){NET.bye=true;if(typeof addEventListener==='function'){addEventListener('pagehide',ntBye);addEventListener('beforeunload',ntBye);}}
  ntSaveWatch();
  if(NET.saveT>=0&&NET.acc>=NET.saveT){NET.saveT=-1;ntSave(true);}
  if(NET.acc-NET.poseT>=0.066){
    const m=ntPoseNow(),s=JSON.stringify(m);
    if(s!==NET.poseS||NET.acc-NET.poseT>=1){NET.poseS=s;NET.poseT=NET.acc;ntSend(m);}
    ntFlush();
  }else if(NET.q.length>=4000)ntFlush();
  if(NET.acc-NET.scanT>=1){
    NET.scanT=NET.acc;
    ntBeScan();
    ntDropsScan();
    ntWdTick();
    const g=JSON.stringify(GR);
    if(g!==NET.grS){NET.grS=g;ntSend({t:'gr',gr:{...GR}});}
    if(RD!==NET.rdS){NET.rdS=RD;ntSend({t:'rd',v:RD+3});}
  }
  /* a jump in the clock that the server did not send (a bed, the debug menu) is this player's doing: tell everyone */
  if(Math.abs(timeOfDay-NET.tPrev)>0.01)ntSend({t:'time',v:((timeOfDay%1)+1)%1});
  NET.tPrev=timeOfDay;
  if(!NET.host){ntMobsTick(dt);ntFxTick();ntVehTick();}
  ntPeersTick(dt);
}
