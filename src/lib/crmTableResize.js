/**
 * Global column resize for CRM data tables.
 *
 * Drag the right edge of any header cell to resize. Uses CSS ::after grips
 * (no nodes injected into React-managed <th>s) so re-renders stay clean.
 * Widths persist in localStorage per header fingerprint.
 */
const BOOT_KEY = '__malwaCrmTableResize';
const MIN_COL_PX = 64;
const EDGE_PX = 10;
const TABLE_READY = 'crm-cols-resizable';
const STORAGE_PREFIX = 'crm-colw:v1:';

function headerCells(table) {
  const row = table.tHead?.rows?.[0];
  if (!row) return [];
  return Array.from(row.cells);
}

function isDataTable(table) {
  if (!(table instanceof HTMLTableElement)) return false;
  if (table.dataset.noColResize === '1' || table.closest('[data-no-col-resize]')) return false;
  if (table.classList.contains('list') || table.classList.contains('kv') || table.classList.contains('data')) {
    return false;
  }
  const cells = headerCells(table);
  if (cells.length < 2) return false;
  if (table.classList.contains('crm-table') || table.classList.contains(TABLE_READY)) return true;
  const wrap = table.parentElement;
  if (wrap && (wrap.classList.contains('overflow-x-auto') || wrap.classList.contains('responsive-scroll'))) {
    return true;
  }
  if (/\bmin-w-\[/.test(table.className)) return true;
  return Boolean(table.tBodies?.[0]?.rows?.length);
}

function tableStorageKey(table) {
  const headers = headerCells(table)
    .map((th) => (th.textContent || '').trim().replace(/\s+/g, ' '))
    .join('|');
  return `${STORAGE_PREFIX}${headers}`;
}

function readSavedWidths(table) {
  try {
    const raw = localStorage.getItem(tableStorageKey(table));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSavedWidths(table, widths) {
  try {
    localStorage.setItem(tableStorageKey(table), JSON.stringify(widths));
  } catch {
    /* ignore */
  }
}

function clearSavedWidths(table) {
  try {
    localStorage.removeItem(tableStorageKey(table));
  } catch {
    /* ignore */
  }
}

function bodyCellsForColumn(table, colIndex) {
  const out = [];
  for (const body of Array.from(table.tBodies || [])) {
    for (const row of Array.from(body.rows)) {
      const cell = row.cells[colIndex];
      if (cell && cell.colSpan === 1) out.push(cell);
    }
  }
  return out;
}

function setColumnWidth(table, colIndex, widthPx) {
  const width = `${Math.max(MIN_COL_PX, Math.round(widthPx))}px`;
  const th = headerCells(table)[colIndex];
  if (!th) return;
  th.style.width = width;
  th.style.minWidth = width;
  th.style.maxWidth = width;
  for (const cell of bodyCellsForColumn(table, colIndex)) {
    cell.style.width = width;
    cell.style.minWidth = width;
    cell.style.maxWidth = width;
  }
}

function syncTableWidth(table) {
  const cells = headerCells(table);
  let total = 0;
  let measured = 0;
  for (const th of cells) {
    const w = th.getBoundingClientRect().width;
    if (w > 0) {
      total += w;
      measured += 1;
    }
  }
  if (measured === cells.length && total > 0) {
    table.style.width = `${Math.ceil(total)}px`;
    table.style.minWidth = `${Math.ceil(total)}px`;
  }
}

function currentWidths(table) {
  return headerCells(table).map((th) => Math.round(th.getBoundingClientRect().width) || MIN_COL_PX);
}

function applyWidths(table, widths) {
  if (!widths?.length) return;
  table.classList.add(TABLE_READY);
  table.style.tableLayout = 'fixed';
  headerCells(table).forEach((_, i) => {
    if (typeof widths[i] === 'number' && widths[i] > 0) {
      setColumnWidth(table, i, widths[i]);
    }
  });
  syncTableWidth(table);
}

function restoreTable(table) {
  if (!isDataTable(table)) return;
  table.classList.add('crm-col-resize-enabled');
  const saved = readSavedWidths(table);
  const cells = headerCells(table);
  if (saved && saved.length === cells.length) {
    applyWidths(table, saved);
  }
}

function prepareAll(root = document) {
  root.querySelectorAll?.('table').forEach((table) => restoreTable(table));
}

function hitResizeEdge(th, clientX) {
  const rect = th.getBoundingClientRect();
  return clientX >= rect.right - EDGE_PX && clientX <= rect.right + 2;
}

function startResize(event, table, colIndex) {
  event.preventDefault();
  event.stopPropagation();

  const th = headerCells(table)[colIndex];
  if (!th) return;

  const startX = event.clientX;
  const startWidth = th.getBoundingClientRect().width;
  table.classList.add(TABLE_READY);
  table.style.tableLayout = 'fixed';
  applyWidths(table, currentWidths(table));

  document.body.classList.add('crm-col-resizing');

  const onMove = (ev) => {
    setColumnWidth(table, colIndex, startWidth + (ev.clientX - startX));
    syncTableWidth(table);
  };

  const onUp = () => {
    document.body.classList.remove('crm-col-resizing');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    writeSavedWidths(table, currentWidths(table));
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function onPointerDown(event) {
  if (event.button != null && event.button !== 0) return;
  const th = event.target?.closest?.('thead th, thead td');
  if (!th) return;
  const table = th.closest('table');
  if (!table || !isDataTable(table)) return;
  if (!hitResizeEdge(th, event.clientX)) return;
  const colIndex = th.cellIndex;
  if (!Number.isFinite(colIndex)) return;
  startResize(event, table, colIndex);
}

function onPointerMove(event) {
  if (document.body.classList.contains('crm-col-resizing')) return;
  const th = event.target?.closest?.('thead th, thead td');
  if (!th) {
    document.body.classList.remove('crm-col-resize-cursor');
    return;
  }
  const table = th.closest('table');
  if (!table || !isDataTable(table) || !hitResizeEdge(th, event.clientX)) {
    document.body.classList.remove('crm-col-resize-cursor');
    return;
  }
  document.body.classList.add('crm-col-resize-cursor');
}

function onDblClick(event) {
  const th = event.target?.closest?.('thead th, thead td');
  if (!th) return;
  const table = th.closest('table');
  if (!table || !isDataTable(table)) return;
  if (!hitResizeEdge(th, event.clientX)) return;
  event.preventDefault();
  event.stopPropagation();
  clearSavedWidths(table);
  table.classList.remove(TABLE_READY);
  table.style.tableLayout = '';
  table.style.width = '';
  table.style.minWidth = '';
  headerCells(table).forEach((header, i) => {
    header.style.width = '';
    header.style.minWidth = '';
    header.style.maxWidth = '';
    for (const cell of bodyCellsForColumn(table, i)) {
      cell.style.width = '';
      cell.style.minWidth = '';
      cell.style.maxWidth = '';
    }
  });
}

export function enableCrmTableColumnResize() {
  if (typeof window === 'undefined' || window[BOOT_KEY]) return;
  window[BOOT_KEY] = true;

  const boot = () => prepareAll(document.getElementById('root') || document);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('dblclick', onDblClick, true);

  const root = document.getElementById('root') || document.body;
  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => prepareAll(root), 50);
  });
  observer.observe(root, { childList: true, subtree: true });
}
