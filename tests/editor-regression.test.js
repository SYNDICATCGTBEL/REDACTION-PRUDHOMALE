const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const richText = readFileSync(join(root, 'rich-text.js'), 'utf8');

test('les scripts intégrés sont syntaxiquement valides', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test('la fenêtre de modification laisse la barre de format disponible sans voler le focus', () => {
  assert.doesNotMatch(html, /enableRuleToolbars|restorable|_disabledForOpen/);
  assert.doesNotMatch(html, /ruleEditorTitleInput[^>]+autofocus/);
  assert.match(html, /window\.RichText\.focus\(major,\{atStart:true\}\);\s*window\.RichText\.getEditor\(major\)\?\.scrollIntoView\(\{block:'center',inline:'nearest'\}\)/);
  const ruleDialog = html.match(/<dialog class="rule-editor"[\s\S]*?<\/dialog>/)?.[0] || '';
  assert.doesNotMatch(ruleDialog, /<label[^>]*>[^<]*<textarea/i);
  for (const id of ['ruleEditorDemande', 'ruleEditorRule', 'ruleEditorEnEspece', 'ruleEditorEnConsequence', 'ruleEditorEnConsequenceAccordee', 'ruleEditorEnConsequenceRejetee', 'ruleEditorEnConsequencePartielle']) {
    assert.match(ruleDialog, new RegExp(`<label for="${id}">`));
  }
});

test('les fenêtres d’import et de recherche utilisent la structure stable de l’éditeur', () => {
  for (const dialogId of ['legalResearchDialog', 'syllogismImportDialog', 'analysisEditorDialog']) {
    const dialog = html.match(new RegExp(`<dialog[^>]+id="${dialogId}"[\\s\\S]*?<\\/dialog>`))?.[0] || '';
    assert.ok(dialog, `${dialogId} doit exister`);
    assert.doesNotMatch(dialog, /<label[^>]*>[^<]*<textarea/i);
  }
  for (const id of ['legalResearchQuery', 'legalResearchExcerpt', 'syllogismImportText']) {
    assert.match(html, new RegExp(`<label for="${id}">`));
  }
  assert.match(html, /window\.RichText\.focus\(area\)/);
  assert.match(html, /window\.RichText\.focus\(query\)/);
});

test('une ancienne sélection est invalidée lorsque le contenu change', () => {
  assert.match(richText, /const clearSelection = \(\) => \{\s*savedRange = null;/);
  assert.match(richText, /!editor\.contains\(savedRange\.commonAncestorContainer\)/);
  assert.match(richText, /entry\.clearSelection\(\);\s*if \(selectionInside\(entry\.editor\)\) window\.getSelection\(\)\?\.removeAllRanges\(\);[\s\S]*?entry\.editor\.innerHTML = cleanHtml;/);
});

test('le curseur de saisie reste visible et le clic donne le focus à l’éditeur', () => {
  assert.match(html, /\.word-editor-surface \{[^}]*caret-color:#14253d;[^}]*cursor:text;/);
  assert.match(richText, /editor\.addEventListener\('pointerup',[\s\S]*?requestAnimationFrame\(\(\) => placeCaretAfterPointer\(event\)\)/);
  assert.match(richText, /placeCaretAfterPointer[\s\S]*?range\.selectNodeContents\(editor\)[\s\S]*?selection\.addRange\(range\)/);
  assert.match(richText, /entry\.clearSelection\(\);[\s\S]*?entry\.editor\.contentEditable = 'true';/);
  assert.match(richText, /function focus\(textarea, options = \{\}\)[\s\S]*?range\.collapse\(options\.atStart === true\)[\s\S]*?selection\.addRange\(range\)/);
  assert.match(richText, /const forceCaretPlacement = options\.atStart === true \|\| options\.atEnd === true;\s*if \(!forceCaretPlacement && selectionInside\(editor\)\) return;/);
});

test('la fenêtre de règle recrée ses éditeurs au lieu de conserver un état usé', () => {
  assert.match(richText, /function destroy\(textarea\)[\s\S]*?entry\.shell\.remove\(\);[\s\S]*?activeEditors\.delete\(textarea\)/);
  assert.match(richText, /window\.RichText = \{ enhance, destroy,/);
  assert.match(html, /const el=document\.getElementById\(id\);\s*window\.RichText\.destroy\(el\);\s*setEditableValue\(el/);
  assert.match(html, /ruleEditorDialog'\)\.addEventListener\('close',[\s\S]*?window\.RichText\.destroy/);
});

test('le clic droit est relié à tous les éditeurs et aux données du dossier', () => {
  const main = readFileSync(join(root, 'main.js'), 'utf8');
  const preload = readFileSync(join(root, 'preload.js'), 'utf8');
  assert.match(main, /ipcMain\.handle\('show-context-menu'/);
  assert.match(preload, /showContextMenu: template => ipcRenderer\.invoke\('show-context-menu'/);
  assert.match(preload, /onContextMenu: callback => ipcRenderer\.on\('context-menu'/);
  assert.match(html, /document\.addEventListener\('contextmenu'/);
  assert.match(html, /window\.redaction\.onContextMenu/);
  assert.match(html, /label:'Couper',role:'cut'/);
  assert.match(html, /label:'Copier',role:'copy'/);
  assert.match(html, /label:'Coller',role:'paste'/);
  assert.match(html, /label:'Insérer une date'/);
  assert.match(html, /label:'Insérer un nombre ou montant'/);
  assert.match(html, /window\.RichText\.insertText\(target,text\)/);
});

test('les règles sont regroupées dans une seule liste déroulante compacte', () => {
  const renderer = html.match(/function renderStableRuleLibrary\(article\)[\s\S]*?function syllogismLabel/)?.[0] || '';
  assert.match(renderer, /Toutes les règles disponibles sont regroupées dans la liste déroulante/);
  assert.match(html, /function ruleStructure\(rule\)[\s\S]*?complete:hasMajor&&hasMinor&&hasConclusion/);
  assert.match(renderer, /Syllogismes complets — /);
  assert.match(renderer, /Règles à compléter — /);
  assert.match(renderer, /items\.map\(rule=>'<option/);
  assert.match(renderer, /select\.disabled=!matches\.length/);
  assert.doesNotMatch(renderer, /data-stable-rule-results|matches\.slice\(0,12\)|class="rule-result"/);
  assert.doesNotMatch(renderer, /select\.addEventListener\('change'/);
  assert.match(renderer, /data-stable-rule-insert[\s\S]*?addEventListener\('click'[\s\S]*?applyStableRule/);
});

test('les dates courantes restent numériques et les clôtures restent en lettres', () => {
  assert.match(html, /function dateToNumeric\(value\)/);
  assert.match(html, /function eventDateText[\s\S]*?return dateToNumeric\(event\?\.date\)/);
  assert.match(html, /const date=dateToNumeric\(event\?\.date\)/);
  assert.match(html, /function signatureText[\s\S]*?dateToWords\(info\.pronouncedOn\)/);
  assert.match(html, /function closingText[\s\S]*?dateToWords\(info\.pronouncedOn\)/);
});

test('un nom de partie déjà rédigé ne peut pas être doublé à l’export', () => {
  assert.match(html, /replace\(\/\\b\(\?:Madame\|Monsieur\|Mme\\\.\?\|M\\\.\)\\s\+X\{1,2\}\\b\/giu,claimant\)/);
  assert.doesNotMatch(html, /\(\?:\\s\+X\{1,2\}\)\?/);
});

test('la version est identique dans les fichiers distribués', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  const main = readFileSync(join(root, 'main.js'), 'utf8');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.match(html, new RegExp(`Version ${pkg.version.replaceAll('.', '\\.')}`));
  assert.match(main, new RegExp(`Version ${pkg.version.replaceAll('.', '\\.')}`));
  assert.match(readme, new RegExp(`Version actuelle : ${pkg.version.replaceAll('.', '\\.')}`));
});
