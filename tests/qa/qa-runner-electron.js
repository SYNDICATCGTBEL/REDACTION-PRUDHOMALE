const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
(async () => {
  const root = path.resolve(__dirname);
  const indexUrl = 'file://' + path.join(root, 'index.html').replace(/\\/g, '/');
  const qaFile = path.join(root, 'qa-0.3.44', 'repeated-rule-edit-qa.js');
  if (!fs.existsSync(qaFile)) {
    console.error('QA file not found:', qaFile);
    process.exit(2);
  }
  const qaCode = fs.readFileSync(qaFile, 'utf8');
  // Launch electron with remote debugging port
  console.log('Launching Electron with remote-debugging-port=9222');
  const electronProc = child_process.spawn('npx', ['electron', '.', '--remote-debugging-port=9222'], { cwd: root, shell: true, stdio: ['ignore','pipe','pipe'] });
  electronProc.stdout.on('data', d => process.stdout.write('[ELECTRON] '+d.toString()));
  electronProc.stderr.on('data', d => process.stderr.write('[ELECTRON_ERR] '+d.toString()));

  // wait for devtools websocket to be available
  const puppeteer = require('puppeteer');
  const maxWait = 30000; // 30s
  const start = Date.now();
  let browser = null;
  while (Date.now() - start < maxWait) {
    try {
      browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
      break;
    } catch (e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!browser) {
    console.error('Unable to connect to Electron debug port');
    electronProc.kill();
    process.exit(3);
  }
  try {
    const pages = await browser.pages();
    let page = pages.find(p => (p.url() || '').includes('index.html')) || pages[0];
    if (!page) page = await browser.newPage();
    console.log('Using page with url:', page.url());
    page.on('console', msg => console.log('PAGE LOG>', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR>', err.message));
    // Ensure full load
    await new Promise(r=>setTimeout(r,800));
    // Run QA code in page context
    console.log('Evaluating QA script...');
    const result = await page.evaluate(new Function('return (async () => { ' + qaCode + ' })()'));
    console.log('QA result:', JSON.stringify(result, null, 2));
    await browser.disconnect();
  } catch (err) {
    console.error('Runner error:', err);
  } finally {
    try { electronProc.kill(); } catch(e) {}
    process.exit(0);
  }
})();