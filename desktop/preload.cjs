'use strict';

const { contextBridge } = require('electron');

// Deliberately expose no IPC or Node.js APIs to the remotely hosted renderer.
// The marker is safe to use for small UI adaptations, while the sandbox and
// context isolation keep the Electron environment out of page JavaScript.
contextBridge.exposeInMainWorld(
  'dorlabaemonDesktop',
  Object.freeze({ isDesktopClient: true }),
);
