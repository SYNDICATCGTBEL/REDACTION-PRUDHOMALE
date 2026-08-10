(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DataProtection = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function isValidStore(value) {
    return Boolean(value && Array.isArray(value.cases) && value.cases.length && value.cases.every(item => item && typeof item.id === 'string' && item.info && item.content));
  }
  function parseStore(serialized) {
    try { const value = JSON.parse(serialized); return isValidStore(value) ? value : null; } catch (_) { return null; }
  }
  return { isValidStore, parseStore };
});
