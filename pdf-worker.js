const { parentPort: threadParentPort, workerData } = require('worker_threads');
const fs = require('fs/promises');
const { DOMMatrix, ImageData, Path2D } = require('@napi-rs/canvas');

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

const { PDFParse } = require('pdf-parse');
const { getData: getPdfWorkerData } = require('pdf-parse/worker');
PDFParse.setWorker(getPdfWorkerData());

const filePath = workerData?.filePath || process.argv[2];

function sendResult(message) {
  if (process.parentPort) process.parentPort.postMessage(message);
  else if (threadParentPort) threadParentPort.postMessage(message);
  else if (process.send) process.send(message);
}

async function readPdf(filePath) {
  const stats = await fs.stat(filePath);
  const maximumSize = 30 * 1024 * 1024;
  if (stats.size > maximumSize) throw new Error('Le PDF dépasse 30 Mo. Réduisez sa taille avant de l’analyser.');
  const parser = new PDFParse({ data: await fs.readFile(filePath) });
  try {
    const parsed = await parser.getText();
    const text = String(parsed.text || '').replace(/\r/g, '').replace(/^-- \d+ of \d+ --\s*$/gmu, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) throw new Error('Ce PDF ne contient pas de texte exploitable. S’il s’agit d’un document scanné, il faut d’abord le convertir avec une reconnaissance de texte.');
    sendResult({ text, pages: parsed.total || 0 });
  } finally {
    await parser.destroy();
  }
}

readPdf(filePath).catch(error => sendResult({ error: error?.message || 'La lecture du PDF a échoué.' }));
