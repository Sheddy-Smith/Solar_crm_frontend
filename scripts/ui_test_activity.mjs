// Drives the real CRM UI to add a test Activity via the new modal, then verifies.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const API = 'http://localhost:8000/api/v1';
const APP = 'http://localhost:5173/projects/details/21';
const TITLE = `UI test activity ${new Date().toISOString().slice(11, 19)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const main = async () => {
  const { access, refresh } = await login();
  console.log('✓ logged in');
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
  const prefs = JSON.stringify({ currentPage: 'dashboard', activeSidebarItem: 'Dashboard', desktopSidebarCollapsed: false });
  await rpc(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('malwa_access', ${JSON.stringify(access)});
    localStorage.setItem('malwa_refresh', ${JSON.stringify(refresh)});
    localStorage.setItem('malwa-solar-crm:ui-preferences', ${JSON.stringify(prefs)});` });
  await rpc(ws, 'Page.navigate', { url: APP });
  await sleep(4500);

  console.log('Activities tab:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Activities'); if(b){b.click();return true;} return false; })()`));
  await sleep(1200);
  console.log('Add Activity clicked:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Add Activity'); if(b){b.click();return true;} return false; })()`));
  await sleep(1000);

  const filled = await evaluate(ws, `(() => {
    const inp = document.querySelector('input[placeholder="e.g. Rooftop site survey"]');
    if (!inp) return 'no-input';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(inp, ${JSON.stringify(TITLE)});
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return inp.value;
  })()`);
  console.log('Activity name filled:', filled === TITLE ? '✓' : filled);
  await sleep(400);
  console.log('Save Activity clicked:', await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>/Save Activity|Saving/.test(x.textContent)); if(b){b.click();return true;} return false; })()`));
  await sleep(2800);

  const inUI = await evaluate(ws, `document.body.innerText.includes(${JSON.stringify(TITLE)})`);
  console.log('Activity visible in UI:', inUI ? '✓ YES' : '✗ NO');
  const apiAct = await (await fetch(`${API}/project-activities/?project=21`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const list = Array.isArray(apiAct) ? apiAct : (apiAct.results || []);
  const found = list.find((a) => a.title === TITLE);
  console.log('Persisted in DB:', found ? `✓ YES (id=${found.id}, type=${found.activity_type}, status=${found.status}, priority=${found.priority})` : '✗ NO');
  console.log('Total activities for project 21:', list.length);
  if (errors.length) { console.log('\\nConsole errors:'); errors.forEach((e) => console.log('  -', e)); } else console.log('\\nNo console errors. ✓');
  ws.close(); chrome.kill(); process.exit(found && inUI ? 0 : 1);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
