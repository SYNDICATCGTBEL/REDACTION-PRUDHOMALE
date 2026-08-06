const { app, BrowserWindow, dialog, ipcMain, shell, clipboard, Menu, utilityProcess } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs/promises');
const { buildDocxBuffer, safeFileName } = require('./document-export');

let updateState = { status: 'idle' };

function configureUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => { updateState = { status: 'available', version: info.version }; });
  autoUpdater.on('update-not-available', () => { updateState = { status: 'current' }; });
  autoUpdater.on('update-downloaded', info => { updateState = { status: 'downloaded', version: info.version }; });
  autoUpdater.on('error', error => { updateState = { status: 'error', message: error?.message || 'La vérification a échoué.' }; });
}

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) return { status: 'development' };
  try {
    updateState = { status: 'checking' };
    await autoUpdater.checkForUpdates();
    return updateState;
  } catch (error) {
    return { status: 'error', message: error?.message || 'La vérification a échoué.' };
  }
});

ipcMain.handle('download-update', async () => {
  if (updateState.status !== 'available') return updateState;
  try {
    updateState = { ...updateState, status: 'downloading' };
    await autoUpdater.downloadUpdate();
    return updateState;
  } catch (error) {
    return { status: 'error', message: error?.message || 'Le téléchargement a échoué.' };
  }
});

ipcMain.handle('install-update', () => {
  if (updateState.status !== 'downloaded') return { status: 'not-ready' };
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { status: 'installing' };
});

ipcMain.handle('export-docx', async (_event, judgment) => {
  const fileName = `${safeFileName(judgment?.title)}.docx`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer le jugement au format Word',
    defaultPath: path.join(app.getPath('documents'), fileName),
    filters: [{ name: 'Document Word', extensions: ['docx'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  await fs.writeFile(filePath, await buildDocxBuffer(judgment));
  return { canceled: false, filePath };
});

ipcMain.handle('import-conclusions-pdf', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choisir les conclusions au format PDF',
    properties: ['openFile'],
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  try {
    const filePath = filePaths[0];
    const result = await new Promise((resolve, reject) => {
      const worker = utilityProcess.fork(path.join(__dirname, 'pdf-worker.js'), [filePath], { serviceName: 'Lecture PDF prud’homale' });
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        worker.kill();
        reject(new Error('L’analyse du PDF a dépassé une minute.'));
      }, 60000);
      worker.once('message', message => {
        settled = true;
        clearTimeout(timeout);
        if (message?.error) reject(new Error(message.error)); else resolve(message);
      });
      worker.once('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error('Le module isolé de lecture PDF a rencontré une erreur.'));
      });
      worker.once('exit', code => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Le module isolé de lecture PDF s’est arrêté avec le code ${code}.`));
      });
    });
    return { canceled: false, fileName: path.basename(filePath), pages: result.pages, text: result.text };
  } catch (error) {
    return { canceled: false, error: 'La lecture de ce PDF a échoué. Vérifiez que le fichier est bien un PDF lisible et non protégé.' };
  }
});

ipcMain.handle('open-legal-research', async (_event, source, query) => {
  const urls = {
    rhExpert: 'https://www.elnet-rh.fr/accueil/',
    dalloz: 'https://www.dalloz.fr/documentation/',
    legifrance: 'https://www.legifrance.gouv.fr/'
  };
  if (!Object.hasOwn(urls, source)) return { error: 'Source de recherche non reconnue.' };
  clipboard.writeText(String(query || ''));
  await shell.openExternal(urls[source]);
  return { opened: true };
});

ipcMain.handle('copy-text', (_event, text) => {
  const value = String(text || '');
  if (!value) return { copied: false };
  clipboard.writeText(value);
  return { copied: true };
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#f7f5ef',
    title: 'Rédaction prud’homale',
    icon: path.join(__dirname, 'assets', 'cph-balance.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}

function sendMenuCommand(command) {
  BrowserWindow.getFocusedWindow()?.webContents.send('menu-command', command);
}

function buildApplicationMenu() {
  const template = [
    { label: 'Fichier', submenu: [
      { label: 'Nouveau jugement', accelerator: 'Ctrl+N', click: () => sendMenuCommand('new-judgment') },
      { type: 'separator' },
      { label: 'Ajouter une règle de droit proposée', click: () => sendMenuCommand('add-rule') },
      { label: 'Importer une règle proposée', click: () => sendMenuCommand('import-rule') },
      { label: 'Analyser des conclusions PDF', click: () => sendMenuCommand('import-pdf') },
      { label: 'Rechercher une règle de droit', click: () => sendMenuCommand('search-rule') },
      { label: 'Mettre à jour le jugement', accelerator: 'Ctrl+S', click: () => sendMenuCommand('update-judgment') },
      { label: 'Supprimer ce dossier', click: () => sendMenuCommand('delete-case') },
      { type: 'separator' },
      { label: 'Exporter au format Word', click: () => sendMenuCommand('export-word') },
      { label: 'Imprimer', accelerator: 'Ctrl+P', click: () => sendMenuCommand('print') },
      { type: 'separator' },
      { role: 'quit', label: 'Quitter' }
    ]},
    { label: 'Édition', submenu: [
      { role: 'undo', label: 'Annuler' },
      { role: 'redo', label: 'Rétablir' },
      { type: 'separator' },
      { role: 'cut', label: 'Couper' },
      { label: 'Copier', accelerator: 'Ctrl+C', click: () => sendMenuCommand('copy-selection') },
      { role: 'paste', label: 'Coller' },
      { role: 'selectAll', label: 'Tout sélectionner' }
    ]},
    { label: 'Affichage', submenu: [
      { label: 'Agrandir le texte', accelerator: 'Ctrl++', click: () => sendMenuCommand('font-up') },
      { label: 'Réduire le texte', accelerator: 'Ctrl+-', click: () => sendMenuCommand('font-down') },
      { label: 'Taille normale', accelerator: 'Ctrl+0', click: () => sendMenuCommand('font-reset') },
      { type: 'separator' },
      { label: 'Afficher ou masquer l’aperçu', click: () => sendMenuCommand('toggle-preview') },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Plein écran' }
    ]},
    { label: 'Fenêtre', submenu: [
      { role: 'minimize', label: 'Réduire' },
      { role: 'zoom', label: 'Agrandir ou restaurer' },
      { type: 'separator' },
      { role: 'close', label: 'Fermer la fenêtre' }
    ]},
    { label: 'Aide', submenu: [
      { label: 'Aide et informations', click: () => sendMenuCommand('help') },
      { label: 'Guide d’utilisation', click: () => sendMenuCommand('help') },
      { label: 'Rechercher une mise à jour', click: () => sendMenuCommand('check-updates') },
      { type: 'separator' },
      { label: 'À propos de Rédaction prud’homale', click: () => dialog.showMessageBox({ type: 'info', title: 'Rédaction prud’homale', message: 'Rédaction prud’homale', detail: 'Version 0.3.48\nApplication locale de la CGT BEL.' }) }
    ]}
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  configureUpdater();
  buildApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
