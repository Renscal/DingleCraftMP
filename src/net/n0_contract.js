/* ---- PART 58: n0_contract.js ---- */
/* ===================================================================== */
/* PART 58 — MULTIPLAYER (v6.10, Release 1.1)                            */
/* A client for server/dinglecraft-server.mjs. The server keeps one      */
/* world: the seed, the game rules, the time of day, every block edit,   */
/* every chest and furnace, and each player (inventory, position) by     */
/* name, and every dropped item (who picks one up is the server's call). */
/* It relays positions, chat and hits, and checks what it can (reach,    */
/* rights, who holds a chest). It does not run the game: an ordinary mob */
/* is run by the game of the player nearest to it and shown to the       */
/* others (n7_mobs.js); vehicles, bosses, dragons, villagers and the AI  */
/* players stay local to each player's own game and are not shared.      */
/*                                                                       */
/* The files (src/net/, in load order):                                  */
/*   n0_contract.js  this file: the protocol number, the NET state, the  */
/*                   test exports (NTEX), the map of everything          */
/*   n1_link.js      the connection: connect, leave, every incoming      */
/*                   message (ntMsg), entering the world (ntEnter)       */
/*   n2_world.js     block edits and block entities (chests, furnaces)   */
/*   n3_drops.js     dropped items                                       */
/*   n4_self.js      this player: save, pose, chat, death, the per-frame */
/*                   tick (ntFrame)                                      */
/*   n5_players.js   the other players: bodies, name tags, the Tab list, */
/*                   melee hits                                          */
/*   n6_menu.js      the Multiplayer screen on the title                 */
/*   n7_mobs.js      shared mobs, and explosions that reach other players*/
/*                                                                       */
/* Load rules: PART 58 loads before PARTs 57-54, so their names are      */
/* runtime-only here (typeof-guarded). No THREE constructor, clock,      */
/* random number or socket at load time: everything starts in ntConnect. */
/* Names: nt* / NET / NT_* / NTEX only.                                  */
/*                                                                       */
/* Core hooks (all behind NET.on, so single player is untouched):        */
/*   setBlock -> ntEdit            saveToStorage -> ntSave               */
/*   quitToTitle -> ntLeave        frame -> ntFrame                      */
/*   doMine -> ntMelee             die -> ntDied                         */
/*   chatSubmit -> ntChat          renderTab -> ntTabRows                */
/*   spawnDrop -> ntDropSpawned    updateDrop -> ntDropTake              */
/*   chatSubmit -> ntCmd (a slash command goes to the server)            */
/*   doSleep -> ntSleep            openModal -> ntBeAsk (chest locks)    */
/*   doMine, doUse -> ntGuard (spawn protection)                         */
/*   updateEntities -> ntMobPup    hurtMob -> ntMobHit                   */
/*   explode -> ntBoom             tickFlow -> ntSimHere                 */
/*   updateArrow, updateBullet -> ntShot                                 */
/*   (and three guards: stashEnts skips e.nid and e.pup, drops do not    */
/*   merge online)                                                       */
/*                                                                       */
/* Protocol: JSON text frames over one WebSocket, {t:'<type>', ...}.     */
/*   client -> server: hello pose rd edits open close be drop dropAt     */
/*                     take chat cmd hit save spawn time gr sleep death  */
/*                     mobs mgone mgive mhit boom                        */
/*   server -> client: welcome perm edits bes drops ready (the join),    */
/*                     then join leave pose edits be lock drop undrop    */
/*                     took chat sys hit time gr kick tp give mode perm  */
/*                     mobs mgone mgive mhit boom                        */
/* NT_PROTO must equal PROTO in the server (tests/net/n_static.js).      */
/* ===================================================================== */
const NT_PROTO=2,NT_PORT=40162;
/* All multiplayer state, in one object:
     on      true while playing on a server (every core hook checks this)
     st      'off' | 'connecting' | 'on'          ws    the WebSocket
     id name this player on the server            server pvp motd   what the welcome said
     ap      true while a block edit from another player is being applied (so it is not sent back, and makes no drops)
     pend    the world while it is still arriving (between welcome and ready), else null
     why     the reason for the next disconnect (a kick message), shown on the title
     peers   id -> the other players (n5_players.js)
     drops   id -> every dropped item the server knows (n3_drops.js); dropIn / dseq / dim belong to it
     q       block edits waiting to be sent (n2_world.js)      beS   block-entity key -> last sent signature
     acc     seconds played on this server (the clock for the timers below)
     poseT poseS scanT   when the pose was last sent, what it was, when the once-a-second scans last ran
     grS     the game rules as last agreed with the server (JSON)      tPrev  the time of day last frame
     stats   message and edit counters (the suites read them)
     op prot spawn   this player's rights: an operator, the radius of the protected spawn area (0: none), the world spawn
     lockK lockWant  the chest or furnace this player holds open on the server, and the one being asked for
     saveT   when the next "save soon" is due (-1: none)         rdS   the draw distance as last told to the server
     mobs    id -> every shared mob this game knows, its own and other players' (n7_mobs.js); mseq mobT ownT belong to it
     dmgRef  the last damage record from before the current hurt (so a death can tell what caused it)   guardT  toast timer */

const NET={on:false,st:'off',ws:null,id:0,name:'',server:'',pvp:true,ap:false,pend:null,why:'',
  peers:new Map(),drops:new Map(),dropIn:false,dseq:0,dim:'over',q:[],acc:0,poseT:0,poseS:'',scanT:0,beS:new Map(),grS:'',tPrev:0,tSet:false,stats:{in:0,out:0,edIn:0,edOut:0},
  op:false,prot:0,spawn:null,lockK:null,lockWant:null,saveT:-1,rdS:0,mobs:new Map(),mseq:0,mobT:0,ownT:0,dmgRef:null,guardT:-9};

/* everything the suites reach, spread into window.__vox by src/boot/export_boot.js */

const NTEX={NET,NT_PROTO,NT_PORT,ntUrl,ntConnect,ntLeave,ntDown,ntMsg,ntSend,ntEnter,ntEdit,ntFlush,ntApplyEdit,ntApplyBE,ntBeScan,ntBeSig,
  ntSave,ntPoseNow,ntFrame,ntPeerAdd,ntPeerDel,ntPeersTick,ntMelee,ntTabRows,ntOpenMenu,ntHash,ntHostHere,ntDropSpawned,ntDropTake,ntDropsScan,ntDropIn,ntDropGone,ntDropTook,
  ntCmd,ntSleep,ntBeAsk,ntLockMsg,ntLockTick,ntGuard,ntSaveSoon,ntSimHere,ntShot,ntMobShared,ntMobsTick,ntMobsIn,ntMobsGone,ntMobTaken,ntMobHurt,ntMobHit,ntMobPup,ntBoom,ntBoomIn};
