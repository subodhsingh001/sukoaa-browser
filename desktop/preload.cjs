// SPDX-License-Identifier: GPL-3.0-or-later
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("aegis", {
  platform: process.platform,
  command: (name, arg) => ipcRenderer.invoke("command", name, arg),
  onState: (cb) => ipcRenderer.on("state", (_e, state) => cb(state)),
  onFocus: (cb) => ipcRenderer.on("focus-address", (_e, request) => cb(request)),
  onClosePanel: (cb) => ipcRenderer.on('close-panel', cb),
});
