const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

function count(pattern, source = html) {
  return [...source.matchAll(pattern)].length;
}

test('le script intégré est syntaxiquement valide', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1].trim())
    .filter(Boolean);
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test('aucune fonction nommée ne possède encore une couche historique', () => {
  const declarations = [...html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(match => match[1]);
  const declarationCounts = declarations.reduce((counts, name) => counts.set(name, (counts.get(name) || 0) + 1), new Map());
  for (const [name, total] of declarationCounts) {
    assert.equal(total, 1, `${name} doit être déclarée une seule fois`);
    assert.equal(count(new RegExp(`(?:^|[;\\n])\\s*${name}\\s*=\\s*function`, 'g')), 0, `${name} ne doit plus être remplacée`);
  }
  assert.equal(count(/deleteRuleButton'\)\.addEventListener/g), 1);
  assert.equal(count(/renderFormWith|baseRenderForm|openRuleEditorWith|prepareRuleWith|appendRuleTextWithPersonalisation/g), 0);
});

test('la bibliothèque possède des intitulés utilisables et uniques', () => {
  const source = readFileSync(join(root, 'regles-syllogisme.js'), 'utf8');
  const rules = JSON.parse(source.slice(source.indexOf('[')).trim().replace(/;$/, ''));
  assert.equal(rules.length, 267);
  const titles = rules.map(rule => String(rule.title || '').trim());
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(titles.filter(title => title.length < 5).length, 0);
  assert.ok(titles.includes('Prise d’acte — Modification unilatérale de la rémunération variable'));
  assert.ok(titles.includes('Compétence et incompétence du conseil de prud’hommes'));
});

test('le numéro de version affiché correspond au paquet', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(html, new RegExp(`Version ${pkg.version.replaceAll('.', '\\.')}`));
});

test('le corps du jugement utilise le réglage Word Aptos 12 points', () => {
  const exporter = readFileSync(join(root, 'document-export.js'), 'utf8');
  assert.match(html, /--document-font:"Aptos"/);
  assert.match(html, /--document-size:12pt/);
  assert.match(exporter, /const DOCUMENT_FONT = 'Aptos'/);
  assert.match(exporter, /const DOCUMENT_SIZE = 24/);
});

test('toutes les zones de rédaction utilisent le même éditeur riche', () => {
  const richEditor = readFileSync(join(root, 'rich-text.js'), 'utf8');
  const exporter = readFileSync(join(root, 'document-export.js'), 'utf8');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(html, /<script src="rich-text\.js"><\/script>/);
  assert.match(html, /textarea:not\(\[data-field\]\)/);
  assert.match(html, /enhanceEditable\(area,ensureRich/);
  assert.match(richEditor, /data-rich-command="bold"/);
  assert.match(richEditor, /data-rich-command="insertUnorderedList"/);
  assert.match(richEditor, /data-rich-color/);
  assert.match(richEditor, /data-rich-highlight/);
  assert.match(exporter, /richTextParagraphs/);
  assert.ok(pkg.build.files.includes('rich-text.js'));
});

test('les chefs de demande du dossier ont des actions explicites et un aperçu sécurisé', () => {
  assert.match(html, /<h4>Chefs de demande du dossier<\/h4>/);
  assert.match(html, /Donnez un intitulé à chaque chef de demande/);
  assert.match(html, /Chef de demande sans intitulé/);
  assert.match(html, /Intitulé du chef de demande/);
  assert.match(html, /data-stable-syllogism-add aria-label="Nouveau chef de demande">Nouveau chef de demande/);
  assert.match(html, /open\.textContent=isActive\?'Aperçu':'Ouvrir'/);
  assert.match(html, /open\.setAttribute\('aria-current','true'\)/);
  assert.match(html, /Aperçu du chef de demande « /);
  assert.match(html, /Ouvrir le chef de demande « /);
  assert.match(html, /Supprimer le chef de demande « /);
  assert.match(html, /currentLabel=title\.value\.trim\(\) \|\| 'Chef de demande sans intitulé '/);
  assert.match(html, /deleteButton\.setAttribute\('aria-label','Supprimer le chef de demande « '\+currentLabel/);
  assert.match(html, /<h2 id="syllogismPreviewTitle">Aperçu du chef de demande<\/h2>/);
  assert.match(html, /function openSyllogismPreview\(index\)/);
  assert.match(html, /window\.RichText\.sanitizeHtml\(value\)/);
  assert.match(html, /document\.getElementById\('syllogismPreviewDialog'\)\.showModal\(\)/);
  for (const heading of ['Sur la demande', 'Règle de droit', 'En l’espèce', 'En conséquence', 'Sens du délibéré']) {
    assert.match(html, new RegExp(heading));
  }
  assert.doesNotMatch(html, />Ouvert</);
});

test('les requêtes restent contenues et lisibles sur mobile', () => {
  assert.match(html, /@media \(max-width:430px\)/);
  assert.match(html, /\.syllogism-switcher, \.syllogism-tabs \{ min-width:0; \}/);
  assert.match(html, /\.syllogism-entry \{ display:grid; grid-template-columns:minmax\(0,1fr\) auto; \}/);
  assert.match(html, /\.syllogism-entry input \{ grid-column:1 \/ -1; width:100%; min-width:0; \}/);
  assert.match(html, /\.syllogism-entry button:not\(\.remove\) \{ grid-column:1; justify-self:end; \}/);
  assert.match(html, /\.syllogism-tabs button:not\(\.active\):hover/);
});

test('les montants et les dates ne débordent pas sur mobile', () => {
  assert.match(html, /\.allocation-row, \.event-date-row \{ grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\); align-items:stretch; \}/);
  assert.match(html, /\.allocation-row \[data-allocation-label\], \.event-date-row \[data-event-label\] \{ grid-column:1 \/ -1; \}/);
  assert.match(html, /\.allocation-row \[data-allocation-value\], \.event-date-row \[data-event-date\] \{ grid-column:1; \}/);
  assert.match(html, /\.allocation-row button, \.event-date-row button \{ grid-column:2; justify-self:end; \}/);
  assert.match(html, /\.event-date-row \{ display:grid; grid-template-columns:105px 120px minmax\(0,1fr\) 155px auto; gap:7px; align-items:center; \}/);
  assert.match(html, /\.allocation-row \[data-allocation-label\], \.event-date-row \[data-event-label\] \{ grid-column:1 \/ -1; \}/);
  assert.match(html, /\.allocation-row button, \.event-date-row button \{ grid-column:2; justify-self:end; \}/);
});

test('les événements utilisent un catalogue code-intitulé et gardent les anciennes lignes', () => {
  assert.match(html, /const EVENT_SHORTCUTS = \[/);
  for (const code of ['SAISINE', 'AUDIENCE', 'EMBAUCHE', 'LICENCIEMENT', 'JUGEMENT', 'PRONONCE']) assert.match(html, new RegExp("code:'" + code + "'"));
  assert.match(html, /function eventShortcutCatalog\(\)/);
  assert.match(html, /Ajouter un événement/);
  assert.match(html, /data-event-code/);
  assert.match(html, /data-event-label/);
  assert.match(html, /eventDates:Array\.isArray\(legacy\.eventDates\)\?legacy\.eventDates:\[\]/);
  assert.match(html, /function eventDateText\(c,label\)/);
});
