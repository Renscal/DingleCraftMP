/* ----- poison (6.40) -----
   Effects: the player can be under an effect for a time (P.fx, saved with the player). There is one so far, poison:
   one damage every 1.25 seconds while it lasts, never taking the last half heart, hearts gone a sick green meanwhile.
   Nothing cures it but time. A poisoned mob loses health the same way.
   Where it comes from:
     Hemlock Root        eat one and you are poisoned.
     Jar of Poison       a root and a Glass Bottle. In the crafting grid with a sword, it coats the blade for PSN.hits
                         hits (st.pz, shown with the weapon's name); in the grid with a food, it makes one poisoned
                         piece of that food.
     poisoned food       looks, stacks and is named exactly like the real thing. A stack remembers only HOW MANY of its
                         pieces are poisoned (st.psn), and that number is never shown anywhere. Eat from the stack and
                         the chance of getting a poisoned piece is psn / count; whenever some pieces leave a stack
                         (a split, a throw, a drag, a shift-click) each poisoned piece goes one way or the other by
                         chance (psnDraw). Every place that moves part of a stack calls psnSplit or psnMoved.
   Ids: items 377 Glass Bottle, 378 Jar of Poison. */
IT.BOTTLE=377;IT.POISON=378;
const PSN={hits:10,eatT:12,hitT:6,rootT:12,every:1.25,rnd:null};
idef(IT.BOTTLE,{name:'Glass Bottle',icon:'i_bottle'});
idef(IT.POISON,{name:'Jar of Poison',icon:'i_poison',stack:16});
DEFS[IT.HROOT].food=1;DEFS[IT.HROOT].fxEat='poison';
/* the two pictures and the two recipes, registered at boot with farming's (farmTiles) */
function psnTiles(){
  const jar=(name,fill,top)=>tile(name,c=>{c.clearRect(0,0,16,16);
    c.fillStyle='#cfe6f2';c.fillRect(6,2,4,3);c.fillRect(4,5,8,9);c.fillStyle='#8fb4c6';c.fillRect(4,13,8,1);c.fillRect(11,5,1,9);c.fillRect(6,4,4,1);
    c.fillStyle='#b98a4a';c.fillRect(6,1,4,1);
    if(fill){c.fillStyle=fill;c.fillRect(5,8,6,5);c.fillStyle=top;c.fillRect(5,8,6,1);c.fillStyle='#e9f6c8';c.fillRect(6,10,1,1);c.fillRect(9,11,1,1);}
    else{c.clearRect(5,6,6,7);c.fillStyle='#eaf6fb';c.fillRect(5,6,1,6);}});
  jar('i_bottle',null,null);jar('i_poison','#6a9a2a','#9bbf2a');
  R(['G G',' G '],{G:B.GLASS},IT.BOTTLE,3);
  RS([IT.HROOT,IT.BOTTLE],IT.POISON,1);
}
/* ---- chance ---- */
function psnRnd(){return PSN.rnd?PSN.rnd():Math.random();}
/* of c pieces, p are poisoned; n of them are taken at random: how many of the taken ones are poisoned? */
function psnDraw(c,p,n){
  c=c|0;p=Math.max(0,Math.min(p|0,c));n=Math.max(0,Math.min(n|0,c));
  let k=0;
  for(let i=0;i<n&&p>0;i++){if(psnRnd()<p/c){k++;p--;}c--;}
  return k;
}
function psnAdd(st,k){if(!st||!k)return;const v=(st.psn|0)+k;if(v>0)st.psn=v;else delete st.psn;}
/* n pieces are about to leave `from` (its count is still the full one) for the new stack `to`: some poisoned go along */
function psnSplit(from,to,n){
  if(!from||!to||!(from.psn>0))return 0;
  const k=psnDraw(from.count,from.psn,n);
  psnAdd(from,-k);psnAdd(to,k);
  return k;
}
/* mv pieces HAVE moved from `from` to `to` (both counts already changed): the same, after the fact */
function psnMoved(from,to,mv){
  if(!from||!to||!(from.psn>0)||!(mv>0))return 0;
  const k=psnDraw(from.count+mv,from.psn,mv);
  psnAdd(from,-k);psnAdd(to,k);
  return k;
}
/* ---- the effect ---- */
function fxPoison(t){
  if(!P||P.dead||P.spec||GR.god||P.mode==='c')return false;
  if(!P.fx)P.fx={};
  const had=P.fx.poison;
  P.fx.poison={t:Math.max(had?had.t:0,t),acc:had?had.acc:0};
  drawStats();
  return true;
}
/* once a frame (from updatePlayer): the player's effects, and the poisoned mobs */
function fxTick(dt){
  const f=P.fx&&P.fx.poison;
  if(f){
    f.t-=dt;f.acc=(f.acc||0)+dt;
    if(P.dead||P.spec||P.mode==='c'){delete P.fx.poison;drawStats();}
    else{
      while(f.acc>=PSN.every){f.acc-=PSN.every;if(P.hp>1){P.hp=Math.max(1,P.hp-1);hurtFlash=0.25;playS('hurt');drawStats();}}
      if(f.t<=0){delete P.fx.poison;drawStats();}
    }
  }
  /* a poisoned mob is ticked by the game of the player who poisoned it: on a server each tick is an ordinary hit, passed
     on to whichever game runs that mob (hurtMob) */
  for(const e of entities){
    if(!(e.psnT>0)||e.dead||!e.mob)continue;
    e.psnT-=dt;e.psnA=(e.psnA||0)+dt;
    while(e.psnA>=PSN.every){e.psnA-=PSN.every;if(e.hp>1){HIT_BY=e.psnBy||null;HIT_HOW='poison';try{hurtMob(e,Math.min(1,e.hp-1),0,0);}finally{HIT_BY=null;HIT_HOW=null;}}}
  }
}
function fxPoisoned(){return !!(P&&P.fx&&P.fx.poison);}
/* a bite was taken from this stack (its count is still the full one): was it a poisoned piece? Hemlock always is */
function psnBite(st,d){
  if(d.fxEat==='poison'){fxPoison(PSN.rootT);return true;}
  if(!(st.psn>0))return false;
  const k=psnDraw(st.count,st.psn,1);
  if(!k)return false;
  psnAdd(st,-1);fxPoison(PSN.eatT);
  return true;
}
/* a melee hit with this weapon: a coated blade poisons what it hits and loses one of its hits. Returns true if it did */
function psnHit(st,e){
  if(!st||!(st.pz>0))return false;
  st.pz--;if(st.pz<=0)delete st.pz;
  if(e){e.psnT=Math.max(e.psnT||0,PSN.hitT);e.psnBy='Dan';}
  return true;
}
/* the crafting grid: a Jar of Poison and one other thing. A sword comes out coated (wear and enchantments kept), a food
   comes out as one poisoned piece of itself. null for anything else (the ordinary recipes are looked at next). */
function psnCraft(grid){
  let jar=0,other=null,n=0;
  for(const s of grid){if(!s)continue;n++;if(s.id===IT.POISON)jar++;else other=s;}
  if(n!==2||jar!==1||!other)return null;
  const d=DEFS[other.id];
  if(d&&d.tool&&d.tool.type==='sword')return {id:other.id,count:1,...(other.dur!=null?{dur:other.dur}:{dur:d.tool.dur}),...(other.ench?{ench:{...other.ench}}:{}),pz:PSN.hits};
  if(d&&d.food&&!d.fxEat)return {id:other.id,count:1,psn:1};
  return null;
}
/* a weapon's name with its coat, for the name shown when it is picked */
function psnName(st){return st&&st.pz>0?'  ☠ poisoned ('+st.pz+')':'';}
