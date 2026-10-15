# The DINGLECRAFT server window

The multiplayer server as a desktop program: a window with buttons instead of a terminal. It is an
[Electron](https://www.electronjs.org) app that runs the same server that lives in [`../server`](../server/README.md); that
server is not changed, and its terminal form (`Start Server.bat`, `start-server.sh`) works as it always did.

**One window for every server version (1.0).** The window carries no server of its own. You import a game release's
`DINGLECRAFT-Server-v<version>.zip` (as downloaded, or unpacked) into its library of **server versions**, and each server
in the list picks the version it runs. Different servers can run different versions at the same time, and a new game
release needs no new window: import its Server zip and switch the server to it. Any version from 6.41 on works (6.41
added the `--ipc` mode the window drives). The window has its own version (`package.json`) and its own release
(`server-gui-v<version>`), made only when the window itself changes.

## Install it (Windows)

Download `DINGLECRAFT-Server-Setup-<version>.exe` from the window's release (tagged `server-gui-v<version>`) or from the
latest game release, and run it. That is all: no Node.js, no terminal. The exe is not signed, so the first time Windows
SmartScreen says it protected your PC: click **More info**, then **Run anyway**.

## Run it from source (any system)

It needs [Node.js](https://nodejs.org) 20 or newer to install; after that it runs on Electron's own Node. Unzip
`DINGLECRAFT-ServerGUI-v<version>.zip` (or use this folder in a checkout), then:

```sh
npm install     # once: downloads Electron
npm start
```

`npm start -- --data <folder>` adds that folder to the list as a server. New servers live in the program's own user-data
folder (the Dashboard shows where, and has a button to open it).

## What is in the window

The layout follows the server managers people already know: your servers down the left, the one you picked on the right.

- **The list (left):** every server with a dot for running, starting or stopped, its port, how many are online and its version. **New server** makes one with its own folder and the first free port; **Add existing folder** adopts a data folder you already have (the terminal server's `data/`, say). Removing one from the list leaves its folder alone.
- **New server (1.1):** a name and a **version** from a drop-down: the versions already here, and the ones on the game's GitHub releases page (marked "download"). One that is not here yet is downloaded, checked against the fingerprint GitHub publishes for it, and imported before the server is made. The refresh button next to it asks GitHub again. (1.1.1) The versions are grouped under the name they were released as ("DingleCraft Multiplayer 2.0", "Release 1.1"), each with its own title and marked release or beta; the versions already here carry the name their game file gives. The window goes online only for this (the list is kept for ten minutes); `DC_RELEASES_REPO=owner/name` points it at a fork's releases.
- **Server versions (left, below the list):** every imported version and how many servers use it. **Import a .zip** takes `DINGLECRAFT-Server-v<version>.zip`; **Import a folder** takes one unpacked. Importing a version that is already there replaces it (not while a server runs it). A version nobody uses can be removed.
- **The header:** the **Version** the picked server runs (changed while it is stopped; moving to an older version than the newest that has run the world asks first, as an older server may not read what a newer one wrote), then Start, Stop (saves first), Restart, and Kill (ends it at once, without saving). Several servers can run at once, each on its own port.
- **Dashboard:** status, players, memory and world as cards; the addresses to give players (with Copy) and Open in browser; which dimensions the server is running a game for.
- **Console:** the log, and a box for commands (the same ones operators type in the game). Up and Down recall earlier commands.
- **Players:** who is online, where, and buttons to kick, ban, op or deop, and teleport one player to another. Below them the **accounts**: add one, set a new password, rename, lock, give a skin, remove. Passwords are not shown: from server 6.61 on they are kept as hashes nobody can read (1.2.1 dropped the Show passwords box, and masks a typed password in the console). The answer to each change shows under the form, so a password the server turns down (its **Enforce password security** setting) says why right there.
- **Settings** and **Game rules:** `server.json` as two forms, as the server's own version knows them: the settings and rules that version has, checked by that version before they are written, and the window says which changes need a restart. From game version 6.58 the server describes every setting and rule itself (`formSchema` in its `lib/admin.mjs`: label, kind, limits, group), so a setting or rule a later version adds appears with its own name and limits, in its own group, with no new window. An older server is shown with the window's own list, and anything a server has that nothing describes still appears, under its own name.
- **Worlds:** the worlds in the data folder, switch world, make a new one (name, seed, mode, difficulty).
- **World files (1.2):** the region and entity files of a world (6.60 packs them; older ones are JSON) with their size and what is in them: chunks, changed blocks, chests, dropped items, mobs, vehicles. Click one to see it as tables with names (what each chunk's blocks were changed to, what each chest holds, every mob with its place and health) or as the JSON it stands for, and **Save as JSON...** to keep a copy. **Search** finds a block, item or mob by name, part of a name, `#id` or mob type across every file, or only the ticked ones, including what each player carries; Blocks, Items, Mobs and Players narrow it, and a hit's file opens with a click. The files are read as the server last saved them: **Save the world now** (while it runs) saves first. Reading them needs a server version from 6.60 on in the library (the newest one there is used for a server on an older version).
- **Backups:** Back up now (a running server saves first), and every dated copy under `backups/` with Restore (the world as it is now is kept as a backup first, so a restore can be undone) and Delete.
- **Scheduler:** every so many minutes, back up the world (keeping the newest N), restart the server, or run a command. Tasks run while that server runs, counted from when it started.

Closing the window with a server running asks whether to stop everything or keep running in the tray. The list of servers (each with its version) and their tasks is `servers.json` in the program's own user-data folder, the imported versions are under `versions/<version>/` beside it; each server's settings stay in its own data folder. A list from before 1.0 of the window gets the newest imported version for every server.

Run from a checkout of the repository, the window also offers the checkout's own `server/` as a version called
"this checkout" (it hands out the newest build in `dist/`).

## How it works

`main.js` starts each server from its version's folder as a child process with Electron's own Node (`ELECTRON_RUN_AS_NODE=1`) in its `--ipc` mode
([`server/lib/admin.mjs`](../server/lib/admin.mjs)): the server reports status, log lines and players over the fork
channel and takes commands the same way. Nothing is read off its output. A server that crashes cannot take the window
with it, and the window can start it again. Settings are checked with that version's own `lib/admin.mjs`, and the World files tab reads with its `lib/region.mjs`. `lib/store.cjs` is the file
handling (the server list, the versions library, settings, worlds, backups, scheduled tasks), kept apart from Electron so the test
suites can run it; `lib/zip.cjs` reads a release zip.

The window and a server talk only through the `--ipc` messages listed at the top of `server/lib/admin.mjs`. Keep those
working the same way (add, do not change), and every window keeps working with every newer server.

## Build the Windows program (.exe)

`npm run dist` builds the installer (`out/DINGLECRAFT Server Setup <version>.exe`) and a portable exe
(`out/DINGLECRAFT-Server-portable.exe`) with electron-builder (the settings are in `package.json`). That has to be run on
Windows (or anywhere with Wine): unzip `DINGLECRAFT-ServerGUI-v<version>.zip`, `npm install`, `npm run dist`. The exe
carries no server: it downloads or imports one as above. `npm run package:gui` at the top of the repository makes that zip.
The owner builds the released installer this way on Windows (1.1.1 was the first published, attached to its release as
`DINGLECRAFT-Server-Setup-1.1.1.exe`, and to DingleCraft Multiplayer 2.0). The exe is unsigned, so Windows SmartScreen will warn the
first time it is started. It has the default Electron icon: the picture in this folder is called `tray.png` because the
builder takes any `icon.png` here as the program's icon and refuses one smaller than 256 x 256.
