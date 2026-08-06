const path = require('path');
const child_process = require('child_process');
const puppeteer = require('puppeteer');
(async () => {
  const root = path.resolve(__dirname);
  const electronProc = child_process.spawn('npx', ['electron', '.', '--remote-debugging-port=9222'], { cwd: root, shell: true, stdio:['ignore','pipe','pipe'] });
  electronProc.stdout.on('data', d => process.stdout.write('[ELECTRON] '+d.toString()));
  electronProc.stderr.on('data', d => process.stderr.write('[ELECTRON_ERR] '+d.toString()));
  let browser = null; const start = Date.now();
  while (!browser && Date.now()-start < 30000) { try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' }); } catch(e){ await new Promise(r=>setTimeout(r,300)); } }
  if (!browser) { console.error('Cannot connect'); electronProc.kill(); process.exit(1); }
  const pages = await browser.pages();
  const page = pages.find(p=> (p.url()||'').includes('index.html')) || pages[0];
  page.on('console', msg=>console.log('PAGE LOG>', msg.text()));
  // open dialog
  await page.evaluate(()=>{ const btn = [...document.querySelectorAll('button')].find(b=>b.textContent && b.textContent.includes('Ajouter une règle')); if (btn) btn.click(); });
  await new Promise(r=>setTimeout(r,500));
  const status = await page.evaluate(()=>{
    const ids=['ruleEditorDemande','ruleEditorRule','ruleEditorEnEspece','ruleEditorEnConsequence','ruleEditorEnConsequenceAccordee','ruleEditorEnConsequenceRejetee','ruleEditorEnConsequencePartielle'];
    return ids.map(id=>{
      const ta = document.getElementById(id);
      const shell = ta?.previousElementSibling;
      const editor = shell?.querySelector('.word-editor-surface');
      const toolbar = shell?.querySelector('.word-toolbar');
      return { id, exists: !!ta, shellExists: !!shell, editorExists: !!editor, toolbarExists: !!toolbar, editorInnerHTML: editor?.innerHTML?.slice(0,80) || '' };
    });
  });
  console.log('Status:', JSON.stringify(status,null,2));
  await browser.disconnect();
  try{ electronProc.kill(); }catch(e){}
  process.exit(0);
})();