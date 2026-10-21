import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import {
  applyAppUpdate,
  dismissUpdateLater,
  subscribeAppUpdate,
} from '../lib/appUpdate.js';
import { hasUnsavedWork } from '../lib/unsavedWork.js';

/**
 * Automatic “New Version Available” dialog for web releases.
 * Native APK updates are called out only when version.json requires them.
 */
export default function AppUpdatePopup() {
  const [state, setState] = useState(() => ({
    popupOpen: false,
    current: { buildId: '', releaseVersion: '' },
    latest: null,
    hasUnsavedWork: false,
  }));
  const [busy, setBusy] = useState(false);
  const [unsavedWarn, setUnsavedWarn] = useState(false);

  useEffect(() => subscribeAppUpdate(setState), []);

  if (!state.popupOpen || !state.latest) return null;

  const currentLabel = state.current.releaseVersion || '—';
  const latestLabel = state.latest.releaseVersion || state.latest.buildId;
  const notes =
    state.latest.releaseNotes
    || 'Latest improvements, bug fixes aur performance updates paane ke liye CRM update karein.';

  const onLater = () => {
    setUnsavedWarn(false);
    dismissUpdateLater();
  };

  const onUpdate = async () => {
    if (hasUnsavedWork() && !unsavedWarn) {
      setUnsavedWarn(true);
      return;
    }
    setBusy(true);
    const result = await applyAppUpdate({ force: unsavedWarn || !hasUnsavedWork() });
    if (result.reason === 'unsaved') {
      setBusy(false);
      setUnsavedWarn(true);
      return;
    }
    // page reloads
  };

  return (
    <div
      className="modal-overlay fixed inset-0 z-[120] flex items-end justify-center bg-[#0b1a33]/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="malwa-update-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[#dce7f5] bg-white shadow-[0_24px_60px_rgba(15,39,92,0.28)] dark:border-slate-600 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-[#0d9f4a] to-[#0b7a39] px-5 py-4 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/85">
            Malwa Solar CRM
          </p>
          <h2 id="malwa-update-title" className="mt-1 text-[20px] font-extrabold leading-tight">
            Software Update
          </h2>
        </div>

        <button
          type="button"
          onClick={onLater}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-white/90 transition hover:bg-white/15"
          aria-label="Dismiss update"
        >
          <X className="size-4" />
        </button>

        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-wide text-[#0d9f4a]">
              New version
            </p>
            <p className="mt-1 text-[15px] font-bold text-[#1e3261] dark:text-slate-100">
              A new version of Malwa Solar CRM is available!
            </p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[#53647f] dark:text-slate-300">
              {notes}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[12px] border border-[#e4edf7] bg-[#f6f9fc] p-3 dark:border-slate-700 dark:bg-slate-800/80">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7585a2]">Current version</p>
              <p className="mt-0.5 text-[15px] font-extrabold text-[#1e3261] dark:text-white">{currentLabel}</p>
              <p className="truncate text-[10px] font-semibold text-[#94a3b8]">build {state.current.buildId}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#7585a2]">Latest version</p>
              <p className="mt-0.5 text-[15px] font-extrabold text-[#0d9f4a]">{latestLabel}</p>
              <p className="truncate text-[10px] font-semibold text-[#94a3b8]">build {state.latest.buildId}</p>
            </div>
          </div>

          {state.latest.requiresApkUpdate ? (
            <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              This release also needs a native Android APK update (wrapper/permissions).
              Use the in-app Android download after updating the website.
            </p>
          ) : (
            <p className="text-[12px] font-semibold text-[#53647f] dark:text-slate-400">
              Update CRM will load new website files. Saved CRM data and login are kept.
              APK reinstall is not required for this web-only update.
            </p>
          )}

          {unsavedWarn ? (
            <p className="rounded-[10px] border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-[12px] font-bold text-[#92400e]">
              Unsaved form changes detected (e.g. Site Survey). Save your work, or tap Update Now again to continue — entered text may be lost if not saved.
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onLater}
              disabled={busy}
              className="h-11 rounded-[10px] border border-[#d9e4f2] bg-white px-4 text-[14px] font-extrabold text-[#1e3261] transition hover:bg-[#f3f7fd] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              Later
            </button>
            <button
              type="button"
              onClick={onUpdate}
              disabled={busy}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#0d9f4a] px-5 text-[14px] font-extrabold text-white transition hover:bg-[#0b8a40] disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Updating…' : unsavedWarn ? 'Update Now anyway' : 'Update CRM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
