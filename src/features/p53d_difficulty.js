/* ----- difficulty, and DingleCore (6.38) -----
   A world has a difficulty: Easy, Normal (what the game always was, and what every older world loads as), Hard, or
   DingleCore, which is Hard with one life. It is a game rule (GR.difficulty), so it is saved with the world and set where
   rules are set; a DingleCore world is made that way and stays that way (diffSet refuses both directions).
     mobs' damage     Easy: half plus one, never more than Normal. Hard and DingleCore: half as much again. Counted once,
                      by the game of the player who is hit (damagePlayer), for hits a mob made (LASTDMG says who).
     starvation       stops at 10 health on Easy, at 1 on Normal; on Hard and DingleCore it kills.
     local difficulty the debug screen's number uses the real level.
   Dying in a DingleCore world is the end of that life: no respawn, only watching. A spectator flies, passes through
   blocks, touches nothing, is ignored by every mob, and has no hearts or hunger. The world's save remembers it, so the
   world opens again to be looked at and never to be played. Puppet Purgatory keeps its own rules about dying. */
const DIFF_NAMES={easy:'Easy',normal:'Normal',hard:'Hard',dinglecore:'DingleCore'};
const DIFF={seen:null};
function diffKey(){const d=GR.difficulty;return typeof d==='string'&&DIFF_NAMES[d]?d:'normal';}
/* 1 Easy, 2 Normal, 3 Hard and DingleCore */
function diffLevel(){const d=diffKey();return d==='easy'?1:d==='normal'?2:3;}
function diffCore(){return diffKey()==='dinglecore';}
/* a mob's hit of n, as this world's difficulty makes it */
function diffMobDmg(n){const l=diffLevel();return l===1?Math.min(n,n/2+1):l===3?n*1.5:n;}
/* from damagePlayer, before anything else: is this a hit a mob has just made? (LASTDMG is a new object for every hit that
   names its cause; one that was already looked at, or names no mob, is not scaled) */
function diffFresh(){
  const L=LASTDMG;
  if(!L||L===DIFF.seen)return false;
  DIFF.seen=L;
  return L.how==='mob'||(L.how==='arrow'&&L.by==='Skeleton')||(L.how==='tnt'&&L.by==='Boomer');
}
/* the health starvation stops at */
function diffStarveFloor(){return diffLevel()===1?10:diffLevel()===2?1:0;}
/* change the difficulty of the world being played: never to or from DingleCore */
function diffSet(v){
  if(diffCore()||v==='dinglecore'||!DIFF_NAMES[v])return false;
  GR.difficulty=v;
  return true;
}
/* ----- spectating ----- */
/* this life is over: watch. Also how a save of a dead DingleCore world, or a server that says so, starts the game */
function specStart(quiet){
  if(!P)return false;
  P.spec=true;P.dead=false;P.mode='c';P.flying=true;P.hp=20;P.hunger=20;P.air=10;P.vx=P.vy=P.vz=0;P.fallD=0;P.ride=null;P.hurtT=0;
  MINE.active=false;MINE.prog=0;
  if(modalOpen())closeModal(true);
  const dm=$('death');if(dm&&dm.style)dm.style.display='none';
  redrawHotbar();drawStats();
  if(!quiet)showToast('You are a spectator now. Look, do not touch.');
  return true;
}
/* back among the living (a server operator's /gamemode) */
function specStop(mode){
  if(!P||!P.spec)return false;
  P.spec=false;P.mode=mode==='c'?'c':'s';P.flying=P.mode==='c';P.hp=20;P.hunger=20;
  redrawHotbar();drawStats();
  return true;
}
/* once a frame for a spectator (from updatePlayer): the flags that make one stay set whatever a key tried to change */
function specTick(){
  if(!P.spec)return false;
  P.mode='c';P.flying=true;P.dead=false;P.sneak=false;
  return true;
}
/* the death screen's buttons for this world: a DingleCore death offers watching, not living */
function diffDeathUI(){
  const core=diffCore()&&DIM!=='puppet';
  const r=$('d_respawn'),s=$('d_spec'),t=$('d_title');
  if(r&&r.style)r.style.display=core?'none':'';
  if(s&&s.style)s.style.display=core?'':'none';
  if(t)t.textContent=core?'Back to title':'Save & Quit to Title';
  return core;
}
