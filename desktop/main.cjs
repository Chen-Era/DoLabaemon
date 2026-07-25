'use strict';

const path = require('node:path');
const { app, BrowserWindow, dialog, session, shell } = require('electron');
const {
  isSafeExternalUrl,
  isSameOriginNavigation,
  resolveServerUrl,
} = require('./url-policy.cjs');

// Must be enabled before the app is ready so every renderer is sandboxed.
app.enableSandbox();

let mainWindow;
let serverUrl;

function denyPermissions() {
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function openSafeExternalUrl(url) {
  if (!isSafeExternalUrl(url)) {
    return;
  }

  void shell.openExternal(url).catch(() => {
    // The operating system owns the external browser. A failure must not fall
    // back to navigating the trusted application window.
  });
}

function protectWebContents(contents, trustedUrl) {
  contents.setWindowOpenHandler(({ url }) => {
    openSafeExternalUrl(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isSameOriginNavigation(url, trustedUrl)) {
      event.preventDefault();
    }
  });

  contents.on('will-redirect', (event, url) => {
    if (!isSameOriginNavigation(url, trustedUrl)) {
      event.preventDefault();
    }
  });

  contents.on('will-frame-navigate', (event, url) => {
    if (!isSameOriginNavigation(url, trustedUrl)) {
      event.preventDefault();
    }
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

function createMainWindow(trustedUrl) {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      enableWebSQL: false,
      devTools: !app.isPackaged,
    },
  });

  protectWebContents(window.webContents, trustedUrl);

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });

  void window.loadURL(trustedUrl.href).catch((error) => {
    dialog.showErrorBox(
      'Unable to open Dorlabaemon',
      `The configured service could not be reached.\n\n${error.message}`,
    );
  });

  return window;
}

function start() {
  try {
    serverUrl = resolveServerUrl({ isPackaged: app.isPackaged });
  } catch (error) {
    dialog.showErrorBox('Invalid server URL', error.message);
    app.quit();
    return;
  }

  denyPermissions();
  mainWindow = createMainWindow(serverUrl);
}

app.whenReady().then(start);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
    mainWindow = createMainWindow(serverUrl);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
