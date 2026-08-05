const { parentPort, workerData } = require('worker_threads');
const fs = require('fs/promises');
const pdfParse = require('pdf-parse');

async function readPdf(filePath) {
  const stats = await fs.stat(filePath);
  const maximumSize = 30 * 1024 * 1024;
  if (stats.size > maximumSize) throw new Error('Le PDF dépasse 30 Mo. Réduisez sa taille avant de l’analyser.');
  const parsed = await pdfParse(await fs.readFile(filePath));
  const text = String(parsed.text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('Ce PDF ne contient pas de texte exploitable. S’il s’agit d’un document scanné, il faut d’abord le convertir avec une reconnaissance de texte.');
  parentPort.postMessage({ text, pages: parsed.numpages || 0 });
}

readPdf(workerData.filePath).catch(error => parentPort.postMessage({ error: error?.message || 'La lecture du PDF a échoué.' }));
