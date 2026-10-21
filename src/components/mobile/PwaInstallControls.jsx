import { useMemo, useState } from 'react';
import { CheckCircle2, Download, MonitorSmartphone, RefreshCw, Share, X } from 'lucide-react';
import { cx } from '../../lib/utils.js';
import { usePwaInstall } from '../../hooks/usePwaInstall.js';
import { probeUpdateForInstallButton } from '../../lib/appUpdate.js';
import {
  getInstallState,
  promptInstall,
  refreshInstalledRelatedApps,
  waitForInstallPrompt,
} from '../../lib/pwaInstall.js';
import { urlUnderAppBase } from '../../lib/appBase.js';

// Signed TWA build of the live site. Unlike a Chrome-minted WebAPK it is a
// regular APK, so it survives phone-clone / backup-restore onto a new device.
// Resolved from app root so /leads or /tele/* never download index.html by mistake.
export const ANDROID_APK_URL = 'downloads/malwa-solar.apk';

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
  link.href = urlUnderAppBase(ANDROID_APK_URL);
  link.setAttribute('download', 'malwa-solar.apk');
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function UpToDateDialog({ open, onClose, versionLabel, buildId }) {
  if (!open) return null;
  return (
    <div
      className="malwa-update-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="App up to date"
    >
      <div className="malwa-update-card">
        <div className="malwa-update-card__hero">
          <p className="malwa-update-card__eyebrow">Malwa Solar CRM</p>
          <h2 className="malwa-update-card__title">Up to date</h2>
        </div>
        <button type="button" onClick={onClose} className="malwa-update-card__close" aria-label="Close">
          <X className="size-4" />
        </button>
        <div className="malwa-update-card__body">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f8eb] text-[#0d9f4a]">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="malwa-update-card__headline" style={{ marginTop: 0 }}>
                Malwa Solar CRM is already installed and up to date.
              </p>
              <p className="malwa-update-card__notes">
                Version {versionLabel || '—'}
                {buildId ? ` · build ${buildId}` : ''}
              </p>
            </div>
          </div>
          <div className="malwa-update-card__actions">
            <button type="button" onClick={onClose} className="malwa-update-btn malwa-update-btn--primary">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Shared install / update / up-to-date handler for sidebar + icon + banner.
 *
 * - Not installed → native install prompt (or APK / how-to guide)
 * - Installed + newer version.json → Update CRM popup
 * - Installed + current → Up to date popup
 */
export function usePwaInstallAction(notify) {
  const pwaInstall = usePwaInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [upToDateOpen, setUpToDateOpen] = useState(false);
  const [upToDateMeta, setUpToDateMeta] = useState({ version: '', buildId: '' });
  const [busy, setBusy] = useState(false);
  const ios = useMemo(() => isIosDevice(), []);
  const android = useMemo(() => isAndroidDevice(), []);

  const runInstalledFlow = async () => {
    const result = await probeUpdateForInstallButton();
    if (result.status === 'update') {
      notify?.('New version available — update CRM.', 'success');
      return;
    }
    if (result.status === 'uptodate') {
      setUpToDateMeta({
        version: (result.latest && result.latest.releaseVersion) || (result.running && result.running.releaseVersion) || '',
        buildId: (result.latest && result.latest.buildId) || (result.running && result.running.buildId) || '',
      });
      setUpToDateOpen(true);
      return;
    }
    notify?.('Could not check for updates. Try again online.', 'error');
  };

  const runInstall = async () => {
    setBusy(true);
    try {
      // Fresh related-apps check — Chrome often has the PWA installed ("Open in app")
      // but beforeinstallprompt never fires, so we must not show the how-to guide.
      await refreshInstalledRelatedApps();
      let state = getInstallState();

      if (state.isInstalled || state.isStandalone || state.justInstalled) {
        await runInstalledFlow();
        return 'installed-check';
      }

      // Wait briefly — BIP can arrive after SW activation / first engagement.
      await waitForInstallPrompt(2500);
      state = getInstallState();

      if (state.canPromptInstall) {
        const choice = await promptInstall();
        if (choice.outcome === 'accepted') {
          notify?.('Malwa Solar CRM installed!', 'success');
          return 'installed';
        }
        if (choice.outcome === 'dismissed') return 'prompt-dismissed';
      }

      // Re-check: BIP missing on Chromium usually means already installed.
      await refreshInstalledRelatedApps();
      state = getInstallState();
      if (state.isInstalled || state.isStandalone || state.justInstalled) {
        await runInstalledFlow();
        return 'installed-check';
      }

      if (ios) {
        setGuideOpen(true);
        return 'guide';
      }

      if (android) {
        downloadAndroidApp();
        setGuideOpen(true);
        return 'guide';
      }

      // Last resort on desktop Chromium: toast only (no full how-to modal).
      // Native prompt is unavailable until Chrome re-offers installability.
      if (state.supportsNativePrompt) {
        notify?.(
          'Install icon address bar me dekho, ya menu (⋮) → Install Malwa Solar / Add to Home screen.',
        );
        return 'omnibox-hint';
      }

      setGuideOpen(true);
      return 'guide';
    } finally {
      setBusy(false);
    }
  };

  return {
    pwaInstall,
    ios,
    android,
    guideOpen,
    setGuideOpen,
    upToDateOpen,
    setUpToDateOpen,
    upToDateMeta,
    busy,
    runInstall,
  };
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
            <GuideStep n={4}>Android 8 phones: update <strong className="font-extrabold">Google Chrome</strong> from Play Store first. If an old Malwa Solar icon will not open, uninstall it, then install this APK again.</GuideStep>
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
            <p className="text-[12px] font-semibold text-[#7585a2]">Install Malwa Solar like an app</p>
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
                Click the <strong className="font-extrabold">Install</strong> icon in the address bar (monitor + arrow).
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">2.</span>
                Or open the browser menu <strong className="font-extrabold">(⋮)</strong> → <strong className="font-extrabold">Install Malwa Solar</strong> / Add to Home screen.
              </li>
              <li className="flex gap-2">
                <span className="font-extrabold text-[#0d9f4a]">3.</span>
                Confirm — Malwa Solar opens full-screen like an app.
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

function buttonLabel(pwaInstall, android, busy) {
  if (busy) return 'Checking…';
  if (android && !pwaInstall.isInstalled && !pwaInstall.isStandalone) return 'Download Android App';
  if (pwaInstall.isInstalled || pwaInstall.isStandalone || pwaInstall.justInstalled) return 'App status';
  return 'Add to Home Screen';
}

export function PwaInstallIconButton({ className = '', notify }) {
  const {
    pwaInstall, guideOpen, setGuideOpen, runInstall, ios, android,
    upToDateOpen, setUpToDateOpen, upToDateMeta, busy,
  } = usePwaInstallAction(notify);
  return (
    <>
      <button
        type="button"
        onClick={runInstall}
        disabled={busy}
        className={cx(
          'relative inline-flex size-10 items-center justify-center rounded-full border border-[#dbe4f0] bg-white text-[#5a6d88] transition hover:border-[#0d9f4a]/40 hover:text-[#0d9f4a] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
          className,
        )}
        aria-label={buttonLabel(pwaInstall, android, busy)}
        title={buttonLabel(pwaInstall, android, busy)}
      >
        {pwaInstall.isInstalled || pwaInstall.isStandalone ? (
          <RefreshCw className={cx('size-[18px]', busy && 'animate-spin')} />
        ) : (
          <MonitorSmartphone className="size-[18px]" />
        )}
        {pwaInstall.canPromptInstall || android ? (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-[#0d9f4a]" />
        ) : null}
      </button>
      <PwaInstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} ios={ios} android={android} />
      <UpToDateDialog
        open={upToDateOpen}
        onClose={() => setUpToDateOpen(false)}
        versionLabel={upToDateMeta.version}
        buildId={upToDateMeta.buildId}
      />
    </>
  );
}

export function PwaInstallBanner({ notify, className = '' }) {
  const {
    pwaInstall, guideOpen, setGuideOpen, runInstall, ios, android,
    upToDateOpen, setUpToDateOpen, upToDateMeta, busy,
  } = usePwaInstallAction(notify);
  return (
    <>
      <button
        type="button"
        onClick={runInstall}
        disabled={busy}
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
            {buttonLabel(pwaInstall, android, busy)}
          </span>
          <span className="block text-[11px] font-semibold text-[#3d7a56] dark:text-emerald-300/90">
            {pwaInstall.isInstalled || pwaInstall.isStandalone
              ? 'Check for CRM updates or confirm you are up to date'
              : android
                ? 'Full-screen app that keeps working after a phone change'
                : 'Install for full-screen app experience'}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-[#0d9f4a] px-3 py-1.5 text-[11px] font-extrabold text-white">
          {busy ? '…' : pwaInstall.isInstalled || pwaInstall.isStandalone ? 'Check' : android ? 'Download' : pwaInstall.canPromptInstall ? 'Install' : 'How'}
        </span>
      </button>
      <PwaInstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} ios={ios} android={android} />
      <UpToDateDialog
        open={upToDateOpen}
        onClose={() => setUpToDateOpen(false)}
        versionLabel={upToDateMeta.version}
        buildId={upToDateMeta.buildId}
      />
    </>
  );
}
