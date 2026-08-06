(function () {
  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'SPAN', 'FONT', 'P', 'DIV', 'BR', 'H2', 'H3', 'UL', 'OL', 'LI']);
  const STYLE_PROPERTIES = new Set(['font-family', 'font-size', 'color', 'background-color', 'text-align']);
  const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24'];
  const activeEditors = new WeakMap();

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  }

  function textToHtml(value) {
    return escapeHtml(String(value || '').replace(/\r/g, '')).replace(/\n/g, '<br>');
  }

  function cleanCssValue(property, value) {
    const candidate = String(value || '').trim();
    if (!candidate || /[<>"'`;{}]/.test(candidate)) return '';
    if (property === 'font-size' && !/^\d+(?:\.\d+)?(?:pt|px|em|rem|%)$/i.test(candidate)) return '';
    if ((property === 'color' || property === 'background-color') && !/^(?:#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(candidate)) return '';
    if (property === 'text-align' && !/^(?:left|center|right|justify)$/i.test(candidate)) return '';
    if (property === 'font-family' && !/^[\w\s,"'-]+$/u.test(candidate)) return '';
    return candidate;
  }

  function sanitizeHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = String(value || '');
    const clean = node => {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
      if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
      const tagName = node.tagName.toUpperCase();
      if (!ALLOWED_TAGS.has(tagName)) {
        const fragment = document.createDocumentFragment();
        [...node.childNodes].forEach(child => fragment.appendChild(clean(child)));
        return fragment;
      }
      const element = document.createElement(tagName.toLowerCase());
      if (tagName === 'FONT') {
        const color = cleanCssValue('color', node.getAttribute('color'));
        const face = cleanCssValue('font-family', node.getAttribute('face'));
        if (color) element.style.color = color;
        if (face) element.style.fontFamily = face;
      }
      for (const property of STYLE_PROPERTIES) {
        const cleanValue = cleanCssValue(property, node.style?.getPropertyValue(property));
        if (cleanValue) element.style.setProperty(property, cleanValue);
      }
      [...node.childNodes].forEach(child => element.appendChild(clean(child)));
      return element;
    };
    const container = document.createElement('div');
    [...template.content.childNodes].forEach(child => container.appendChild(clean(child)));
    return container.innerHTML;
  }

  function editorText(editor) {
    return String(editor.innerText || '').replace(/\u00a0/g, ' ').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').replace(/\n+$/u, '');
  }

  function toolbarMarkup() {
    return `
      <div class="word-toolbar-row">
        <label class="word-toolbar-select">Police
          <select data-rich-font aria-label="Police">
            <option value="Aptos">Aptos (Corps)</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
        </label>
        <label class="word-toolbar-select word-size-select">Taille
          <select data-rich-size aria-label="Taille de police">${FONT_SIZES.map(size => `<option value="${size}"${size === '12' ? ' selected' : ''}>${size}</option>`).join('')}</select>
        </label>
        <span class="word-toolbar-group" aria-label="Style du texte">
          <button type="button" data-rich-command="bold" title="Gras (Ctrl+B)" aria-label="Gras"><strong>G</strong></button>
          <button type="button" data-rich-command="italic" title="Italique (Ctrl+I)" aria-label="Italique"><em>I</em></button>
          <button type="button" data-rich-command="underline" title="Souligné (Ctrl+U)" aria-label="Souligné"><u>S</u></button>
          <button type="button" data-rich-command="strikeThrough" title="Barré" aria-label="Barré"><s>abc</s></button>
          <button type="button" data-rich-command="subscript" title="Indice" aria-label="Indice">x<sub>2</sub></button>
          <button type="button" data-rich-command="superscript" title="Exposant" aria-label="Exposant">x<sup>2</sup></button>
        </span>
        <label class="word-color-control" title="Couleur du texte">Texte<input type="color" value="#14253d" data-rich-color aria-label="Couleur du texte"></label>
        <label class="word-color-control" title="Surlignage">Surligner<input type="color" value="#fff200" data-rich-highlight aria-label="Couleur de surlignage"></label>
      </div>
      <div class="word-toolbar-row word-toolbar-row-secondary">
        <label class="word-toolbar-select word-style-select">Style
          <select data-rich-block aria-label="Style de paragraphe">
            <option value="p">Normal</option>
            <option value="h2">Titre 1</option>
            <option value="h3">Titre 2</option>
          </select>
        </label>
        <span class="word-toolbar-group" aria-label="Paragraphe">
          <button type="button" data-rich-command="justifyLeft" title="Aligner à gauche">Gauche</button>
          <button type="button" data-rich-command="justifyCenter" title="Centrer">Centrer</button>
          <button type="button" data-rich-command="justifyRight" title="Aligner à droite">Droite</button>
          <button type="button" data-rich-command="justifyFull" title="Justifier">Justifier</button>
          <button type="button" data-rich-command="insertUnorderedList" title="Liste à puces">Puces</button>
          <button type="button" data-rich-command="insertOrderedList" title="Liste numérotée">Numéros</button>
        </span>
        <span class="word-toolbar-group word-toolbar-history" aria-label="Historique et nettoyage">
          <button type="button" data-rich-command="undo" title="Annuler (Ctrl+Z)">Annuler</button>
          <button type="button" data-rich-command="redo" title="Rétablir (Ctrl+Y)">Rétablir</button>
          <button type="button" data-rich-command="removeFormat" title="Effacer la mise en forme">Effacer le format</button>
        </span>
      </div>`;
  }

  function selectionInside(editor) {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return false;
    const container = selection.getRangeAt(0).commonAncestorContainer;
    return editor.contains(container) || container === editor;
  }

  function enhance(textarea, options = {}) {
    if (!textarea) return null;
    const existing = activeEditors.get(textarea);
    if (existing) {
      set(textarea, textarea.value, options.html);
      return existing.editor;
    }

    const shell = document.createElement('div');
    shell.className = 'word-editor';
    const toolbar = document.createElement('div');
    toolbar.className = 'word-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Mise en forme du texte');
    toolbar.innerHTML = toolbarMarkup();
    const editor = document.createElement('div');
    editor.className = 'word-editor-surface';
    editor.contentEditable = 'true';
    editor.spellcheck = true;
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('aria-label', textarea.getAttribute('aria-label') || textarea.closest('label')?.childNodes[0]?.textContent?.trim() || 'Zone de rédaction');
    editor.dataset.placeholder = textarea.getAttribute('placeholder') || 'Rédigez cette partie…';
    shell.append(toolbar, editor);
    textarea.before(shell);
    textarea.classList.add('rich-text-source');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;

    let savedRange = null;
    let syncingFromEditor = false;
    const saveSelection = () => {
      if (!selectionInside(editor)) return;
      const selection = window.getSelection();
      savedRange = selection.getRangeAt(0).cloneRange();
    };
    const restoreSelection = () => {
      editor.focus();
      if (!savedRange) return;
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(savedRange);
    };
    const updateToolbarState = () => {
      for (const button of toolbar.querySelectorAll('[data-rich-command]')) {
        const command = button.dataset.richCommand;
        const stateful = ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'].includes(command);
        if (stateful) {
          const active = Boolean(document.queryCommandState(command));
          button.classList.toggle('active', active);
          button.setAttribute('aria-pressed', String(active));
        }
      }
    };
    const syncSource = (emit = true) => {
      syncingFromEditor = true;
      textarea.value = editorText(editor);
      textarea.dataset.richHtml = sanitizeHtml(editor.innerHTML);
      if (emit) textarea.dispatchEvent(new Event('input', { bubbles: true }));
      syncingFromEditor = false;
    };
    const execute = command => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand(command, false, null);
      saveSelection();
      syncSource();
      updateToolbarState();
    };

    toolbar.querySelectorAll('button').forEach(button => {
      button.addEventListener('mousedown', event => event.preventDefault());
      button.addEventListener('click', () => execute(button.dataset.richCommand));
    });
    toolbar.querySelector('[data-rich-font]').addEventListener('change', event => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontName', false, event.target.value);
      saveSelection();
      syncSource();
    });
    toolbar.querySelector('[data-rich-size]').addEventListener('change', event => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontSize', false, '7');
      editor.querySelectorAll('font[size="7"]').forEach(element => {
        element.removeAttribute('size');
        element.style.fontSize = `${event.target.value}pt`;
      });
      saveSelection();
      syncSource();
    });
    toolbar.querySelector('[data-rich-block]').addEventListener('change', event => {
      restoreSelection();
      document.execCommand('formatBlock', false, event.target.value);
      saveSelection();
      syncSource();
    });
    toolbar.querySelector('[data-rich-color]').addEventListener('input', event => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('foreColor', false, event.target.value);
      saveSelection();
      syncSource();
    });
    toolbar.querySelector('[data-rich-highlight]').addEventListener('input', event => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('hiliteColor', false, event.target.value);
      saveSelection();
      syncSource();
    });
    editor.addEventListener('input', () => {
      saveSelection();
      syncSource();
      updateToolbarState();
    });
    editor.addEventListener('keyup', () => { saveSelection(); updateToolbarState(); });
    editor.addEventListener('mouseup', () => { saveSelection(); updateToolbarState(); });
    editor.addEventListener('focus', () => { saveSelection(); shell.classList.add('focused'); });
    editor.addEventListener('blur', () => shell.classList.remove('focused'));
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const html = event.clipboardData?.getData('text/html');
      const text = event.clipboardData?.getData('text/plain') || '';
      document.execCommand(html ? 'insertHTML' : 'insertText', false, html ? sanitizeHtml(html) : text);
    });

    // Prevent toolbar controls (e.g., the font select) from stealing focus when
    // the user clicks inside the editor surface. Clicking should always focus
    // the editor surface itself.
    editor.addEventListener('mousedown', event => {
      try {
        event.preventDefault();
        editor.focus();
        saveSelection();
      } catch(e) { /* noop */ }
    });

    // Track last mousedown target to distinguish intentional toolbar clicks
    let lastMouseDownTarget = null;
    const mdown = e => { lastMouseDownTarget = e.target; };
    document.addEventListener('mousedown', mdown, true);

    // If the toolbar is marked as 'restorable' (i.e., disabled at open), prevent any focus
    // moving into it and redirect focus back to the editor surface.
    toolbar.addEventListener('focusin', (e) => {
      try {
        if (toolbar.dataset.restorable === 'true') {
          e.stopPropagation();
          e.preventDefault();
          editor.focus();
          saveSelection();
        }
      } catch (err) { /* noop */ }
    }, true);

    // If focus moves into the toolbar without a corresponding mousedown on that control,
    // assume it was unintended and return focus to the editor. This avoids cases where
    // the toolbar's select becomes focused immediately after clicking the editor.
    const focusinTrap = e => {
      try {
        if (toolbar.contains(e.target) && lastMouseDownTarget !== e.target) {
          e.preventDefault();
          editor.focus();
          saveSelection();
        }
      } catch (err) { /* noop */ }
    };

    editor.addEventListener('focus', () => {
      document.addEventListener('focusin', focusinTrap, true);
      shell.classList.add('focused');
    });
    editor.addEventListener('blur', () => {
      document.removeEventListener('focusin', focusinTrap, true);
      shell.classList.remove('focused');
    });

    textarea.addEventListener('input', () => {
      if (syncingFromEditor) return;
      editor.innerHTML = textToHtml(textarea.value);
      textarea.dataset.richHtml = sanitizeHtml(editor.innerHTML);
    });

    activeEditors.set(textarea, { shell, toolbar, editor, syncSource, restoreSelection, saveSelection });
    set(textarea, textarea.value, options.html);
    return editor;
  }

  function set(textarea, plainText, html) {
    const entry = activeEditors.get(textarea);
    textarea.value = String(plainText || '');
    const cleanHtml = sanitizeHtml(html || textToHtml(plainText));
    textarea.dataset.richHtml = cleanHtml;
    if (entry) entry.editor.innerHTML = cleanHtml;
  }

  function getHtml(textarea) {
    const entry = activeEditors.get(textarea);
    return sanitizeHtml(entry ? entry.editor.innerHTML : textarea?.dataset.richHtml || textToHtml(textarea?.value));
  }

  function getEditor(textarea) {
    return activeEditors.get(textarea)?.editor || null;
  }

  function focus(textarea) {
    const editor = getEditor(textarea);
    (editor || textarea)?.focus();
  }

  function appendText(textarea, addition, separator = '\n\n') {
    const entry = activeEditors.get(textarea);
    const currentText = textarea?.value || '';
    const nextText = `${currentText}${currentText.trim() ? separator : ''}${addition || ''}`;
    const separatorHtml = textToHtml(separator);
    const nextHtml = `${getHtml(textarea)}${currentText.trim() ? separatorHtml : ''}${textToHtml(addition)}`;
    set(textarea, nextText, nextHtml);
    if (entry) entry.syncSource();
    else textarea.dispatchEvent(new Event('input', { bubbles: true }));
    (entry?.editor || textarea)?.focus();
  }

  function insertText(textarea, text) {
    const entry = activeEditors.get(textarea);
    if (!entry) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || start;
      textarea.setRangeText(text, start, end, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
      return;
    }
    entry.restoreSelection();
    document.execCommand('insertText', false, text);
    entry.saveSelection();
    entry.syncSource();
  }

  window.RichText = { enhance, set, getHtml, getEditor, focus, appendText, insertText, sanitizeHtml, textToHtml };
})();
