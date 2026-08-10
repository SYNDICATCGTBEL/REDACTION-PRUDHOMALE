(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.JudgmentValidation = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function text(value) { return String(value || '').trim(); }

  const FRENCH_MONTHS = new Map([
    ['janvier',1],['fevrier',2],['mars',3],['avril',4],['mai',5],['juin',6],
    ['juillet',7],['aout',8],['septembre',9],['octobre',10],['novembre',11],['decembre',12]
  ]);

  function plainFrench(value) { return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function parseDate(value) {
    const normalized = plainFrench(value).replace(/^le\s+/, '').replace(/\s+/g, ' ');
    const numeric = normalized.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}))$/);
    const written = normalized.match(/^(\d{1,2}|1er|premier)\s+([a-z]+)\s+(\d{4})$/);
    if (!numeric && !written) return null;
    const year = Number(numeric ? (numeric[1] || numeric[6]) : written[3]);
    const month = numeric ? Number(numeric[2] || numeric[5]) : FRENCH_MONTHS.get(written[2]);
    const day = numeric ? Number(numeric[3] || numeric[4]) : (written[1] === '1er' || written[1] === 'premier' ? 1 : Number(written[1]));
    if (!month) return null;
    const date = new Date(year, month - 1, day);
    return month >= 1 && month <= 12 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function validateCase(caseFile) {
    const info = caseFile?.info || {};
    const content = caseFile?.content || {};
    const errors = [];
    const warnings = [];
    const errorItems = [];
    const warningItems = [];
    const addError = (message, target) => { errors.push(message); errorItems.push({ message, target }); };
    const addWarning = (message, target) => { warnings.push(message); warningItems.push({ message, target }); };
    const requiredInfo = [
      ['claimant', 'Le nom du demandeur est manquant.'],
      ['defendant', 'Le nom du défendeur est manquant.'],
      ['caseNumber', 'Le numéro de dossier est manquant.'],
      ['filingDate', 'La date de saisine est manquante.'],
      ['hearing', 'La date d’audience est manquante.'],
      ['judgmentDate', 'La date de mise à disposition au greffe est manquante.'],
      ['pronouncedOn', 'La date du prononcé est manquante.'],
      ['president', 'Le nom du président est manquant.'],
      ['clerk', 'Le nom du greffier est manquant.']
    ];
    requiredInfo.forEach(([key, message]) => { if (!text(info[key])) addError(message, key); });

    const requiredContent = [
      ['litige', 'L’exposé du litige est vide.'],
      ['demande', 'Le chef de demande du syllogisme est vide.'],
      ['regleDroit', 'La règle de droit est vide.'],
      ['enEspece', 'La partie « En l’espèce » est vide.'],
      ['enConsequence', 'La partie « En conséquence » est vide.'],
      ['dispositif', 'Le dispositif « Par ces motifs » est vide.']
    ];
    requiredContent.forEach(([key, message]) => { if (!text(content[key])) addError(message, key); });
    if (!text(content.sensDelibere)) addError('Le sens du délibéré n’est pas renseigné.', 'sensDelibere');

    const dates = [
      ['filingDate', 'date de saisine'], ['hearing', 'date d’audience'],
      ['judgmentDate', 'date de mise à disposition au greffe'], ['pronouncedOn', 'date du prononcé']
    ];
    const parsed = {};
    dates.forEach(([key, label]) => {
      if (text(info[key])) {
        parsed[key] = parseDate(info[key]);
        if (!parsed[key]) addError(`La ${label} est invalide. Utilisez « 08/08/2025 » ou « 8 août 2025 ».`, key);
      }
    });
    if (parsed.filingDate && parsed.hearing && parsed.filingDate > parsed.hearing) addError('La date de saisine est postérieure à la date d’audience.', 'filingDate');
    if (parsed.hearing && parsed.judgmentDate && parsed.hearing > parsed.judgmentDate) addError('La date d’audience est postérieure à la mise à disposition au greffe.', 'hearing');
    if (parsed.judgmentDate && parsed.pronouncedOn && parsed.judgmentDate > parsed.pronouncedOn) addWarning('La date du prononcé est antérieure à la mise à disposition au greffe. Vérifiez ces deux dates.', 'pronouncedOn');

    const unresolved = [caseFile?.title, ...Object.values(info), ...Object.values(content).filter(value => typeof value === 'string')]
      .some(value => /\*{3,}|\[à compléter(?:\s*:[^\]]+)?\]|non renseign/iu.test(text(value)));
    if (unresolved) addError('Le jugement contient encore une mention à compléter ou des astérisques.', 'caseTitle');
    if (!text(info.collectiveAgreement)) addWarning('La convention collective n’est pas renseignée.', 'collectiveAgreement');
    return { valid: errors.length === 0, errors, warnings, errorItems, warningItems };
  }

  return { parseDate, validateCase };
});
