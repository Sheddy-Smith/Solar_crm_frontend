import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Check, ChevronDown, Monitor, Moon, Sun, SunMoon } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'professional', label: 'Professional', icon: Briefcase },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function getOption(theme) {
  return OPTIONS.find((option) => option.value === theme) || OPTIONS[0];
}

/** Navbar / profile theme picker: Light, Professional, Dark, System. */
function ThemeToggle({
  theme,
  onChange,
  className = '',
  compact = false,
  row = false,
  menuAttrs,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const active = getOption(theme);
  const ActiveIcon = active.icon;

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(220, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const top = rect.bottom + 8;
      setPos({ top, left, width, maxHeight: Math.max(160, window.innerHeight - top - 12) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectTheme = (value) => {
    onChange?.(value);
    setOpen(false);
  };

  return (
    <div ref={ref} className={`relative ${className}`}>
      {row ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left! text-[13px] font-extrabold text-[#263d72] transition hover:bg-[#f5f9ff] dark:text-slate-200 dark:hover:bg-slate-800"
          aria-label="Change theme"
          aria-expanded={open}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-[#f3edff] text-[#7c3aed]">
            <SunMoon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">Theme</span>
          <span className="truncate text-[12px] font-bold text-[#7585a2]">{active.label}</span>
          <ChevronDown className={`size-4 shrink-0 text-[#91a3bd] transition ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#dce7f5] bg-white font-bold text-[#34507e] transition hover:border-[#b9cdea] hover:text-[#0b65e5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${
            compact ? 'size-9 justify-center' : 'h-10 px-3 text-[13px]'
          }`}
          aria-label="Change theme"
          aria-expanded={open}
          title="Change theme"
        >
          <ActiveIcon className="size-4" />
          {compact ? null : (
            <>
              <span>{active.label}</span>
              <ChevronDown className={`size-3.5 opacity-70 transition ${open ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
      )}

      {open && pos
        ? createPortal(
            <div
              {...menuAttrs}
              ref={menuRef}
              style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
              className="fixed z-1000 flex flex-col overflow-hidden rounded-xl border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)] dark:border-slate-600 dark:bg-slate-900"
            >
              <p className="shrink-0 border-b border-[#edf2f9] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2] dark:border-slate-700">
                Change theme
              </p>
              <div className="overflow-y-auto py-1">
                {OPTIONS.map(({ value, label, icon: Icon }) => {
                  const isActive = theme === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectTheme(value)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] font-semibold transition ${
                        isActive
                          ? 'bg-[#eef5ff] text-[#0b65e5] dark:bg-slate-800 dark:text-sky-300'
                          : 'text-[#34507e] hover:bg-[#f5f9ff] dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                      aria-pressed={isActive}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">{label}</span>
                      {isActive ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default ThemeToggle;
