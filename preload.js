const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('redaction', {
  exportDocx: judgment => ipcRenderer.invoke('export-docx', judgment),
  importConclusionsPdf: () => ipcRenderer.invoke('import-conclusions-pdf'),
  openLegalResearch: (source, query) => ipcRenderer.invoke('open-legal-research', source, query),
  copyText: text => ipcRenderer.invoke('copy-text', text),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onMenuCommand: callback => ipcRenderer.on('menu-command', (_event, command) => callback(command))
});
