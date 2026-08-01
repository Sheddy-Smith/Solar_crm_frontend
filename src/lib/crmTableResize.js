/**
 * Resizable columns for CRM data tables.
 *
 * Drag the right edge of a header to expand OR shrink that column.
 * Action/Actions stays sticky on the right and is not resized.
 * Double-click a resize edge to reset widths for that table.
 */
const BOOT_KEY = '__malwaCrmTableResize';
const MIN_COL_PX = 52;
const MIN_INDEX_PX = 40;
/** Keep Action compact — must not absorb leftover table width (creates a right-side gap). */
const ACTION_MIN_PX = 88;
const ACTION_WIDTH_PX = 96;
const EDGE_PX = 8;
const TABLE_READY = 'crm-cols-resizable';
/** Bump when default/min logic changes so bloated localStorage widths reset. */
const STORAGE_PREFIX = 'crm-colw:v6:';

let resizing = false;

function headerCells(table) {
  const row = table.tHead?.rows?.[0];
  if (!row) return [];
  return Array.from(row.cells);
}

function headerLabel(th) {
  return (th?.textContent || '').trim().replace(/\s+/g, ' ');
}

function isActionHeader(th) {
  const label = headerLabel(th).toLowerCase();
  return label === 'action' || label === 'actions';
}

function isIndexHeader(th) {
  const label = headerLabel(th).toLowerCase();
  return label === '#' || label === 'no.' || label === 'no' || label === 'sr' || label === 'sr.';
}

function minForHeader(th) {
  if (isActionHeader(th)) return ACTION_MIN_PX;
  if (isIndexHeader(th)) return MIN_INDEX_PX;
  return MIN_COL_PX;
}

function defaultWidthForHeader(th) {
  const label = headerLabel(th).toLowerCase();
  if (isActionHeader(th)) return ACTION_WIDTH_PX;
  if (isIndexHeader(th)) return 44;
  if (label.includes('mobile') || label.includes('phone')) return 118;
  if (label.includes('ivrs')) return 140;
  if (label === 'status' || label === 'survey status') return 108;
  if (label.includes('project type') || label === 'type') return 100;
  if (label.includes('customer') || label.includes('role name') || label === 'item') return 180;
  if (label.includes('project name') || label === 'project') return 140;
  if (label.includes('assigned') || label.includes('added by') || label.includes('created by') || label.includes('deleted by')) return 140;
  if (label.includes('follow-up') || label.includes('follow up') || label.includes('deleted on') || label.includes('auto-delete')) return 130;
  if (label === 'source' || label === 'type' || label === 'users' || label === 'status') return 110;
  return 120;
}

function actionColumnIndex(table) {
  const cells = headerCells(table);
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    if (isActionHeader(cells[i])) return i;
  }
  return -1;
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
  const headers = headerCells(table).map((th) => headerLabel(th)).join('|');
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

function ensureScrollParent(table) {
  const wrap = table.parentElement;
  if (!wrap || !(wrap instanceof HTMLElement)) return;
  const overflowX = getComputedStyle(wrap).overflowX;
  if (overflowX === 'hidden' || overflowX === 'clip') {
    wrap.style.overflowX = 'auto';
  }
  wrap.classList.add('crm-table-scroll');
}

function ensureColgroup(table, count) {
  Array.from(table.querySelectorAll(':scope > colgroup')).forEach((group) => {
    if (group.dataset.crmCols !== '1') group.remove();
  });

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

function markStickyAction(table) {
  const idx = actionColumnIndex(table);
  const cells = headerCells(table);
  cells.forEach((th, i) => {
    th.classList.toggle('crm-col-sticky-right', i === idx);
    th.classList.toggle('crm-col-index', isIndexHeader(th));
  });
  for (const body of Array.from(table.tBodies || [])) {
    for (const row of Array.from(body.rows)) {
      Array.from(row.cells).forEach((cell, i) => {
        cell.classList.toggle('crm-col-sticky-right', i === idx);
        cell.classList.toggle('crm-col-index', i === 0 && isIndexHeader(cells[0]));
      });
    }
  }
}

function measureNaturalWidths(table) {
  const prevLayout = table.style.tableLayout;
  const prevWidth = table.style.width;
  const prevMin = table.style.minWidth;
  const prevMax = table.style.maxWidth;
  // Measure compact content widths — ignore stretched min-width classes.
  table.style.tableLayout = 'auto';
  table.style.width = 'auto';
  table.style.minWidth = '0';
  table.style.maxWidth = 'none';
  const widths = headerCells(table).map((th) => {
    const measured = Math.round(th.getBoundingClientRect().width) || minForHeader(th);
    const preferred = defaultWidthForHeader(th);
    // Cap index columns so "#" never inherits a stretched layout width.
    if (isIndexHeader(th)) return Math.max(minForHeader(th), Math.min(measured, preferred));
    return Math.max(minForHeader(th), measured || preferred);
  });
  table.style.tableLayout = prevLayout;
  table.style.width = prevWidth;
  table.style.minWidth = prevMin;
  table.style.maxWidth = prevMax;
  return widths;
}

function defaultWidths(table) {
  return headerCells(table).map((th) => defaultWidthForHeader(th));
}

function currentWidths(table) {
  const colgroup = table.querySelector(':scope > colgroup[data-crm-cols]');
  const cells = headerCells(table);
  if (colgroup?.children?.length) {
    return Array.from(colgroup.children).map((col, i) => {
      const raw = Number.parseFloat(col.style.width);
      if (Number.isFinite(raw) && raw > 0) return raw;
      const th = cells[i];
      return defaultWidthForHeader(th);
    });
  }
  return defaultWidths(table);
}

function normalizeWidths(table, widths) {
  const cells = headerCells(table);
  return cells.map((th, i) => Math.max(minForHeader(th), Math.round(widths[i] || minForHeader(th))));
}

function applyWidths(table, widths) {
  if (!widths?.length) return;
  const next = normalizeWidths(table, widths);
  const cols = ensureColgroup(table, next.length).children;
  let total = 0;
  for (let i = 0; i < next.length; i += 1) {
    const th = headerCells(table)[i];
    const floor = minForHeader(th);
    const isAction = isActionHeader(th);
    // Pin Action so leftover 100%-width space goes into data columns, not past the icons.
    const px = isAction ? ACTION_WIDTH_PX : next[i];
    total += px;
    cols[i].style.width = `${px}px`;
    // Floor min-width only — do NOT pin minWidth to current width, or
    // browsers refuse to shrink the column on the next drag.
    cols[i].style.minWidth = `${isAction ? ACTION_WIDTH_PX : floor}px`;
    cols[i].style.maxWidth = isAction ? `${ACTION_WIDTH_PX}px` : '';
  }

  table.classList.add(TABLE_READY);
  table.style.tableLayout = 'fixed';
  // Fill the available page/container width; scroll only when content needs more.
  table.style.width = '100%';
  table.style.minWidth = `${total}px`;
  table.style.maxWidth = 'none';
  markStickyAction(table);
  ensureScrollParent(table);
}

function restoreTable(table) {
  if (!isDataTable(table) || resizing) return;
  table.classList.add('crm-col-resize-enabled');
  ensureScrollParent(table);
  markStickyAction(table);
  // Already initialized for this DOM node — don't clobber live widths.
  if (table.classList.contains(TABLE_READY)) return;
  const cells = headerCells(table);
  const saved = readSavedWidths(table);
  if (saved && saved.length === cells.length) {
    applyWidths(table, saved);
    return;
  }
  // Compact defaults so "#" / first columns are not stretched by min-width.
  applyWidths(table, defaultWidths(table));
}

function prepareAll(root = document) {
  if (resizing) return;
  root.querySelectorAll?.('table').forEach((table) => restoreTable(table));
}

function hitResizeEdge(th, clientX) {
  if (isActionHeader(th)) return false;
  const rect = th.getBoundingClientRect();
  return clientX >= rect.right - EDGE_PX && clientX <= rect.right + 4;
}

function startResize(event, table, colIndex) {
  event.preventDefault();
  event.stopPropagation();

  const th = headerCells(table)[colIndex];
  if (!th || isActionHeader(th)) return;

  resizing = true;
  const startX = event.clientX;
  const scrollParent = table.parentElement;

  let locked = currentWidths(table);
  if (!table.classList.contains(TABLE_READY)) {
    locked = measureNaturalWidths(table);
  }
  applyWidths(table, locked);
  const startWidth = locked[colIndex];
  const floor = minForHeader(th);
  const startScroll = scrollParent?.scrollLeft || 0;

  document.body.classList.add('crm-col-resizing');
  table.classList.add('crm-col-resizing-active');

  const onMove = (ev) => {
    const delta = ev.clientX - startX;
    const next = locked.slice();
    // Expand (positive) and shrink (negative) both supported down to floor.
    next[colIndex] = Math.max(floor, Math.round(startWidth + delta));
    applyWidths(table, next);
    locked = next;
    if (scrollParent) scrollParent.scrollLeft = startScroll;
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
  applyWidths(table, defaultWidths(table));
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
