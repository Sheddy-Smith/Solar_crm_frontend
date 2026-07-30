/**
 * Per-column resize for CRM data tables.
 *
 * Each column is locked to its own pixel width via <colgroup>. Dragging one
 * header edge only changes that column; the table width grows/shrinks so the
 * parent overflow-x-auto scrolls (responsive) instead of squeezing siblings.
 */
const BOOT_KEY = '__malwaCrmTableResize';
const MIN_COL_PX = 72;
const EDGE_PX = 8;
const TABLE_READY = 'crm-cols-resizable';
const STORAGE_PREFIX = 'crm-colw:v2:';

let resizing = false;

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

function ensureColgroup(table, count) {
  let colgroup = table.querySelector(':scope > colgroup[data-crm-cols]');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    colgroup.dataset.crmCols = '1';
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.children.length < count) {
    colgroup.appendChild(document.createElement('col'));
  }
  while (colgroup.children.length > count) {
    colgroup.lastElementChild.remove();
  }
  return colgroup;
}

function measureNaturalWidths(table) {
  // Temporarily clear forced layout so we measure content sizes once.
  const prevLayout = table.style.tableLayout;
  const prevWidth = table.style.width;
  const prevMin = table.style.minWidth;
  table.style.tableLayout = 'auto';
  table.style.width = 'max-content';
  table.style.minWidth = 'max-content';
  const widths = headerCells(table).map((th) => Math.max(MIN_COL_PX, Math.round(th.getBoundingClientRect().width) || MIN_COL_PX));
  table.style.tableLayout = prevLayout;
  table.style.width = prevWidth;
  table.style.minWidth = prevMin;
  return widths;
}

function currentWidths(table) {
  const colgroup = table.querySelector(':scope > colgroup[data-crm-cols]');
  if (colgroup?.children?.length) {
    return Array.from(colgroup.children).map((col, i) => {
      const raw = Number.parseFloat(col.style.width);
      if (Number.isFinite(raw) && raw > 0) return raw;
      const th = headerCells(table)[i];
      return Math.max(MIN_COL_PX, Math.round(th?.getBoundingClientRect().width || MIN_COL_PX));
    });
  }
  return headerCells(table).map((th) => Math.max(MIN_COL_PX, Math.round(th.getBoundingClientRect().width) || MIN_COL_PX));
}

function applyWidths(table, widths) {
  if (!widths?.length) return;
  const cols = ensureColgroup(table, widths.length).children;
  let total = 0;
  for (let i = 0; i < widths.length; i += 1) {
    const px = Math.max(MIN_COL_PX, Math.round(widths[i] || MIN_COL_PX));
    total += px;
    cols[i].style.width = `${px}px`;
    cols[i].style.minWidth = `${px}px`;
  }

  table.classList.add(TABLE_READY);
  table.style.tableLayout = 'fixed';
  // Explicit pixel table width — never leave at 100%, or siblings reflow together.
  table.style.width = `${total}px`;
  table.style.minWidth = `${total}px`;
  table.style.maxWidth = 'none';
}

function restoreTable(table) {
  if (!isDataTable(table) || resizing) return;
  table.classList.add('crm-col-resize-enabled');
  const cells = headerCells(table);
  const saved = readSavedWidths(table);
  if (saved && saved.length === cells.length) {
    applyWidths(table, saved);
  }
}

function prepareAll(root = document) {
  if (resizing) return;
  root.querySelectorAll?.('table').forEach((table) => restoreTable(table));
}

function hitResizeEdge(th, clientX) {
  const rect = th.getBoundingClientRect();
  return clientX >= rect.right - EDGE_PX && clientX <= rect.right + 4;
}

function startResize(event, table, colIndex) {
  event.preventDefault();
  event.stopPropagation();

  const th = headerCells(table)[colIndex];
  if (!th) return;

  resizing = true;
  const startX = event.clientX;

  // Lock every column to its current pixel width, then only mutate colIndex.
  let locked = currentWidths(table);
  if (!table.classList.contains(TABLE_READY)) {
    locked = measureNaturalWidths(table);
  }
  applyWidths(table, locked);
  const startWidth = locked[colIndex];

  document.body.classList.add('crm-col-resizing');
  table.classList.add('crm-col-resizing-active');

  const onMove = (ev) => {
    const next = locked.slice();
    next[colIndex] = Math.max(MIN_COL_PX, startWidth + (ev.clientX - startX));
    applyWidths(table, next);
    locked = next;
  };

  const onUp = () => {
    resizing = false;
    document.body.classList.remove('crm-col-resizing');
    table.classList.remove('crm-col-resizing-active');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    writeSavedWidths(table, locked);
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
  if (resizing) return;
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
  table.style.maxWidth = '';
  const colgroup = table.querySelector(':scope > colgroup[data-crm-cols]');
  colgroup?.remove();
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
    if (resizing) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => prepareAll(root), 80);
  });
  observer.observe(root, { childList: true, subtree: true });
}
