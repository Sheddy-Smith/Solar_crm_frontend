import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, Eye, FilePlus2, FileText, Hammer, Pencil, Plus, Printer, ReceiptText, RefreshCw, RotateCcw, Save, Search, Trash2, Truck, X,
} from 'lucide-react';
import { materialPlanApi, projectApi, projectInvoiceApi, projectSalesChallanApi, settingsApi } from './api.js';

const PANEL = 'rounded-[14px] border border-[#e7eef7] bg-white shadow-[0_10px_24px_rgba(17,39,84,0.05)]';
const CELL_INPUT = 'h-8 w-full rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] font-semibold text-[#1e3261] outline-none transition hover:border-[#dce6f3] focus:border-[#86b7fe] focus:bg-white disabled:hover:border-transparent';
const FIELD_INPUT = 'h-10 w-full rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none placeholder:text-[#9aa8bc] focus:border-[#86b7fe] disabled:bg-[#f8fafc]';
const LABEL = 'grid gap-1 text-[12px] font-bold text-[#53647f]';
const PAGE_SIZE = 15;
const UNITS = ['Nos', 'Set', 'KW', 'Meter', 'Kg', 'Box', 'Roll', 'Lot'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'IMPS', 'Transfer', 'Other'];

// Rooftop solar is billed as a composite supply: 70% goods @5% + 30% installation service @18%.
const GST_PRESETS = [
  { label: 'Solar System (70:30) — 8.9%', rate: 8.9 },
  { label: 'Solar Goods — 5%', rate: 5 },
  { label: 'Services — 18%', rate: 18 },
  { label: 'GST — 12%', rate: 12 },
  { label: 'No GST — 0%', rate: 0 },
];

const COMPANY_FALLBACK = {
  companyName: 'MALWA SOLAR ENERGY',
  gstNumber: '23CTTPM3966P1ZN',
  phone: '822-3000-822',
  email: 'malwasolarenergy@gmail.com',
  address1: '11/4, Fawara Chowk',
  city: 'Ujjain',
  state: 'Madhya Pradesh',
  pinCode: '456001',
  bankName: 'AU SMALL FINANCE BANK LIMITED',
  accountNumber: '2402231963220487',
  ifsc: 'AUBL0002319',
  branch: 'Freeganj, Ujjain',
};

const KINDS = {
  challan: {
    title: 'Sales Challan',
    icon: Truck,
    api: projectSalesChallanApi,
    noField: 'challan_no',
    dateField: 'challan_date',
    statuses: ['Open', 'Dispatched', 'Delivered', 'Cancelled'],
    defaultStatus: 'Dispatched',
    printTitle: 'DELIVERY CHALLAN',
    emptyHint: 'Items load automatically from the project Quotation. Add any extra work done later under "Additional Work".',
  },
  invoice: {
    title: 'Invoice',
    icon: ReceiptText,
    api: projectInvoiceApi,
    noField: 'invoice_no',
    dateField: 'invoice_date',
    statuses: ['Pending', 'Issued', 'Paid', 'Cancelled'],
    defaultStatus: 'Issued',
    printTitle: 'TAX INVOICE',
    emptyHint: 'Line items load automatically at Material Planning rates, or use the turnkey project value.',
  },
};

const STATUS_DOT = {
  Open: 'bg-[#f59e0b]',
  Pending: 'bg-[#f59e0b]',
  Dispatched: 'bg-[#0b65e5]',
  Issued: 'bg-[#0b65e5]',
  Delivered: 'bg-[#16a34a]',
  Paid: 'bg-[#16a34a]',
  Cancelled: 'bg-[#dc2626]',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function rowsOf(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  const v = num(n);
  // The epsilon keeps half-paisa values (x.xx5) rounding up like the server's ROUND_HALF_UP.
  return (Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-6)) / 100;
}

function money(n) {
  return `₹${num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

const todayIso = () => new Date().toISOString().slice(0, 10);

let lineSeq = 0;
function makeLine(overrides = {}) {
  lineSeq += 1;
  return {
    _key: `l${Date.now()}-${lineSeq}`,
    section: 'Main',
    material_name: '',
    category: '',
    brand: '',
    specification: '',
    quantity: 1,
    unit: 'Nos',
    rate: '',
    ...overrides,
  };
}

function prefillLines(prefill) {
  return (prefill?.lines || []).map((l) => makeLine({
    material_name: l.material_name || '',
    category: l.category || '',
    brand: l.brand || '',
    specification: l.specification || '',
    quantity: num(l.quantity),
    unit: l.unit || 'Nos',
    rate: num(l.rate),
  }));
}

const isAdditional = (line) => line.section === 'Additional';
const lineAmount = (line) => num(line.quantity) * num(line.rate);

// Mirrors apply_challan_totals on the server: split GST rounds the combined 8.9% once,
// and taxed challans are billed to the whole rupee with the difference shown as round off.
function challanTotals(lines, gstMode, gstPercent) {
  const main = round2(lines.filter((l) => !isAdditional(l)).reduce((s, l) => s + lineAmount(l), 0));
  const extra = round2(lines.filter(isAdditional).reduce((s, l) => s + lineAmount(l), 0));
  const taxable = round2(main + extra);
  let gst = 0;
  let gst5 = 0;
  if (gstMode === 'Split') {
    gst = round2((taxable * 8.9) / 100);
    gst5 = round2((taxable * 3.5) / 100);
  } else if (gstMode === 'Flat') {
    gst = round2((taxable * num(gstPercent)) / 100);
  }
  const gross = round2(taxable + gst);
  const total = gstMode === 'None' ? gross : Math.round(gross);
  return { main, extra, taxable, gst, gst5, gst18: round2(gst - gst5), roundOff: round2(total - gross), total };
}

function planLine(plan, qty, withRate) {
  return makeLine({
    material_name: String(plan.inventory_item_name || plan.items || plan.category || '').trim(),
    category: plan.category || '',
    quantity: qty,
    unit: plan.uom || 'Nos',
    rate: withRate ? round2(plan.planning_unit_price_display || plan.planning_unit_price || 0) : '',
  });
}

function challanLinesFromPlans(plans) {
  const dispatched = plans.filter((p) => num(p.dispatched_qty) > 0);
  if (dispatched.length) return dispatched.map((p) => planLine(p, num(p.dispatched_qty), true));
  return plans.filter((p) => num(p.planned_qty) > 0).map((p) => planLine(p, num(p.planned_qty), true));
}

function invoiceLinesFromPlans(plans) {
  return plans.filter((p) => num(p.planned_qty) > 0).map((p) => planLine(p, num(p.planned_qty), true));
}

// Mirrors compute_gst_amounts on the server: CGST and SGST are rounded to the paisa separately.
function gstParts(subtotal, gstType, gstRate) {
  const taxable = round2(subtotal);
  const rate = num(gstRate);
  if (gstType === 'IGST') {
    const igst = round2((taxable * rate) / 100);
    return { taxable, cgst: 0, sgst: 0, igst, gst: igst, total: round2(taxable + igst) };
  }
  const half = round2((taxable * round2(rate / 2)) / 100);
  return { taxable, cgst: half, sgst: half, igst: 0, gst: round2(half * 2), total: round2(taxable + half * 2) };
}

function turnkeyLine(project, gstRate, gstType = 'CGST_SGST') {
  const cap = num(project?.capacity_kwp);
  const system = [project?.project_type, project?.system_type || 'Rooftop Solar'].filter(Boolean).join(' ');
  // Project value is the GST-inclusive deal amount, so back out the tax to get the taxable rate,
  // nudging by a few paise so the rounded invoice total matches the project value exactly.
  const target = round2(project?.total_value);
  const base = round2(target / (1 + num(gstRate) / 100));
  const candidates = [0, -0.01, 0.01, -0.02, 0.02, -0.03, 0.03].map((d) => round2(base + d));
  const rate = candidates.find((c) => gstParts(c, gstType, gstRate).total === target) ?? base;
  return makeLine({
    material_name: `Supply, Installation, Testing & Commissioning of ${cap ? `${cap} kWp ` : ''}${system} Power System`,
    category: 'Solar Power System',
    quantity: 1,
    unit: 'Set',
    rate,
  });
}

function computeTotals(lines, kind, gstType, gstRate, received) {
  const subtotal = lines.reduce((s, l) => s + num(l.quantity) * num(l.rate), 0);
  if (kind !== 'invoice') return { subtotal, total: subtotal };
  const parts = gstParts(subtotal, gstType, gstRate);
  return { ...parts, subtotal: parts.taxable, balance: parts.total - num(received) };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

function rupeesInWords(amount) {
  const value = Math.round(num(amount) * 100) / 100;
  let rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  if (!rupees && !paise) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rupees) parts.push(threeDigits(rupees));
  const words = parts.length ? `Rupees ${parts.join(' ')}` : 'Rupees Zero';
  return `${words}${paise ? ` and ${twoDigits(paise)} Paise` : ''} Only`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function printDocument(kind, doc, company) {
  const cfg = KINDS[kind];
  const c = { ...COMPANY_FALLBACK, ...(company || {}) };
  const isInvoice = kind === 'invoice';
  const lines = doc.lines || [];
  const companyAddress = [c.address1, c.address2, c.city, c.state, c.pinCode].filter(Boolean).join(', ');
  const baseAddress = (isInvoice ? doc.project_site_address || doc.site : doc.site_address || doc.project_site_address || doc.site) || '';
  const customerAddress = doc.city && !baseAddress.toLowerCase().includes(String(doc.city).toLowerCase())
    ? [baseAddress, doc.city].filter(Boolean).join(', ')
    : baseAddress;
  const rows = lines.map((l, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(l.material_name)}${l.category && l.category !== l.material_name ? `<div class="muted">${esc(l.category)}</div>` : ''}</td>
      <td class="r">${esc(num(l.quantity))}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="r">${num(l.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      <td class="r">${num(l.line_total ?? num(l.quantity) * num(l.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>`).join('');
  const gstRows = isInvoice
    ? (doc.gst_type === 'IGST'
      ? `<tr><td>IGST @ ${num(doc.igst_percent)}%</td><td class="r">${money(doc.gst_amount)}</td></tr>`
      : `<tr><td>CGST @ ${num(doc.cgst_percent)}%</td><td class="r">${money(num(doc.gst_amount) / 2)}</td></tr>
         <tr><td>SGST @ ${num(doc.sgst_percent)}%</td><td class="r">${money(num(doc.gst_amount) / 2)}</td></tr>`)
    : '';
  const totalsHtml = isInvoice
    ? `<table class="totals">
        <tr><td>Taxable Value</td><td class="r">${money(doc.subtotal)}</td></tr>
        ${gstRows}
        <tr class="grand"><td>Invoice Total</td><td class="r">${money(doc.total_amount)}</td></tr>
        <tr><td>Received</td><td class="r">${money(doc.payment_amount)}</td></tr>
        <tr><td><b>Balance Due</b></td><td class="r"><b>${money(doc.balance_due)}</b></td></tr>
      </table>`
    : `<table class="totals"><tr class="grand"><td>Material Value</td><td class="r">${money(doc.total_amount)}</td></tr></table>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(cfg.printTitle)} ${esc(doc[cfg.noField])}</title>
  <style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;padding:24px;font-size:12px}
    .doc{max-width:820px;margin:0 auto;border:1px solid #cbd5e1;padding:20px}
    .head{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #078c3e;padding-bottom:12px}
    .brand{font-size:20px;font-weight:800;color:#078c3e} .muted{color:#64748b;font-size:11px}
    .title{text-align:center;font-size:16px;font-weight:800;letter-spacing:2px;margin:14px 0}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
    .box{border:1px solid #e2e8f0;border-radius:6px;padding:10px} .box h4{margin:0 0 6px;font-size:11px;color:#64748b;text-transform:uppercase}
    .kv{display:flex;justify-content:space-between;gap:8px;padding:1px 0}
    table.items{width:100%;border-collapse:collapse;margin-top:6px} table.items th{background:#f1f5f9;text-align:left}
    table.items th,table.items td{border:1px solid #e2e8f0;padding:6px}
    .r{text-align:right} .c{text-align:center}
    .foot{display:flex;justify-content:space-between;gap:16px;margin-top:12px}
    table.totals{min-width:280px;border-collapse:collapse} table.totals td{padding:4px 6px;border-bottom:1px solid #f1f5f9}
    table.totals .grand td{font-weight:800;font-size:13px;border-top:1px solid #111827}
    .sign{display:flex;justify-content:space-between;margin-top:48px} .sign div{border-top:1px solid #94a3b8;padding-top:4px;min-width:180px;text-align:center}
    @media print{body{padding:0} .doc{border:none}}
  </style></head><body><div class="doc">
    <div class="head">
      <div><div class="brand">${esc(c.companyName)}</div><div class="muted">${esc(companyAddress)}</div>
        <div class="muted">Phone: ${esc(c.phone)} · ${esc(c.email)}</div></div>
      <div class="r"><div><b>GSTIN:</b> ${esc(c.gstNumber)}</div>
        <div><b>${isInvoice ? 'Invoice' : 'Challan'} No:</b> ${esc(doc[cfg.noField])}</div>
        <div><b>Date:</b> ${esc(fmtDate(doc[cfg.dateField]))}</div>
        ${!isInvoice && doc.vehicle_no ? `<div><b>Vehicle No:</b> ${esc(doc.vehicle_no)}</div>` : ''}</div>
    </div>
    <div class="title">${esc(cfg.printTitle)}</div>
    <div class="grid">
      <div class="box"><h4>${isInvoice ? 'Bill To' : 'Deliver To'}</h4>
        <div><b>${esc(doc.party_name || doc.customer_name)}</b></div>
        ${doc.customer_phone ? `<div>Mobile: ${esc(doc.customer_phone)}</div>` : ''}
        ${customerAddress ? `<div>${esc(customerAddress)}</div>` : ''}
        ${isInvoice && doc.gst_number ? `<div>GSTIN: ${esc(doc.gst_number)}</div>` : ''}</div>
      <div class="box"><h4>Solar Project</h4>
        <div class="kv"><span>Project No</span><b>${esc(doc.project_code)}</b></div>
        <div class="kv"><span>Capacity</span><b>${esc(num(doc.capacity_kwp))} kWp</b></div>
        <div class="kv"><span>System</span><b>${esc([doc.project_type, doc.system_type].filter(Boolean).join(' / '))}</b></div>
        ${doc.consumer_number ? `<div class="kv"><span>Consumer No</span><b>${esc(doc.consumer_number)}</b></div>` : ''}
        ${doc.discom_name ? `<div class="kv"><span>DISCOM</span><b>${esc(doc.discom_name)}</b></div>` : ''}</div>
    </div>
    <table class="items"><thead><tr><th class="c" style="width:36px">#</th><th>Description</th><th class="r">Qty</th><th class="c">Unit</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="c muted">No items</td></tr>'}</tbody></table>
    <div class="foot">
      <div>${isInvoice ? `<div><b>Amount in words:</b> ${esc(rupeesInWords(doc.total_amount))}</div>
        <div class="box" style="margin-top:10px"><h4>Bank Details</h4><div>${esc(c.bankName)}</div><div>A/c: ${esc(c.accountNumber)} · IFSC: ${esc(c.ifsc)}</div><div>${esc(c.branch)}</div></div>`
        : '<div class="muted">Material received in good condition.</div>'}
        ${doc.remarks ? `<div style="margin-top:8px"><b>Remarks:</b> ${esc(doc.remarks)}</div>` : ''}</div>
      ${totalsHtml}
    </div>
    <div class="sign"><div>${isInvoice ? "Customer's Signature" : "Receiver's Signature"}</div><div>For ${esc(c.companyName)}<br/>Authorised Signatory</div></div>
  </div><script>window.onload=function(){window.print()}</script></body></html>`;
  return openPrintWindow(html);
}

function openPrintWindow(html) {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

function fmtAmount(n) {
  return num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Same visual language as the quotation PDF (navy / gold, Cormorant + Manrope).
function printChallan(doc, company) {
  const c = { ...COMPANY_FALLBACK, ...(company || {}) };
  const origin = window.location.origin;
  const logo = `${origin}/quotation-brand/logo.png`;
  const lines = doc.lines || [];
  const main = lines.filter((l) => !isAdditional(l));
  const extra = lines.filter(isAdditional);
  const amountOf = (l) => num(l.line_total ?? lineAmount(l));
  const mainTotal = main.reduce((s, l) => s + amountOf(l), 0);
  const extraTotal = extra.reduce((s, l) => s + amountOf(l), 0);
  const taxable = num(doc.subtotal) || mainTotal + extraTotal;
  const gst = num(doc.gst_amount);
  const gst5 = doc.gst_mode === 'Split' ? round2((taxable * 3.5) / 100) : 0;
  const total = num(doc.total_amount);
  const companyAddress = [c.address1, c.address2, c.city, c.state, c.pinCode].filter(Boolean).join(', ');
  const baseAddress = doc.site_address || doc.project_site_address || doc.site || '';
  const siteAddress = doc.city && !baseAddress.toLowerCase().includes(String(doc.city).toLowerCase())
    ? [baseAddress, doc.city].filter(Boolean).join(', ')
    : baseAddress;
  const capacity = num(doc.capacity_kwp) ? `${num(doc.capacity_kwp)} kWp` : '';
  const system = [doc.project_type, doc.system_type].filter(Boolean).join(' / ');
  const customer = doc.party_name || doc.customer_name || 'Customer';

  const itemRows = (list, includedLabel) => list.map((l, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td><b>${esc(l.material_name)}</b>${l.category && l.category !== l.material_name ? `<div class="sub">${esc(l.category)}</div>` : ''}</td>
      <td>${esc(l.specification) || '—'}</td>
      <td>${esc(l.brand) || '—'}</td>
      <td class="r">${esc(num(l.quantity))}</td>
      <td class="c">${esc(l.unit)}</td>
      <td class="r">${num(l.rate) ? fmtAmount(l.rate) : '—'}</td>
      <td class="r">${amountOf(l) ? fmtAmount(amountOf(l)) : `<span class="pill">${includedLabel}</span>`}</td>
    </tr>`).join('');
  const itemTable = (list, includedLabel, totalLabel, totalValue) => `
    <table class="data">
      <thead><tr><th class="c" style="width:26px">#</th><th>Item / Work</th><th>Specification</th><th>Make</th><th class="r">Qty</th><th class="c">Unit</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${itemRows(list, includedLabel) || '<tr><td colspan="8" class="c">No items</td></tr>'}
        <tr class="total"><td colspan="7">${esc(totalLabel)}</td><td class="r">${fmtAmount(totalValue)}</td></tr>
      </tbody>
    </table>`;

  const gstRows = doc.gst_mode === 'Split'
    ? `<tr><td>GST 5% on 70%</td><td class="r">${fmtAmount(gst5)}</td><td>Goods portion</td></tr>
       <tr><td>GST 18% on 30%</td><td class="r">${fmtAmount(gst - gst5)}</td><td>Service portion</td></tr>
       <tr><td>Total GST</td><td class="r">${fmtAmount(gst)}</td><td>Effective 8.9%</td></tr>`
    : doc.gst_mode === 'Flat'
      ? `<tr><td>GST @ ${esc(num(doc.gst_percent))}%</td><td class="r">${fmtAmount(gst)}</td><td>CGST + SGST</td></tr>`
      : '';

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
  <title>${esc(doc.challan_no)} — Delivery Challan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #102033; }
    body { font-family: Manrope, "Segoe UI", sans-serif; font-size: 11px; line-height: 1.45; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .sheet { width: 210mm; min-height: 297mm; padding: 14mm 14mm 16mm; position: relative; }
    .sheet::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 5px; background: linear-gradient(90deg, #0B1F36 0%, #C8892A 55%, #0B1F36 100%); }
    .display { font-family: "Cormorant Garamond", Georgia, serif; letter-spacing: 0.02em; }
    .chrome { display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #D7E0EA; color: #5B6B7C; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
    .header h1 { margin: 0; font-size: 28px; color: #0B1F36; font-weight: 700; line-height: 1; }
    .header p { margin: 4px 0 0; color: #5B6B7C; font-size: 10.5px; font-weight: 600; }
    .logo { height: 48px; width: auto; }
    .label { display: inline-block; margin: 0 0 8px; padding: 4px 10px; border-radius: 999px; background: #F7E7C8; color: #0B1F36; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
    .h2 { margin: 0 0 6px; font-size: 22px; color: #0B1F36; font-weight: 700; line-height: 1.1; }
    .lede { margin: 0 0 12px; color: #5B6B7C; font-size: 11.5px; }
    .info { display: grid; grid-template-columns: 1.35fr 1fr; gap: 12px; margin-bottom: 14px; }
    .panel { border: 1px solid #D7E0EA; border-radius: 14px; padding: 12px 14px; }
    .panel.navy { background: linear-gradient(145deg, #0B1F36 0%, #163454 100%); color: #fff; border-color: #0B1F36; }
    .panel .k2 { font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(247,231,200,0.85); }
    .panel .big { margin-top: 4px; color: #fff; font-size: 26px; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 700; }
    .panel .hint { margin-top: 4px; font-size: 10px; color: rgba(255,255,255,0.75); font-weight: 600; }
    .kv { width: 100%; border-collapse: collapse; }
    .kv td { padding: 4px 0; vertical-align: top; border-bottom: 1px solid rgba(215,224,234,0.8); }
    .kv tr:last-child td { border-bottom: 0; }
    .kv .k { width: 34%; color: #5B6B7C; font-weight: 700; font-size: 10.5px; }
    .kv .v { font-weight: 700; font-size: 11px; }
    table.data { width: 100%; border-collapse: separate; border-spacing: 0; margin: 4px 0 14px; border: 1px solid #D7E0EA; border-radius: 12px; overflow: hidden; }
    table.data th { background: #0B1F36 !important; color: #fff !important; font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; text-align: left; padding: 8px; }
    table.data td { padding: 7px 8px; border-top: 1px solid #D7E0EA; font-size: 10px; font-weight: 600; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #F6F1E8 !important; }
    table.data tr.total td { background: #F7E7C8 !important; font-weight: 800; color: #0B1F36; border-top: 1px solid #C8892A; }
    table.data.extra th { background: #8A5A12 !important; }
    .sub { color: #5B6B7C; font-size: 9px; font-weight: 600; margin-top: 2px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #E3F4EA !important; color: #0E7A3B !important; font-size: 9px; font-weight: 800; }
    .r { text-align: right !important; } .c { text-align: center !important; }
    .note { margin: 0 0 10px; padding: 10px 12px; border-radius: 12px; background: #EEF3F8; border: 1px solid #D7E0EA; font-size: 10.5px; white-space: pre-wrap; }
    .words { margin: -6px 0 12px; color: #5B6B7C; font-size: 10.5px; font-weight: 700; }
    .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
    .sign div { border-top: 1px solid #D7E0EA; padding-top: 8px; text-align: center; color: #5B6B7C; font-size: 10px; font-weight: 700; }
    .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #D7E0EA; text-align: center; color: #5B6B7C; font-size: 9.5px; }
    .footer b { display: block; color: #0B1F36; font-size: 11px; letter-spacing: 0.08em; }
  </style></head><body><section class="sheet">
    <div class="chrome"><span>${esc(c.companyName)}</span><span>Delivery Challan</span><span>${esc(doc.challan_no)}</span></div>
    <div class="header">
      <div><h1 class="display">${esc(c.companyName)}</h1>
        <p>${esc(companyAddress)} · ${esc(c.phone)}</p>
        <p>${esc(c.email)} · GSTIN ${esc(c.gstNumber)}</p></div>
      <img class="logo" src="${logo}" alt="Logo" onerror="this.style.display='none'" />
    </div>
    <div class="label">Delivery Challan</div>
    <h2 class="h2 display">Solar plant delivery for ${esc(customer)}</h2>
    <p class="lede">${esc([capacity, system].filter(Boolean).join(' · ') || 'Solar Power Plant')}${doc.quotation_no ? ` · Ref. Quotation ${esc(doc.quotation_no)}` : ''}</p>
    <div class="info">
      <div class="panel"><table class="kv">
        <tr><td class="k">Challan No / Date</td><td class="v">${esc(doc.challan_no)} · ${esc(fmtDate(doc.challan_date))}</td></tr>
        <tr><td class="k">Customer</td><td class="v">${esc(customer)}${doc.customer_phone ? ` · ${esc(doc.customer_phone)}` : ''}</td></tr>
        <tr><td class="k">Delivery Site</td><td class="v">${esc(siteAddress) || '—'}</td></tr>
        <tr><td class="k">Project No</td><td class="v">${esc(doc.project_code)}${capacity ? ` · ${esc(capacity)}` : ''}</td></tr>
        ${doc.consumer_number || doc.discom_name ? `<tr><td class="k">Consumer / DISCOM</td><td class="v">${esc([doc.consumer_number, doc.discom_name].filter(Boolean).join(' · '))}</td></tr>` : ''}
        ${doc.vehicle_no ? `<tr><td class="k">Vehicle No</td><td class="v">${esc(doc.vehicle_no)}</td></tr>` : ''}
      </table></div>
      <div class="panel navy">
        <div class="k2">Challan Value${gst ? ' (GST Inclusive)' : ''}</div>
        <div class="big">₹${fmtAmount(total)}</div>
        <div class="hint">${esc(rupeesInWords(total))}</div>
        ${extra.length ? `<div class="hint" style="margin-top:10px">Includes additional work of ₹${fmtAmount(extraTotal)}</div>` : ''}
      </div>
    </div>
    <div class="label">${doc.quotation_no ? `As per Quotation ${esc(doc.quotation_no)}` : 'Material & Work Delivered'}</div>
    ${itemTable(main, 'Included', 'Quotation Items Value', mainTotal)}
    ${extra.length ? `<div class="label">Additional Work</div>${itemTable(extra, '—', 'Additional Work Total', extraTotal).replace('class="data"', 'class="data extra"')}` : ''}
    <div class="label">Challan Value</div>
    <table class="data">
      <thead><tr><th>Particulars</th><th class="r">Amount</th><th>Note</th></tr></thead>
      <tbody>
        <tr><td>Quotation Items</td><td class="r">${fmtAmount(mainTotal)}</td><td>${doc.quotation_no ? esc(doc.quotation_no) : 'Main scope'}</td></tr>
        ${extra.length ? `<tr><td>Additional Work</td><td class="r">${fmtAmount(extraTotal)}</td><td>Work added after quotation</td></tr>` : ''}
        <tr><td>Taxable Value</td><td class="r">${fmtAmount(taxable)}</td><td>Without GST</td></tr>
        ${gstRows}
        ${num(doc.round_off) ? `<tr><td>Round Off</td><td class="r">${fmtAmount(doc.round_off)}</td><td></td></tr>` : ''}
        <tr class="total"><td>Total Challan Value</td><td class="r">₹${fmtAmount(total)}</td><td>${gst ? 'GST inclusive' : ''}</td></tr>
      </tbody>
    </table>
    <p class="words">Amount in words: ${esc(rupeesInWords(total))}</p>
    ${doc.remarks ? `<div class="label">Remarks</div><div class="note">${esc(doc.remarks)}</div>` : ''}
    <div class="note">Material received in good condition as per the above list. Any shortage or damage must be reported at the time of delivery.</div>
    <div class="sign"><div>Receiver's Signature &amp; Stamp</div><div>For ${esc(c.companyName)}<br/>Authorised Signatory</div></div>
    <div class="footer"><b>${esc(c.companyName)}</b>${esc(companyAddress)} · ${esc(c.phone)} · ${esc(c.email)} · GSTIN ${esc(c.gstNumber)}</div>
  </section><script>window.onload=function(){setTimeout(function(){window.print()},400)}</script></body></html>`;
  return openPrintWindow(html);
}

/* ───────────────── Small UI pieces ───────────────── */

function Heading({ title, onOpenSection }) {
  return (
    <div className="page-heading flex min-w-0 flex-col gap-2.5 rounded-[12px] bg-white/60 p-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-[24px] font-bold leading-[1.12] tracking-[-0.01em] text-[#111827] sm:text-[30px]">{title}</h1>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 text-[13px] font-semibold">
          <button type="button" onClick={() => onOpenSection('Dashboard')} className="text-[#0b65e5]">Dashboard</button>
          <ChevronRight className="size-3.5 text-[#9aa8bc]" />
          <button type="button" onClick={() => onOpenSection('Project List')} className="text-[#0b65e5]">Project Management</button>
          <ChevronRight className="size-3.5 text-[#9aa8bc]" />
          <span className="text-[#53647f]">{title}</span>
        </div>
      </div>
    </div>
  );
}

function LinesTable({ lines, readOnly, onChange, onRemove }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#e7eef7]">
      <table data-no-col-resize="1" className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="bg-[#f6f8fb] text-[12px] font-bold text-[#1e3261]">
            <th className="w-10 px-2 py-2 text-center">#</th>
            <th className="min-w-[260px] px-2 py-2">Material / Work</th>
            <th className="w-[170px] px-2 py-2">Category</th>
            <th className="w-[90px] px-2 py-2 text-right">Qty</th>
            <th className="w-[100px] px-2 py-2">Unit</th>
            <th className="w-[130px] px-2 py-2 text-right">Rate</th>
            <th className="w-[140px] px-2 py-2 text-right">Amount</th>
            {!readOnly ? <th className="w-10 px-2 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={8} className="py-6 text-center text-[13px] font-semibold text-[#8a98af]">No items. Use &quot;Add Item&quot; to add a line.</td></tr>
          ) : lines.map((line, idx) => (
            <tr key={line._key} className="border-t border-[#f0f4f9] text-[13px]">
              <td className="px-2 py-1 text-center font-semibold text-[#8a98af]">{idx + 1}</td>
              <td className="px-2 py-1">
                <input disabled={readOnly} value={line.material_name} onChange={(e) => onChange(line._key, { material_name: e.target.value })} placeholder="e.g. 540Wp Mono PERC Module" className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1">
                <input disabled={readOnly} value={line.category} onChange={(e) => onChange(line._key, { category: e.target.value })} placeholder="Solar Panel" className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1">
                <input type="number" min="0" disabled={readOnly} value={line.quantity} onChange={(e) => onChange(line._key, { quantity: e.target.value })} className={cx(CELL_INPUT, 'text-right')} />
              </td>
              <td className="px-2 py-1">
                <select disabled={readOnly} value={line.unit} onChange={(e) => onChange(line._key, { unit: e.target.value })} className={CELL_INPUT}>
                  {[...new Set([...UNITS, line.unit].filter(Boolean))].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              <td className="px-2 py-1">
                <input type="number" min="0" disabled={readOnly} value={line.rate} onChange={(e) => onChange(line._key, { rate: e.target.value })} placeholder="0.00" className={cx(CELL_INPUT, 'text-right')} />
              </td>
              <td className="px-2 py-1 text-right font-extrabold text-[#1e3261]">{money(num(line.quantity) * num(line.rate))}</td>
              {!readOnly ? (
                <td className="px-2 py-1 text-center">
                  <button type="button" onClick={() => onRemove(line._key)} className="text-[#dc2626]" aria-label="Remove line"><X className="size-4" /></button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallanLinesTable({ lines, readOnly, onChange, onRemove, additional, emptyText }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#e7eef7]">
      <table data-no-col-resize="1" className="w-full min-w-[980px] border-collapse text-left">
        <thead>
          <tr className={cx('text-[12px] font-bold', additional ? 'bg-[#fff6e8] text-[#8a5a12]' : 'bg-[#f6f8fb] text-[#1e3261]')}>
            <th className="w-10 px-2 py-2 text-center">#</th>
            <th className="min-w-[230px] px-2 py-2">{additional ? 'Additional Work' : 'Item / Work'}</th>
            <th className="min-w-[220px] px-2 py-2">Specification</th>
            <th className="w-[140px] px-2 py-2">Make / Brand</th>
            <th className="w-[80px] px-2 py-2 text-right">Qty</th>
            <th className="w-[90px] px-2 py-2">Unit</th>
            <th className="w-[120px] px-2 py-2 text-right">Rate</th>
            <th className="w-[130px] px-2 py-2 text-right">Amount</th>
            {!readOnly ? <th className="w-10 px-2 py-2" /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr><td colSpan={9} className="py-5 text-center text-[13px] font-semibold text-[#8a98af]">{emptyText}</td></tr>
          ) : lines.map((line, idx) => (
            <tr key={line._key} className="border-t border-[#f0f4f9] text-[13px]">
              <td className="px-2 py-1 text-center font-semibold text-[#8a98af]">{idx + 1}</td>
              <td className="px-2 py-1">
                <input disabled={readOnly} value={line.material_name} onChange={(e) => onChange(line._key, { material_name: e.target.value })} placeholder={additional ? 'e.g. Extra structure height, Extra AC cable' : 'e.g. Solar PV Modules'} className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1">
                <input disabled={readOnly} value={line.specification} title={line.specification} onChange={(e) => onChange(line._key, { specification: e.target.value })} placeholder={additional ? 'Details / reason' : 'e.g. Mono PERC 540 Wp'} className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1">
                <input disabled={readOnly} value={line.brand} onChange={(e) => onChange(line._key, { brand: e.target.value })} placeholder="Make" className={CELL_INPUT} />
              </td>
              <td className="px-2 py-1">
                <input type="number" min="0" disabled={readOnly} value={line.quantity} onChange={(e) => onChange(line._key, { quantity: e.target.value })} className={cx(CELL_INPUT, 'text-right')} />
              </td>
              <td className="px-2 py-1">
                <select disabled={readOnly} value={line.unit} onChange={(e) => onChange(line._key, { unit: e.target.value })} className={CELL_INPUT}>
                  {[...new Set([...UNITS, line.unit].filter(Boolean))].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              <td className="px-2 py-1">
                <input type="number" min="0" disabled={readOnly} value={line.rate} onChange={(e) => onChange(line._key, { rate: e.target.value })} placeholder="0.00" className={cx(CELL_INPUT, 'text-right')} />
              </td>
              <td className="px-2 py-1 text-right font-extrabold text-[#1e3261]">
                {lineAmount(line) || additional
                  ? money(lineAmount(line))
                  : <span className="rounded-full bg-[#e3f4ea] px-2 py-0.5 text-[11px] font-bold text-[#0e7a3b]">Included</span>}
              </td>
              {!readOnly ? (
                <td className="px-2 py-1 text-center">
                  <button type="button" onClick={() => onRemove(line._key)} className="text-[#dc2626]" aria-label="Remove line"><X className="size-4" /></button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalLine({ label, value, tone = 'text-[#1e3261]', big, children }) {
  return (
    <div className="flex items-center justify-end gap-4">
      <span className={cx('font-bold text-[#53647f]', big ? 'text-[15px]' : 'text-[13px]')}>{label}</span>
      <span className={cx('min-w-[140px] text-right font-extrabold', tone, big ? 'text-[18px]' : 'text-[14px]')}>{children ?? value}</span>
    </div>
  );
}

function StatChip({ label, value, tone }) {
  return (
    <div className="rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a98af]">{label}</p>
      <p className={cx('text-[16px] font-extrabold', tone || 'text-[#1e3261]')}>{value}</p>
    </div>
  );
}

function ConfirmDelete({ label, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/40 p-4">
      <div className="w-full max-w-[400px] rounded-[14px] bg-white p-5 shadow-xl">
        <h3 className="text-[16px] font-extrabold text-[#1e3261]">Delete {label}?</h3>
        <p className="mt-1 text-[13px] text-[#53647f]">This record will be permanently deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-10 rounded-[8px] border border-[#d5e0ef] px-4 text-[13px] font-semibold text-[#314a79]">Cancel</button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-[8px] bg-[#dc2626] px-4 text-[13px] font-semibold text-white">Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── Page ───────────────── */

function emptyForm(kind) {
  return {
    date: todayIso(),
    status: KINDS[kind].defaultStatus,
    vehicle_no: '',
    site_address: '',
    gst_number: '',
    gst_type: 'CGST_SGST',
    gst_rate: 8.9,
    payment_mode: '',
    payment_amount: 0,
    remarks: '',
    quotation_no: '',
    gst_mode: 'None',
    gst_percent: 0,
  };
}

function ProjectBillingPage({ kind, activeSection, onOpenSection, onNotify, Subnav, initialProjectId }) {
  const cfg = KINDS[kind];
  const isInvoice = kind === 'invoice';
  const editorRef = useRef(null);
  const [projects, setProjects] = useState([]);
  const [company, setCompany] = useState(null);
  const [projectId, setProjectId] = useState(initialProjectId ? String(initialProjectId) : '');
  const [projectDetail, setProjectDetail] = useState(null);
  const [doc, setDoc] = useState(null);
  const [form, setForm] = useState(() => emptyForm(kind));
  const [lines, setLines] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [viewOnly, setViewOnly] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [docs, setDocs] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const emptyFilters = { project_code: '', customer: '', date_from: '', date_to: '', status: '' };
  const [filterDraft, setFilterDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [deleting, setDeleting] = useState(null);

  const project = useMemo(() => projects.find((p) => String(p.id) === String(projectId)) || null, [projects, projectId]);
  const info = projectDetail && String(projectDetail.id) === String(projectId) ? { ...project, ...projectDetail } : project;

  useEffect(() => {
    projectApi.list({ page_size: 1000 })
      .then((data) => setProjects(rowsOf(data).filter((p) => p.lead_status === 'Won')))
      .catch(() => setProjects([]));
    settingsApi.company.get()
      .then((res) => setCompany(res?.data && Object.keys(res.data).length ? res.data : null))
      .catch(() => setCompany(null));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setProjectDetail(null);
      return;
    }
    projectApi.get(projectId).then(setProjectDetail).catch(() => setProjectDetail(null));
  }, [projectId]);

  const loadDocs = useCallback(async () => {
    setListLoading(true);
    try {
      setDocs(rowsOf(await cfg.api.list({ ...filters, page_size: 1000 })));
    } catch {
      setDocs([]);
    } finally {
      setListLoading(false);
    }
  }, [cfg.api, filters]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const fetchPlans = (pid) => materialPlanApi.list({ project: pid, page_size: 500 }).then(rowsOf).catch(() => []);
  const fetchPrefill = (pid, qid) => projectSalesChallanApi.quotationPrefill(pid, qid).catch(() => null);
  const quotationForm = (prefill) => ({
    quotation_no: prefill.quotation_no || '',
    gst_mode: prefill.gst_mode || 'None',
    gst_percent: num(prefill.gst_percent),
  });

  const loadSeq = useRef(0);
  const startNew = useCallback(async (pid) => {
    const seq = ++loadSeq.current;
    setDoc(null);
    setViewOnly(false);
    const base = emptyForm(kind);
    setForm(base);
    if (!pid) {
      setLines([]);
      setQuotations([]);
      return;
    }
    setEditorLoading(true);
    try {
      if (isInvoice) {
        const plans = await fetchPlans(pid);
        if (seq !== loadSeq.current) return;
        const itemized = invoiceLinesFromPlans(plans);
        const proj = projects.find((p) => String(p.id) === String(pid));
        if (itemized.some((l) => num(l.rate) > 0)) setLines(itemized);
        else if (num(proj?.total_value) > 0) setLines([turnkeyLine(proj, base.gst_rate)]);
        else setLines(itemized.length ? itemized : [makeLine()]);
      } else {
        const [plans, pre] = await Promise.all([fetchPlans(pid), fetchPrefill(pid)]);
        if (seq !== loadSeq.current) return;
        setQuotations(pre?.quotations || []);
        const vehicle = plans.find((p) => p.vehicle_no)?.vehicle_no || '';
        if (pre?.prefill?.lines?.length) {
          setLines(prefillLines(pre.prefill));
          setForm((prev) => ({ ...prev, vehicle_no: vehicle, ...quotationForm(pre.prefill) }));
        } else {
          const loaded = challanLinesFromPlans(plans);
          setLines(loaded.length ? loaded : [makeLine()]);
          setForm((prev) => ({ ...prev, vehicle_no: vehicle }));
        }
      }
    } finally {
      if (seq === loadSeq.current) setEditorLoading(false);
    }
  }, [isInvoice, kind, projects]);

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current || !initialProjectId || !projects.length) return;
    didInit.current = true;
    startNew(String(initialProjectId));
  }, [initialProjectId, projects, startNew]);

  const applyDoc = (row, readOnly) => {
    loadSeq.current += 1;
    setEditorLoading(false);
    setDoc(row);
    setViewOnly(readOnly);
    setProjectId(String(row.project));
    const gstRate = row.gst_type === 'IGST' ? num(row.igst_percent) : num(row.cgst_percent) + num(row.sgst_percent);
    setForm({
      date: row[cfg.dateField] || todayIso(),
      status: row.status || cfg.defaultStatus,
      vehicle_no: row.vehicle_no || '',
      site_address: row.site_address || '',
      gst_number: row.gst_number || '',
      gst_type: row.gst_type || 'CGST_SGST',
      gst_rate: round2(gstRate),
      payment_mode: row.payment_mode || '',
      payment_amount: num(row.payment_amount),
      remarks: row.remarks || '',
      quotation_no: row.quotation_no || '',
      gst_mode: row.gst_mode || 'None',
      gst_percent: num(row.gst_percent),
    });
    setLines((row.lines || []).map((l) => makeLine({
      section: l.section || 'Main',
      material_name: l.material_name,
      category: l.category,
      brand: l.brand || '',
      specification: l.specification || '',
      quantity: num(l.quantity),
      unit: l.unit || 'Nos',
      rate: num(l.rate),
    })));
    if (!isInvoice) fetchPrefill(row.project).then((res) => setQuotations(res?.quotations || []));
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const keepAdditional = (fresh) => (prev) => [...fresh, ...prev.filter(isAdditional)];

  const reloadFromPlanning = async () => {
    if (!projectId) return;
    const plans = await fetchPlans(projectId);
    const fresh = isInvoice ? invoiceLinesFromPlans(plans) : challanLinesFromPlans(plans);
    if (!fresh.length) {
      onNotify?.('This project has no items in Material Planning', 'error');
      return;
    }
    setLines(isInvoice ? fresh : keepAdditional(fresh));
    onNotify?.(`${fresh.length} item(s) loaded from Material Planning`);
  };

  const loadFromQuotation = async (quotationId) => {
    if (!projectId) return;
    const res = await fetchPrefill(projectId, quotationId);
    if (!res?.prefill?.lines?.length) {
      onNotify?.('No Quotation found for this project', 'error');
      return;
    }
    setQuotations(res.quotations || []);
    setLines(keepAdditional(prefillLines(res.prefill)));
    setForm((prev) => ({ ...prev, ...quotationForm(res.prefill) }));
    onNotify?.(`Items loaded from Quotation ${res.prefill.quotation_no || ''}`);
  };

  const addAdditionalWork = () => setLines((prev) => [...prev, makeLine({ section: 'Additional', rate: '' })]);

  const applyTurnkey = () => {
    if (!num(info?.total_value)) {
      onNotify?.('Project value is not set', 'error');
      return;
    }
    setLines([turnkeyLine(info, form.gst_rate, form.gst_type)]);
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const changeLine = (key, patch) => setLines((prev) => prev.map((l) => (l._key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(
    () => computeTotals(lines, kind, form.gst_type, form.gst_rate, form.payment_amount),
    [lines, kind, form.gst_type, form.gst_rate, form.payment_amount],
  );
  const cTotals = useMemo(
    () => challanTotals(lines, form.gst_mode, form.gst_percent),
    [lines, form.gst_mode, form.gst_percent],
  );
  const mainLines = lines.filter((l) => !isAdditional(l));
  const extraLines = lines.filter(isAdditional);

  const buildPayload = () => {
    const ordered = isInvoice ? lines : [...mainLines, ...extraLines];
    const payloadLines = ordered
      .filter((l) => String(l.material_name).trim())
      .map((l, idx) => ({
        material_name: String(l.material_name).trim().slice(0, 200),
        category: String(l.category || '').trim().slice(0, 100),
        quantity: num(l.quantity),
        unit: l.unit || 'Nos',
        rate: num(l.rate),
        sort_order: idx,
        ...(isInvoice ? {} : {
          section: l.section || 'Main',
          brand: String(l.brand || '').trim().slice(0, 100),
          specification: String(l.specification || '').trim().slice(0, 300),
        }),
      }));
    const common = { project: Number(projectId), status: form.status, remarks: form.remarks, lines: payloadLines, [cfg.dateField]: form.date };
    if (!isInvoice) {
      return {
        ...common,
        vehicle_no: form.vehicle_no,
        site_address: form.site_address,
        quotation_no: form.quotation_no,
        gst_mode: form.gst_mode,
        gst_percent: form.gst_mode === 'Flat' ? num(form.gst_percent) : form.gst_mode === 'Split' ? 8.9 : 0,
      };
    }
    const rate = num(form.gst_rate);
    return {
      ...common,
      gst_number: form.gst_number,
      gst_type: form.gst_type,
      cgst_percent: form.gst_type === 'IGST' ? 0 : round2(rate / 2),
      sgst_percent: form.gst_type === 'IGST' ? 0 : round2(rate / 2),
      igst_percent: form.gst_type === 'IGST' ? rate : 0,
      payment_mode: form.payment_mode,
      payment_amount: num(form.payment_amount),
    };
  };

  const handleSave = async () => {
    if (!projectId) {
      onNotify?.('Select a project first', 'error');
      return;
    }
    const payload = buildPayload();
    if (!payload.lines.length) {
      onNotify?.('Add at least one item', 'error');
      return;
    }
    if (!form.date) {
      onNotify?.('Select a date', 'error');
      return;
    }
    setSaving(true);
    try {
      const saved = doc?.id ? await cfg.api.update(doc.id, payload) : await cfg.api.create(payload);
      setDoc(saved);
      onNotify?.(`${cfg.title} ${saved[cfg.noField]} saved`);
      loadDocs();
    } catch (e) {
      onNotify?.(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (row) => {
    const opened = isInvoice ? printDocument(kind, row, company) : printChallan(row, company);
    if (!opened) onNotify?.('Popup blocked — please allow popups in your browser', 'error');
  };

  const confirmDelete = async () => {
    const row = deleting;
    setDeleting(null);
    try {
      await cfg.api.delete(row.id);
      onNotify?.(`${row[cfg.noField]} deleted`);
      if (doc?.id === row.id) startNew(projectId);
      loadDocs();
    } catch (e) {
      onNotify?.(e.message || 'Delete failed', 'error');
    }
  };

  const summary = useMemo(() => {
    const active = docs.filter((d) => d.status !== 'Cancelled');
    return {
      count: docs.length,
      value: active.reduce((s, d) => s + num(d.total_amount), 0),
      received: active.reduce((s, d) => s + num(d.payment_amount), 0),
      balance: active.reduce((s, d) => s + num(d.balance_due), 0),
      delivered: docs.filter((d) => d.status === 'Delivered').length,
    };
  }, [docs]);

  const readOnly = viewOnly;
  const shown = docs.slice(0, visible);
  const Icon = cfg.icon;
  const headers = isInvoice
    ? ['Status', 'Invoice No', 'Date', 'Project No', 'Customer Name', 'Taxable', 'GST', 'Total', 'Received', 'Balance', 'Actions']
    : ['Status', 'Challan No', 'Date', 'Project No', 'Customer Name', 'Vehicle No', 'Items', 'Value', 'Actions'];
  const numericCols = new Set(['Taxable', 'GST', 'Total', 'Received', 'Balance', 'Value', 'Items']);

  return (
    <div className="space-y-2.5">
      <Heading title={cfg.title} onOpenSection={onOpenSection} />
      {Subnav ? <Subnav activeSection={activeSection} onOpenSection={onOpenSection} /> : null}

      <section ref={editorRef} className={cx(PANEL, 'scroll-mt-4 p-3 sm:p-5')}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-display text-[20px] font-extrabold text-[#111827]">{doc ? `${cfg.title} ${doc[cfg.noField]}` : `New ${cfg.title}`}</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-[#7386a3]">
              {doc ? `Last updated ${fmtDate(doc.updated_at)}` : projectId ? `${cfg.title} number is generated automatically on save` : 'Select a solar project'}
              {readOnly ? <span className="ml-2 rounded bg-[#eef2f7] px-1.5 py-0.5 text-[10px] font-bold text-[#53647f]">VIEW ONLY</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className={LABEL}>
              Project
              <select
                value={projectId}
                onChange={(e) => { setProjectId(e.target.value); startNew(e.target.value); }}
                className="h-10 min-w-[260px] rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-semibold text-[#1e3261] outline-none"
              >
                <option value="">Select won project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.project_id} · {p.customer_name || p.project_name}</option>
                ))}
              </select>
            </label>
            {doc ? (
              <>
                <button type="button" onClick={() => handlePrint(doc)} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] px-3 text-[13px] font-semibold text-[#314a79]">
                  <Printer className="size-4" /> Print
                </button>
                {readOnly ? (
                  <button type="button" onClick={() => setViewOnly(false)} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] px-3 text-[13px] font-semibold text-[#314a79]">
                    <Pencil className="size-4" /> Edit
                  </button>
                ) : null}
                <button type="button" onClick={() => startNew(projectId)} className="inline-flex h-10 items-center gap-1.5 rounded-[8px] bg-[#eef2f7] px-3 text-[13px] font-bold text-[#314a79]">
                  <FilePlus2 className="size-4" /> New
                </button>
              </>
            ) : null}
          </div>
        </div>

        {info ? (
          <div className="mt-3 grid gap-2 rounded-[10px] border border-[#e7eef7] bg-[#f8fbff] p-3 text-[12px] sm:grid-cols-3 lg:grid-cols-6">
            {[
              ['Customer', info.customer_name],
              ['Mobile', info.lead_mobile_number],
              ['Capacity', info.capacity_kwp ? `${num(info.capacity_kwp)} kWp` : ''],
              ['System', [info.project_type, info.system_type].filter(Boolean).join(' / ')],
              [isInvoice ? 'Project Value' : 'Site', isInvoice ? (num(info.total_value) ? money(info.total_value) : '') : info.site || info.city],
              [isInvoice ? 'Consumer No' : 'Project Manager', isInvoice ? info.consumer_number : info.manager_name],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="font-semibold text-[#8a98af]">{label}</p>
                <p className="truncate font-bold text-[#1e3261]">{value || '—'}</p>
              </div>
            ))}
          </div>
        ) : null}

        {!projectId ? (
          <div className="mt-4 rounded-[12px] border border-dashed border-[#d5e0ef] bg-[#f8fbff] px-6 py-12 text-center">
            <Icon className="mx-auto size-8 text-[#9aa8bc]" />
            <p className="mt-2 text-[15px] font-extrabold text-[#1e3261]">Select a project</p>
            <p className="mt-1 text-[13px] font-medium text-[#7386a3]">{cfg.emptyHint}</p>
          </div>
        ) : editorLoading ? (
          <p className="py-12 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className={LABEL}>
                {isInvoice ? 'Invoice Date' : 'Challan Date'}
                <input type="date" disabled={readOnly} value={form.date} onChange={(e) => setField('date', e.target.value)} className={FIELD_INPUT} />
              </label>
              {isInvoice ? (
                <>
                  <label className={LABEL}>
                    Customer GSTIN (optional)
                    <input disabled={readOnly} value={form.gst_number} maxLength={20} onChange={(e) => setField('gst_number', e.target.value.toUpperCase())} placeholder="Leave blank for residential" className={FIELD_INPUT} />
                  </label>
                  <label className={LABEL}>
                    GST Slab
                    <select
                      disabled={readOnly}
                      value={GST_PRESETS.some((p) => p.rate === num(form.gst_rate)) ? String(num(form.gst_rate)) : 'custom'}
                      onChange={(e) => { if (e.target.value !== 'custom') setField('gst_rate', Number(e.target.value)); }}
                      className={FIELD_INPUT}
                    >
                      {GST_PRESETS.map((p) => <option key={p.rate} value={String(p.rate)}>{p.label}</option>)}
                      <option value="custom">Custom rate</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={LABEL}>
                      GST %
                      <input type="number" min="0" step="0.01" disabled={readOnly} value={form.gst_rate} onChange={(e) => setField('gst_rate', e.target.value)} className={FIELD_INPUT} />
                    </label>
                    <label className={LABEL}>
                      Tax Type
                      <select disabled={readOnly} value={form.gst_type} onChange={(e) => setField('gst_type', e.target.value)} className={FIELD_INPUT}>
                        <option value="CGST_SGST">CGST + SGST</option>
                        <option value="IGST">IGST</option>
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className={LABEL}>
                    Vehicle No
                    <input disabled={readOnly} value={form.vehicle_no} maxLength={30} onChange={(e) => setField('vehicle_no', e.target.value.toUpperCase())} placeholder="MP13 AB 1234" className={FIELD_INPUT} />
                  </label>
                  <label className={LABEL}>
                    Quotation Ref
                    <select
                      disabled={readOnly || !quotations.length}
                      value={quotations.find((q) => q.quotation_number === form.quotation_no)?.id ?? ''}
                      onChange={(e) => { if (e.target.value) loadFromQuotation(e.target.value); }}
                      className={FIELD_INPUT}
                    >
                      <option value="">{quotations.length ? 'Select quotation...' : 'No quotation for this project'}</option>
                      {quotations.map((q) => (
                        <option key={q.id} value={q.id}>{q.quotation_number || `#${q.id}`} · {q.status}{num(q.total) ? ` · ${money(q.total)}` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <div className={cx('grid gap-2', form.gst_mode === 'Flat' ? 'grid-cols-[1fr_90px]' : 'grid-cols-1')}>
                    <label className={LABEL}>
                      GST
                      <select disabled={readOnly} value={form.gst_mode} onChange={(e) => setField('gst_mode', e.target.value)} className={FIELD_INPUT}>
                        <option value="Split">Solar 70:30 (5% + 18%) — 8.9%</option>
                        <option value="Flat">Flat GST %</option>
                        <option value="None">No GST (material only)</option>
                      </select>
                    </label>
                    {form.gst_mode === 'Flat' ? (
                      <label className={LABEL}>
                        GST %
                        <input type="number" min="0" step="0.01" disabled={readOnly} value={form.gst_percent} onChange={(e) => setField('gst_percent', e.target.value)} className={FIELD_INPUT} />
                      </label>
                    ) : null}
                  </div>
                  <label className={cx(LABEL, 'sm:col-span-2 xl:col-span-4')}>
                    Delivery Site Address
                    <input disabled={readOnly} value={form.site_address} maxLength={300} onChange={(e) => setField('site_address', e.target.value)} placeholder={info?.site_address || info?.site || 'Project site address'} className={FIELD_INPUT} />
                  </label>
                </>
              )}
            </div>

            {!isInvoice ? (
              <>
                <div className="mt-4 rounded-[12px] border border-[#e7eef7] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-[14px] font-extrabold text-[#1e3261]">
                        {form.quotation_no ? `As per Quotation ${form.quotation_no}` : 'Material & Work Delivered'}
                      </h3>
                      <p className="text-[11px] font-semibold text-[#8a98af]">Every cell is editable. Lines with rate 0 print as &quot;Included&quot;.</p>
                    </div>
                    {!readOnly ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => loadFromQuotation()} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dce6f3] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] hover:bg-[#f8fbff]">
                          <FileText className="size-3.5" /> Load from Quotation
                        </button>
                        <button type="button" onClick={reloadFromPlanning} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dce6f3] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] hover:bg-[#f8fbff]">
                          <RefreshCw className="size-3.5" /> Load from Material Planning
                        </button>
                        <button type="button" onClick={() => setLines((prev) => [...prev, makeLine()])} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#eef2f7] px-3 text-[12px] font-bold text-[#314a79] hover:bg-[#e2e8f1]">
                          <Plus className="size-3.5" /> Add Row
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <ChallanLinesTable
                    lines={mainLines}
                    readOnly={readOnly}
                    onChange={changeLine}
                    onRemove={(key) => setLines((prev) => prev.filter((l) => l._key !== key))}
                    emptyText='No items. Use "Load from Quotation" or "Add Row".'
                  />
                </div>

                <div className="mt-3 rounded-[12px] border border-[#f3dfbd] bg-[#fffcf6] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="inline-flex items-center gap-1.5 text-[14px] font-extrabold text-[#8a5a12]">
                        <Hammer className="size-4" /> Additional Work
                      </h3>
                      <p className="text-[11px] font-semibold text-[#a9803f]">Add any work beyond the quotation here (extra structure, cable, civil work...). It is shown separately at the end of the challan.</p>
                    </div>
                    {!readOnly ? (
                      <button type="button" onClick={addAdditionalWork} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#f59e0b] px-3 text-[12px] font-bold text-white hover:bg-[#d98b06]">
                        <Plus className="size-3.5" /> Add Additional Work
                      </button>
                    ) : null}
                  </div>
                  <ChallanLinesTable
                    additional
                    lines={extraLines}
                    readOnly={readOnly}
                    onChange={changeLine}
                    onRemove={(key) => setLines((prev) => prev.filter((l) => l._key !== key))}
                    emptyText="No additional work. Use the button above to add it if needed."
                  />
                </div>

                <div className="mt-4 space-y-2 border-b border-[#edf2f8] pb-3">
                  <TotalLine label="Quotation Items" value={money(cTotals.main)} />
                  {cTotals.extra ? <TotalLine label="Additional Work" value={money(cTotals.extra)} tone="text-[#b7791f]" /> : null}
                  <TotalLine label="Taxable Value" value={money(cTotals.taxable)} />
                  {form.gst_mode === 'Split' ? (
                    <>
                      <TotalLine label="GST 5% on 70% (Goods)" value={money(cTotals.gst5)} />
                      <TotalLine label="GST 18% on 30% (Service)" value={money(cTotals.gst18)} />
                    </>
                  ) : null}
                  {form.gst_mode === 'Flat' ? <TotalLine label={`GST @ ${num(form.gst_percent)}%`} value={money(cTotals.gst)} /> : null}
                  {cTotals.roundOff ? <TotalLine label="Round Off" value={money(cTotals.roundOff)} /> : null}
                  <TotalLine label="Challan Total" value={money(cTotals.total)} big />
                </div>
                <p className="mt-1 text-right text-[12px] font-semibold text-[#7386a3]">{rupeesInWords(cTotals.total)}</p>
              </>
            ) : null}

            {isInvoice ? (
            <div className="mt-4 rounded-[12px] border border-[#e7eef7] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[14px] font-extrabold text-[#1e3261]">Billing Items</h3>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={reloadFromPlanning} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dce6f3] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] hover:bg-[#f8fbff]">
                      <RefreshCw className="size-3.5" /> Load from Material Planning
                    </button>
                    <button type="button" onClick={applyTurnkey} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-[#dce6f3] bg-white px-2.5 text-[12px] font-semibold text-[#314a79] hover:bg-[#f8fbff]">
                      <ReceiptText className="size-3.5" /> Turnkey (Project Value)
                    </button>
                    <button type="button" onClick={() => setLines((prev) => [...prev, makeLine()])} className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-[#eef2f7] px-3 text-[12px] font-bold text-[#314a79] hover:bg-[#e2e8f1]">
                      <Plus className="size-3.5" /> Add Item
                    </button>
                  </div>
                ) : null}
              </div>
              <LinesTable lines={lines} readOnly={readOnly} onChange={changeLine} onRemove={(key) => setLines((prev) => prev.filter((l) => l._key !== key))} />
            </div>
            ) : null}

            {isInvoice ? (
              <>
                <div className="mt-4 space-y-2 border-b border-[#edf2f8] pb-3">
                  <TotalLine label="Taxable Value" value={money(totals.subtotal)} />
                  {form.gst_type === 'IGST' ? (
                    <TotalLine label={`IGST @ ${num(form.gst_rate)}%`} value={money(totals.igst)} />
                  ) : (
                    <>
                      <TotalLine label={`CGST @ ${round2(num(form.gst_rate) / 2)}%`} value={money(totals.cgst)} />
                      <TotalLine label={`SGST @ ${round2(num(form.gst_rate) / 2)}%`} value={money(totals.sgst)} />
                    </>
                  )}
                  <TotalLine label="Invoice Total" value={money(totals.total)} big />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-b border-[#edf2f8] pb-3">
                  <select disabled={readOnly} value={form.payment_mode} onChange={(e) => setField('payment_mode', e.target.value)} className="h-8 rounded-[6px] border border-[#d9e4f2] bg-white px-2 text-[13px] font-semibold text-[#314a79] outline-none">
                    <option value="">Payment mode</option>
                    {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <TotalLine label="Received" tone="text-[#16a34a]">
                    <input type="number" min="0" disabled={readOnly} value={form.payment_amount} onChange={(e) => setField('payment_amount', e.target.value)} className="h-8 w-[140px] rounded-[6px] border border-[#cfe8d6] px-2 text-right text-[14px] font-extrabold text-[#16a34a] outline-none" />
                  </TotalLine>
                </div>
                <div className="mt-3">
                  <TotalLine label="Balance Due" value={money(totals.balance)} tone="text-[#dc2626]" big />
                </div>
                <p className="mt-1 text-right text-[12px] font-semibold text-[#7386a3]">{rupeesInWords(totals.total)}</p>
              </>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <label className={cx(LABEL, 'flex-1')}>
                Remarks
                <textarea
                  rows={2}
                  disabled={readOnly}
                  value={form.remarks}
                  onChange={(e) => setField('remarks', e.target.value)}
                  placeholder={isInvoice ? 'Payment terms, subsidy note...' : 'Panel serial numbers, driver name, delivery notes...'}
                  className="rounded-[8px] border border-[#d9e4f2] px-3 py-2 text-[13px] font-medium text-[#1e3261] outline-none"
                />
              </label>
              {!readOnly ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <select value={form.status} onChange={(e) => setField('status', e.target.value)} className="h-11 rounded-[8px] border border-[#d9e4f2] bg-white px-3 text-[13px] font-bold text-[#314a79] outline-none">
                    {cfg.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button type="button" disabled={saving} onClick={handleSave} className="inline-flex h-11 items-center gap-2 rounded-[8px] bg-[#0b65e5] px-5 text-[13px] font-bold text-white shadow-[0_8px_16px_rgba(11,101,229,0.22)] hover:bg-[#0a58c8] disabled:opacity-60">
                    <Save className="size-4" />
                    {saving ? 'Saving...' : `Save ${cfg.title}`}
                  </button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <div className="mt-6 border-t border-[#edf2f8] pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className={LABEL}>
              Project No
              <input value={filterDraft.project_code} onChange={(e) => setFilterDraft((p) => ({ ...p, project_code: e.target.value }))} placeholder="Search by project no" className={FIELD_INPUT} />
            </label>
            <label className={LABEL}>
              Customer Name
              <input value={filterDraft.customer} onChange={(e) => setFilterDraft((p) => ({ ...p, customer: e.target.value }))} placeholder="Search by customer name" className={FIELD_INPUT} />
            </label>
            <label className={LABEL}>
              Status
              <select value={filterDraft.status} onChange={(e) => setFilterDraft((p) => ({ ...p, status: e.target.value }))} className={FIELD_INPUT}>
                <option value="">All Status</option>
                {cfg.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className={LABEL}>
              Date From
              <input type="date" value={filterDraft.date_from} onChange={(e) => setFilterDraft((p) => ({ ...p, date_from: e.target.value }))} className={FIELD_INPUT} />
            </label>
            <label className={LABEL}>
              Date To
              <input type="date" value={filterDraft.date_to} onChange={(e) => setFilterDraft((p) => ({ ...p, date_to: e.target.value }))} className={FIELD_INPUT} />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { setVisible(PAGE_SIZE); setFilters({ ...filterDraft }); }} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-[#078c3e] px-4 text-[13px] font-bold text-white">
              <Search className="size-4" /> Search
            </button>
            <button
              type="button"
              onClick={() => { setFilterDraft(emptyFilters); setFilters(emptyFilters); setVisible(PAGE_SIZE); }}
              className="inline-flex h-9 items-center gap-1.5 rounded-[8px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-semibold text-[#314a79]"
            >
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="font-display text-[18px] font-extrabold text-[#111827]">{cfg.title} Reports</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatChip label={isInvoice ? 'Invoices' : 'Challans'} value={summary.count} />
            <StatChip label={isInvoice ? 'Total Invoiced' : 'Challan Value'} value={money(summary.value)} />
            {isInvoice ? (
              <>
                <StatChip label="Received" value={money(summary.received)} tone="text-[#16a34a]" />
                <StatChip label="Balance Due" value={money(summary.balance)} tone="text-[#dc2626]" />
              </>
            ) : (
              <StatChip label="Delivered" value={summary.delivered} tone="text-[#16a34a]" />
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-[10px] border border-[#e7eef7]">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f6f8fb] text-[12px] font-bold text-[#1e3261]">
                  {headers.map((h) => (
                    <th key={h} className={cx('px-3 py-2', numericCols.has(h) && 'text-right', h === 'Actions' && 'text-center')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr><td colSpan={headers.length} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">Loading...</td></tr>
                ) : shown.length === 0 ? (
                  <tr><td colSpan={headers.length} className="py-8 text-center text-[13px] font-semibold text-[#8a98af]">No {cfg.title.toLowerCase()} found.</td></tr>
                ) : shown.map((row) => (
                  <tr key={row.id} className={cx('border-t border-[#f0f4f9] text-[13px] hover:bg-[#fafcff]', doc?.id === row.id && 'bg-[#f3fbf6]')}>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#53647f]">
                        <span className={cx('size-2 rounded-full', STATUS_DOT[row.status] || 'bg-[#9aa8bc]')} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#0b65e5]">{row[cfg.noField]}</td>
                    <td className="px-3 py-2 text-[#53647f]">{fmtDate(row[cfg.dateField])}</td>
                    <td className="px-3 py-2 font-bold text-[#1e3261]">{row.project_code}</td>
                    <td className="px-3 py-2 text-[#314a79]">{row.customer_name || row.party_name || '—'}</td>
                    {isInvoice ? (
                      <>
                        <td className="px-3 py-2 text-right text-[#314a79]">{money(row.subtotal)}</td>
                        <td className="px-3 py-2 text-right text-[#314a79]">{money(row.gst_amount)}</td>
                        <td className="px-3 py-2 text-right font-extrabold text-[#1e3261]">{money(row.total_amount)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#16a34a]">{money(row.payment_amount)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#dc2626]">{money(row.balance_due)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 text-[#314a79]">{row.vehicle_no || '—'}</td>
                        <td className="px-3 py-2 text-right text-[#314a79]">{row.lines?.length || 0}</td>
                        <td className="px-3 py-2 text-right font-extrabold text-[#1e3261]">{money(row.total_amount)}</td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => applyDoc(row, true)} className="text-[#7c3aed]" aria-label="View"><Eye className="size-4" /></button>
                        <button type="button" onClick={() => applyDoc(row, false)} className="text-[#0b65e5]" aria-label="Edit"><Pencil className="size-4" /></button>
                        <button type="button" onClick={() => handlePrint(row)} className="text-[#078c3e]" aria-label="Print"><Printer className="size-4" /></button>
                        <button type="button" onClick={() => setDeleting(row)} className="text-[#dc2626]" aria-label="Delete"><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!listLoading && docs.length > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-[#7386a3]">Showing {shown.length} of {docs.length} records</p>
              {docs.length > visible ? (
                <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="h-9 rounded-[8px] border border-[#d5e0ef] bg-white px-4 text-[13px] font-semibold text-[#1e3261] hover:bg-[#f8fbff]">
                  Show More ({docs.length - visible} remaining)
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {deleting ? <ConfirmDelete label={deleting[cfg.noField]} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} /> : null}
    </div>
  );
}

export function ProjectSalesChallanPage(props) {
  return <ProjectBillingPage kind="challan" {...props} />;
}

export function ProjectInvoicePage(props) {
  return <ProjectBillingPage kind="invoice" {...props} />;
}
