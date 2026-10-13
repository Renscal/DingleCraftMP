/* ---- PART 58: n4_self.js ---- */
/* What this player sends about themselves, and ntFrame: the one place multiplayer runs every frame. ntFrame is called
   from frame() (core/p07h_boot_loop.js) outside the pause gate, because the world goes on while one player has a menu
   open. Its timers run on NET.acc (summed frame time), never on the wall clock, so the suites can step it by hand. */

/* ----- this player: save, pose, chat, death ----- */
function ntSave(quiet){
  const s=snapshot('');
  const ok=ntSend({t:'save',player:{...s.player,dim:s.dim,mp:s.mp,stash:s.stash}});
  if(!quiet)showToast(ok?'Saved to the server':'Not connected');
  return ok;
}
/* ask for a save about a second from now (several askings make one save): after anything that moved an item between the
   inventory and the world, so the server never remembers an inventory that still holds what now lies on the ground */
function ntSaveSoon(){if(NET.saveT<0)NET.saveT=NET.acc+1;}
/* this player as others need to see them. fl bits: 1 swinging, 2 sneaking, 4 dead, 8 riding, 16 creative, 32 paused (this
   game is not running the world right now, so it must not be anyone's simulation owner) */
function ntPoseNow(){
  const st=heldStack();
  return {t:'pose',x:+P.x.toFixed(2),y:+P.y.toFixed(2),z:+P.z.toFixed(2),yaw:+P.yaw.toFixed(3),pitch:+P.pitch.toFixed(3),
    dim:DIM,held:st?st.id:0,hp:Math.round(P.hp),fl:(P.swing>0.3?1:0)|(P.sneak?2:0)|(P.dead?4:0)|(P.ride?8:0)|(P.mode==='c'?16:0)|(paused?32:0)};
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
  if(NET.dim!==DIM)ntDropsScan();   /* a dimension change: before anything else looks at the drops */
  if(P.hurtT<=0)NET.dmgRef=LASTDMG;
  ntLockTick();
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
    const g=JSON.stringify(GR);
    if(g!==NET.grS){NET.grS=g;const o={...GR};delete o.bots;ntSend({t:'gr',gr:o});}
    if(RD!==NET.rdS){NET.rdS=RD;ntSend({t:'rd',v:RD+3});}
  }
  /* a jump in the clock that the server did not send (a bed, the debug menu) is this player's doing: tell everyone */
  if(Math.abs(timeOfDay-NET.tPrev)>0.01)ntSend({t:'time',v:((timeOfDay%1)+1)%1});
  NET.tPrev=timeOfDay;
  ntMobsTick(dt);
  ntPeersTick(dt);
}
