const fs = require('fs');
const path = require('path');
(async () => {
  try {
    const root = path.resolve(__dirname);
    const indexUrl = 'file://' + path.join(root, 'index.html').replace(/\\/g, '/');
    const qaFile = path.join(root, 'qa-0.3.44', 'repeated-rule-edit-qa.js');
    if (!fs.existsSync(qaFile)) {
      console.error('QA file not found:', qaFile);
      process.exit(2);
    }
    const qaCode = fs.readFileSync(qaFile, 'utf8');
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG>', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR>', err.message));
    console.log('Navigating to', indexUrl);
    await page.goto(indexUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    // wait for app elements to load
    await page.waitForSelector('#caseList', { timeout: 15000 }).catch(()=>{});
    console.log('Injecting and running QA script...');
    const result = await page.evaluate(async (code) => {
      try {
        // The QA file is an IIFE that returns a promise; eval it and await result
        return await eval(code);
      } catch (e) {
        return { __evalError: String(e) };
      }
    }, qaCode);
    console.log('QA result:', JSON.stringify(result, null, 2));
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Runner error:', err);
    process.exit(1);
  }
})();