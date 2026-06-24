// Drives the real CRM UI via Chrome DevTools Protocol to add a test Note
// through the frontend, then verifies it persisted (UI + backend DB).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const API = 'http://localhost:8000/api/v1';
const APP = 'http://localhost:5173/projects/details/21';
const TEST_NOTE = `UI test note ${new Date().toISOString().slice(11, 19)} — added via frontend`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const res = await fetch(`${API}/auth/login/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@malwasolar.com', password: 'Malwa@2024' }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.json();
}

let msgId = 0;
function rpc(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(ws, expression) {
  const r = await rpc(ws, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
  return r.result.value;
}

const main = async () => {
  const { access, refresh } = await login();
  console.log('✓ logged in, got JWT');

  const userDir = mkdtempSync(join(tmpdir(), 'cdp-'));
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
    '--headless=new', '--disable-gpu', '--no-sandbox', 'about:blank',
  ]);

  // wait for a page target
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await sleep(250);
    try {
      const targets = await (await fetch(`http://localhost:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error('no page target');

  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });

  const consoleErrors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
      consoleErrors.push(m.params.args.map((a) => a.value || a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown')
      consoleErrors.push('EXC: ' + (m.params.exceptionDetails.exception?.description || ''));
  });

  await rpc(ws, 'Runtime.enable');
  await rpc(ws, 'Page.enable');

  const prefs = JSON.stringify({ currentPage: 'dashboard', activeSidebarItem: 'Dashboard', desktopSidebarCollapsed: false });
  const seed = `
    localStorage.setItem('malwa_access', ${JSON.stringify(access)});
    localStorage.setItem('malwa_refresh', ${JSON.stringify(refresh)});
    localStorage.setItem('malwa-solar-crm:ui-preferences', ${JSON.stringify(prefs)});
  `;
  await rpc(ws, 'Page.addScriptToEvaluateOnNewDocument', { source: seed });
  await rpc(ws, 'Page.navigate', { url: APP });
  await sleep(4500);

  // Click the Notes tab
  const clickedTab = await evaluate(ws, `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Notes');
    if (btn) { btn.click(); return true; } return false;
  })()`);
  console.log('Notes tab clicked:', clickedTab);
  await sleep(1200);

  // Type into the note textarea (React-controlled) and tick "Pin this note"
  const typed = await evaluate(ws, `(() => {
    const ta = document.querySelector('textarea[placeholder="Write your note here..."]');
    if (!ta) return 'no-textarea';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, ${JSON.stringify(TEST_NOTE)});
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const pin = document.querySelector('input[type="checkbox"]');
    if (pin && !pin.checked) pin.click();
    return ta.value;
  })()`);
  console.log('Typed into textarea:', typed === TEST_NOTE ? '✓' : typed);
  await sleep(400);

  // Click Save Note
  const saved = await evaluate(ws, `(() => {
    const btn = [...document.querySelectorAll('button')].find(b => /Save Note|Saving/.test(b.textContent));
    if (btn) { btn.click(); return true; } return false;
  })()`);
  console.log('Save Note clicked:', saved);
  await sleep(2800);

  // Verify the note now appears in the rendered table
  const appearsInUI = await evaluate(ws, `document.body.innerText.includes(${JSON.stringify(TEST_NOTE)})`);
  const noteCountText = await evaluate(ws, `(() => {
    const el = [...document.querySelectorAll('span')].find(s => /\\d+ notes?$/.test(s.textContent.trim()));
    return el ? el.textContent.trim() : 'count-not-found';
  })()`);
  console.log('Note visible in UI table:', appearsInUI ? '✓ YES' : '✗ NO');
  console.log('Header count badge:', noteCountText);

  // Verify it persisted in the backend DB via API
  const apiNotes = await (await fetch(`${API}/project-notes/?project=21`, { headers: { Authorization: `Bearer ${access}` } })).json();
  const list = Array.isArray(apiNotes) ? apiNotes : (apiNotes.results || []);
  const found = list.find((n) => n.content === TEST_NOTE);
  console.log('Persisted in DB (API check):', found ? `✓ YES (id=${found.id}, pinned=${found.is_pinned})` : '✗ NO');
  console.log('Total notes for project 21 in DB:', list.length);

  if (consoleErrors.length) { console.log('\\nConsole errors during run:'); consoleErrors.forEach(e => console.log('  -', e)); }
  else console.log('\\nNo console errors. ✓');

  ws.close();
  chrome.kill();
  process.exit(found && appearsInUI ? 0 : 1);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
