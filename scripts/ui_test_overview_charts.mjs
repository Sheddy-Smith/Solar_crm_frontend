// Verifies the Project Overview + KPI Analytics charts show REAL database data
// (not the old hardcoded "128"). Compares UI values against the backend API.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9336;
const API = 'http://localhost:8000/api/v1';
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
const navigate = async (ws, url) => { await rpc(ws, 'Page.navigate', { url }); await sleep(4500); };

const main = async () => {
  const { access, refresh } = await login();
  // Ground truth from DB
  const listRaw = await (await fetch(`${API}/projects/?page_size=1000`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const projects = Array.isArray(listRaw) ? listRaw : (listRaw.results || []);
  const total = projects.length;
  const statusCount = (s) => projects.filter((p) => p.status === s).length;
  const dbStatus = { Active: statusCount('Active'), Planning: statusCount('Planning'), Completed: statusCount('Completed'), 'On Hold': statusCount('On Hold') };
  console.log(`DB ground truth: total=${total}`, dbStatus);

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
  const prefs = JSON.stringify({ currentPage: 'dashboard', activeSidebarItem: 'Project Overview', desktopSidebarCollapsed: false });
  await rpc(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('malwa_access', ${JSON.stringify(access)});
    localStorage.setItem('malwa_refresh', ${JSON.stringify(refresh)});
    localStorage.setItem('malwa-solar-crm:ui-preferences', ${JSON.stringify(prefs)});` });

  const readMetric = (label) => `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.querySelector('span') && b.innerText.trim().startsWith(${JSON.stringify(label)}));
    if (!btn) return null;
    const v = btn.querySelector('.text-\\\\[22px\\\\]');
    return v ? v.textContent.trim() : null;
  })()`;
  const readDonutCenters = `[...document.querySelectorAll('.text-\\\\[30px\\\\]')].map(e => e.textContent.trim())`;

  let pass = true;
  const expect = (name, got, want) => { const ok = String(got) === String(want); console.log(`  ${ok ? '✓' : '✗'} ${name}: UI=${got} DB=${want}`); if (!ok) pass = false; };

  // ---- KPI Analytics (deep-link works) ----
  console.log('\\n=== KPI Analytics (/projects/kpi-analytics) ===');
  await navigate(ws, 'http://localhost:5173/projects/kpi-analytics');
  expect('Hero "Total Projects"', await evaluate(ws, readMetric('Total Projects')), total);
  const kpiCenters = await evaluate(ws, readDonutCenters);
  console.log('  Donut center totals:', kpiCenters);
  expect('Status donut center', kpiCenters[0], total);

  // ---- Project Overview (reach via in-app subnav tab, like a real user) ----
  console.log('\\n=== Project Overview (click "Project Overview" subnav tab) ===');
  const tabClicked = await evaluate(ws, `(() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Project Overview'); if(b){b.click();return true;} return false; })()`);
  console.log('  Project Overview tab clicked:', tabClicked);
  await sleep(3500);
  const hasStatus = await evaluate(ws, `document.body.innerText.includes('Projects by Status')`);
  const hasRecent = await evaluate(ws, `document.body.innerText.includes('Recent Projects')`);
  console.log(`  hasStatusChart=${hasStatus} | hasRecent=${hasRecent}`);
  expect('Hero "Total Projects"', await evaluate(ws, readMetric('Total Projects')), total);
  expect('Hero "Active Projects"', await evaluate(ws, readMetric('Active Projects')), dbStatus.Active);
  expect('Hero "Completed"', await evaluate(ws, readMetric('Completed')), dbStatus.Completed);
  const ovCenters = await evaluate(ws, readDonutCenters);
  console.log('  Donut center totals:', ovCenters);
  expect('Status donut center', ovCenters[0], total);

  console.log(`\\nNot showing old mock "128": ${ovCenters.includes('128') || kpiCenters.includes('128') ? '✗ still 128' : '✓'}`);
  if (errors.length) { console.log('\\nConsole errors:'); errors.forEach((e) => console.log('  -', e)); } else console.log('No console errors. ✓');
  ws.close(); chrome.kill();
  console.log(`\\nRESULT: ${pass && !errors.length ? 'PASS ✓' : 'FAIL ✗'}`);
  process.exit(pass && !errors.length ? 0 : 1);
};
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
