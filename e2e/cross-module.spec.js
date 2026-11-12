import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_EMAIL || 'loadtest@local.test';
const PASSWORD = process.env.E2E_PASSWORD || 'LoadTest@12345';

const MODULES = [
  { name: 'Dashboard', path: '/dashboard', ready: /Dashboard|Overview|KPI|Today/i },
  { name: 'Lead', path: '/lead/list', ready: /Lead|IVRS|Customer/i },
  { name: 'Customer', path: '/customers/details', ready: /Customer|Client/i },
  { name: 'Customer Merge', path: '/customers/merge', ready: /Merge|Duplicate|Customer/i },
  { name: 'Project Reconciliation', path: '/customers/reconciliation', ready: /Reconcile|Orphan|Project/i },
  { name: 'Quotation', path: '/quotation', ready: /Quotation|Draft|Create/i },
  { name: 'Project Management', path: '/projects/list', ready: /Project|PRJ|Customer/i },
  { name: 'Accounts', path: '/accounts/overview', ready: /Account|Ledger|Payment|Invoice/i },
  { name: 'Inventory', path: '/inventory/overview', ready: /Inventory|Stock|Item/i },
  { name: 'O&M', path: '/om/dashboard', ready: /O&M|Plant|Service|Dashboard/i },
  { name: 'Insights', path: '/insights', ready: /Insight|Summary|Sales|Report/i },
  { name: 'Daily Tasks', path: '/daily-tasks', ready: /Daily|Task/i },
  { name: 'Settings', path: '/settings', ready: /Setting|Backup|Role|Branch/i },
];

async function login(page) {
  await page.goto('/');
  // Already authenticated via localStorage?
  const email = page.getByPlaceholder(/email|mobile/i).first();
  if (await email.isVisible({ timeout: 3000 }).catch(() => false)) {
    await email.fill(EMAIL);
    await page.getByPlaceholder(/password/i).first().fill(PASSWORD);
    await page.getByRole('button', { name: /login|sign in|enter/i }).first().click();
    await expect(page).not.toHaveURL(/login/i, { timeout: 20000 });
  }
  await page.waitForTimeout(800);
}

test.describe('Malwa CRM cross-module smoke', () => {
  test('login + sidebar modules load without crash', async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    const results = [];
    for (const mod of MODULES) {
      const entry = { module: mod.name, path: mod.path, ok: false, detail: '' };
      try {
        await page.goto(mod.path);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(700);
        const body = await page.locator('body').innerText();
        const crashed = /Something went wrong|Unhandled|TypeError|Cannot read/i.test(body);
        const ready = mod.ready.test(body) || body.length > 80;
        entry.ok = !crashed && ready;
        entry.detail = crashed ? 'crash markers found' : (ready ? 'loaded' : 'content not matched');
      } catch (err) {
        entry.detail = String(err?.message || err);
      }
      results.push(entry);
      expect(entry.ok, `${mod.name}: ${entry.detail}`).toBeTruthy();
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ results }, null, 2));
  });

  test('customer profile + reconciliation surfaces', async ({ page }) => {
    await login(page);
    await page.goto('/customers/details');
    await expect(page.getByText(/Customer Management|All Client|Client Detail/i).first()).toBeVisible();
    await page.goto('/customers/reconciliation');
    await expect(page.getByText(/Project Customer Reconciliation|Orphan|Bulk reconcile/i).first()).toBeVisible();
    await page.goto('/customers/merge');
    await expect(page.getByText(/Merge|Duplicate|Surviv/i).first()).toBeVisible();
  });
});
