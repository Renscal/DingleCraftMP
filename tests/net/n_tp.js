/* n_tp.js (v6.32, lane NET, gate x1): a teleport that crosses dimensions, in the game (src/net/n1_link.js, case 'tp').
   Offline: the game is told it is on a server and handed the message a server sends. The server's side is in n_rules.js.
   1 a tp with the dimension Dan is in moves him and nothing else
   2 a tp with another dimension switches the dimension, puts him at the place, builds the ground there, and he takes no
     fall damage however he was falling; the ride and the portal timer are cleared
   3 and back again
   4 Puppet Purgatory is never entered this way, a made-up dimension is ignored, and an old server's tp (no dim) still works */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:32});
const step=boot.stepper(600000);

boot.run(async()=>{
  const NET=V.NET;
  boot.studio(V,step,{});V.GR.god=true;   /* god mode: the far end may be inside rock or lava, and only the fall is being tested */
  const P=()=>V.P;
  const tp=m=>{NET.on=true;try{V.ntMsg(Object.assign({t:'tp'},m));}finally{NET.on=false;}};
  const hx=Math.floor(P().x),hz=Math.floor(P().z),hy=P().y;

  tp({x:hx+3.5,y:hy,z:hz+0.5,dim:'over'});
  ok('the same dimension: moved, still the Overworld',V.getDim()==='over'&&P().x===hx+3.5&&P().z===hz+0.5);

  P().vy=-30;P().fallD=40;P().portalT=1.5;P().hp=20;
  tp({x:300.5,y:40,z:300.5,dim:'nether'});
  const made=!!V.chunkAt(300,300),at=[P().x,P().y,P().z].join(),fall=[P().vy,P().fallD,P().portalT].join();
  step(40);
  ok('another dimension: the Nether, at the place ('+at+'), the ground there already built, the fall forgotten, no damage ('+P().hp+')',
    V.getDim()==='nether'&&at==='300.5,40,300.5'&&made&&fall==='0,0,0'&&P().hp===20&&!P().ride&&!P().dead);
  ok('  ... and the portal timer was cleared, so he is not sent straight back',V.getDim()==='nether');

  tp({x:hx+0.5,y:hy,z:hz+0.5,dim:'over'});step(30);
  ok('and back: the Overworld, at the place, the blocks he left still there',V.getDim()==='over'&&Math.abs(P().x-(hx+0.5))<0.5&&V.getBlock(hx,Math.floor(hy)-1,hz)===V.B.STONE&&P().hp===20);

  tp({x:5.5,y:40,z:5.5,dim:'puppet'});const d1=V.getDim(),x1=P().x;
  tp({x:hx+1.5,y:hy,z:hz+0.5,dim:'moon'});const d2=V.getDim(),x2=P().x;
  tp({x:hx+2.5,y:hy,z:hz+0.5});
  ok('Purgatory is never entered by teleport (he is moved where he is), a made-up dimension likewise, and a tp without a dimension still works',
    d1==='over'&&x1===5.5&&d2==='over'&&x2===hx+1.5&&V.getDim()==='over'&&P().x===hx+2.5);
});
