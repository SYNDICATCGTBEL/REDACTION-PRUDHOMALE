const path = require('path');
const child_process = require('child_process');
const puppeteer = require('puppeteer');
(async () => {
  const root = path.resolve(__dirname);
  console.log('Launching Electron with remote debugging');
  const electronProc = child_process.spawn('npx', ['electron', '.', '--remote-debugging-port=9222'], { cwd: root, shell: true, stdio: ['ignore','pipe','pipe'] });
  electronProc.stdout.on('data', d => process.stdout.write('[ELECTRON] '+d.toString()));
  electronProc.stderr.on('data', d => process.stderr.write('[ELECTRON_ERR] '+d.toString()));
  let browser = null; const start = Date.now();
  while (!browser && Date.now()-start < 30000) { try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' }); } catch(e){ await new Promise(r=>setTimeout(r,300)); } }
  if (!browser) { console.error('Cannot connect to Electron'); electronProc.kill(); process.exit(1); }
  const pages = await browser.pages();
  const page = pages.find(p => (p.url()||'').includes('index.html')) || pages[0];
  page.on('console', msg => console.log('PAGE LOG>', msg.text()));
  console.log('Clicking Add Rule button');
  await page.evaluate(()=>{ const btn = [...document.querySelectorAll('button')].find(b=>b.textContent && b.textContent.includes('Ajouter une règle')); if (btn) btn.click(); });
  await new Promise(r=>setTimeout(r,300));
  // Get bounding rect of editor surface
  const rect = await page.evaluate(()=>{
    const textarea = document.getElementById('ruleEditorRule');
    const shell = textarea?.previousElementSibling;
    const editor = shell?.querySelector('.word-editor-surface');
    if (!editor) return null;
    const r = editor.getBoundingClientRect();
    return { x: r.left + r.width/2, y: r.top + r.height/2, w: r.width, h: r.height };
  });
  if (!rect) { console.log('Editor not found'); await browser.disconnect(); try{electronProc.kill();}catch(e){}; process.exit(2); }
  console.log('Editor rect', rect);
  // Puppeteer mouse coordinates are relative to the page viewport, ensure viewport size fits
  try { await page.setViewport({ width: Math.max(1200, Math.ceil(rect.x+200)), height: Math.max(800, Math.ceil(rect.y+200)) }); } catch(e){}
  // perform real click at center
  console.log('Performing real mouse click at center');
  await page.mouse.click(rect.x, rect.y, { delay: 100 });
  await new Promise(r=>setTimeout(r,300));
  const info = await page.evaluate(()=>{
    const active = document.activeElement;
    const font = document.querySelector('[data-rich-font]');
    const fontSelectFocused = document.activeElement === font;
    return { activeTag: active?.tagName, activeClass: active?.className, activeId: active?.id, fontSelectFocused };
  });
  console.log('After real click focus info:', info);
  await browser.disconnect();
  try { electronProc.kill(); } catch(e){}
  process.exit(0);
})();