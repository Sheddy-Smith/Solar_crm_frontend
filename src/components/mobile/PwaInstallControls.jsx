import { useMemo, useState } from 'react';
import { Download, MonitorSmartphone, Share, X } from 'lucide-react';
import { cx } from '../../lib/utils.js';
import { usePwaInstall } from '../../hooks/usePwaInstall.js';

// Signed TWA build of the live site. Unlike a Chrome-minted WebAPK it is a
// regular APK, so it survives phone-clone / backup-restore onto a new device.
export const ANDROID_APK_URL = '/downloads/malwa-solar.apk';

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isAndroidDevice() {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function downloadAndroidApp() {
  const link = document.createElement('a');
  link.href = ANDROID_APK_URL;
  link.download = 'malwa-solar.apk';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Shared install handler + optional iOS “Add to Home Screen” guide. */
export function usePwaInstallAction(notify) {
  const pwaInstall = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const ios = useMemo(() => isIosDevice(), []);
  const android = useMemo(() => isAndroidDevice(), []);

  const runInstall = async () => {
    if (pwaInstall.isStandalone) {
      notify?.('Already running from your home screen.', 'success');
      return;
    }
    if (android) {
      downloadAndroidApp();
      setGuideOpen(true);
      return;
    }
    if (pwaInstall.justInstalled) {
      notify?.("Already installed — open Malwa Solar from your home screen.");
      return;
    }
    if (pwaInstall.canPromptInstall) {
      const choice = await pwaInstall.promptInstall();
      if (choice.outcome === 'accepted') {
        notify?.('Malwa Solar CRM installed!', 'success');
      }
      return;
    }
    if (ios) {
      setGuideOpen(true);
      return;
    }
    if (pwaInstall.supportsNativePrompt) {
      notify?.(
        "Use your browser menu (⋮) → Install app / Add to Home screen. If you already installed it, open it from the home screen.",
      );
      return;
    }
    setGuideOpen(true);
  };

  return { pwaInstall, ios, android, guideOpen, setGuideOpen, runInstall };
}

function GuideStep({ n, children }) {
  return (
    <li className="flex gap-2">
      <span className="font-extrabold text-[#0d9f4a]">{n}.</span>
      <span>{children}</span>
    </li>
  );
}

export function PwaInstallGuide({ open, onClose, ios, android = false }) {
  if (!open) return null;
  if (android) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0b1a33]/55 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Install Android app">
        <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-[20px] border border-[#dce7f5] bg-white p-5 shadow-[0_24px_60px_rgba(15,39,92,0.28)] dark:border-slate-600 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-[#7585a2] transition hover:bg-[#f3f7fd] dark:hover:bg-slate-800"
            aria-label="Close guide"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#e8f8eb] text-[#0d9f4a]">
              <Download className="size-6" />
            </span>
            <div>
              <h2 className="font-display text-[17px] font-extrabold text-[#102446] dark:text-slate-100">Install Malwa Solar App</h2>
              <p className="text-[12px] font-semibold text-[#7585a2]">The Android app is downloading</p>
            </div>
          </div>
          <ol className="mt-4 space-y-3 text-[13px] font-semibold leading-6 text-[#33456b] dark:text-slate-300">
            <GuideStep n={1}>Open the downloaded <strong className="font-extrabold">malwa-solar.apk</strong> from the notification or Downloads.</GuideStep>
            <GuideStep n={2}>If asked, allow <strong className="font-extrabold">Install unknown apps</strong> for your browser, then go back.</GuideStep>
            <GuideStep n={3}>Tap <strong className="font-extrabold">Install</strong>, then open <strong className="font-extrabold">Malwa Solar</strong> and sign in.</GuideStep>
            <GuideStep n={4}>If you had an old Malwa Solar icon that does not open, uninstall that one.</GuideStep>
          </ol>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <a
              href={ANDROID_APK_URL}
              download="malwa-solar.apk"
              className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[#c7ebd4] text-[13px] font-extrabold text-[#0d9f4a]"
            >
              <Download className="size-4" />
              Download again
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 items-center justify-center rounded-[12px] bg-[#0d9f4a] text-[14px] font-extrabold text-white"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#0b1a33]/55 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Add to Home Screen">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[20px] border border-[#dce7f5] bg-white p-5 shadow-[0_24px_60px_rgba(15,39,92,0.28)] dark:border-slate-600 dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full text-[#7585a2] transition hover:bg-[#f3f7fd] dark:hover:bg-slate-800"
          aria-label="Close guide"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-3 pr-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#e8f8eb] text-[#0d9f4a]">
            <MonitorSmartphone className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-[#102446] dark:text-slate-100">Add to Home Screen</h2>
            <p className="text-[12px] font-semibold text-[#7585a2]">Install Malwa Solar like an Android app</p>
          </div>
        </div>
        <ol className="mt-4 space-y-3 text-[13px] font-semibold leading-6 text-[#33456b] dark:text-slate-300">
          {ios ? (
            <>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">1.</span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  Tap the Share button
                  <Share className="inline size-3.5 text-[#0b65e5]" />
                  in Safari.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">2.</span>
                Scroll and tap <strong className="font-extrabold">Add to Home Screen</strong>.
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">3.</span>
                Tap <strong className="font-extrabold">Add</strong> — the app icon appears on your home screen.
              </li>
            </>
          ) : (
            <>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">1.</span>
                Open the browser menu <strong className="font-extrabold">(⋮)</strong> at the top-right.
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">2.</span>
                Tap <strong className="font-extrabold">Install app</strong> or <strong className="font-extrabold">Add to Home screen</strong>.
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">3.</span>
                Confirm — Malwa Solar opens full-screen like an Android app.
              </li>
            </>
          )}
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-[12px] bg-[#0d9f4a] text-[14px] font-extrabold text-white"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function PwaInstallIconButton({ className = '', notify }) {
  const { pwaInstall, guideOpen, setGuideOpen, runInstall, ios, android } = usePwaInstallAction(notify);
  if (pwaInstall.isStandalone) return null;
  return (
    <>
      <button
        type="button"
        onClick={runInstall}
        className={cx(
          'relative inline-flex size-10 items-center justify-center rounded-full border border-[#dbe4f0] bg-white text-[#5a6d88] transition hover:border-[#0d9f4a]/40 hover:text-[#0d9f4a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
          className,
        )}
        aria-label={pwaInstall.justInstalled ? 'Already installed' : 'Add to Home Screen'}
        title={pwaInstall.justInstalled ? 'Already installed' : 'Add to Home Screen'}
      >
        <MonitorSmartphone className="size-[18px]" />
        {pwaInstall.canPromptInstall || android ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-[#0d9f4a]" />
        ) : null}
      </button>
      <PwaInstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} ios={ios} android={android} />
    </>
  );
}

export function PwaInstallBanner({ notify, className = '' }) {
  const { pwaInstall, guideOpen, setGuideOpen, runInstall, ios, android } = usePwaInstallAction(notify);
  if (pwaInstall.isStandalone || (pwaInstall.justInstalled && !android)) return null;
  return (
    <>
      <button
        type="button"
        onClick={runInstall}
        className={cx(
          'flex w-full items-center gap-3 rounded-[14px] border border-[#c7ebd4] bg-[#f3fbf6] px-3.5 py-3 text-left transition hover:bg-[#e8f8eb] md:hidden dark:border-emerald-900/50 dark:bg-emerald-950/40',
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0d9f4a] text-white">
          <MonitorSmartphone className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-extrabold text-[#0f3d24] dark:text-emerald-100">
            {android ? 'Get the Android App' : 'Add to Home Screen'}
          </span>
          <span className="block text-[11px] font-semibold text-[#3d7a56] dark:text-emerald-300/90">
            {android ? 'Full-screen app that keeps working after a phone change' : 'Install for full-screen Android app experience'}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#0d9f4a] px-3 py-1.5 text-[11px] font-extrabold text-white">
          {android ? 'Download' : pwaInstall.canPromptInstall ? 'Install' : 'How'}
        </span>
      </button>
      <PwaInstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} ios={ios} android={android} />
    </>
  );
}
