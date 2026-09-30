import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Keyboard, Languages } from 'lucide-react';
import { authApi, tokenStore } from '../api.js';
import {
  LANGUAGES, getLanguageMeta, markExplicitChoice, markLanguageSynced, setLanguage, setTypingEnabled,
  trackPreferenceSave, useI18n,
} from './index.js';

export async function saveLanguagePreference(prefs) {
  const hasLanguage = Object.prototype.hasOwnProperty.call(prefs, 'language');
  if (hasLanguage) markLanguageSynced(false);
  if (!tokenStore.getAccess()) return null;
  const saved = await trackPreferenceSave(authApi.updatePreferences(prefs).catch(() => null));
  if (hasLanguage && saved) markLanguageSynced(true);
  return saved;
}

export function chooseLanguage(code) {
  markExplicitChoice();
  setLanguage(code);
  return saveLanguagePreference({ language: code });
}

export function chooseTyping(enabled) {
  setTypingEnabled(enabled);
  return saveLanguagePreference({ typing_transliteration: Boolean(enabled) });
}

/** Header language menu: pick the UI language and toggle phonetic typing. */
export default function LanguageSwitcher({ compact = false, className = '', onChanged }) {
  const { language, typing, enabled, loading } = useI18n();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const menuRef = useRef(null);
  const meta = getLanguageMeta(language);
  const options = LANGUAGES.filter((l) => enabled.includes(l.code));

  // The menu is portalled to <body> so sticky page toolbars can't paint over it.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(250, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      const top = r.bottom + 8;
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
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#dce7f5] bg-white font-bold text-[#34507e] transition hover:border-[#b9cdea] hover:text-[#0b65e5] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${compact ? 'size-9 justify-center' : 'h-10 px-3 text-[13px]'}`}
        aria-label="Change language"
        aria-expanded={open}
        title="Change language"
      >
        <Languages className={`${compact ? 'size-4' : 'size-4'} ${loading ? 'animate-pulse' : ''}`} />
        {compact ? null : (
          <>
            <span data-no-translate>{meta.native}</span>
            <ChevronDown className="size-3.5 opacity-70" />
          </>
        )}
      </button>

      {open && pos ? createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          className="fixed z-1000 flex flex-col overflow-hidden rounded-xl border border-[#dce7f5] bg-white shadow-[0_18px_34px_rgba(21,43,83,0.16)] dark:border-slate-600 dark:bg-slate-900"
        >
          <p className="shrink-0 border-b border-[#edf2f9] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#7585a2] dark:border-slate-700">Language</p>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {options.map((l) => {
              const active = l.code === language;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    chooseLanguage(l.code);
                    onChanged?.(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] transition hover:bg-[#f5f9ff] dark:hover:bg-slate-800 ${active ? 'font-extrabold text-[#0b65e5]' : 'font-semibold text-[#263d72] dark:text-slate-200'}`}
                >
                  <span data-no-translate>
                    {l.native}
                    {l.native !== l.name ? <span className="ml-1.5 text-[11px] font-semibold text-[#8a99b3]">{l.name}</span> : null}
                  </span>
                  {active ? <Check className="size-4" /> : null}
                </button>
              );
            })}
          </div>
          {meta.itc ? (
            <div className="shrink-0 border-t border-[#edf2f9] px-4 py-3 dark:border-slate-700">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-bold text-[#263d72] dark:text-slate-200">
                  <Keyboard className="size-4 text-[#0b65e5]" />
                  Phonetic typing
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={typing}
                  aria-label="Phonetic typing"
                  onClick={() => chooseTyping(!typing)}
                  className={`relative h-5 w-9 shrink-0 rounded-full transition ${typing ? 'bg-[#0b65e5]' : 'bg-[#cbd5e1]'}`}
                >
                  <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${typing ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
              </label>
              <p className="mt-1.5 text-[11px] font-semibold leading-snug text-[#7585a2]">
                Type with English letters, then press Space or Enter to convert the word.
              </p>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
