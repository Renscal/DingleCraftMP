/* ---- PART 58: n6_menu.js ---- */
/* The Multiplayer view of the title menu (#tmp in html/dom/title.html; the title's own code knows it as view 'mp' through
   tmEls in ui/p07g_title.js). The buttons are wired once, at load, by the block at the bottom, like every other panel. */

/* ----- the Multiplayer screen on the title ----- */
/* the address of the server that served this page. A page on plain http port 80 has no port in location.host, and a bare
   host would get the game's default port (ntUrl), so the 80 is spelled out; https needs nothing (wss, port 443). */
function ntHostHere(l){return l.host+(l.protocol==='http:'&&!l.port?':80':'');}
/* show the Multiplayer screen and prefill the address: this page's own server, else the last one used */
function ntOpenMenu(){
  if(typeof tmShow!=='function')return;
  tmShow('mp');
  const a=$('t_mp_addr');
  if(a&&!a.value){
    a.value=typeof location!=='undefined'&&/^https?:$/.test(location.protocol)&&location.host?ntHostHere(location):(NET.addr||'');
    if(!a.value){try{window.storage.get('vox_mp').then(r=>{if(r&&r.value&&!a.value){const o=JSON.parse(r.value);if(o&&o.addr)a.value=''+o.addr;}}).catch(()=>{});}catch(e){}}
  }
  const n=$('t_mp_name');if(n)n.textContent='You will join as '+PNAME+' (change your name in Settings). A server with accounts asks for your username and password instead.';
  ntLoginHide();
  ntStatus(NET.msg||'',true);
  try{if(a&&a.focus)a.focus();}catch(e){}
}
/* the Join Server button (and Enter in any field): join, or, while the server is asking, log in */
function ntMenuGo(){
  if(NET.loginWait&&NET.st==='connecting'){ntLoginGo();return;}
  const a=$('t_mp_addr'),addr=a?a.value:'';
  ntMplGet().then(L=>{const c=L[ntMplKey(addr)];ntConnect(addr,c&&c.u?{u:''+c.u,p:c.p?''+c.p:'',keep:!!c.p}:null);});
}

/* ----- accounts (6.49) -----
   A server with accounts answers hello with login: the Multiplayer screen grows a username and a password box (and
   "Remember the password"), and Join Server becomes Log in. The username is remembered for each server address; the
   password only if asked, in this browser's storage ('vox_mpl'). Settings gets a box for the account while online. */
/* the logins this browser remembers are kept by server address, in lower case */
function ntMplKey(addr){return (''+(addr||'')).trim().toLowerCase();}
/* every remembered login: {address: {u, p?}} (a promise; {} if there are none or storage refuses) */
function ntMplGet(){
  try{const p=window.storage.get('vox_mpl');if(p&&p.then)return p.then(r=>{try{const o=r&&r.value?JSON.parse(r.value):{};return o&&typeof o==='object'?o:{};}catch(e){return {};}}).catch(()=>({}));}catch(e){}
  return Promise.resolve({});
}
/* remember a login for a server (v null: forget it) */
function ntMplSet(addr,v){
  ntMplGet().then(L=>{const k=ntMplKey(addr);if(v)L[k]=v;else delete L[k];try{const p=window.storage.set('vox_mpl',JSON.stringify(L));if(p&&p.catch)p.catch(()=>{});}catch(e){}});
}
/* the server asks who this is (m.why: what was wrong with the last try) */
function ntLoginShow(m){
  NET.loginWait=true;
  const box=$('t_mp_login');if(box)box.hidden=false;
  const u=$('t_mp_user'),p=$('t_mp_pass'),k=$('t_mp_keep'),go=$('t_mp_go');
  if(u&&!u.value)u.value=(NET.cred&&NET.cred.u)||m.user||PNAME||'';   /* 6.54: the name this game goes by, if nothing better is known */
  if(NET.cred&&NET.cred.p&&m.why){ntMplSet(NET.addr,{u:NET.cred.u});NET.cred.p='';}   /* a remembered password that no longer works is forgotten */
  if(p)p.value='';
  if(k&&NET.cred)k.checked=!!NET.cred.keep;
  if(go)go.textContent='Log in';
  ntStatus(m.why?''+m.why:(m.accounts?'This server has accounts: log in with the username and password its owner gave you.':'That name has an account here: log in with its password.'),!!m.why);
  try{const f=u&&!u.value?u:p;if(f&&f.focus)f.focus();}catch(e){}
}
/* Log in: send what was typed (the password is kept in memory for reconnecting, and remembered only if asked) */
function ntLoginGo(){
  const u=$('t_mp_user'),p=$('t_mp_pass'),k=$('t_mp_keep');
  const cred={u:u?(''+u.value).trim():'',p:p?''+p.value:'',keep:!!(k&&k.checked)};
  if(!cred.u||!cred.p){ntStatus('Type your username and password.',true);return;}
  NET.cred=cred;
  ntSend({t:'login',user:cred.u,pass:cred.p});
  ntStatus('Logging in …');
}
/* the login box away, and Join Server back */
function ntLoginHide(){
  NET.loginWait=false;
  const box=$('t_mp_login');if(box)box.hidden=true;
  const go=$('t_mp_go');if(go)go.textContent='Join Server';
}
/* in: remember the login for next time (the password only if asked) */
function ntLoginDone(){
  const c=NET.cred;
  if(c&&c.u&&NET.addr)ntMplSet(NET.addr,c.keep&&c.p?{u:c.u,p:c.p}:{u:c.u});
  ntLoginHide();
}
/* this player's own skin, as the server has it: shown here, never sent back and never kept in this browser */
function ntSkinOwn(png){
  const S=skinOwn(),url=ntSkinUrl(png);
  S.url=url;NET.skinOwn=true;
  skinLoadInto(S.cv,S.tex,url,null,()=>{skinPreview();});
}
/* someone has a new name (this player, after a change in Settings or by an operator) */
function ntRenamed(id,name){
  if(!name)return;
  if(id===NET.id){NET.name=name;if(NET.cred)NET.cred.u=name;sysMsg('You are now called '+name+'.');ntAcctSync();return;}
  const q=NET.peers.get(id);if(!q)return;
  const was=q.name,skin=q.skin;
  ntPeerDel(id);const n=ntPeerAdd(id,name,q.has?{...q}:null);if(n)n.skin=skin;   /* a new body, for the new name tag */
  sysMsg(was+' is now called '+name+'.');
}
/* the server answers a change (ok, why) or tells this player their locks changed */
function ntAcctIn(m){
  if(NET.acct&&m.locks&&typeof m.locks==='object'){NET.acct.locks=m.locks;ntAcctSync();}
  if(typeof m.why==='string'&&m.why){const s=$('s_acmsg');if(s)s.textContent=m.why;showToast(m.why);}
  if(m.ok&&NET.cred&&NET.acctPass){NET.cred.p=NET.acctPass;if(NET.cred.keep)ntMplSet(NET.addr,{u:NET.cred.u,p:NET.cred.p});}
  NET.acctPass='';
}
/* the account box in Settings: shown online on a server where this player has an account, its locks greyed out */
function ntAcctSync(){
  const box=$('s_acct');if(!box)return;
  const A=NET.on&&NET.acct&&NET.acct.account?NET.acct:null;
  box.hidden=!A;
  const L=(A&&A.locks)||{},dis=(id,v)=>{const e=$(id);if(e)e.disabled=!!v;};
  const nm=$('s_acname');if(nm&&document.activeElement!==nm)nm.value=NET.name||'';
  dis('s_acname',L.name);dis('s_acname_go',L.name);dis('s_acold',L.password);dis('s_acnew',L.password);dis('s_acpw_go',L.password);
  const sk=NET.on&&NET.acct&&NET.acct.locks&&NET.acct.locks.skin;dis('s_skin',sk);dis('s_skinreset',sk);
  const ln=$('s_aclock');if(ln){const on=['name','password','skin'].filter(k=>L[k]);ln.textContent=on.length?'Locked by the server: your '+on.join(', ')+'.':'';}
}
/* The game a server hands out is that server's game: Create New World, Load World and Continue are taken off its menu
   (the functions behind them do nothing there either), which leaves Multiplayer as the one way to play. A copy of the
   game opened from a file, or in the desktop client, keeps them. */
function ntServedMenu(){
  if(!NET.served)return false;
  for(const id of ['t_continue','t_go_new','t_go_load','t_import']){const b=$(id);if(b){b.hidden=true;b.disabled=true;if(b.setAttribute)b.setAttribute('aria-hidden','true');}}
  return true;
}
{
  const on=(id,f)=>{const b=$(id);if(b)b.onclick=f;};
  ntServedMenu();
  on('t_go_mp',()=>{ntOpenMenu();playS('click');});
  on('t_back_mp',()=>{ntRetryStop();if(NET.st==='connecting'){const ws=NET.ws;NET.ws=null;NET.st='off';NET.pend=null;if(ws){try{ws.onclose=null;ws.close();}catch(e){}}ntStatus('');}
    ntLoginHide();tmShow('main','t_go_mp');playS('click');});
  /* 6.49: the account box in Settings (it is synced whenever Settings opens) */
  {const ps=$('p_settings');if(ps&&ps.addEventListener)ps.addEventListener('click',()=>ntAcctSync());}
  on('s_acname_go',()=>{const v=$('s_acname');if(!NET.on||!v)return;ntSend({t:'acct',name:(''+v.value).trim()});playS('click');});
  on('s_acpw_go',()=>{const o=$('s_acold'),n=$('s_acnew');if(!NET.on||!o||!n)return;
    NET.acctPass=''+n.value;ntSend({t:'acct',old:''+o.value,pass:''+n.value});o.value='';n.value='';playS('click');});
  on('t_mp_go',()=>{ntMenuGo();playS('click');});
  for(const id of ['t_mp_addr','t_mp_user','t_mp_pass']){const i=$(id);
    if(i&&i.addEventListener)i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();ntMenuGo();}});}
}
