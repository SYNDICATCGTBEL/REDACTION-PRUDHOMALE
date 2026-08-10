(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CaseManagement = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function searchableText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function collectText(value, output = [], key = '') {
    if (typeof value === 'string') {
      if (key !== 'rich' && !/<[a-z][\s\S]*>/i.test(value)) output.push(value);
      return output;
    }
    if (Array.isArray(value)) value.forEach(item => collectText(item, output, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => {
      if (!['rich', 'selectedRuleId'].includes(childKey)) collectText(child, output, childKey);
    });
    return output;
  }

  function searchValue(caseFile) {
    return searchableText(collectText(caseFile).join(' '));
  }

  function listCases(cases, query = '') {
    const terms = searchableText(query).split(/\s+/).filter(Boolean);
    return [...(Array.isArray(cases) ? cases : [])]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .filter(caseFile => terms.every(term => searchValue(caseFile).includes(term)));
  }

  function duplicateCase(source, now = Date.now()) {
    if (!source || typeof source !== 'object') throw new TypeError('Le dossier à dupliquer est invalide.');
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = `case-${now}`;
    copy.title = `${source.title || 'Dossier sans titre'} — copie`;
    copy.updatedAt = now;
    return copy;
  }

  return { collectText, duplicateCase, listCases, searchableText, searchValue };
});
