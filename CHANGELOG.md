# DINGLECRAFT changelog

Every release's patch notes, newest first. This file is generated from
`PATCH_LOG` in `src/ui/p28_patch_notes.js` by `npm run changelog`: change the patch notes there, never here.
A version appears once `npm run release` has recorded it in `tests/fixtures/shipped.json`.

<!-- manual -->
> **Release 1.0 (game versions 6.4 to 6.9).** The first public release, and the first one built in this repository. 6.4 was
> the preview: Puppet Purgatory's new cast, the game's own names, models and textures in several other places (old worlds
> load with the new names), a redesigned title screen and a UI Scale setting. 6.5 and 6.6 were cuts of the title panorama.
> 6.7 completes it: game rules on Create New World, a per-world rules editor, Export World in the pause menu, new sliders,
> your own name, menu music, offline play and a few rare finds. 6.8 trims the horror, and 6.9 adds replays (F8) and
> screenshots (F2). Each cut has its own entry below.
>
> **The move into this repository (v6.3, 2026-10-08).** DINGLECRAFT moved out of its old "splice" build pipeline into this
> repository: per-system source files in `src/` and `html/`, the Hyperreal art as individual WebP files in
> `assets/packed/`, and a Node-only build (`npm run build`) and test gate (`npm run gate`). The build reproduced the shipped
> `dinglecraft_v6.3.html` byte for byte (md5 `e0d781ad02350580f027d9452ba67e28`), so nothing about the game changed in
> the move. See `docs/PARITY.md` for the proof.
<!-- /manual -->

<!-- generated from PATCH_LOG: do not edit below this line (up to the next manual block) -->

## DingleCraft Multiplayer 2.0 — Every byte counts

*Game version 6.60, released 2026-10-15.*

- **EVERY BYTE COUNTS.** The world’s region files used to be JSON written for people: every changed block spelled out as three numbers in quotes, every empty chest slot written down as null, the word count typed out once per stack. Lovely to read. Enormous to keep. Since 6.60 the server packs them instead.
- **How small.** Every number takes as few bytes as it needs, a row of the same block is written once with its length, a chest only writes the slots that hold something, and a name or a set of keys the file has already seen is a two-byte reference. A built-up region (forty chunks of houses, tunnels and chests) went from 299 KB of JSON to 32 KB. The small files most worlds are made of come out under half the size the old compression managed.
- **Nothing compressed.** The compression from 6.53 is gone, and so are its two settings. The packing is the whole trick, so a file is read straight off the disk: loading one is as quick as the JSON was.
- **Your world converts itself.** Start a 6.60 server on an older world and every region, every entity file and every compressed player is rewritten in the new form at once, the old files removed. Same blocks, same chests, same mobs, same passwords. The server says how many files it converted.
- **Still readable.** *node dinglecraft-server.mjs view* prints any region or entity file as the same JSON as before; *unpack* and *pack* turn one into JSON and back (byte for byte) for anyone who edits worlds by hand. *files* lists them with what is in them.
- **Where did I leave my diamonds.** *node dinglecraft-server.mjs find diamond* searches the whole world: changed blocks, chests, furnaces, dropped items, mobs, vehicles and every player’s pockets, by name, part of a name, *#id* or mob type. It answers with coordinates.
- **And in the server window (1.2).** A new World files tab: every file with its size and contents, a click shows one as tables with real names (what each chunk was changed to, what each chest holds, every mob and its health) or as JSON, and a search box over all of it or only the files you tick.
- **For the server owner.** compressAfter and compressPlayersAfter are gone from server.json (the server takes them out by itself). Back up before the first start if you like to be careful: an older server cannot read the packed files.

## DingleCraft Multiplayer 2.0 — Log in with a click

*Game version 6.59, released 2026-10-14.*

- **LOG IN WITH A CLICK.** On a server with accounts, the Log in button was greyed out the whole time the server was waiting for you to log in, which is the one time anybody wants to press it. Only Enter worked, and nothing said so.
- **Fixed.** The button works. While your login is on its way it waits for the answer, so a double click spends one of your five tries, not two, and a wrong password gives it straight back for the next go.
- **How it got past us.** The tests logged in the way Enter does and never pressed the button. They press the button now.

## DingleCraft Multiplayer 2.0 — Two point oh

*Game version 6.58, released 2026-10-14.*

- **DINGLECRAFT MULTIPLAYER 2.0.** Same game, bigger number. Everything since the first multiplayer server (game 6.10) has been living under the name Release 1.1 for forty-eight versions, which is a lot of point-ones. It has earned a proper name.
- **What 2.0 is.** A real server that runs the world itself: mobs, water, fire, crops, furnaces and the market, the same for everyone, in every dimension. Accounts, operators and slash commands. Farming, saplings, flowing water and lava, real light, monsters by the book, difficulty and DingleCore, your own skin, rebindable keys, and a plane you actually fly.
- **And the tools around it.** A desktop client, and a server window that runs any number of servers on any version, downloading new ones from GitHub by itself.
- **What changed in this version.** The name. That is all. The game plays exactly like 6.57 "Sit down and fly": the title screen and the ending now say DingleCraft Multiplayer 2.0.
- **Where it lives.** This is the first release on the main branch: the one to download if you just want to play.

## Release 1.1 — Sit down and fly

*Game version 6.57, released 2026-10-14.*

- **SIT DOWN AND FLY.** The Prop Plane used to fly wherever you looked, which meant admiring the view was a good way to fly into it. It is now a plane.
- **The controls.** Space is the throttle. W pushes the nose down, S pulls it up, A and D turn and bank. Alt is the brake, and on the ground, stopped, it backs you up slowly. Let go of W and S and the nose comes back to level by itself. Look wherever you like: the plane does not care.
- **Real flying, roughly.** Too slow and the nose drops: that is a stall, and the ground is where it ends. Climbing costs speed and diving pays it back, so a long climb wants a full throttle. On the ground you roll on the throttle and lift off with S once you are fast enough.
- **The tilt is right.** The plane leaned the wrong way whenever it was not pointing north (three.js turns things in an order that only works facing one way). It now pitches and banks properly in every direction.
- **A cockpit with someone in it.** You used to stand up through the plane with your legs sticking out of the back. You now sit inside, under the canopy, and only your head shows. The canopy grew to fit it.
- **Heads turn, bodies do not.** In a plane, car, boat or coaster cart your body faces the way the vehicle goes and only your head follows your look, as far as a neck allows. Your view also turns with the vehicle, so a long bend no longer leaves you staring out of the side window. The skateboard is unchanged: you stand on it.
- **No more chasing your own car.** Every vehicle used to sit a frame ahead of you: you were put in the seat, THEN it moved, then the camera looked. At speed it slid away and snapped back all the time. You are now seated after it moves, so you and it are one thing.
- **Same for everyone else.** On a server, other players used to see your body and your vehicle arrive as two separate stories that drifted apart. Your body is now drawn on the seat of the vehicle they see, tilt and all.
- **New key.** The plane brake is in Controls → Change keys, next to everything else. Space (the throttle) follows your jump key.

## Release 1.1 — Your keys, your rules

*Game version 6.56, released 2026-10-14.*

- **YOUR KEYS, YOUR RULES.** Every key the game uses was nailed to the floor: W was forward, E was the inventory, and left-handed players, arrow-key loyalists and people with a sticky Q simply had to live with it. Not any more.
- **Change keys.** Controls has a new page. Click an action, press the key you want, done. Walking, jumping, sneaking, sprinting, the inventory, dropping, sorting, all nine hotbar slots, the camera, the Powers menu, Laser Eyes, the car horn, chat, the player list, screenshots and replays: 28 actions, any key you like.
- **The side buttons too.** Mouse buttons 4 and 5, the ones that usually mean back and forward, no longer take you back or forward and away from your world. Give them a job instead: jump, sneak, the camera, anything on the list.
- **No double-booking.** Pick a key another action already has and the two swap places, so nothing ever ends up with two jobs or none. The key you moved away from goes quiet. Reset all keys puts everything back.
- **Everything follows.** Cars, boats, skateboards, dragons, the plane and the coaster all steer with your keys, and the Controls screen shows your keys, not ours.
- **What stays put.** Left, right and middle click, Esc, Enter, F3 (and its F3 + B and F3 + G), the easel and DEEP DIRT 2D keep their own keys. Typing in chat or a text box is never translated: your W still types a w.
- **Remembered.** Your keys are saved in this browser with the rest of your settings, and only the ones you changed. A world on a server uses them too.
- **CONTROLS, WITH AN INDEX.** The Controls screen was one long scroll of everything at once. It now has an index down the side: Moving, Mining & using, Inventory, Vehicles & mounts, Special items, Screen & chat, Creativity & mini-games, Touch and Change keys, one page at a time. On a phone the index folds into a row of buttons on top.
- **Two corrections on the way.** It no longer claims Laser Eyes are sneak + right-click (they have been L since 6.52) or that /think reads minds (that left with the AI players).
- **Credits.** Now link this game's home, github.com/Renscal/DingleCraftMP, and the original DINGLECRAFT it is built on, github.com/dandingle/dinglecraft.
- **THE DESKTOP CLIENT KEEPS ITS HANDS OFF.** The desktop app still had a browser hiding inside it: Ctrl+R reloaded the game, Ctrl+W closed it, Ctrl+Q (the game's drop-the-whole-stack) could quit it on Linux, and zoom and the developer tools were a keypress away. All gone. Ctrl+C and Ctrl+V still copy and paste in a text box, and F11 is still full screen. Every other key is the game's.
- **Renscal.net.** The main menu button and the sharing screen now point at Renscal.net instead of the old subreddit.

## Release 1.1 — Farms at full range

*Game version 6.55, released 2026-10-14.*

- **FARMS AT FULL RANGE.** Since 6.48 monsters spawn by the book, but on a server the world only ran 80 blocks around each player, and a mob further out than 72 blocks froze in mid-air. Farm towers built the classic way, high above the AFK spot, sat partly outside that.
- **Now 128 blocks.** The server runs the world 8 chunks around every player: spawning, falling, walking, the lot, out to the full range the spawning rules use. A pig dropped 110 blocks away now actually falls.
- **What it costs.** Measured with four players spread out: about 15% of one CPU core for the whole world, up from 7%. The setting **simulationDistance** (4 to 12 chunks) turns it down on a small machine.
- **Idle worlds let go of their memory.** A Nether or Aether nobody has visited for 10 minutes after it paused is shut down completely and started again when someone goes there (**stopWhenEmpty**, in minutes, 0 to keep it).
- **A crash is not the end.** If the Overworld's server game ever crashes, it restarts by itself 5 seconds later (up to three times in ten minutes), instead of waiting for a player to notice.

## Release 1.1 — Feet on the ground

*Game version 6.54, released 2026-10-14.*

- **FEET ON THE GROUND.** Some new worlds started you off with a 15-block drop into a ravine and half your hearts gone before you had pressed a key. The spawn finder looked at the land as planned, before the caves and ravines were cut into it.
- **Fixed.** It now checks the ground that is really there: a new world always starts you on dry, solid ground above the sea. Tested on 40 seeds. A world that is open sea for hundreds of blocks still starts you over the water, which is at least soft.
- **Logging in is a little quicker.** On a server with accounts, the Username box now starts with the name you play under, so most people only need to type the password.
- **Behind the scenes.** The desktop client was started for the first time and works (muted, logged in, played), and a server running on https/wss with a certificate was tested end to end.

## Release 1.1 — Out of sight, out of space

*Game version 6.53, released 2026-10-14.*

- **OUT OF SIGHT, OUT OF SPACE.** A server that has been running for a year keeps every house, mine and dug-out crater anyone ever made, in readable files. Readable is lovely. A year of it is a lot of disk.
- **Cold land is packed away.** Land nobody has been near for 7 days is written compressed: about 3% of its size. A flattened chunk that took 57 KB now takes a few bytes. The moment someone walks back, it is written plain again.
- **So are absent players.** A player who has not joined for 7 days has their file compressed too. When they log in, it is plain again. Their login still works the whole time.
- **For the server owner.** Two settings: **compressAfter** and **compressPlayersAfter** (days, 7 by default, 0 for never). A compressed file ends in .json.br and opens with any Brotli tool. The server README shows how, and how the packed format works, so nothing is locked away.

## Release 1.1 — Eyes front

*Game version 6.52, released 2026-10-14.*

- **EYES FRONT.** Laser Eyes had three problems: nobody else could see them, they came out of your eyes only when you looked straight ahead, and you could not fire them in mid-air. All three are fixed.
- **Aimed properly.** The beam was being turned the wrong way round once you looked anywhere but straight ahead: in 90 of 112 directions tested it pointed somewhere else, by up to 149 degrees. It now leaves from just in front of your eyes and goes exactly where you look, every way you can turn your head.
- **A key of its own.** Hold **L** to fire, whatever is in your hand, standing, falling or flying. Sneak + right-click with an empty hand no longer does it, which is why it never worked in the air: nobody sneaks in mid-air. It is in the Controls screen.
- **Everyone sees it.** On a server, other players now see your beam, from your eyes to wherever it lands. Their copy is a light show only: it melts and hurts nothing on their side, the real one already did.

## Release 1.1 — Three small mercies

*Game version 6.51, released 2026-10-14.*

- **THREE SMALL MERCIES.** Little things that were quietly ruining someone's afternoon.
- **Figurine Drops, a game rule.** Slain mobs drop a figurine of themselves one time in twenty. Now you can switch that off: on Create New World, in the debug menu, or on a server with /gamerule figDrops false. Museums everywhere mourn.
- **Chests no longer get bricked in.** On a server, right-clicking a chest or furnace with a block in your hand placed the block against it while the server was still deciding whether you could open it. Now a click that opens something places nothing until you let go of the button.
- **Escape does not stop the world.** On a server, the pause menu used to freeze your own game: your mobs, your physics, your furnaces, all holding their breath while everyone else carried on. Now the menu opens and the world keeps going, as it should on a server. Your keys let go, so you do not walk off a cliff while changing the volume. Single player still pauses properly.

## Release 1.1 — The world keeps time

*Game version 6.50, released 2026-10-14.*

- **THE WORLD KEEPS TIME.** Plant a field, walk off on an adventure, come back: the wheat used to be exactly as tall as you left it, frozen in place out of politeness. A paused server (since 6.46) froze everyone's furnaces as well. Not any more.
- **What catches up.** Crops on watered farmland, saplings in the light, and furnaces. When their land is next run (you walk back, a chunk loads, the server wakes up), everything they would have done happens at once, with the same odds as if you had stood there and watched.
- **Real time.** It counts time the server sat empty or paused, time the server was switched off, and time your single-player game was closed. Leave a full furnace overnight and the ingots are waiting in the morning. Day and night do not move while nobody plays.
- **Within reason.** A furnace only cooks what its fuel and input allow. A crop stops at ripe, and dry farmland still grows nothing. A sapling that would have become a tree becomes one the moment you are back, so trees never sprout half-built at the edge of the world.
- **Not caught up.** Fire, flowing water, falling leaves and mobs. Those are physics and wildlife, not gardening.
- **For the server owner.** The setting **catchUpMax** (minutes, 0 for no limit, which is the default) caps how much time any one catch-up may cover. The world's clock lives in level.json.
- **A new face.** The title has a new logo: DINGLECRAFT MULTIPLAYER, in chunky grey letters with the sprinkles still on.
- **Which version is this?** The line under the logo now says the game's own version number, and keeps itself up to date with every release, instead of the release name it had been stuck on.

## Release 1.1 — Who goes there

*Game version 6.49, released 2026-10-14.*

- **WHO GOES THERE.** On a server, you used to be whoever you said you were. Type an operator's name and you had their rights, their inventory and their spot in the sun. Servers now have accounts.
- **How it works.** The server's owner makes an account (a username and a password) and hands it to the player. When the player joins, the server asks for it before they spawn. Get it wrong five times and you are shown the door.
- **Remembered.** The game remembers your username for each server. Tick "Remember the password" and it remembers that too, on this computer only.
- **Per server, on purpose.** There is no central account system. Each server keeps its own accounts, so anyone can run one, forever, with nobody's permission. The password is stored in plain text at the top of your player file, where the owner can read it. Settings says so in a red box. Do not reuse a password you care about.
- **Change your own.** While you are on a server, Settings has a box for your account: a new username, or a new password (the old one first).
- **For the owner.** The server window's Players tab lists every account: add one, set a password, rename, remove, set a skin from a PNG file, and lock a player's name, password or skin. The same from the console: **/account add, password, rename, remove, lock, list** and **/setskin**. Settings has the same three locks for everyone at once.
- **The server password is gone.** Accounts replace it. A server that had one switches to accounts by itself. An open server with players stays open (anyone joins by name, as before) until its owner switches accounts on. A brand new server starts with accounts on.
- **Skins stick.** The skin you last wore on a server is kept with your account, and what an operator gives you is what everyone sees, you included.

## Release 1.1 — Monsters by the book

*Game version 6.48, released 2026-10-14.*

- **MONSTERS BY THE BOOK.** Mob farms are a whole engineering discipline in the blocky game this one takes after, and none of them worked here, because our monsters followed our own rules. Now they follow those rules, closely enough that a farm built from a tutorial should just work.
- **The sky has a light level now.** Every block knows how much sky light reaches it: full 15 straight down an open shaft, one less per block sideways under a roof, a little less under leaves or water. Night takes up to 11 off it. Torches still count separately.
- **Dark is a dice roll.** A monster needs no torchlight at all, and then the light from the sky (after the hour takes its share) has to beat a random number from 0 to 7. A sealed room spawns every time, an open field at noon never, and the open sky at night about a quarter of the time.
- **How spawning works now.** Twenty times a second, every loaded chunk within 8 of you gets one try: a random spot at a random height, then up to three packs of up to four. Never within 24 blocks of a player, never more than 128 from one.
- **The cap scales.** 70 monsters and 10 animals for a full 17 by 17 area of chunks, counted only near you, and fewer when less of the world is loaded.
- **Despawning.** A monster more than 128 blocks from everyone vanishes at once. Past 32, once nobody has been near it for half a minute, it has a small chance each tick. Inside 32, never. Bosses, villagers and anything with a name stay put.
- **Animals.** On grass, in the light, every 20 seconds. They go only past 128 blocks.
- **Dungeon spawners.** They wake up when a player is within 16 blocks, try 4 spots within 4 blocks of themselves, accept torchlight up to 11, wait 10 to 40 seconds after a success, and stop once there are 6 of their kind around. Spawner farms, in other words.
- **Falling hurts monsters.** More than 3 blocks hurts them, a point per block beyond that, and water breaks the fall. Drop towers now do what drop towers do. The Pig Cannon's pigs are issued parachutes.
- **Not changed.** The Nether, the Aether and Puppet Purgatory keep their own spawners, because their residents were never going to follow anyone's rules.

## Release 1.1 — Shoot through the hedge

*Game version 6.47, released 2026-10-14.*

- **SHOOT THROUGH THE HEDGE.** Bullets used to treat a single oak leaf like a slab of reinforced concrete. Zombies learned to stand behind bushes. That era is over.
- **What a bullet goes through now.** Leaves of every kind, doors (shut or open: it is a wooden door, not a bank vault) and water. Puppet Purgatory's fleece canopy too.
- **What still stops it.** Stone and every other solid block, glass, Bunker Glass (it was always in the name) and lava. Lava used to let bullets through, which was physics nobody had signed off on.
- **Everyone sees the same thing.** On a server, the copy of your bullet other players see goes through the same hedge, so nobody watches a shot vanish into a leaf and then hit them anyway.
- **The Staple Gun agrees.** Staples follow the same rule. Arrows are unchanged and still stick in leaves, because an arrow in a tree is a classic look.

## Release 1.1 — Lights out when nobody is home

*Game version 6.46, released 2026-10-14.*

- **LIGHTS OUT WHEN NOBODY IS HOME.** A server with nobody on it used to keep the whole world running for an audience of zero: the sun crossing an empty sky, zombies shuffling around nobody, furnaces cooking for a player asleep in another time zone. All of that cost CPU the computer could have spent on anything else.
- **Now the world naps.** A minute after the last player leaves a dimension, the server stops running it entirely. Time, mobs, water, fire and furnaces freeze exactly where they were, and the server game for it uses no CPU at all.
- **And wakes up instantly.** The moment a player steps back in, it picks up from that exact moment: no fast-forward, no zombies teleporting to catch up on the minute they missed.
- **Per dimension.** Everyone off in the Nether? The Overworld naps by itself, and so does the Nether once you all come home. When the whole server empties, the world is saved first.
- **For the server owner.** The new setting **pauseWhenEmpty** (seconds, 60 by default, 0 to never pause) is in server.json and in the server window's Settings. The dashboard shows which worlds are asleep.

## Release 1.1 — Hemlock, a little less hidden

*Game version 6.45, released 2026-10-13.*

- **HEMLOCK, A LITTLE LESS HIDDEN.** Last update made wild hemlock fifty times rarer, which turned out to mean one plant in about two thousand chunks: not hidden so much as missing. It is now about one plant in a hundred chunks of ordinary country.
- **What that means on foot.** A hundred chunks is a square ten chunks on a side, 160 blocks each way. Walk grassland for a few minutes and you should pass one. Open plains have more, forests fewer, and desert, snow and sea have none: it only grows on bare grass.
- **Carrots are unchanged.** Wild carrots are still two to three times as common as hemlock, so most of what looks like a carrot is one. Check the leaves anyway.

## Release 1.1 — Afraid of the dark

*Game version 6.44, released 2026-10-13.*

- **AFRAID OF THE DARK.** Monsters used to follow a timetable: on the surface at night, somewhere underground by day, and never within eight blocks of a torch. They did not care how dark it actually was, and they did not check where they were standing. They do both now.
- **Dark means dark.** A monster can appear anywhere there is no light at all: no torchlight reaching the spot, and no daylight. Build a sealed room with no torch in it and things will turn up in it at noon. Light it properly and nothing will.
- **Torches work honestly.** A torch protects exactly as far as its light reaches, which is further than before, and one torch in the corner of a big hall no longer covers the far end. Lava and glowstone count too.
- **Daylight comes in.** By day the sky lights not just what is under it but about eight blocks in through any opening: a doorway, a window, the mouth of a cave. Deeper than that, bring a torch.
- **Somewhere to stand.** A monster needs solid ground under it and room for its whole body: two blocks of height for a zombie, a full three by three for a spider. Nothing appears in water, in lava, in mid-air, inside a block, or on glass or leaves.
- **Not on top of you.** Nothing appears within 24 blocks of a player. They come in small packs of up to four, and they can turn up anywhere in the loaded world, caves included, so the caves under your feet fill up while you garden. Still never more than fourteen around you.
- **Animals.** Still by day, on grass, in the open, and now only where they fit.
- **The Nether.** Its monsters keep their own rules but need room too, and no longer appear in lava.
- **On a server.** The server's own game now keeps track of light as well, so dark means the same thing there.
- **Hemlock went into hiding.** Wild hemlock is fifty times rarer than it was. Wild carrots are as common as ever, so nearly everything that looks like a carrot now is one. Nearly.
- **And it bites harder.** Poison from something you ate, a Hemlock Root or a poisoned piece of food, now lasts two minutes instead of twelve seconds. A poisoned blade is still six seconds a hit.
- **The hoe drags.** Hold the right button with a hoe and sweep the crosshair along: every grass or dirt block it crosses is tilled. One wear a block, as before.

## Release 1.1 — Plant a tree

*Game version 6.43, released 2026-10-13.*

- **PLANT A TREE.** You could cut every tree in the world down and never grow one back. Forests were a thing you used up. Now there are saplings: oak, birch and spruce.
- **Where they come from.** Break leaves and about one in twenty drops a sapling of that tree. Oak leaves, very rarely, also drop an apple, which is how apples were always supposed to work.
- **Planting.** Right-click grass or dirt with a sapling. Give it sky or a decent light and it grows through four stages into a full tree of its own kind, the same shape as the wild ones, in about ten minutes. It needs room for its trunk: put a roof one block over it and it waits, politely, for as long as it takes.
- **Leaves let go.** Cut a trunk and the leaves no longer hang in the air forever like a guilty thought. Over the next few seconds every leaf that is not within four blocks of a log withers away, dropping saplings as it goes. A tree standing next to the one you cut keeps its own.
- **Hedges are safe.** Leaves you place yourself are yours and never wither.
- **On a server.** Saplings grow and leaves wither once, in the game that runs the land, and everybody sees the same forest.
- **For modders.** That was the last free block id. Saplings share one block and keep their kind in the block's spare byte, and anything new will have to do the same.
- **Server window.** Building the Windows program stopped with a complaint about the icon: the builder took the logo for the program's icon and found it too small. The picture is now called tray.png, which the builder leaves alone, so npm run dist goes through. The exe wears the default icon until somebody draws a square one.

## Release 1.1 — Two loose ends

*Game version 6.42, released 2026-10-13.*

- **TWO LOOSE ENDS.** The full test run after the last batch of updates found two things the quick runs had missed. Both are fixed here.
- **Water against lava makes obsidian again.** Since lava stopped being a wall (6.28), pouring a water bucket at a lava pool put the water INTO the lava and simply replaced it. A poured bucket now lands against the lava, as it used to, and the lava turns to obsidian. Looking through lava and building into it are unchanged.
- **The Stiletto is itself again.** Puppet Purgatory's dagger has always had its own bonus for a falling strike. When critical hits arrived (6.30) it got that bonus AND the new one. Purgatory's weapons keep their own rules and are left out of the general critical hit.

## Release 1.1 — The server gets a window

*Game version 6.41, released 2026-10-13.*

- **THE SERVER GETS A WINDOW.** Running a DINGLECRAFT server has meant a black terminal, a blinking cursor and a list of commands you were expected to remember. There is now a proper program for it, laid out the way server managers are: your servers down the left, the one you picked on the right. The terminal server is still there, untouched, for people who like blinking cursors.
- **Servers, plural.** Keep a survival world for the group and a creative one for the builders. Each server has its own folder, its own port and its own dot: green for running, amber for starting, grey for stopped. New server makes one; Add existing folder adopts the one you already had.
- **Dashboard.** Status, players, memory and world on four cards, the address to give your friends with a Copy button, and Open in browser.
- **Start, Stop, Restart, Kill.** Stop saves the world first. Kill does not, and says so. Closing the window with a server running asks whether to stop it or keep it going in the tray.
- **Console and Players.** The live log, a command box with Up and Down for history, and for everyone online: where they are, with buttons to kick, ban, op and teleport them to each other.
- **Settings and Game rules.** Every setting and every rule as a form, including difficulty and the three dimension switches. Nothing wrong gets written: a bad port or a name that is not a name is pointed at, and the window tells you which changes need a restart.
- **Worlds and Backups.** Make a world, switch world. Back up now takes a dated copy of the whole world; Restore puts one back, and quietly backs up the world as it was first, so even a restore can be undone.
- **Scheduler.** Every so many minutes: back up the world and keep the newest ten, restart the server, or run a command. Set it once and stop thinking about it.
- **The honest part.** It is an Electron app you start with npm install and npm start. There is no .exe yet, and nobody has run it on Windows or looked at it on a screen: the parts that touch files and the server are tested, the buttons are not. When an .exe exists it will be unsigned, and Windows will say so the first time.
- **For the curious.** The server grew an --ipc mode: started by another program, it reports its status, log and players to it and takes commands back. That is all the window is: a face on that.

## Release 1.1 — Something in the stew

*Game version 6.40, released 2026-10-13.*

- **SOMETHING IN THE STEW.** The Hemlock Root from last update now does what hemlock does. Eat one and you are poisoned: your hearts turn a sick green and you lose half a heart every second or so until it wears off. It will take you down to your last half heart and stop there. It is poison, not an execution. A full stomach does not heal you while it lasts, and nothing cures it but time.
- **Glass Bottle.** Three glass in a V make three bottles.
- **Jar of Poison.** One Hemlock Root and one Glass Bottle. This is where it gets interesting.
- **On a blade.** Put a Jar of Poison and a sword in the crafting grid and you get the same sword back, wear and enchantments and all, coated for ten hits. Its name says so. Everything it hits is poisoned for six seconds, monsters and players alike, and each hit uses one up. Poison will not finish a monster off either: it softens them up, you do the rest.
- **In the food.** Put a Jar of Poison and any food in the crafting grid and you get one piece of that food, poisoned. It looks like the food. It is called the food. It stacks with the food. Nothing on the screen will ever tell you, or anyone else, which piece it is.
- **The odds.** Slip one poisoned steak into a stack of nineteen good ones and whoever eats from that stack has one chance in twenty of getting it, then one in nineteen, and so on down. Split the stack, throw half of it, drag it across a chest: the bad piece goes one way or the other by chance and tells nobody. Poison two pieces and there are two in there. Dinner parties will never be the same.
- **Honest admissions.** Cooking does not carry poison through a furnace, and using a poisoned piece as an ingredient gives a clean result. The jar is not given back.
- **Fixed from 6.39.** A newly made watering can came out full. It is made empty now, as it was meant to be.

## Release 1.1 — Sow, water, wait

*Game version 6.39, released 2026-10-13.*

- **SOW, WATER, WAIT.** Farming is in. There is a hoe, a watering can, three crops, and bread at the end of it. The game finally has something to do that is not a fight, a casino or a sixteen-metre demon.
- **The hoe.** Two of a material over two sticks, in all five materials. Right-click grass or dirt that has air above it and it becomes farmland. The hoe wears like any tool.
- **The watering can.** Four iron round a bucket. Fill it by right-clicking still water (the water stays where it is), and it holds eight waterings. Right-click dry farmland and it turns dark and watered.
- **Water is your job.** A pond next to your field waters nothing. Rain waters nothing. Farmland is watered by the can and only the can, and it stays watered for five harvests of a ripe crop, then goes dry and wants watering again. Pulling up something unripe does not count.
- **Wheat.** Tall grass drops Wheat Seeds about one time in eight. Plant them on farmland, wait about a day, and a ripe plant gives one Wheat and up to three seeds. Three Wheat in a row make Bread.
- **Carrots.** Wild carrot plants grow here and there on grass. A ripe one gives two to four carrots. A carrot is food, and a carrot planted on farmland is next season.
- **Hemlock.** Also wild. Also carrot-shaped. The leaves are a touch paler and bluer, the stems have small purple spots, and the root is cream instead of orange. It is called Hemlock Root and for the moment it does nothing whatsoever. We would not get attached to that.
- **Good to know.** Crops only grow on watered farmland; on dry ground they just sit there. Dig the farmland out from under a crop and it pops off as its seed. Put a solid block on farmland and it is dirt again. Walk on it all you like.
- **On a server.** Crops grow once, in the game that runs the land, and everyone sees the same field.
- **LEFT AND RIGHT CLICK, PUT BACK.** The mouse-button change from 6.27 has been undone at the owner's request. Clicking works exactly as it did before that update.

## Release 1.1 — DingleCore

*Game version 6.38, released 2026-10-13.*

- **DIFFICULTY.** Worlds now have one: Easy, Normal or Hard. Normal is the game exactly as it was, and every world you already have is Normal. There is no Peaceful on the list: turning off mob spawning is still how you get a quiet life.
- **Easy.** Mobs hit for half, plus one, and never harder than they would on Normal. Hunger stops chewing on you at five hearts.
- **Hard.** Mobs hit half as hard again. A zombie that took three hearts takes four and a half. Hunger does not stop at half a heart any more. It finishes the job.
- **DINGLECORE.** Hard, with one life. You choose it when you create the world and at no other time: a DingleCore world cannot be made gentler, and a gentle world cannot be made DingleCore. Your hearts know. Look at them closely. They are looking back.
- **When you die in DingleCore.** There is no Respawn button. There is Spectate world and there is Back to title. As a spectator you fly, you pass through walls, the monsters lose all interest in you, and you cannot break, place, pick up or open a single thing. The world remembers: open it tomorrow and you are still a ghost in it.
- **The one place it does not count.** Dying inside Puppet Purgatory is not the end, even in DingleCore. You were already in purgatory. There are limits.
- **On a server.** Set "difficulty" in the rules. /gamerule difficulty switches between Easy, Normal and Hard; DingleCore is set in server.json and stays set. On a DingleCore server a player who dies becomes a spectator, by name, and stays one after reconnecting, until an operator runs /gamemode survival. There is a /gamemode spectator too.
- **Also.** Create New World now offers the three dimension rules from two updates ago, which it should have done then. The debug screen shows the difficulty.

## Release 1.1 — A hand of your own

*Game version 6.37, released 2026-10-13.*

- **A HAND OF YOUR OWN.** In first person, with nothing in your hand, there was nothing in your hand. Not even a hand. You punched trees with an idea. Now your empty hand is your own right arm, in your own skin, sleeve and all, reaching up from the corner of the screen where an arm ought to be.
- **It is really yours.** The arm wears the same picture your body wears. Change your skin in Settings and the arm changes with it on the spot.
- **It punches.** It swings when you swing and bobs when you walk, the same as anything else you hold.
- **It knows when to leave.** Pick up a block, a tool or a rifle and the arm steps aside for it, as before. Hyperreal keeps its fist.

## Release 1.1 — Armour you can see through

*Game version 6.36, released 2026-10-13.*

- **ARMOUR YOU CAN SEE THROUGH.** Putting on armour used to turn you into a stack of plain coloured boxes. Whatever skin you had spent an evening on was simply gone, replaced by a diamond-coloured refrigerator. Armour is now a fitted layer with gaps in it, and you are still in there.
- **The helmet has a face.** There is an opening at the front with a nose guard across it, so your eyes and that grin show through, a slot over each ear, and nothing underneath.
- **The chestplate shows the shirt.** Plates front and back, straps over the shoulders, open at the sides and below the ribs. On the arms: a shoulder guard and a bracer, with the elbow and the hand bare.
- **Leggings and boots.** A belt round the hips and each leg covered down to the boot, open at the back of the knee so you can still sit down in theory. Boots cover the ankle down and the sole.
- **Four metals.** Iron, golden, diamond and dragon each have their own picture, drawn pixel by pixel in code. Mix a golden helmet with diamond boots and each piece keeps its own colour.
- **Everyone matches.** Your own figure in third person and every other player on a server are dressed by the same piece of code from the same pictures, so what you see on yourself is what they see on you. The Hyperreal player keeps its own look.

## Release 1.1 — Ten pairs of trousers

*Game version 6.35, released 2026-10-13.*

- **TEN PAIRS OF TROUSERS.** Your armour used to be a small shield and a number in the corner of the screen, like a parking ticket. It is now a proper armour bar: ten icons in a row directly above your hearts. The icons are trousers. Every other game went with a chestplate. We looked at what actually keeps a person decent and made our choice.
- **How to read it.** Each pair of trousers is two points of armour. One leg is one point. A full iron set is four pairs; full dragon is all ten.
- **Gold rounds up.** A golden piece is worth a point and a half, and the bar shows the nearest half pair, so one golden helmet is one whole pair of trousers. Nobody is drawing three quarters of a trouser.
- **Nothing on, nothing shown.** With no armour the bar is not there at all, and it steps aside in creative along with the hearts.
- **Same protection.** Only the display changed. Armour absorbs exactly what it absorbed yesterday.

## Release 1.1 — The server remembers

*Game version 6.34, released 2026-10-13.*

- **THE SERVER REMEMBERS.** On a server your inventory used to be saved when you dropped something, picked something up, or pressed Save. Mine for an hour, craft a diamond pickaxe, eat, level up, and then have the browser tab crash: the server remembered you as you were an hour ago, holding dirt. Not any more.
- **Within a second.** Anything that changes about you (what you carry, what you wear, your health, your hunger, your experience, your spawn) reaches the server about a second later, by itself. A flurry of changes goes as one message, and when nothing changes nothing is sent.
- **Where you stand.** Your position goes along with every save, and on its own every ten seconds while you are on the move.
- **The last word.** Closing the tab, leaving the page or pressing Disconnect sends one final save on the way out. If the line simply drops, the server keeps the last thing it heard, which is now at most a second old.
- **Light on the wire.** A save no longer carries the whole world along for the ride, and your paintings and records travel only when you have changed one. The server keeps the copies it already has.
- **When the server stops.** Every player's latest state is written to their file as it shuts down.

## Release 1.1 — Closed for the season

*Game version 6.33, released 2026-10-13.*

- **CLOSED FOR THE SEASON.** Three new game rules: The Nether, The Aether and Puppet Purgatory. All on, as always, unless you turn one off. Turn one off and that place is shut: nothing in the world leads to it any more. The Overworld is not on the list. You have to live somewhere.
- **The Nether, off.** Obsidian frames will not light, however much you click at them. A portal that already stands hums at you and goes nowhere, and says so.
- **The Aether, off.** The glowstone frame keeps its thirst to itself. You keep your water.
- **Puppet Purgatory, off.** The Stage Door does not arrive after its ten minutes, and if one is already standing in your world, it stays shut. Everything Purgatory remembers about you is kept in the save, so turning the rule back on puts it all back where it was. The frog can wait. The frog is good at waiting.
- **Caught inside.** If a place is switched off while you are in it, or you load a save that was made there, you are put back at your Overworld spawn without a scratch.
- **Where to set them.** Create New World, the rules editor, /gamerule, and the rules in server.json. On a server a closed dimension gets no game of its own, and /tp will not send anyone there.

## Release 1.1 — Teleport anywhere

*Game version 6.32, released 2026-10-13.*

- **TELEPORT ANYWHERE.** /tp to a friend used to answer "is in another dimension" and leave it at that, as if dimensions were a legal problem. Now /tp Ann takes you to Ann. If Ann is in the Nether, you are in the Nether. There is nothing to type about dimensions: the server knows where she is.
- **Soft landings.** Arriving in another dimension works like a portal trip without the portal: the ground is built before you get there, whatever you were falling from is forgotten, and you step off anything you were riding.
- **Coordinates stay put.** /tp 10 64 10 moves you inside the dimension you are already in, as before.
- **Not Puppet Purgatory.** Nobody can be teleported into Purgatory, and nobody in it can be pulled out to another dimension. That place has its own way in and its own way out, and it does not take requests.

## Release 1.1 — The long day

*Game version 6.31, released 2026-10-13.*

- **THE LONG DAY.** A day used to last ten minutes and exactly half of it was dark, which is a fine schedule for a bat. A day is now twenty minutes: ten of full daylight, a minute and a half of sunset, seven of night, a minute and a half of sunrise.
- **More day, less night.** You get ten whole minutes to build before anything with too many legs turns up, and the night is over in seven instead of dragging on for half your evening.
- **Proper sunsets.** The sky takes its time going orange and coming back. The sun and moon cross the sky at the same steady pace as ever; it is the light that learned some manners.
- **Everything keeps time.** Monsters, burning zombies, beds, the night music, the torch glow and the Stage Door's moods all read the same new clock. A world saved at dusk loads at dusk.
- **Servers.** The server counts the same twenty minutes and agrees with every game about when it is night, so a bed vote opens the moment the sky is fully dark. A 6.31 server needs 6.31 games: the clocks would disagree otherwise. /time night now lands just inside the dark.

## Release 1.1 — Jump, then swing

*Game version 6.30, released 2026-10-13.*

- **JUMP, THEN SWING.** Critical hits are in. Hit something while you are falling and the hit does half as much again. A fist does 1.5. A diamond sword does a great deal more than that. Gravity has always been on your side; now it is on your side in a fight.
- **The rule.** You must be off the ground and on the way down. Not on the way up, not standing, not in water or lava, not riding anything, not sprinting, and not flying in creative. Jump, wait for the top, swing on the way down.
- **You will know.** A crit throws a burst of gold sparks off the target and makes a sharp bright sound instead of the usual thud.
- **Enchantments stack honestly.** The half is taken on the weapon itself; Sharpness is added on top afterwards, not multiplied.
- **On a server.** It works on other players too, and everyone nearby sees the sparks, whether you crit a friend or a zombie. Your friend also sees them, from closer than they would like.

## Release 1.1 — Names through walls

*Game version 6.29, released 2026-10-13.*

- **NAMES THROUGH WALLS.** Your friend walks behind a hill and their name walks behind it too, which is the exact moment you wanted to know where they went. A name tag is now drawn over everything. Mountains, castles, the casino: the name floats on top.
- **Dim means hidden.** With a clear line from your eye to their head the name is at full strength. Put something solid between you and it fades to about a third. So one glance tells you who is there and whether you can actually see them.
- **Glass does not count.** A window, leaves or a torch in the way is not a wall. Stone behind the window is.
- **Sneaking is for sneaks.** Hold Shift and your name dims for everyone, and behind a wall it is not drawn at all. Hide-and-seek works again. Ambushes also work again. We are sorry and you are welcome.
- **Cheap.** The game checks each player's line a few times a second, not every frame, and the dead and people in other dimensions stay hidden as before.

## Release 1.1 — Lava is not a wall

*Game version 6.28, released 2026-10-13.*

- **LAVA IS NOT A WALL.** You could look through water. You could not look through lava: the crosshair stopped on it as if it were a brick, so a block aimed at the far bank of a lava pool landed on top of the lava, and a block aimed INTO the lava went nowhere at all. Lava is a liquid. The game has been told.
- **Look through it.** The crosshair passes through lava, still or flowing, to whatever is behind it. Mobs see through it the same way, which is fair, because so do you.
- **Build into it.** Put a block where lava is and the lava is gone: a source is plugged for good, and what had run out of it drains away. Plug a stream and it runs round your block. Bridging a lava lake no longer needs a ritual.
- **Sand sinks.** Sand and gravel dropped onto lava fall through it to the bottom, as they do in water.
- **The bucket still works.** An empty bucket scoops the lava you are looking at. It is the one thing that does not look through it.

## Release 1.1 — Two buttons at once

*Game version 6.27, released 2026-10-13.*

- **TWO BUTTONS AT ONCE.** Your mouse has two buttons and the game could only count to one. Hold right to look down the rifle scope, press left to fire: nothing. The browser only announces the FIRST button you press; the second one arrives disguised as a mouse movement, and nobody was reading those. Somebody reads them now.
- **Scope and shoot.** Hold right, squeeze left, and the rifle fires with the scope still up. Let go of either button first; the other one stays held, the way a held button should.
- **Mine and use.** Keep the left button down on a rock face and tap right to open a door, place a block or eat a sandwich. The mining does not drop the beat.
- **A button held through a window stays quiet.** If a click opens a chest or a shop, that click is spent: closing the window with the button still down does not start digging a hole in the floor.
- **About doors and walking.** We also went looking for the door that would not close while you walk. The buttons were innocent: an open door refuses to shut while you are still standing in its doorway, because a shut door is a solid block and you would be inside it. Step clear and it closes. Whether that should change is the owner's call.

## Release 1.1 — Every torch counts

*Game version 6.26, released 2026-10-13.*

- EVERY TORCH COUNTS. Only the six torches nearest to you ever gave any light. Walk down a long tunnel and it went dark behind you, one torch at a time. Thirty torches in a room lit six torches' worth of room.
- Light now belongs to the world. A torch lights the blocks around it, a little less with every block, round corners and through doorways, and it stays lit whether you are next to it or a mile away.
- Lava glows. Glowstone glows. Alien lamps, burners and eyeball lamps glow. Put a block in a corridor and the light stops at it. Take the torch away and the dark comes back.
- There is no limit on torches any more. Light your whole base. Light your friend's base. Light a cave you never intend to visit again.
- The glow is warm, strongest at night and underground, and stands back in daylight. Mobs standing in torchlight are lit by it.
- Hyperreal uses the same light, and keeps its own few point lights for shine and shadows.

## Release 1.1 — Water finds its level

*Game version 6.25, released 2026-10-13.*

- WATER FINDS ITS LEVEL. Until today every drop of water was a whole block of it. Pour a bucket on a hill and you got a staircase of full blocks that never went away.
- Now liquids flow properly. A source spreads seven blocks, thinner as it goes, and the surface slopes. It runs toward the nearest drop, falls as a column, and spreads again where it lands.
- Take the source away and the stream runs dry, block by block.
- Two sources with a gap between them, on solid ground, fill the gap with a third. Infinite water is back on the menu. Lava does not do this, because that would be alarming.
- Lava flows too: slowly, three blocks in the Overworld, seven and faster in the Nether. It lights what it touches while Fire Tick is on.
- Water on a lava source is obsidian. Water on flowing lava is cobblestone. Lava falling onto water is stone. Build a generator. You know you want to.
- Running water washes away tall grass, flowers and torches (they drop), and pushes you, the mobs and anything lying in it downstream.
- A bucket only fills from a source, not from a trickle. Water poured in the Nether hisses and is gone.
- Old worlds load as they are. Every water block you already have counts as a source, so yesterday's puddles are today's permanent ponds.
- Server owners: this needs the 6.25 server. An older game and a newer server refuse each other.

## Release 1.1 — A face of your own

*Game version 6.24, released 2026-10-13.*

- A FACE OF YOUR OWN. The player is now a proper blocky figure that wears a skin: head, body, arms and legs, each with a second layer for hats, jackets and sleeves.
- Settings has a new row: Your skin. Pick a PNG, 64 by 64 (the older 64 by 32 works too), under 50 KB, and you are wearing it. Nothing is looked up or downloaded: it is your file, kept in your browser.
- No skin? You get the house one, painted fresh: the orange hoodie and charcoal trousers the game has always worn.
- On a server everyone sees your skin, and you see theirs. Players without one each keep a hoodie in their own colour, so you can still tell your friends apart.
- Armour, hats and held tools sit on the new figure as they did on the old one. The Hyperreal player is unchanged.

## Release 1.1 — Hands on the inventory

*Game version 6.23, released 2026-10-13.*

- HANDS ON THE INVENTORY. One click per slot was honest work. Now the mouse does what your hands expect.
- Hold a stack and drag left across empty slots: it is shared out evenly, and you watch the numbers as you go. Drag right: one item in each slot you cross, and another every time you cross it again.
- Double-click while holding a stack and every matching item in the window jumps onto it, part stacks first.
- Start a left drag on a slot that holds the same item and it gathers instead of sharing: every such slot you cross is pulled onto your cursor. With Shift, each is sent to the other side.
- Shift and drag with an empty hand: every slot you cross is quick-moved. Emptying a chest is now one sweep.
- The wheel: scroll down over a stack to send items out one at a time, scroll up to bring matching ones in.
- Over any slot: 1 to 9 swaps it with that hotbar slot, Q throws one, Ctrl+Q throws the stack. Click outside the window with a stack in hand to throw it (right click throws one).
- Creative: middle click gives a full stack of whatever you point at.
- Fixed along the way: right-clicking an enchanted item out of a slot used to quietly wipe the enchantment.

## Release 1.1 — The debug screen

*Game version 6.22, released 2026-10-13.*

- THE DEBUG SCREEN. F3 used to say five things. It now says where you are to three decimals, which block that is, which way you face, your chunk, your section and your spot inside it, the biome, how much memory the game is using, and the local difficulty.
- Local difficulty is counted the usual way: the longer a world has been played and the longer anyone has stood in a chunk, the higher it climbs. It is only a number for now. Nothing spawns by it.
- F3 + B draws a box round everything that has one: mobs, dropped items, vehicles, other players. Mobs and players get a little line showing which way they face.
- F3 + G draws the borders of your chunk, with a ring every 16 blocks up, and the corners of the chunks around it.
- F3 now acts when you let go of it, so the combos do not flick the screen on and off.

## Release 1.1 — Throw it and wait

*Game version 6.21, released 2026-10-13.*

- THROW IT AND WAIT. Press Q and the item used to bounce off the ground and straight back into your pocket, which made giving anybody anything a small comedy.
- Now the thrower waits 2 seconds before they can pick their own throw back up. Everybody else can grab it as fast as ever.
- Only throws count. What a broken block drops, what a mob leaves and what you spill when you die behave as before.
- On a server the server keeps the same clock, so nobody argues their way round it.

## Release 1.1 — Looking up from underwater

*Game version 6.20, released 2026-10-13.*

- LOOKING UP FROM UNDERWATER. Dive in, look up, and there used to be nothing: the surface of the water was only painted on its top side, so from below the lake had no lid.
- Water now has both sides. The surface is there from underneath, and the wall of a waterfall is there when you look out of it.

## Release 1.1 — No more tool swapping

*Game version 6.19, released 2026-10-13.*

- NO MORE TOOL SWAPPING. You could start a block with your good pickaxe, flick to an empty hand just before it broke, and let your bare knuckles take the wear. Or do it the other way round and borrow a diamond pick for the last tenth of a second.
- Not any more. Change the slot, or what is in your hand, and the block starts over with whatever you are holding now. The tool that breaks a block is the tool that did the whole job, and it pays for it.
- Mining without swapping costs exactly the time and the wear it always did.

## Release 1.1 — A server is a server

*Game version 6.18, released 2026-10-13.*

- A SERVER IS A SERVER. Open a server's address and the game you get is that server's game: Multiplayer, and nothing else to click by mistake. Create New World, Load World, Continue and Import World are gone from it.
- Single player has not gone anywhere. It lives in the game itself: the html opened from a file, or the desktop client. Same game, same worlds, same everything.
- One catch, and it is a real one: a browser keeps worlds per address. If you made single-player worlds at a server's address before, they are still in your browser, untouched, but that page no longer opens them. The server owner can switch the old page back on (singlePlayer in server.json) long enough for you to Export World.

## Release 1.1 — Every dimension

*Game version 6.17, released 2026-10-13.*

- EVERY DIMENSION. The server now runs the Nether and the Aether the way it runs the Overworld: its own mobs, water, fire, falling blocks, spawners and vehicles, saved with the world.
- Each dimension gets its own copy of the game on the server, woken the moment the first of you steps through a portal. Imps no longer depend on whose computer is nearest.
- Mobs stay in their dimension, and so do their save files: server owners will find entities/nether next to entities/over.
- Puppet Purgatory is still yours alone. It was built around one player's suffering and it would be rude to share.
- Server owners: each dimension somebody has visited since the server started costs about another 110 MB.

## Release 1.1 — The world remembers

*Game version 6.16, released 2026-10-13.*

- THE WORLD REMEMBERS. A server used to forget everything about its world that was not a block. Which villages had been found, which bosses were dead, what the stocks cost: all of it lived in each player's game and left when they did.
- Now the server keeps it. A village one of you finds is found for all of you, and is populated once. A dimension boss you kill stays dead for the friend who logs in tomorrow.
- ONE STOCK MARKET. The server runs it and everyone sees the same prices. Your shares and your balance are still yours. Yes, this means you can no longer both be right about the price of anything.
- Spawners are run by the server too, once, not once per bystander.
- What is yours stays yours: the Snail, your business with Malgorath, and your own paintings and songs now travel with your player. Until now a painting did not survive leaving the server. Sorry about that.
- Server owners: a new data folder in the world holds all of this, a readable file each.

## Release 1.1 — The server runs the water

*Game version 6.15, released 2026-10-13.*

- THE SERVER RUNS THE WATER. And the fire. And the sand. In the Overworld of a server that plays along, those are now the server's business and happen exactly once.
- Water: poured by you, flowed by the server. No more two games arguing about where the puddle ends.
- Sand and gravel: dig under it and the server drops it. Everyone watches it fall. Nobody gets a bonus sand item because three people were standing nearby.
- Fire: your fireball asks, the server lights. Everybody sees the flames, everybody standing in them regrets it, and each tree burns down once.
- Furnaces keep cooking when you walk away, when you log off, and when nobody is anywhere near them. One game cooks each furnace: yours while you have it open, the server's the rest of the time.
- Loot is rolled once. A chest the world already knows can only be changed by the player who has it open, so the next visitor's game can no longer refill a dungeon chest with treasure of its own invention.
- Other dimensions still do all this the old way.

## Release 1.1 — Everyone sees it fly

*Game version 6.14, released 2026-10-13.*

- EVERYONE SEES IT FLY. Arrows, bullets, grenades, lit TNT, a boss's rocks and fireballs, XP orbs: other players now see them in the air. Until now your friend's arrow was a rumour and a skeleton's was an injury with no warning.
- What you see is a copy. The real one still lives in the game that shot it, which alone decides what it hits. The copy looks the same and touches nothing.
- VEHICLES BELONG TO THE WORLD. On a server that runs its own game, a car, boat, plane, cart or skateboard you put down in the Overworld stays there for everyone, and is still there after a restart.
- Get on and it is yours for the ride, driven by your own game so it feels as it always did. If someone is already driving it you are told so. Get off and the server has it back.
- Break a parked car and it breaks for everybody, once, and drops one car. No more private parking.
- Server owners: the entities folder now lists vehicles next to the mobs and the dropped items.
- Still each player's own: vehicles outside the Overworld, and everything in Purgatory and at Malgorath's.

## Release 1.1 — The server runs the mobs

*Game version 6.13, released 2026-10-13.*

- THE SERVER RUNS THE MOBS. Until now a mob on a server lived in whichever player's game happened to be closest. Now the server plays the game too, without a screen, and every zombie, pig, villager, Nuke Keg and boss in the Overworld is its own.
- What you notice: mobs keep moving while you sit in a menu. They no longer hiccup when you and a friend swap places. A village has one set of villagers no matter how many of you walk in.
- Mobs are saved with the world. Stop the server, start it again, and the villager called Zorp is standing where you left him. Server owners can read the whole census in the entities folder.
- Spawn eggs, critter jars, spawners and the pig cannon all hand their mob to the server the instant it appears. The pig keeps its speed.
- A mob hits you through your own game, so your armour still counts and the death message still knows who did it.
- Server owners: this costs about 110 MB of memory. Set simulate to false in server.json to go back to the old way.
- Only the Overworld for now. The Nether, the Aether and Purgatory still work the old way, and so do arrows, vehicles and water. Those are next.

## Release 1.1 — The world is a folder

*Game version 6.12, released 2026-10-13.*

- THE WORLD IS A FOLDER. Server owners: the one big world file is gone. A world is now a folder you can open and read, laid out like a certain other block game: level.json, region, entities, playerdata.
- region holds the changed blocks, chests and furnaces, 512 by 512 blocks to a file, each file named after its place in the world. entities holds what is lying around in that region. playerdata has one file per player who ever joined: where they are, their health, hunger, spawn point and every slot of their inventory, one per line.
- Saving writes only the files that changed. A big world no longer rewrites itself in full every 30 seconds because somebody placed a torch.
- Your old world.vxw.json is converted on the first start and left where it was, untouched, in case you want it back.
- New command for operators: /export writes the whole world as one file again, for taking it back to single player.
- Nothing changes for players. This is the ground floor for the next step: the server running the world itself.

## Release 1.1 — Multiplayer, tightened

*Game version 6.11, released 2026-10-13.*

- MULTIPLAYER, TIGHTENED. Same server, fewer ways for it to let you down. Needs the 6.11 server: a 6.10 game and a 6.11 server politely refuse each other.
- Lost your connection? The game now tries to get back in by itself: five tries over about 25 seconds, and you come back where the server last saw you, not where you last saved. Kicks, bans and shutdowns are still final.
- A heartbeat every 2 seconds: the game notices a dead line in 12 seconds and the server gives up on a silent player after 20 (it used to be 45). Hold TAB to see everyone's ping.
- Other players now wear their armour where you can see it, in the right metal, and when they drive past you there is a car under them. Also boats, planes, carts and skateboards.
- You hear your friends dig. A block placed or broken by another player nearby comes with its sound and its dust. Water going about its business stays quiet.
- Villagers, Nuke Kegs, the dungeon boss, the Stone Titan and the Nether and Aether bosses are shared: everybody sees the same one and can hit it. A boss fights the player whose game is running it. A village no longer comes with one set of villagers per visitor.
- When a player leaves or drops, the mobs their game was running are handed to whoever is nearest. They used to vanish.
- The server compresses what it sends, and sends chests and dropped items for the area around you, not for the whole world. Joining a big world is quicker.
- Server owners: optional TLS (cert and key in server.json, then it is https and wss), an origins list for who may connect, and a limit on how fast any one player may send anything. Flooders are shown the door.
- Still each player's own: dragons, parked vehicles, what a boss throws at you, and the casts of Purgatory and Malgorath.

## Release 1.1 — Multiplayer

*Game version 6.10, released 2026-10-13.*

- MULTIPLAYER. Other people. In your world. On purpose.
- Main menu: Multiplayer. Type a server address, press Join Server, and you are standing next to your friends, who each get their own shirt colour and their name floating over their head.
- Shared with everyone: every block placed or broken (in every dimension), chests and furnaces, dropped items, chat, the player list (hold TAB), the time of day, sleeping through the night and the game rules.
- The server remembers you by name: your inventory, armour, XP, Dingle Bucks and where you were standing are all waiting when you come back.
- You can punch each other. Swords count, and so do arrows, bullets and TNT. The server checks you were actually close enough, and the server owner can switch the whole thing off, and probably will.
- Dropped items are real for everyone: throw your friend a sword, loot the pile where they died, and when two of you dive for the same diamond the server picks exactly one winner.
- MOBS ARE SHARED. The zombie chasing your friend is the same zombie you can see, hit and loot. Each ordinary mob (zombies, skeletons, boomers, spiders, pigs, cows, sheep and the Nether and Aether locals) is run by the game of whoever is nearest and goes after them, and quietly changes hands when someone else gets closer.
- Sleeping is a vote now: the night is skipped when everyone is in bed (the server owner picks the percentage). One person in pyjamas no longer decides for the group.
- Chests and furnaces are one player at a time. If your friend is in it, you are told so, and nobody's diamonds get eaten by a race.
- OPERATORS AND COMMANDS: the server owner can make players operators. Type / in chat: /tp, /give, /gamemode (per player), /time, /gamerule, /kick, /ban, /whitelist, /setworldspawn, plus /msg, /me, /list and /help for everyone.
- New players start at one world spawn, and on a server with operators the blocks around it are protected from everyone else.
- Death messages are written by the server and say what happened. You fell from a high place. You tried to swim in lava. You were slain by your so-called friend.
- Reconnecting after your wifi hiccups gives you your own name and inventory back instead of a stranger called You_2.
- Quietly better: big worlds join faster (the server sends the chunks around you and the rest as you travel), water is flowed by one game instead of all of them, and dropped items no longer age while the server is empty.
- Still your own: vehicles, bosses, dragons, villagers, the Purgatory and Malgorath casts and the AI players are played by each player's own game and are not shared yet.
- Hosting: the new server/ folder has the server (nothing to install, it needs only Node.js). On Windows, double-click Start Server.bat. It keeps the world, saves it every 30 seconds, hands the game to anyone who opens its address in a browser, and can host a world you exported from single player.
- THE AI PLAYERS HAVE LOGGED OFF. BunkerBrad, xx_lilcreepah_xx and honeybee_mc have left the building, taking their brain server, their grudges and their bunker with them. You have real friends now. Old worlds still load; the three of them are simply not in them. The chat box, the player list and the Player Compass stay, and the compass now points at actual people.
- Single player is otherwise exactly as it was. Server worlds never touch your saved worlds.

## Release 1.0 — Replays

*Game version 6.9, released 2026-10-09.*

- REPLAYS: the game keeps your last 30 seconds ready. Press F8 and it saves as an MP4 video, sound, records and paintings included. Turn it on or off in Settings.
- SCREENSHOTS: F2 saves a picture (PNG).
- First launch says hello: share your best moments on r/DanDingle.
- Main menu: Controls (just the controls now), an r/DanDingle button and a separate Credits screen.
- The menu music is half as loud, and Load World no longer shows a count.

## Release 1.0 (final cut)

*Game version 6.8, released 2026-10-09.*

- Final cut of Release 1.0. Two of the things that stalk the night have moved out for good, and the whispers come ten times less often.

## Release 1.0

*Game version 6.7, released 2026-10-09.*

- RELEASE 1.0. The proper one.
- A new title screen: a sharp 360 panorama of a real world, turning slowly on the spot like it should, with its own menu music (BATEHOVEN IS HALOUS).
- Create New World now has game rules: Keep Inventory, Mob Griefing, Peaceful, Fire Tick, The Eternal Snail, Guilt Ghosts, the Fullbright toggle, AI Players, the Dingle Store, Superpowers and Cheats. Cheats decide whether the debug menu exists at all.
- A warning on Create New World: worlds live in your browser, so clearing your history deletes them. Export often.
- Export World moved to the pause menu, right under Save World.
- Settings: Field of View, Mouse Sensitivity, Sound volume and Music volume sliders.
- Fixed the oldest bug in the game: picking something up now updates your hotbar straight away (and finally makes the pickup pop).
- First launch asks for your name. Type anything. Chat, the player list and the AI players all use it (change it any time in Settings).
- Right-click a saved world in Load World to change all of its game rules before you load it.
- No internet needed: everything the game needs is baked into the file now.
- Patch notes are retired. This is the last one. Enjoy it.

## Release 1.0 (second cut)

*Game version 6.6, released 2026-10-09.*

- Second cut of Release 1.0: the sharp, always-turning title panorama.

## Release 1.0 (first cut)

*Game version 6.5, released 2026-10-08.*

- First cut of Release 1.0. The same night, 6.6 made the title panorama sharp and keeps it turning.

## Release 1.0 Preview — Under New Management

*Game version 6.4, released 2026-10-08.*

- RELEASE 1.0. UNDER NEW MANAGEMENT. The purgatory theatre has changed hands. The new owners kept the building, let the entire cast go and hired the cheapest touring company they could find. It is now called Puppet Purgatory.
- Now headlining: THE DEMOLITIONIST (bomb suit, plunger, no hobbies), THE PIG (a very large pig with a very large ego) and, closing the show, THE MANAGEMENT.
- The supporting cast works for scale and nobody will tell you where it was hired. Go and meet them. Bring tomatoes.
- Your progress transfers to the new production. Kills, trunks, souvenirs and Programme ticks from older saves all load with the new names on them. Once a world has been opened in Release 1.0, keep it on Release 1.0.
- Elsewhere: the green walking bombs are now NUKE KEGS (gunpowder barrels on legs, same fuse, same crater). Mobs are now caught in a CRITTER JAR. The fortune ball is now a FORTUNE ORB with exactly the same attitude. The Gaming Rig now runs DEEP DIRT 2D, the cinema is showing ASTEROID ALLEY, and MALGORATH has a new title: THE WORLD-EATER.
- The Dingle Exchange now lists made-up companies only. Old portfolios were converted share for share, so nobody lost a diamond.
- Dan has a new outfit (orange and charcoal), and the zombies got new old clothes. In Hyperreal the aliens look like aliens again, and the boomers are walking powder kegs too: eye holes, a burnt grin, a fuse that spits sparks and a freshly packed gunpowder sac behind the chest doors.
- A few sound effects that only ever worked on one computer now use the in-engine versions for everyone.
- NEW TITLE SCREEN: the logo is big and proud, a floating island turns slowly behind it, and every button is chunky, clicky and works from the keyboard (arrow keys, Enter, Esc). Everything else got BIGGER too: the HUD, every menu, chat, the help book and these very patch notes. New in Settings: UI SCALE (Auto, 100%, 125%, 150% or 200%). Auto picks a size that suits your screen, and icons stay pixel-sharp at every size.
- Deleting a saved world now takes two clicks, and What’s New finally opens in front of the title screen instead of behind it. Toasts no longer land on top of whatever menu you have open, and F3 and the player list (hold Tab) keep out of the way of the boss bars, the chat and the compass.
- Under the hood: 3,773 checks (3,512 in the game suites, 261 in the tools), including test.js 69, smoke.js 221 (x6) and botsmoke.js 199 (x3). Every suite from the last release, an originality scan over every file, checks for every recast model, texture and old save, a privacy scan and a UI scale suite. All green.

## v6.3 — The Malgorath Update

*Released 2026-10-08.*

- v6.3 THE MALGORATH UPDATE. MALGORATH has been rebuilt from the bones up. Same address: X 1000, Z 1000. Different appetite.
- Whatever you remember about his arena, forget it. Something has taken a bite out of the world out there, and it is still chewing. Go and look over the edge. Then decide whether to poke anything.
- He is sixteen metres of hand-sculpted, wildly over-detailed demon in a world made of 16 pixel cubes, and the last world he ate is still stuck to his back. In Hyperreal he is now the most expensive-looking thing in the game by a distance.
- He is hard. Properly hard. Bring your best armour, your best sword and a lot of steak. In testing, a robot in full diamond with a Sharpness V sword beat him in eleven worlds out of twelve and died along the way in most of them. A robot in dragon armour that just stood there and swung lasted under a minute, every single time.
- He learns. So will you. When he kills you, you start again further along than you think.
- Beat him and he leaves you something to remember him by. It bites.
- Killed the old one in an old world? He remembers. He comes back anyway.
- If an old world of yours has anything built near X 1000, Z 1000, it has been cleared away. Anything that was in a chest there is waiting for you at the top of the stairs.
- Full disclosure: nobody here has heard a single note of his music or one of his sound effects. A computer measured every one of them (pitch, tempo, loudness, clicks) and swears they are horrible in the right way. Debug menu, Malgorath: sounds plays the lot. If anything sounds off, say so.
- Once a world has been opened in v6.3, keep it on v6.3. Older versions remember the old arena and do not know what he left you.
- Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack, purgatory and creativity suite, thirteen new Malgorath suites (540 checks, including a fight harness that proves a skilled player can win and a careless one cannot) and two new og_trace sessions proving the rest of the world has not changed. All green.

## v6.2 — The Creativity Update

*Released 2026-10-07.*

- v6.2 THE CREATIVITY UPDATE. You can now make art. Actual art, signed by you, one of a kind, hanging next to the hole a Nuke Keg left in your wall.
- EASELS. Craft one (a stick frame around a block of wool), put it down and right-click it. Pick a canvas: Square 64x64, Wide 128x64 or Tall 64x128. Then paint with 24 colours, a pencil, an eraser, a fill bucket, an eyedropper and three brush sizes. Right-click erases with any tool, Ctrl+Z undoes, and every tool has a keyboard shortcut for the professionals.
- Walk away whenever you like. The easel keeps your painting exactly where you left it, through saves, deaths and the occasional nuke. Break the easel and the unfinished canvas pops out so you can carry it to another one.
- Press Done, give it a title and you get THE painting. Not a copy: there is only ever one. Hang it on any wall (2x2, 4x2 or 2x4 blocks), take it down, move house, hang it again. It is the same painting forever, with crisp pixels in OG and in Hyperreal.
- RECORD PLAYERS. Craft one (stick, iron ingot, stick over three planks) and build a song on a step grid: up to six tracks of piano, bass, lead synth, pluck guitar, bells and a four-piece drum kit. Click a square for a note, drag right to hold it, Space to play. Tempo, bars, key, octave and volume are one click away. Every row is in C major, so you cannot play a wrong note. You can still write a bad song. That part is on you.
- Press Done and the record player presses a music disc. Also the only one in existence.
- JUKEBOXES. Eight planks around a diamond, as tradition demands. Put a disc in and it loops for everyone nearby, louder as you walk up and coming from where the jukebox actually is, while the background music politely steps outside. Right-click again to get your disc back. Break the jukebox and the disc drops. Nothing you make gets lost by accident.
- Paintings and discs survive everything: chests, deaths far from home, saves, the Nether, the Big Dingle and a trip to Puppet Purgatory (they wait in your trunk, the frog has no taste in art). Drop one on the far side of the map and it waits right where it fell. BunkerBrad, xx_lilcreepah_xx and honeybee_mc will admire your work from a respectful distance. They will not touch it. We checked.
- Full disclosure: nobody here has actually heard the music. A computer listened very carefully, swears every note is in tune and on time, decided the bells were too loud (turned down) and gave the kick drum enough punch for laptop speakers. If anything else sounds off, say so.
- One warning: once a world has been opened in v6.2, keep it on v6.2. Older versions do not know what a painting is and forget them when they save. If it happens anyway, the lost ones turn up as Lost Works instead of breaking anything.
- Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack and purgatory suite, seven new creativity suites (415 checks, including an offline ear that measures every note) and two new og_trace sessions proving nothing changes until you craft something. All green.

## v6.1 — Puppet Purgatory

*Released 2026-10-07.*

- v6.1 PUPPET PURGATORY. Somewhere in your world a door has appeared. Three headliners, one way out. Tune the structure compass to Stage Door, or survive 10 minutes.
- There is a frog on a stool beside it. It wants an empty hand. Everything you carry waits outside in a trunk with your name on it. BunkerBrad, xx_lilcreepah_xx and honeybee_mc go in with nothing too, and they want out as badly as you do.
- Inside is a whole new dimension: new ground, new ores, new tools, new food, new crafting, new monsters. Nothing from your world works in there, and nothing from in there comes home except three souvenirs.
- You are handed a Programme. Right-click it. The printed copy is very cheerful. Trust the handwriting in the margins.
- The Demolitionist, the Pig and the Management are headlining. Beat all three and find the EXIT. It is through the audience.
- Works in both texture packs: OG gets the full licensed-PC-game-from-1997 treatment, Hyperreal gets the flash photographs. The file is now about 40 MB.
- Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), every texture-pack suite, ten new purgatory suites (over 1,000 checks) and a pilot that plays the whole thing from the door to the EXIT in about 31 minutes without a single free item. All green.

## v6.0 — Hyperreal

*Released 2026-10-06.*

- New in Settings: TEXTURE PACK. OG is the game you know, 16px, exactly as it was. HYPERREAL replaces every block, every light and most of the living things with photoreal versions. The world was not consulted.
- BLOCKS. Grass, dirt, stone, every ore, logs, planks, leaves, sand, snow, ice, glass, cactus, TNT, crafting tables, furnaces, chests, doors, beds, torches, wool, the Nether blocks and more are now high-resolution PBR materials with real bumps and real roughness. Every terrain block is turned at random so the ground never tiles. Leaves and flowers are cut out properly, water is see-through and catches the light at low angles, ice is glassy, and lava, torches and glowstone actually glow. Anything without a photoreal version yet keeps its OG pixels, lit by the new lights.
- LIGHT. A real sun and moon cast real shadows that follow you around, under a proper sky: golden hour, an orange sunset, a purple dusk and starlit nights. Torches, lava and glowstone throw actual light and flicker. Caves are dark until you light them. The Nether glows red, the Aether is blinding, underwater turns teal and murky, and the arena of MALGORATH is now graded in ash and embers. Bloom, ambient occlusion, haze, filmic tone mapping and anti-aliasing do the rest.
- THE CAST. Zombies, skeletons, boomers, spiders, pigs, cows, sheep and villagers have been replaced by the Hyperreal cast. They are not low-poly and they are not sorry. Heads turn to follow you. A zombie swing lands on the exact frame it hurts you. Skeletons draw and release with the arrow. Boomers swell and strobe before they go. The hurt flash only lights up the mob you actually hit.
- CORPSES. Mobs no longer vanish in a puff the instant they die. They die. The whole death animation plays out, the body lies there for a respectful moment, sinks into the ground, and THEN it is a puff. Up to eight bodies at a time; the oldest one leaves to make room. Drops and XP are exactly the same as before.
- YOU. In third person you are now Dan, in more detail than anyone asked for, still wearing your hat and armour and still holding your tools. In first person an empty hand is THE FIST: swollen, and very much yours. It bobs when you walk, jabs when you punch and throws splinters when you punch a tree. Hold a block and you are holding a real photoreal cube.
- BunkerBrad, xx_lilcreepah_xx and honeybee_mc got bodies to match. Same minds, same grudges, considerably more skin. When they die they leave a body like everybody else, then respawn just as Hyperreal.
- HYPERREAL QUALITY sits right under the pack switch: Auto, Low, Medium, High or Ultra. Auto picks Medium on a normal computer and Low on touch screens. High and Ultra are opt-in for machines that enjoy suffering: bigger shadow maps, more lights, ambient occlusion and film grain. The first switch takes a few seconds while the textures unpack, and you can switch back and forth mid-game.
- OG IS UNTOUCHED. Not basically the same: identical. One test plays the same 600-frame session on the old code and the new code and compares them every 40 frames. Another renders a frame, goes to Hyperreal and back, renders it again and checks that every pixel matches. The HUD, the inventory icons, figurines and particles stay 16px in both packs, on purpose.
- Fair warning: the game file is now about 31 MB, because every texture lives inside it, and Hyperreal needs WebGL2. If your browser cannot do it, the option says so and OG carries on as normal.
- Under the hood: test.js 69, smoke.js 221 (x6), botsmoke.js 199 (x3), plus 614 new texture-pack checks in 9 suites (contract 97 + 55 (x2), blocks 46 + 62 (x2), light 49 + 80 (x2), cast 101 + 93 (x2), OG trace 31). All green.

## v5.9 — Other Players

*Released 2026-10-06.*

- You are not alone any more. Three AI players now live in your world as if it were a real server: BunkerBrad (convinced everything is out to kill him, builds bunkers, moats, sky bases and traps), xx_lilcreepah_xx (steals, griefs and blows things up, and takes it VERY personally when it happens to him) and honeybee_mc (just wants a lovely flower-filled town where everyone gets along). They each have their own goals, memories, grudges and friendships, and they decide for themselves what to do next.
- They play by EXACTLY your survival rules. They join a new world with nothing, punch trees, craft planks, sticks, a crafting table and a wooden pickaxe, mine stone for stone tools, dig for coal and iron, smelt ore in real furnaces, and build only with blocks they actually carried there. Tools and armour wear out and break, stone without a pickaxe gives nothing, they get hungry and only heal when fed, they can’t reach through walls, and when they run out of cobble halfway up a wall they have to go and get more. Every torch, door, bed, chest and stick of TNT was mined, smelted or crafted the hard way, and nobody else’s furnace or chest is a free shop (the one mercy: a filled Water Bucket never runs dry for them).
- They place every single block themselves, so their houses look exactly as good (or bad) as they manage. They fight mobs, set up homes, raid chests, light TNT and hold grudges. PvP and griefing are on for everyone, including against each other. Ask one to team up and it is genuinely their call. Declare war and they will remember.
- Press T (or Enter) to talk in server chat, / for commands: /msg &lt;player&gt; to whisper, /think &lt;player&gt; to read their mind, /bots to see who is online, /help for the rest. Hold TAB for the player list. New PLAYER COMPASS (you are handed one when they join; craft more from 4 iron around 1 gold): right-click to cycle through players, sneak + right-click to go back, and it points to them with the distance and height. honeybee_mc is also collecting nine NEW FLOWERS that now grow in different biomes.
- Their minds run on Claude through a small local brain server (double-click "Start AI Brain.command" in the game folder - it opens the game for you). Without it they play on a simple survival autopilot and cannot chat; the game now says so in chat and shows an "AI players: autopilot" badge until the brain is connected (/brain shows the status). New worlds have them switched on; for older worlds use /bots join or the AI Players rule in the Debug Menu.
- Fix: mouse look no longer randomly snaps sideways. Some browsers occasionally report one giant bogus mouse movement while the pointer is locked (especially right after closing chat); the game now ignores those spikes.

## v5.8 — Slow-Mo Studio

- New GAME SPEED slider in the Debug Menu (1x down to 0.1x). Turn it down and the whole world runs in slow motion for capturing clean footage — and it slows and smooths your mouse look by the same amount, so when you speed the recording back up in editing it looks like normal 1x gameplay. Default is 1x, full speed.
- Also a GUILT GHOSTS toggle: switch it off and slain mobs will not come back to haunt you, and any that are already lurking are sent packing.

## v5.7 — Hold Still

- New FREEZE ALL MOBS toggle in the Debug Menu. Flip it on and every mob — pigs, zombies, bosses, all of them — stops dead where it stands: no walking, no attacking, no falling, frozen mid-stride until you switch it back off. They can still be hit and killed while frozen; they just cannot do anything about it.

## v5.6 — One Hit Wonder

- New INSTANT KILL toggle in the Debug Menu. Flip it on and every hit you land drops a mob on the spot — does not matter if it is a gun, a sword, a pickaxe, an arrow, the boomerang, or your bare fist. One touch, one kill. Turn it off to go back to earning it.

## v5.5 — Quieter Toggles

- Switching game mode, toggling X-Ray, and cycling the camera view (F) no longer pop a toast message on screen. The change is obvious the moment it happens, so the notifications were just noise. Everything still works exactly the same, just without the announcement.

## v5.3 — Into the Void

- The AETHER has no floor, so anything that falls off an island now vanishes into the void the way it should. Mobs, skateboards, cars, boats, planes, and dropped items that tumble into the abyss poof into cloud instead of piling up invisibly at the bottom of the world. You still get bounced back to the overworld when YOU fall off. The rest is lost to the clouds.

## v5.2 — Undead Vacation

- ZOMBIES and SKELETONS no longer burn in the daylight of the AETHER. The sky islands are bright, but their light does not smite the undead — the rotting and the bony can now wander the clouds in peace. Sunburn is still very much a thing back in the overworld.

## v5.1 — Mercy Settings

- THE ETERNAL SNAIL now has an OFF switch, tucked in the Debug Menu with the other game rules. Flip it and he vanishes on the spot and stays gone. Flip it back if you miss him. He will not judge you. He will simply return.
- JUMPSCARES are now OFF by default (chance-per-frame set to 0). If you want them back, the slider is right where it always was, in the Debug Menu. Existing worlds keep whatever you last set.

## v5.0 — THE BIG DINGLE

- You can now craft a NUCLEAR BOMB. It is called The Big Dingle and it is a mistake by design: 4 TNT, 2 diamonds, 2 gunpowder, glowstone core. Air delivery only — craft the PROP PLANE (5 iron + glass), place it, hop in, and fly with W to throttle, A/D to bank, and your own eyes to climb: it goes where you look.
- Right-click with the bomb while flying to let go. Then a 20 second countdown, sirens included, and then: catastrophic, unimaginable damage. A crater to the VOID — yes, through bedrock — across a huge area. Everything alive within EIGHT CHUNKS dies. The mushroom cloud is visible from everywhere and lingers for a minute and a half. The crater is permanent. It survives saving, loading, and your regret.
- The only block that says no: BUNKERCRETE (3 stone + iron, makes 8) and BUNKER GLASS (bunkercrete + glass, makes 4). Seal yourself in completely — floor, walls, roof, no gaps — and the blast cannot touch you. One missing block and it can. The snail also survives. The snail always survives.

## v4.2 — Snail Mobility Assessment

- THE ETERNAL SNAIL has completed climbing school. He now pillar-jumps upward when you are above him, placing his own blocks beneath himself, and digs straight down when you are below. Altitude first, then the closing walk. He no longer wastes time building above you - every block he places is a step toward you, never past you.

## v4.1 — Horror, Director's Cut

- Jumpscares play their in-engine sounds on every computer, so everybody gets the same fright.

## v4.0 — THE HORROR UPDATE

- THE ETERNAL SNAIL is here. He is slow. He is patient. His only purpose is to touch you, and his touch is instant death. He breaks walls when he must, builds bridges when he needs to, follows you across every dimension, and if you outrun him he simply... reappears. Fifty blocks away. Walking. There is no hiding. There is no killing. There is only distance, temporarily.
- JUMPSCARES: every single frame now has a configurable chance (default 1%) of a gnome greeting you at considerable volume, a sudden bass drop from nowhere, or THE MASCOT. All art and sounds are original and hand-made, which somehow makes it worse. The slider is in the Debug Menu: 0% for cowards, 100% for content creators.
- GUILT: 10% of your kills now come back as a translucent ghost of the exact mob you killed, following you for a full minute saying things designed to make you feel bad. They cannot hurt you. That was never the point of them.
- NEW HORRORS stalk the night and the deep: a tall pale thing that only moves when you are not looking, and something fast in the caves that freezes in torchlight. Neither can be killed. Sleep well.
- There are also things in this update we are not going to tell you about. You will know when you know.

## v3.5 — THE GRAB BAG UPDATE

- LIVING BLOCKS: one in every 500 blocks does not consent to being mined. It sprouts legs, bursts into tears, and runs. You monster. (Killing it returns the block. Still a monster.)
- FISHING: craft a rod (2 sticks, 2 string), cast into water, wait for the dip, reel within the window. Fish cook in the furnace. There is also a REVERSE FISHING ROD (rod + gunpowder, or a rare catch) which reels YOU in. We are not fixing this. It is genuinely great for water travel.
- SNAKES roam the grass, hunting dropped apples - every apple makes them one segment longer. Eating an apple yourself makes YOU bigger for 25 seconds: taller, harder-hitting, higher-jumping. The snakes knew all along.
- MOB FIGURINES: every kill has a 5% chance to drop a figurine of the victim. Display them on a SHELF (planks ring) or in a JAR (glass + plank). Boss figurines exist. They rotate. Slowly. Menacingly.
- GUARD TURF: craft militarized soil (dirt + string + gunpowder) and plant it: roses shoot, dandelions heal, cacti maul, tall grass slows the horde. Any resemblance to other botanical defense programs is purely coincidental.
- DINGLE CINEMA (store, 3999 DB): place the kit and a whole cinema assembles itself. Three original films - and pressing E puts YOU inside the movie as the lead. Win for popcorn.
- FORTUNE ORB (obsidian + wool): right-click to consult. Twenty answers, all unhelpful in the correct way.

## v3.4 — Mandatory Mantling Seminar

- CLIMBING CLAWS fixed: reaching the top of a block no longer leaves you bobbing at the lip like a confused seal. Once your chest clears the edge you now pop up and over onto the ledge. Hold W, climb, arrive.
- Hang Glider reminder, since people asked: keep it in your inventory, fall off something tall, HOLD SHIFT, steer with your face.

## v3.3 — Applied Bounce Physics

- NEW BLOCK: the TRAMPOLINE. Craft it from 3 string over 3 planks, place it, and every fall becomes a bigger bounce (up to a serious amount of air). Sneak to land softly. Landing on one never hurts, even sneaking.
- Mobs bounce too. Indefinitely. Build a zombie bounce pit. We cannot legally stop you.
- Not to be confused with the Pocket Trampoline gadget, which is for people who bring the bounce with them.

## v3.2 — Boss Attendance Review

- FIXED: INFERNIS and VALKYRA sometimes clocked in, noticed you were more than 64 blocks away, and clocked straight back out — permanently. Dimension bosses now spawn only when you actually arrive, are immune to distance-despawning, and RESPAWN on every visit until you genuinely kill them. Fortresses you already looted will have their boss waiting when you return.
- Boss kills are now recorded per-fortress and per-shrine in your save. Slaying stays slain.

## v3.1 — Ocular Upgrade Program

- LASER EYES have been through the lab: the beam is now thick, white-hot with a red glow, holds steady instead of strobing, has an actual laser sound, hits for triple damage, and VAPORIZES THE FIRST BLOCK IT TOUCHES about eleven times per second. Bedrock and portals are immune. Nothing else is.
- Yes, it is slightly overpowered. That is a design decision and we stand behind it from a safe distance.

## v3.0 — THE DIMENSIONS UPDATE

- THE NETHER: a roofed hell of netherrock, soul sand, glowstone and a lava sea. Build a 4x5 OBSIDIAN frame and light it with a TORCH. Home to nether fortresses, imps, hellhogs, and INFERNIS, THE MOLTEN DUKE.
- THE AETHER: islands in a bottomless sky. Build the frame from GLOWSTONE and pour a WATER BUCKET into it. Shrines, cherubs, and VALKYRA OF THE HIGH ISLES await. Fall off and you are returned to the overworld — from very, very high up.
- BUCKETS: craft from 3 iron. Scoop and pour water and lava. Water + lava = OBSIDIAN, which is also how you get portal frames. Overworld caves now bottom out in lava lakes (existing worlds get them too in unexplored terrain).
- TEN GADGETS hide in dimension dungeon chests and boss drops: Double-Jump Boots, Jetpack, Grappling Anchor, Hang Glider, Loot Magnet, Climbing Claws, Pocket Trampoline, Blink Pearl, Anti-Gravity Belt, and the Pig Cannon, which fires one (1) live pig. Passives work from your inventory; actives fire on right-click while held.
- Every gadget renders as a real 3D model in your hand (CC-BY 3.0 models by Poly by Google and Roman Miller, plus a CC0 cannon by Quaternius; see Help for credits).
- One world, three dimensions, one save file. Old worlds upgrade in place.

## v2.13 — The Consumer Rights Update

- The Battle Pass can now be PAUSED. Click its button in the DINGLE STORE (it says PAUSE once owned) to stop the dirt deliveries; click again to resume. This is the most player-friendly battle pass in the industry and we are already regretting it.

## v2.12 — The Totally Legitimate Mining Update

- NEW debug tool: X-RAY. Everything goes ghost-transparent except diamond ore, which stays solid and judgmental. Toggle it in the Debug Menu or with [ + X.
- Geology lesson: diamonds in DINGLECRAFT spawn at a FLAT rate everywhere below y=14, so any depth from y=1 to y=13 is equally good. Branch-mine around y=6 and thank us in the comments.
- X-Ray is a debug cheat: it is not saved, and your dignity does not survive the reload either.

## v2.11 — The Quality of Life Update

- Patch notes are now a scrollable archive of every update from here on. You are reading the archive right now. Meta.
- NEW Settings toggle: Mouse Capture. Turn it OFF and the browser stops flashing its “press ESC to show your cursor” note entirely — you aim by moving the mouse over the game instead. (That banner belongs to your browser, not us; this is the one legal workaround.)
- Help & Controls can no longer be escaped from. You will read the controls and you will be grateful. The Close button remains available to quitters.
- DINGLECRAFT releases now ship as separate files per version, so last night’s build keeps working while the next one is cooking.

## v2.10 — DEEP DIRT 2D: Dirt Harder

- DEEP DIRT 2D got its Big Content Patch: bigger worlds with TREES, a real hotbar (dirt/stone/wood/planks/brick/torch), CRAFTING (press C — planks, torches, brick, tool tiers), pick progression that actually speeds up mining, a gold sword, cave BATS, slime loot drops (hearts! ore!), fall damage, particles, cracking blocks, parallax hills, drifting clouds, starfields and torch glow. Collect 15 ore and craft the GOLDEN DINGLE to win.
- Old DEEP DIRT 2D saves still load. Your dirt is safe. Your dirt was always safe.
- Jumping in DEEP DIRT 2D no longer makes your actual body jump. The two of you are separate people now; the therapist said it was for the best.

<!-- manual:older -->
## Before v2.10

The in-game archive starts at v2.10. The earlier releases, in short:

- **v1.0 to v1.6:** the core sandbox, then weapons and guns, cars, doors, skateboards and tricks, disasters and the stock
  market (the PC block), then aliens, villages, romance dialogues and the mob-catching jars.
- **v1.7:** THE DINGLE CASINO (slots and blackjack) and profit and loss for every stock.
- **v1.8:** roller coasters, generated theme parks, and disasters you can make permanent and pick yourself.
- **v1.9:** egg-summoned mega-dungeons, mob spawners, XP, enchanting and the Warden. **v1.9.1:** beds, darker nights,
  fullbright.
- **v2.0:** flowing water, climbing out of water, the surf ollie, inventory sort, the death marker, armour, boats,
  tameable rideable dragons, buried dungeons and spawner vaults, the DINGLE STORE (DingleBucks, hats, trails and joke
  items), six superpowers, Dragon King roosts and the summonable Stone Titan.
- **v2.1:** the first MALGORATH: a fixed arena at X 1000, Z 1000, a letterboxed cutscene, a three-phase fight and the
  YOU WIN screen. (He was rebuilt from scratch in v6.3.)
- **v2.2:** the structure compass. **v2.2.1:** render distance up to 32.
- **v2.3:** spawn eggs for every mob, and the walking nukes (Nuke Kegs since Release 1.0). **v2.3.1:** the debug menu and per-world game rules.
- **v2.4 to v2.9:** not recorded here.
<!-- /manual:older -->
