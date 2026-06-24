// Verifies the Timeline page now shows the horizontal subcategory bar (like
// other project pages), highlights "Project Timeline", and that the Timeline
// info card derives Project Start/Duration from milestones (no more "—").
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9339;
const API = 'http://localhost:8000/api/v1';
const APP = 'http://localhost:5173/projects/timeline/21';
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

  let pass = true;
  const check = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) pass = false; };

  check('Subcategory bar present ("Project Management Subcategories")', await evaluate(ws, `document.body.innerText.includes('Project Management Subcategories')`));
  check('Subnav has "Project Timeline" tab', await evaluate(ws, `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Project Timeline')`));
  check('Subnav has "Project Site Survey" tab', await evaluate(ws, `[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Project Site Survey')`));

  // Switch to Gantt View to check the Timeline info card derives dates
  await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Gantt View'); if(b) b.click(); })()`);
  await sleep(1500);
  const hasProjectStart = await evaluate(ws, `(() => {
    const txt = document.body.innerText;
    const idx = txt.toLowerCase().indexOf('project start');
    return idx >= 0 ? txt.slice(idx, idx + 70).replace(/\\n/g,' ') : '(not found)';
  })()`);
  console.log('  Timeline card "Project Start" context:', JSON.stringify(hasProjectStart));
  check('Project Start derived (shows a month/date, not —)', /Apr|May|Jun|Jul|Jan|Feb|Mar|Aug|Sep|Oct|Nov|Dec/.test(hasProjectStart));

  // Navigate away via subnav: click "Project Site Survey"
  const navAway = await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Project Site Survey'); if(b){b.click();return true;} return false; })()`);
  await sleep(3000);
  const heading = await evaluate(ws, `document.querySelector('h1,h2')?.innerText || ''`);
  console.log('  After clicking "Project Site Survey", heading:', JSON.stringify(heading));
  check('Subnav navigation works (left Timeline page)', navAway && !/^Timeline$/.test(heading));

  if (errors.length) { console.log('\\nConsole errors:'); errors.forEach((e) => console.log('  -', e)); pass = false; } else console.log('\\nNo console errors. ✓');
  ws.close(); chrome.kill();
  console.log(`\\nRESULT: ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(pass ? 0 : 1);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
