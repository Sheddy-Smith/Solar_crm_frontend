/** Shared frontend helpers (BUG-035). */

export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

export const EM_DASH = '—';

export function normalizeApiRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export const fmtRs = (v) => (v != null && v !== '' ? `Rs ${Number(v).toLocaleString('en-IN')}` : EM_DASH);

export function exportCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportNotifyCsv(onNotify, label, headers, rows) {
  if (!rows?.length) {
    onNotify?.('Nothing to export.', 'error');
    return;
  }
  exportCsv(`${label.replace(/\s+/g, '-').toLowerCase()}.csv`, headers, rows);
  onNotify?.(`${rows.length} row(s) exported.`, 'success');
}
