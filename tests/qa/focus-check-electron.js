const path = require('path');
const child_process = require('child_process');
const puppeteer = require('puppeteer');
(async () => {
  const root = path.resolve(__dirname);
  console.log('Launching Electron with remote debugging');
  const electronProc = child_process.spawn('npx', ['electron', '.', '--remote-debugging-port=9222'], { cwd: root, shell: true, stdio: ['ignore','pipe','pipe'] });
  electronProc.stdout.on('data', d => process.stdout.write('[ELECTRON] '+d.toString()));
  electronProc.stderr.on('data', d => process.stderr.write('[ELECTRON_ERR] '+d.toString()));
  // connect
  let browser = null;
  const start = Date.now();
  while (!browser && Date.now() - start < 30000) {
    try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' }); } catch(e){ await new Promise(r=>setTimeout(r,300)); }
  }
  if (!browser) { console.error('Cannot connect to Electron'); electronProc.kill(); process.exit(1); }
  const pages = await browser.pages();
  const page = pages.find(p => (p.url()||'').includes('index.html')) || pages[0];
  page.on('console', msg => console.log('PAGE LOG>', msg.text()));
  console.log('Opening rule editor via UI click...');
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent && b.textContent.includes('Ajouter une règle'));
    if (btn) btn.click();
    return !!btn;
  });
  await new Promise(r=>setTimeout(r,400));
  const info = await page.evaluate(() => {
    const textarea = document.getElementById('ruleEditorRule');
    const shell = textarea?.previousElementSibling;
    const editor = shell?.querySelector('.word-editor-surface');
    const fontSelect = shell?.querySelector('[data-rich-font]');
    // simulate user click inside editor
    if (editor) {
      editor.focus();
      const ev = new MouseEvent('mousedown', { bubbles: true });
      editor.dispatchEvent(ev);
      const ev2 = new MouseEvent('mouseup', { bubbles: true });
      editor.dispatchEvent(ev2);
    }
    const active = document.activeElement;
    return {
      activeTag: active?.tagName,
      activeClass: active?.className,
      activeId: active?.id,
      fontHasFocus: document.activeElement === fontSelect,
      editorExists: !!editor
    };
  });
  console.log('Focus info:', info);
  await browser.disconnect();
  try { electronProc.kill(); } catch(e) {}
  process.exit(0);
})();