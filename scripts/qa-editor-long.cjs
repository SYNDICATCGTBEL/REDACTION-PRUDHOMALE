const http = require('node:http');
const WebSocket = require('ws');

const port = Number(process.env.QA_CDP_PORT || 9343);
const cycles = Number(process.env.QA_CYCLES || 30);
const pauseMs = Number(process.env.QA_PAUSE_MS || 8000);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const getJson = url => new Promise((resolve, reject) => http.get(url, response => {
  let body = '';
  response.on('data', chunk => { body += chunk; });
  response.on('end', () => resolve(JSON.parse(body)));
}).on('error', reject));

(async () => {
  const [page] = await getJson(`http://127.0.0.1:${port}/json`);
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(resolve => socket.once('open', resolve));
  let nextId = 0;
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const receive = data => {
      const message = JSON.parse(data);
      if (message.id !== id) return;
      socket.off('message', receive);
      if (message.error) reject(message.error);
      else resolve(message.result);
    };
    socket.on('message', receive);
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const clickPoint = async ({ x, y }) => {
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const state = () => evaluate(`(() => {
    const textarea=document.getElementById('ruleEditorRule');
    const editor=window.RichText.getEditor(textarea);
    const selection=window.getSelection();
    const range=selection.rangeCount?selection.getRangeAt(0):null;
    const container=range?.commonAncestorContainer;
    const rect=editor?.getBoundingClientRect();
    return {
      time:new Date().toISOString(),
      dialogOpen:document.getElementById('ruleEditorDialog').open,
      shellCount:document.getElementById('ruleEditorDialog').querySelectorAll('.word-editor').length,
      activeTag:document.activeElement?.tagName,
      activeClass:document.activeElement?.className,
      editorActive:document.activeElement===editor,
      selectionCount:selection.rangeCount,
      selectionCollapsed:Boolean(range?.collapsed),
      selectionInside:Boolean(editor&&container&&(container===editor||editor.contains(container))),
      contentEditable:editor?.contentEditable,
      caretColor:editor?getComputedStyle(editor).caretColor:null,
      point:rect?{x:Math.round(rect.left+Math.min(80,rect.width/3)),y:Math.round(rect.top+Math.min(35,rect.height/3))}:null
    };
  })()`);

  const profile = await evaluate(`(() => {
    const changes=JSON.parse(localStorage.getItem('redaction-prudhomale-rules-v1')||'{}');
    return {options:document.querySelectorAll('[data-stable-rule-select] option[value]:not([value=""])').length,groups:[...document.querySelectorAll('[data-stable-rule-select] optgroup')].map(group=>group.label),countText:document.querySelector('[data-stable-rule-count]')?.textContent,deleted:(changes.deleted||[]).length,overrides:Object.keys(changes.overrides||{}).length,custom:(changes.custom||[]).length};
  })()`);
  const failures = [];
  const samples = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    await evaluate(`(() => {
      const search=document.querySelector('[data-stable-rule-search]');
      search.value=''; search.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await delay(350);
    await evaluate(`(() => {
      const select=document.querySelector('[data-stable-rule-select]');
      select.value=[...select.options].map(option=>option.value).find(Boolean);
      document.querySelector('[data-stable-rule-edit]').click();
    })()`);
    await delay(750);
    let snapshot = await state();
    if (snapshot.point) await clickPoint(snapshot.point);
    await delay(pauseMs);
    snapshot = await state();
    samples.push({ cycle, phase: 'after-real-click-and-pause', ...snapshot });
    if (!snapshot.editorActive || !snapshot.selectionInside || !snapshot.selectionCollapsed || snapshot.contentEditable !== 'true' || snapshot.caretColor !== 'rgb(20, 37, 61)') {
      failures.push({ cycle, phase: 'editing', ...snapshot });
      break;
    }
    await evaluate(`document.getElementById('ruleEditorForm').requestSubmit()`);
    await delay(1000);
    await evaluate(`(() => {
      const select=document.querySelector('[data-stable-rule-select]');
      select.value=[...select.options].map(option=>option.value).find(Boolean);
      document.querySelector('[data-stable-rule-edit]').click();
    })()`);
    await delay(750);
    await evaluate(`(() => { const old=window.confirm; window.confirm=()=>true; document.getElementById('deleteRuleButton').click(); window.confirm=old; })()`);
    await delay(1000);
    const closed = await state();
    samples.push({ cycle, phase: 'after-delete', ...closed });
    if (closed.dialogOpen || closed.shellCount !== 0) {
      failures.push({ cycle, phase: 'after-delete', ...closed });
      break;
    }
  }
  console.log(JSON.stringify({ startedAt: samples[0]?.time, finishedAt: new Date().toISOString(), requestedCycles: cycles, completedCycles: samples.filter(item => item.phase === 'after-delete').length, pauseMs, profile, failures, lastSamples: samples.slice(-6) }, null, 2));
  socket.close();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
