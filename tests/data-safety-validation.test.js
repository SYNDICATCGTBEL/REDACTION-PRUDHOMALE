const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStore } = require('../data-protection');
const { parseDate, validateCase } = require('../judgment-validation');
const { duplicateCase, listCases } = require('../case-management');
const { buildDocxBuffer } = require('../document-export');
const JSZip = require('jszip');
const { FORMULAS, TEMPLATES, itemsFor } = require('../legal-writing-aids');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

function completeCase() {
  return { id:'case-1', title:'Jugement', info:{ claimant:'Mme A', defendant:'Société B', caseNumber:'26/1', filingDate:'01/01/2026', hearing:'01/02/2026', judgmentDate:'01/03/2026', pronouncedOn:'01/03/2026', president:'Mme P', clerk:'M. G', collectiveAgreement:'Métallurgie' }, content:{ litige:'Faits', demande:'Sur la demande', regleDroit:'Règle', enEspece:'Application', enConsequence:'Conséquence', dispositif:'CONDAMNE', sensDelibere:'accordee' } };
}

test('le stockage refuse les données corrompues ou incomplètes', () => {
  assert.equal(parseStore('{'), null);
  assert.equal(parseStore('{"cases":[]}'), null);
  assert.equal(parseStore(JSON.stringify({currentId:'case-1',cases:[completeCase()]})).cases.length, 1);
});

test('la validation contrôle les dates réelles et leur chronologie', () => {
  assert.equal(parseDate('29/02/2024')?.getDate(), 29);
  assert.equal(parseDate('29/02/2025'), null);
  assert.equal(parseDate('08 août 2025')?.getMonth(), 7);
  assert.equal(parseDate('le 1er février 2026')?.getDate(), 1);
  assert.equal(parseDate('31 avril 2025'), null);
  const value=completeCase(); value.info.filingDate='05/02/2026';
  assert.match(validateCase(value).errors.join(' '), /postérieure à la date d’audience/);
});

test('un jugement complet peut être exporté et les mentions provisoires le bloquent', () => {
  assert.equal(validateCase(completeCase()).valid, true);
  const value=completeCase(); value.info.president='********';
  const result=validateCase(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /mention à compléter/);
  assert.ok(result.errorItems.every(item=>item.message && item.target));
});

test('chaque anomalie peut diriger l’utilisateur vers le champ concerné', () => {
  const value=completeCase(); value.info.claimant=''; value.content.enEspece='';
  const result=validateCase(value);
  assert.equal(result.errorItems.find(item=>item.target==='claimant')?.message,'Le nom du demandeur est manquant.');
  assert.equal(result.errorItems.find(item=>item.target==='enEspece')?.message,'La partie « En l’espèce » est vide.');
});

test('les modèles juridiques sont adaptés au champ et bloquent un export incomplet', () => {
  assert.ok(FORMULAS.length >= 12);
  assert.ok(TEMPLATES.length >= 8);
  assert.equal(new Set([...FORMULAS,...TEMPLATES].map(item=>item.id)).size,FORMULAS.length+TEMPLATES.length);
  assert.ok(itemsFor('regleDroit','template').every(item=>item.fields.includes('regleDroit')));
  assert.ok(itemsFor('dispositif','formula').some(item=>item.text.startsWith('DIT')));
  const value=completeCase(); value.content.regleDroit='Aux termes de [À compléter : article applicable], la règle est la suivante.';
  const result=validateCase(value);
  assert.equal(result.valid,false);
  assert.match(result.errors.join(' '),/mention à compléter/);
});

test('la recherche, le tri et la duplication des dossiers sont indépendants de l’interface', () => {
  const first=completeCase(); first.id='case-1'; first.updatedAt=10;
  const second=completeCase(); second.id='case-2'; second.title='Heures supplémentaires'; second.info.claimant='Mme Durand'; second.updatedAt=20;
  assert.deepEqual(listCases([first,second],'durand').map(item=>item.id),['case-2']);
  assert.deepEqual(listCases([first,second],'').map(item=>item.id),['case-2','case-1']);
  const copy=duplicateCase(second,1234);
  assert.equal(copy.id,'case-1234');
  assert.equal(copy.title,'Heures supplémentaires — copie');
  copy.info.claimant='Modification';
  assert.equal(second.info.claimant,'Mme Durand');
  first.content.litige='Monsieur Burak expose les faits du dossier.';
  assert.deepEqual(listCases([first,second],'Burak').map(item=>item.id),['case-1']);
  first.content.analyses=[{evidence:'Attestation de Monsieur Yilmaz'}];
  assert.deepEqual(listCases([first,second],'Yilmaz').map(item=>item.id),['case-1']);
});

test('la gestion professionnelle des dossiers est reliée à l’interface et au stockage protégé', () => {
  const root=join(__dirname,'..');
  const html=readFileSync(join(root,'index.html'),'utf8');
  const main=readFileSync(join(root,'main.js'),'utf8');
  const preload=readFileSync(join(root,'preload.js'),'utf8');
  assert.match(html,/id="caseSearch"/);
  assert.match(html,/CaseManagement\.listCases/);
  assert.match(html,/id="duplicateCase"/);
  assert.match(html,/id="caseHistoryDialog"/);
  assert.match(html,/createCaseBackup\(JSON\.stringify\(data\)\)[\s\S]*?readCaseVersion/);
  assert.match(main,/ipcMain\.handle\('list-case-versions'/);
  assert.match(main,/ipcMain\.handle\('read-case-version'/);
  assert.match(preload,/createCaseBackup: serialized/);
  assert.match(html,/id="validationDialog"/);
  assert.match(html,/ValidationAssistant\.render/);
  assert.match(html,/LegalWritingAids\.mount/);
  const assistant=readFileSync(join(root,'validation-assistant.js'),'utf8');
  assert.match(assistant,/exportButton\.disabled = !validation\.valid/);
  assert.match(assistant,/onNavigate\(item\.target\)/);
});

test('les paragraphes Word reprennent l’interligne et l’espacement visibles dans l’aperçu', () => {
  const root=join(__dirname,'..');
  const html=readFileSync(join(root,'index.html'),'utf8');
  const exporter=readFileSync(join(root,'document-export.js'),'utf8');
  assert.match(html, /#previewText \{[^}]*font:var\(--document-size\)\/1\.5/);
  assert.match(html, /#previewText \.preview-rich p, #previewText \.preview-rich div \{ margin:0 0 \.65em;/);
  assert.match(exporter, /const DEFAULT_LINE_SPACING = 360;/);
  assert.match(exporter, /const DEFAULT_PARAGRAPH_AFTER = 156;/);
  assert.match(exporter, /spacing: \{ line: DEFAULT_LINE_SPACING, after: DEFAULT_PARAGRAPH_AFTER \}/);
});

test('un bloc HTML vide ne crée pas un double espace dans Word', async () => {
  const buffer=await buildDocxBuffer({
    info:{},
    sections:[{title:'Exposé du litige',fields:[{title:'',content:'Premier\nSecond',html:'<div>Premier</div><div><br></div><div>Second</div>'}]}],
    closings:[]
  });
  const archive=await JSZip.loadAsync(buffer);
  const xml=await archive.file('word/document.xml').async('string');
  const body=xml.match(/<w:body>[\s\S]*?<\/w:body>/)?.[0] || '';
  assert.doesNotMatch(body, /<w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?<w:r>[\s\S]*?<w:br\/>[\s\S]*?<\/w:r><\/w:p>/);
  assert.match(body, /Premier/);
  assert.match(body, /Second/);
});

test('les titres du jugement sont centrés et la lettre de licenciement reste interne', async () => {
  const buffer=await buildDocxBuffer({
    info:{},
    sections:[{title:'Exposé du litige',fields:[
      {title:'Moyens et prétentions du demandeur',content:'Demandes',html:'<div>Demandes</div>'},
      {title:'Lettre de licenciement (si applicable)',content:'CONTENU INTERNE À EXCLURE',html:'<div>CONTENU INTERNE À EXCLURE</div>'}
    ]}], closings:[]
  });
  const xml=await (await JSZip.loadAsync(buffer)).file('word/document.xml').async('string');
  assert.match(xml, /<w:p><w:pPr>[^<]*(?:<w:[^>]+\/>)*<w:jc w:val="center"\/>(?:<w:[^>]+\/>)?<\/w:pPr><w:r>[\s\S]*?EXPOSÉ DU LITIGE/);
  assert.match(xml, /<w:p><w:pPr>[^<]*(?:<w:[^>]+\/>)*<w:jc w:val="center"\/>(?:<w:[^>]+\/>)?<\/w:pPr><w:r>[\s\S]*?MOYENS ET PRÉTENTIONS DU DEMANDEUR/);
  assert.doesNotMatch(xml, /CONTENU INTERNE À EXCLURE|LETTRE DE LICENCIEMENT/);
  const html=readFileSync(join(__dirname,'..','index.html'),'utf8');
  assert.match(html, /filter\(field=>field\.key!==['"]lettreLicenciement['"]\)/);
  assert.doesNotMatch(html.match(/function exportSections[\s\S]*?\}\n/)?.[0] || '', /fields:part\.fields\.map/);
});
