/** Double-click (desktop) + double-tap (mobile) to open a table/card row — same pattern as Lead List. */

const DOUBLE_TAP_MS = 320;

function shouldIgnoreRowOpen(event) {
  return Boolean(
    event.target?.closest?.(
      'button, a, input, select, textarea, label, [data-no-row-open], .crm-col-sticky-right',
    ),
  );
}

/**
 * Spread onto <tr> / card: {...rowDoubleOpenProps(() => open(row))}
 * Action cells should use data-no-row-open or class crm-col-sticky-right.
 */
export function rowDoubleOpenProps(onOpen, { title = 'Double-tap to view' } = {}) {
  return {
    className: 'crm-row-clickable',
    title,
    onDoubleClick: (event) => {
      if (shouldIgnoreRowOpen(event)) return;
      onOpen?.(event);
    },
    onTouchEnd: (event) => {
      if (shouldIgnoreRowOpen(event)) return;
      const el = event.currentTarget;
      if (!el) return;
      const now = Date.now();
      const prev = Number(el.dataset.lastTapAt || 0);
      if (now - prev > 0 && now - prev < DOUBLE_TAP_MS) {
        event.preventDefault();
        el.dataset.lastTapAt = '0';
        onOpen?.(event);
        return;
      }
      el.dataset.lastTapAt = String(now);
    },
  };
}
