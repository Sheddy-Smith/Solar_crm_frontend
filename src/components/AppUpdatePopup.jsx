import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import {
  applyAppUpdate,
  dismissUpdateLater,
  subscribeAppUpdate,
} from '../lib/appUpdate.js';
import { hasUnsavedWork } from '../lib/unsavedWork.js';

/**
 * “New Version Available” dialog.
 * Avoids global `.fixed.inset-0.flex` mobile CSS (that stretched the card to a
 * blank full-screen white sheet inside the installed PWA).
 */
export default function AppUpdatePopup() {
  const [state, setState] = useState(() => ({
    popupOpen: false,
    current: { buildId: '', releaseVersion: '' },
    latest: null,
    hasUnsavedWork: false,
    alreadyOnLatest: false,
  }));
  const [busy, setBusy] = useState(false);
  const [unsavedWarn, setUnsavedWarn] = useState(false);

  useEffect(() => subscribeAppUpdate(setState), []);

  if (!state.popupOpen || !state.latest) return null;

  const currentLabel = state.current.releaseVersion || (state.running && state.running.releaseVersion) || '—';
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
    }
  };

  return (
    <div
      className="malwa-update-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="malwa-update-title"
    >
      <div className="malwa-update-card">
        <div className="malwa-update-card__hero">
          <p className="malwa-update-card__eyebrow">Malwa Solar CRM</p>
          <h2 id="malwa-update-title" className="malwa-update-card__title">
            Software Update
          </h2>
        </div>

        <button
          type="button"
          onClick={onLater}
          className="malwa-update-card__close"
          aria-label="Dismiss update"
        >
          <X className="size-4" />
        </button>

        <div className="malwa-update-card__body">
          <div>
            <p className="malwa-update-card__label">New version</p>
            <p className="malwa-update-card__headline">
              A new version of Malwa Solar CRM is available!
            </p>
            <p className="malwa-update-card__notes">{notes}</p>
          </div>

          <div className="malwa-update-card__versions">
            <div>
              <p className="malwa-update-card__vlabel">Current version</p>
              <p className="malwa-update-card__vnum">{currentLabel}</p>
              <p className="malwa-update-card__vbuild">build {state.current.buildId || '—'}</p>
            </div>
            <div>
              <p className="malwa-update-card__vlabel">Latest version</p>
              <p className="malwa-update-card__vnum malwa-update-card__vnum--new">{latestLabel}</p>
              <p className="malwa-update-card__vbuild">build {state.latest.buildId}</p>
            </div>
          </div>

          <p className="malwa-update-card__safe">
            Update CRM will load new website files. Saved CRM data and login are kept.
            APK reinstall is not required for this web-only update.
          </p>

          {unsavedWarn ? (
            <p className="malwa-update-card__warn">
              Unsaved form changes detected. Save your work, or tap Update again to continue.
            </p>
          ) : null}

          <div className="malwa-update-card__actions">
            <button type="button" onClick={onLater} disabled={busy} className="malwa-update-btn malwa-update-btn--ghost">
              Later
            </button>
            <button type="button" onClick={onUpdate} disabled={busy} className="malwa-update-btn malwa-update-btn--primary">
              <RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Updating…' : unsavedWarn ? 'Update anyway' : 'Update CRM'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
