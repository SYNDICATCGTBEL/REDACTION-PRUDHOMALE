(function () {
  const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'SUB', 'SUP', 'SPAN', 'FONT', 'P', 'DIV', 'BR', 'H2', 'H3', 'UL', 'OL', 'LI']);
  const STYLE_PROPERTIES = new Set(['font-family', 'font-size', 'color', 'background-color', 'text-align', 'line-height', 'margin-bottom']);
  const FONT_SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24'];
  const activeEditors = new WeakMap();

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>\"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  }

  function textToHtml(value) {
    const text = escapeHtml(String(value || '').replace(/\r/g, ''));
    if (!text) return '';
    return text.split('\n').map(line => `<div>${line || '<br>'}</div>`).join('');
  }

  function cleanCssValue(property, value) {
    const candidate = String(value || '').trim();
    if (!candidate || /[<>"'`;{}]/.test(candidate)) return '';
    if (property === 'font-size' && !/^\d+(?:\.\d+)?(?:pt|px|em|rem|%)$/i.test(candidate)) return '';
    if ((property === 'color' || property === 'background-color') && !/^(?:#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)$/i.test(candidate)) return '';
    if (property === 'text-align' && !/^(?:left|center|right|justify)$/i.test(candidate)) return '';
    if (property === 'line-height' && !/^(?:\d+(?:\.\d+)?(?:pt|px|em|rem|%)?|normal)$/i.test(candidate)) return '';
    if (property === 'margin-bottom' && !/^(?:\d+(?:\.\d+)?(?:pt|px|em|rem|%)?|0)$/i.test(candidate)) return '';
    if (property === 'font-family' && !/^[\w\s,"'-]+$/u.test(candidate)) return '';
    return candidate;
  }

  function stripWordMarkup(html) {
    let result = String(html || '');
    result = result.replace(/<!--\[if[\s\S]*?<![\s]*endif[\s]*]-->/gi, '');
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    result = result.replace(/<\/?(xml|o:\w+|w:\w+|m:\w+|v:\w+|st\d*:\w+)[^>]*>/gi, '');
    result = result.replace(/mso-[^;"']+;?/gi, '');
    result = result.replace(/\s+class\s*=\s*["'][^"']*["']/gi, '');
    result = result.replace(/\s+style\s*=\s*["']\s*["']/gi, '');
    return result;
  }

  function sanitizeHtml(value) {
    const stripped = stripWordMarkup(value);
    const template = document.createElement('template');
    template.innerHTML = stripped;
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
        <label class="word-toolbar-select word-spacing-select">Interligne
          <select data-rich-lineheight aria-label="Espacement des lignes">
            <option value="1">1.0 (Simple)</option>
            <option value="1.15" selected>1.15 (Standard)</option>
            <option value="1.5">1.5 (1,5 ligne)</option>
            <option value="2">2.0 (Double)</option>
          </select>
        </label>
        <label class="word-toolbar-select word-spacing-select">Esp. §
          <select data-rich-paraspacing aria-label="Espacement de paragraphe">
            <option value="0">Aucun</option>
            <option value="0.25em" selected>Compact</option>
            <option value="0.5em">Normal</option>
            <option value="1em">Spacieux</option>
            <option value="1.5em">Large</option>
          </select>
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
    const explicitLabel = textarea.id ? document.querySelector(`label[for="${CSS.escape(textarea.id)}"]`) : null;
    editor.setAttribute('aria-label', textarea.getAttribute('aria-label') || explicitLabel?.textContent?.trim() || textarea.closest('label')?.childNodes[0]?.textContent?.trim() || 'Zone de rédaction');
    editor.dataset.placeholder = textarea.getAttribute('placeholder') || 'Rédigez cette partie…';
    shell.append(toolbar, editor);
    shell.addEventListener('mousedown', event => event.stopPropagation());
    shell.addEventListener('click', event => event.stopPropagation());
    textarea.before(shell);
    textarea.classList.add('rich-text-source');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.tabIndex = -1;

    let savedRange = null;
    let syncingFromEditor = false;
    const clearSelection = () => {
      savedRange = null;
    };
    const saveSelection = () => {
      if (!selectionInside(editor)) return;
      const selection = window.getSelection();
      savedRange = selection.getRangeAt(0).cloneRange();
    };
    const restoreSelection = () => {
      editor.focus();
      if (!savedRange) return;
      if (!editor.contains(savedRange.commonAncestorContainer)) {
        clearSelection();
        return;
      }
      try {
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
      } catch (err) {
        clearSelection();
        console.warn('Failed to restore selection:', err);
      }
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
      if (selectionInside(editor)) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let container = selection.getRangeAt(0).commonAncestorContainer;
          if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
          const block = container.closest('p, div, h2, h3, li') || editor;
          const lineSelect = toolbar.querySelector('[data-rich-lineheight]');
          if (lineSelect && block?.style?.lineHeight) lineSelect.value = block.style.lineHeight;
        }
        const paraSelect = toolbar.querySelector('[data-rich-paraspacing]');
        if (paraSelect && editor.dataset.paraspacing) paraSelect.value = editor.dataset.paraspacing;
      }
    };
    const syncSource = (emit = true) => {
      syncingFromEditor = true;
      try {
        textarea.value = editorText(editor);

        const valPara = editor.dataset.paraspacing;
        const valLine = editor.dataset.lineheight;
        if (valPara || valLine) {
          editor.querySelectorAll('p, div, h2, h3, li').forEach(b => {
            if (valPara) b.style.marginBottom = valPara;
            if (valLine) b.style.lineHeight = valLine;
          });
        }

        textarea.dataset.richHtml = sanitizeHtml(editor.innerHTML);
        if (emit) textarea.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {
        console.error('Error during editor synchronization:', err);
      } finally {
        syncingFromEditor = false;
      }
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
    toolbar.querySelectorAll('select').forEach(sel => {
      sel.addEventListener('mousedown', () => saveSelection());
    });
    toolbar.querySelector('[data-rich-font]').addEventListener('change', event => {
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('fontName', false, event.target.value);
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
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
      setTimeout(() => editor.focus(), 0);
    });
    toolbar.querySelector('[data-rich-lineheight]').addEventListener('change', event => {
      restoreSelection();
      const val = event.target.value;
      // Store on editor element so it survives re-renders
      editor.dataset.lineheight = val;
      if (val) {
        editor.querySelectorAll('p, div, h2, h3, li').forEach(b => b.style.lineHeight = val);
      } else {
        editor.querySelectorAll('p, div, h2, h3, li').forEach(b => b.style.lineHeight = '');
      }
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
    });
    toolbar.querySelector('[data-rich-paraspacing]').addEventListener('change', event => {
      restoreSelection();
      const val = event.target.value;
      editor.dataset.paraspacing = val;
      // CSS variable applies automatically to ALL blocks, present and future
      editor.style.setProperty('--para-spacing', val);
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
    });
    toolbar.querySelector('[data-rich-block]').addEventListener('change', event => {
      restoreSelection();
      document.execCommand('formatBlock', false, event.target.value);
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
    });
    toolbar.querySelector('[data-rich-color]').addEventListener('input', event => {
      if (!event.target.value) return;
      restoreSelection();
      document.execCommand('styleWithCSS', false, false);
      document.execCommand('foreColor', false, event.target.value);
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
    });
    toolbar.querySelector('[data-rich-highlight]').addEventListener('input', event => {
      if (!event.target.value) return;
      restoreSelection();
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('hiliteColor', false, event.target.value);
      saveSelection();
      syncSource();
      setTimeout(() => editor.focus(), 0);
    });
    editor.addEventListener('input', () => {
      saveSelection();
      syncSource();
      updateToolbarState();
    });
    editor.addEventListener('keyup', () => { saveSelection(); updateToolbarState(); });
    editor.addEventListener('mouseup', () => { saveSelection(); updateToolbarState(); });
    editor.addEventListener('contextmenu', saveSelection);
    editor.addEventListener('focus', () => { saveSelection(); shell.classList.add('focused'); });
    editor.addEventListener('blur', () => shell.classList.remove('focused'));
    editor.addEventListener('paste', event => {
      event.preventDefault();
      const html = event.clipboardData?.getData('text/html');
      const text = event.clipboardData?.getData('text/plain') || '';
      if (html) {
        const cleaned = sanitizeHtml(html);
        const textContent = cleaned.replace(/<[^>]*>/g, '').trim();
        document.execCommand('insertHTML', false, textContent ? cleaned : escapeHtml(text));
      } else {
        document.execCommand('insertText', false, text);
      }
    });

    textarea.addEventListener('input', () => {
      if (syncingFromEditor) return;
      editor.innerHTML = textToHtml(textarea.value);
      textarea.dataset.richHtml = sanitizeHtml(editor.innerHTML);
    });

    activeEditors.set(textarea, { shell, toolbar, editor, syncSource, restoreSelection, saveSelection, clearSelection });
    set(textarea, textarea.value, options.html);
    return editor;
  }

  function normalizeBlocks(editor) {
    const newChildren = [];
    let currentBlock = null;
    [...editor.childNodes].forEach(node => {
      const isBlock = node.nodeType === Node.ELEMENT_NODE && ['P', 'DIV', 'H2', 'H3', 'UL', 'OL'].includes(node.tagName);
      if (isBlock) {
        if (currentBlock) { newChildren.push(currentBlock); currentBlock = null; }
        newChildren.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
        if (currentBlock) { newChildren.push(currentBlock); currentBlock = null; }
        else {
          const div = document.createElement('div');
          div.appendChild(document.createElement('br'));
          newChildren.push(div);
        }
      } else {
        if (!currentBlock) currentBlock = document.createElement('div');
        currentBlock.appendChild(node);
      }
    });
    if (currentBlock) newChildren.push(currentBlock);
    if (newChildren.length > 0) {
      editor.innerHTML = '';
      newChildren.forEach(child => editor.appendChild(child));
    }
  }

  function set(textarea, plainText, html) {
    const entry = activeEditors.get(textarea);
    textarea.value = String(plainText || '');
    const cleanHtml = sanitizeHtml(html || textToHtml(plainText));
    textarea.dataset.richHtml = cleanHtml;
    if (entry) {
      entry.clearSelection();
      entry.editor.innerHTML = cleanHtml;
      normalizeBlocks(entry.editor);

      // Detect global styles from the first block if present
      const firstBlock = entry.editor.querySelector('p, div, h2, h3, li');
      if (firstBlock) {
        if (firstBlock.style.lineHeight && !entry.editor.dataset.lineheight) {
          entry.editor.dataset.lineheight = firstBlock.style.lineHeight;
        }
        if (firstBlock.style.marginBottom && !entry.editor.dataset.paraspacing) {
          entry.editor.dataset.paraspacing = firstBlock.style.marginBottom;
        }
      }

      const storedLh = entry.editor.dataset.lineheight;
      if (storedLh) entry.editor.style.lineHeight = storedLh;
      const storedPs = entry.editor.dataset.paraspacing;
      if (storedPs) entry.editor.style.setProperty('--para-spacing', storedPs);

      // Ensure all blocks have the correct styles applied immediately
      if (storedPs || storedLh) {
        entry.editor.querySelectorAll('p, div, h2, h3, li').forEach(b => {
          if (storedPs) b.style.marginBottom = storedPs;
          if (storedLh) b.style.lineHeight = storedLh;
        });
      }
    }
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
