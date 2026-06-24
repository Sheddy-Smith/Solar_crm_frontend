// Verifies the Timeline "Overall Progress" ring now shows the REAL computed
// average completion (Completed=100%), matching the ring — not the stale
// project.progress_percent field.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9338;
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
  // Ground truth: compute expected overall progress from milestones
  const detail = await (await fetch(`${API}/projects/21/`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const tops = detail.milestones || [];
  const all = tops.flatMap((m) => [m, ...(m.children || [])]);
  const expected = all.length
    ? Math.round(all.reduce((s, m) => s + (m.status === 'Completed' ? 100 : Number(m.progress_percent || 0)), 0) / all.length)
    : Number(detail.progress_percent || 0);
  console.log(`DB: ${all.length} tasks | stale project.progress_percent=${detail.progress_percent}% | computed overall=${expected}%`);

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
  // The Overall Progress card lives in the Gantt View section
  await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Gantt View'); if(b) b.click(); })()`);
  await sleep(1500);

  let pass = true;
  const check = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) pass = false; };

  const centerText = await evaluate(ws, `(() => { const e=document.querySelector('.text-\\\\[34px\\\\]'); return e ? e.textContent.trim() : '(none)'; })()`);
  console.log('  UI Overall Progress center:', centerText);
  check(`Center shows computed ${expected}% (not stale ${detail.progress_percent}%)`, centerText === `${expected}%`);

  // Ring fill should match: read the conic-gradient inline style and extract the green stop %
  const ringPct = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll('div')].find(d => (d.getAttribute('style')||'').includes('conic-gradient'));
    if (!el) return null;
    const bg = window.getComputedStyle(el).backgroundImage || '';
    const stops = [...bg.matchAll(/rgb\\(22,\\s*163,\\s*74\\)\\s+([0-9.]+)%/g)].map((m) => parseFloat(m[1]));
    return stops.length ? Math.round(Math.max(...stops)) : null;
  })()`);
  console.log('  Ring green-fill %:', ringPct);
  check('Ring fill matches center number', ringPct === expected);

  check('No stale 89% shown as overall', centerText !== '89%' || expected === 89);
  if (errors.length) { console.log('\\nConsole errors:'); errors.forEach((e) => console.log('  -', e)); pass = false; } else console.log('\\nNo console errors. ✓');
  ws.close(); chrome.kill();
  console.log(`\\nRESULT: ${pass ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(pass ? 0 : 1);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
