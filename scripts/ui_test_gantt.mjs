// Adds a SCHEDULED task (with start+end dates) via the Timeline UI, then
// verifies it renders as a bar on the redesigned Gantt View + persists in DB.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9337;
const API = 'http://localhost:8000/api/v1';
const APP = 'http://localhost:5173/projects/timeline/21';
const TITLE = `Gantt test ${new Date().toISOString().slice(11, 19)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// schedule window: today .. today+10
const d0 = new Date();
const d1 = new Date(Date.now() + 10 * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const START = iso(d0), END = iso(d1);
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const expectMonth = `${monthNames[d0.getMonth()]} ${d0.getFullYear()}`;

async function login() {
  const res = await fetch(`${API}/auth/login/`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@malwasolar.com', password: 'Malwa@2024' }) });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return res.json();
}
let msgId = 0;
function rpc(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => { const m = JSON.parse(ev.data); if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } };
    ws.addEventListener('message', onMsg); ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(ws, expression) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}
const setInput = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'no:' + ${JSON.stringify(sel)};
  const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return el.value;
})()`;

const main = async () => {
  const { access, refresh } = await login();
  console.log('✓ logged in | schedule', START, '→', END, '| expect month header:', expectMonth);
  const userDir = mkdtempSync(join(tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`, '--headless=new', '--disable-gpu', '--no-sandbox', 'about:blank']);
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await sleep(250); try { const t = await (await fetch(`http://localhost:${PORT}/json`)).json(); const p = t.find((x) => x.type === 'page'); if (p) wsUrl = p.webSocketDebuggerUrl; } catch {} }
  if (!wsUrl) throw new Error('no page target');
  const ws = new WebSocket(wsUrl); await new Promise((res) => { ws.onopen = res; });
  const errors = [];
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC: ' + (m.params.exceptionDetails.exception?.description || '')); });
  await rpc(ws, 'Runtime.enable'); await rpc(ws, 'Page.enable');
  const prefs = JSON.stringify({ currentPage: 'dashboard', activeSidebarItem: 'Project Timeline', desktopSidebarCollapsed: false });
  await rpc(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('malwa_access', ${JSON.stringify(access)});
    localStorage.setItem('malwa_refresh', ${JSON.stringify(refresh)});
    localStorage.setItem('malwa-solar-crm:ui-preferences', ${JSON.stringify(prefs)});` });
  await rpc(ws, 'Page.navigate', { url: APP });
  await sleep(5000);

  // Add a scheduled task
  console.log('Add Task clicked:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Task'); if(b){b.click();return true;} return false; })()`));
  await sleep(900);
  console.log('  title:', await evaluate(ws, setInput('input[placeholder="e.g. Site survey completed"]', TITLE)) === TITLE ? '✓' : '✗');
  console.log('  start:', await evaluate(ws, setInput('input[type="date"]', START)));
  // second date input = end date
  console.log('  end:', await evaluate(ws, `(() => {
    const els = document.querySelectorAll('input[type="date"]'); const el = els[1]; if(!el) return 'no-end';
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(el, ${JSON.stringify(END)});
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return el.value;
  })()`));
  await evaluate(ws, setInput('input[inputmode="numeric"]', '50'));
  await sleep(300);
  console.log('Save Task clicked:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>/Save Task|Saving/.test(x.textContent)); if(b){b.click();return true;} return false; })()`));
  await sleep(2800);

  // Switch to Gantt View
  console.log('Gantt View tab:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Gantt View'); if(b){b.click();return true;} return false; })()`));
  await sleep(1500);

  let pass = true;
  const check = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) pass = false; };

  const monthHeaderShown = await evaluate(ws, `document.body.innerText.includes(${JSON.stringify(expectMonth)})`);
  check(`Month-grouped header shows "${expectMonth}"`, monthHeaderShown);

  const taskRowShown = await evaluate(ws, `document.body.innerText.includes(${JSON.stringify(TITLE)})`);
  check('New task appears in Gantt rows', taskRowShown);

  const barExists = await evaluate(ws, `!!document.querySelector('[title*=${JSON.stringify(TITLE)}]')`);
  check('Task is drawn as a Gantt bar (with tooltip)', barExists);

  const todayMarker = await evaluate(ws, `document.body.innerText.includes('marks today')`);
  check('Today marker legend present', todayMarker);

  // DB persistence
  const apiMs = await (await fetch(`${API}/project-milestones/?project=21`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const list = Array.isArray(apiMs) ? apiMs : (apiMs.results || []);
  const flat = list.flatMap((m) => [m, ...(m.children || [])]);
  const found = flat.find((m) => m.title === TITLE);
  check(`Persisted in DB with dates (id=${found?.id}, ${found?.start_date}→${found?.end_date}, ${found?.progress_percent}%)`, !!found && found.start_date === START && found.end_date === END);

  if (errors.length) { console.log('\\nConsole errors:'); errors.forEach((e) => console.log('  -', e)); pass = false; } else console.log('\\nNo console errors. ✓');
  ws.close(); chrome.kill();
  console.log(`\\nRESULT: ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(pass ? 0 : 1);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
