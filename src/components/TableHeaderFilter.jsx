import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Lead-style column header filter: label + chevron, portal dropdown.
 * options: string[] | { value, label }[]
 */
export function TableHeaderFilter({ label, value, options, onChange, active = false }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, minWidth: 190 });

  const updateMenuPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportPadding = 8;
    const menuWidth = Math.max(190, rect.width);
    const left = Math.min(rect.left, window.innerWidth - menuWidth - viewportPadding);
    setMenuStyle({
      top: rect.bottom + 4,
      left: Math.max(viewportPadding, left),
      minWidth: menuWidth,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const close = (event) => {
      const target = event.target;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => updateMenuPosition();
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updateMenuPosition]);

  return (
    <>
      <div ref={anchorRef} className="crm-header-filter-anchor relative inline-flex max-w-full min-w-0 items-center gap-0.5">
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
          aria-label={`Filter ${label}`}
          aria-expanded={open}
          className={cx(
            'grid size-5 shrink-0 place-items-center rounded-[5px] transition',
            active || open ? 'bg-[#e8f1ff] text-[#0b65e5]' : 'text-[#8a98af] hover:bg-[#eef3fb] hover:text-[#284276]',
          )}
        >
          <ChevronDown className={cx('size-3.5 transition-transform', open && 'rotate-180')} />
        </button>
      </div>
      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={`${label} filter options`}
          className="fixed z-[200] max-h-64 min-w-[190px] overflow-y-auto rounded-[10px] border border-[#e2e9f3] bg-white py-1 shadow-[0_16px_32px_rgba(17,39,84,0.16)]"
          style={{ top: menuStyle.top, left: menuStyle.left, minWidth: menuStyle.minWidth }}
        >
          {options.map((option) => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? option.label : option;
            const selected = String(value) === String(optionValue);
            return (
              <button
                key={String(optionValue)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(optionValue);
                  setOpen(false);
                }}
                className={cx(
                  'flex w-full items-center px-3 py-1.5 text-left text-[12px] font-bold transition',
                  selected ? 'bg-[#eef6ff] text-[#0b65e5]' : 'text-[#314a79] hover:bg-[#f7fbff]',
                )}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export default TableHeaderFilter;
