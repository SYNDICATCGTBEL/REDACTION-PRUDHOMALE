const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('redaction', {
  exportDocx: judgment => ipcRenderer.invoke('export-docx', judgment),
  saveCaseData: serialized => ipcRenderer.invoke('save-case-data', serialized),
  loadCaseRecovery: () => ipcRenderer.invoke('load-case-recovery'),
  listCaseVersions: caseId => ipcRenderer.invoke('list-case-versions', caseId),
  readCaseVersion: (fileName, caseId) => ipcRenderer.invoke('read-case-version', fileName, caseId),
  createCaseBackup: serialized => ipcRenderer.invoke('create-case-backup', serialized),
  importConclusionsPdf: () => ipcRenderer.invoke('import-conclusions-pdf'),
  openLegalResearch: (source, query) => ipcRenderer.invoke('open-legal-research', source, query),
  copyText: text => ipcRenderer.invoke('copy-text', text),
  showContextMenu: template => ipcRenderer.invoke('show-context-menu', template),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onMenuCommand: callback => ipcRenderer.on('menu-command', (_event, command) => callback(command)),
  onContextMenu: callback => ipcRenderer.on('context-menu', (_event, params) => callback(params))
});
