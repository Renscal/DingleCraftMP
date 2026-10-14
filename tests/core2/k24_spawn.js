/* k24_spawn.js (v6.54, lane CORE2, gate x1): a new world starts with your feet on the ground (findSpawn,
   src/core/p07f_world_lifecycle.js). Caves and ravines are cut after the land is shaped, so the planned height can be
   over a hole: seed 653 dropped the player 15 blocks at the very start. Across 40 seeds (653 among them) the player
   starts on a dry, solid block above the sea, within a block of it, and has lost no health a few seconds later (a world
   that is all sea near the start begins over the water, as before, and is only checked for being unhurt). */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({});
const step=boot.stepper(700000);

boot.run(async()=>{
  const B=V.B,bad=[];let n=0,ocean=0;
  const seeds=['653',...Array.from({length:39},(_,i)=>String(1000+i*37))];
  for(const sd of seeds){
    V.startNewWorld('k24',sd,'s');V.GR.mobSpawn=false;V.GR.snail=false;V.GR.jsc=0;
    const P=V.P,x=Math.floor(P.x),z=Math.floor(P.z),y0=P.y,t=V.surfaceTop(x,z),top=V.getBlock(x,t,z);
    step(90);
    const hp=V.P.hp,drop=y0-V.P.y;n++;
    /* a world with no land near the start (all sea for 350 blocks) begins over the water, as it always has: unhurt is all that is asked */
    if(P.x===0.5&&P.z===0.5&&V.colInfo(0,0).h<31){ocean++;if(hp!==20)bad.push(sd+' (ocean start, hp '+hp+')');continue;}
    if(!(t>=30&&V.DEFS[top].solid!==false&&top!==B.WATER&&top!==B.LAVA&&y0-t<2.2&&hp===20&&drop<1.5))bad.push(sd+' (top '+t+' id '+top+', start '+y0.toFixed(1)+', fell '+drop.toFixed(1)+', hp '+hp+')');
  }
  ok('40 new worlds (seed 653 among them): the player starts on dry, solid ground above the sea and is unhurt ('+ocean+' are all sea near the start: unhurt in the water)'+(bad.length?' (wrong: '+bad.slice(0,4).join('; ')+')':''),n===40&&bad.length===0);
});
