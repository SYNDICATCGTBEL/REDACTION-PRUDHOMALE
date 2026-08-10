(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ValidationAssistant = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function render(options) {
    const { document, validation, onNavigate } = options;
    const container = options.container || document.getElementById('validationResults');
    const exportButton = options.exportButton || document.getElementById('confirmExportWord');
    container.replaceChildren();

    const summary = document.createElement('div');
    summary.className = `validation-summary${validation.valid ? ' ready' : ''}`;
    const strong = document.createElement('strong');
    strong.textContent = validation.valid ? 'Jugement prêt à exporter.' : `${validation.errors.length} point${validation.errors.length > 1 ? 's' : ''} à corriger avant l’export.`;
    summary.append(strong, document.createElement('br'), document.createTextNode(validation.valid ? 'Aucune erreur bloquante n’a été détectée.' : 'Utilisez « Aller au champ » pour compléter directement le dossier.'));
    container.appendChild(summary);

    const addGroup = (title, items, type) => {
      if (!items.length) return;
      const section = document.createElement('section');
      section.className = 'validation-group';
      const heading = document.createElement('h3');
      heading.textContent = `${title} (${items.length})`;
      const list = document.createElement('ul');
      list.className = 'validation-list';
      items.forEach(item => {
        const row = document.createElement('li');
        row.className = `validation-item ${type}`;
        const message = document.createElement('span');
        message.textContent = item.message;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-button';
        button.textContent = 'Aller au champ';
        button.addEventListener('click', () => onNavigate(item.target));
        row.append(message, button);
        list.appendChild(row);
      });
      section.append(heading, list);
      container.appendChild(section);
    };
    addGroup('Erreurs bloquantes', validation.errorItems, 'error');
    addGroup('Points à vérifier', validation.warningItems, 'warning');
    exportButton.disabled = !validation.valid;
    exportButton.textContent = validation.valid ? 'Exporter le document Word' : 'Export indisponible';
    return validation;
  }

  return { render };
});
