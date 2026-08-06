const test = require('node:test');
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { fork } = require('node:child_process');
const JSZip = require('jszip');
const { buildDocxBuffer, safeFileName } = require('../document-export');

const root = join(__dirname, '..');

test('le moteur Word produit un document lisible et complet', async () => {
  const buffer = await buildDocxBuffer({
    title: 'Dossier QA:344',
    info: {
      caseNumber: 'QA-2026-344',
      claimant: 'Madame QA',
      defendant: 'Société QA'
    },
    sections: [
      { title: 'Exposé du litige', fields: [{ title: '', content: 'Exposé QA complet.' }] },
      { title: 'Motifs de la décision', fields: [{ title: 'Règle de droit', content: 'Règle QA soulignée colorée. Point un.', html: '<p><strong>Règle</strong> <em>QA</em> <u>soulignée</u> <span style="color:#ff0000;background-color:#fff200;font-size:14pt;font-family:Arial">colorée</span></p><ul><li>Point un</li></ul>' }] },
      { title: 'Par ces motifs', fields: [{ title: '', content: 'CONDAMNE la Société QA à payer 1 500 euros.' }] }
    ],
    closings: ['Clôture QA.']
  });
  assert.ok(buffer.length > 5000);
  const archive = await JSZip.loadAsync(buffer);
  const xml = await archive.file('word/document.xml').async('string');
  assert.match(xml, /CONSEIL DE PRUD’HOMMES/);
  assert.match(xml, /QA-2026-344/);
  assert.match(xml, /Madame QA/);
  assert.match(xml, /CONDAMNE/);
  assert.match(xml, /Clôture QA/);
  assert.match(xml, /w:ascii="Aptos"/);
  assert.match(xml, /w:sz w:val="24"/);
  assert.match(xml, /w:b/);
  assert.match(xml, /w:i/);
  assert.match(xml, /w:u w:val="single"/);
  assert.match(xml, /w:color w:val="FF0000"/);
  assert.match(xml, /w:shd w:fill="FFF200"/);
  assert.match(xml, /w:ascii="Arial"/);
  assert.match(xml, /w:sz w:val="28"/);
  assert.match(xml, /w:numPr/);
  assert.equal(safeFileName('Dossier QA:344'), 'Dossier QA-344');
});

test('le moteur PDF extrait le texte et le nombre de pages', async () => {
  const filePath = join(root, 'qa-0.3.44', 'fixtures', 'conclusions-qa.pdf');
  const result = await new Promise((resolve, reject) => {
    const worker = fork(join(root, 'pdf-worker.js'), [filePath], { silent: true });
    const timeout = setTimeout(() => {
      worker.kill();
      reject(new Error('Délai dépassé pendant le contrôle PDF'));
    }, 10000);
    worker.once('message', message => {
      clearTimeout(timeout);
      if (message.error) reject(new Error(message.error));
      else resolve(message);
    });
    worker.once('error', reject);
  });
  assert.equal(result.pages, 1);
  assert.match(result.text, /QA-PDF-344/);
  assert.match(result.text, /article L\. 3171-4/);
  assert.match(result.text, /1 500\s+euros/);
  assert.doesNotMatch(result.text, /-- 1 of 1 --/);
});
