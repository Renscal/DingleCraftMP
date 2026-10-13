// preload.js: the only door between the window's page and the program. The page gets window.dc and nothing else of Node.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (name) => (...a) => ipcRenderer.invoke(name, ...a);
contextBridge.exposeInMainWorld('dc', {
  servers: call('servers'), addServer: call('server:add'), adoptServer: call('server:adopt'), removeServer: call('server:remove'),
  state: call('state'), start: call('start'), stop: call('stop'), kill: call('kill'), restart: call('restart'), command: call('command'),
  readSettings: call('settings:read'), saveSettings: call('settings:save'),
  worlds: call('worlds'), newWorld: call('world:new'), useWorld: call('world:use'),
  backups: call('backups'), backupNow: call('backup:now'), restoreBackup: call('backup:restore'), deleteBackup: call('backup:delete'),
  saveTask: call('task:save'), deleteTask: call('task:delete'),
  openData: call('open:data'), openBrowser: call('open:browser'), copy: call('copy'),
  on: (what, fn) => ipcRenderer.on(what, (_e, v) => fn(v)),
});
