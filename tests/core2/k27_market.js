/* k27_market.js (v6.64, lane CORE2, gate x1): the stock market goes a little up.
   1 every step carries the trend: +2% a game day (DAY_LEN), and the swings are a tenth of what they were
   2 money spread over all eight stocks ends a game day up most of the time (about 85 in 100), typically +1-3%
   3 one stock alone still moves both ways in a day (it can lose), so picking still matters
   4 over a week the market as a whole has grown, about 2% a day
   5 a trend kept in a save from before 6.64 is brought into the new range by the first step
   The game's own updateStocks drives it, seeded (mulberry32), many independent days. */
'use strict';
const boot=require('../lib/c_boot.js'),{ok}=boot;
const V=boot({seed:64});
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

boot.run(async()=>{
  ok('the seams are on __vox',typeof V.updateStocks==='function'&&typeof V.initMarket==='function'&&!!V.MKT&&Array.isArray(V.STOX)&&V.STOX.length===8);
  const M=V.MKT,day=V.DAY_LEN;
  ok('the trend is +2% a game day ('+day+' s, two steps a second)',Math.abs(Math.exp(V.MKT_TREND*day*2)-1.02)<1e-9);
  Math.random=rng(64);
  const days=400,port=[],one=[];
  for(let d=0;d<days;d++){V.initMarket();const p0={...M.p};V.updateStocks(day);
    port.push(V.STOX.reduce((a,s)=>a+M.p[s]/p0[s],0)/8);one.push(M.p[V.STOX[d%8]]/p0[V.STOX[d%8]]);}
  const up=port.filter(v=>v>1).length/days,sorted=[...port].sort((a,b)=>a-b),med=sorted[days>>1]-1,o=[...one].sort((a,b)=>a-b);
  ok('all eight together end a game day up '+Math.round(up*100)+' times in 100 (want 75 or more)',up>=0.75);
  ok('...typically by '+(med*100).toFixed(1)+'% (want 1% to 3.5%)',med>=0.01&&med<=0.035);
  ok('one stock alone still moves both ways ('+((o[Math.floor(days*0.1)]-1)*100).toFixed(0)+'% to +'+((o[Math.floor(days*0.9)]-1)*100).toFixed(0)+'% for the middle 80 of 100 days)',o[Math.floor(days*0.1)]<0.99&&o[Math.floor(days*0.9)]>1.04&&o[Math.floor(days*0.1)]>0.8&&o[Math.floor(days*0.9)]<1.25);
  {V.initMarket();const p0={...M.p};for(let d=0;d<7;d++)V.updateStocks(day);
    const g=V.STOX.reduce((a,s)=>a+M.p[s]/p0[s],0)/8,perDay=Math.pow(g,1/7)-1;
    ok('a week: the market as a whole grew '+((g-1)*100).toFixed(1)+'% ('+(perDay*100).toFixed(1)+'% a day)',g>1.05&&perDay>0.005&&perDay<0.04);}
  {V.initMarket();for(const s of V.STOX)M.mu[s]=0.0009;M.acc=0;V.updateStocks(0.5);
    ok('a trend from an older save (0.0009 a step) is brought into the new range at the first step',V.STOX.every(s=>Math.abs(M.mu[s])<=V.MKT_MU+1e-15));}
});
