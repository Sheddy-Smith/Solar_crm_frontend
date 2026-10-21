import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startKeepAlive } from './lib/keepAlive.js';
import { enableCrmTableColumnResize } from './lib/crmTableResize.js';
import { enableNativeEditShortcuts } from './lib/nativeEditShortcuts.js';
import { registerServiceWorker } from './lib/pwaInstall.js';
import { initI18n } from './i18n/index.js';
import './index.css';

// Backend keep-alive: silent 14-min ping so the Render backend never sleeps.
startKeepAlive();
enableCrmTableColumnResize();
enableNativeEditShortcuts();

// Register SW after first paint path — never block CRM boot on update monitor.
const swReady = registerServiceWorker();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f7fb', fontFamily: 'Arial, sans-serif', padding: '24px' }}>
          <div style={{ maxWidth: 520, textAlign: 'center' }}>
            <h1 style={{ color: '#1e3261', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Something went wrong</h1>
            <p style={{ color: '#53647f', fontSize: 14, fontWeight: 600, lineHeight: 1.6, margin: '0 0 20px' }}>
              {(this.state.error && this.state.error.message) || 'An unexpected error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ background: '#0d9f4a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function signalReady() {
  try {
    window.dispatchEvent(new Event('malwa-app-ready'));
  } catch {
    /* ignore */
  }
  try {
    if (typeof window.malwaHideSplash === 'function') window.malwaHideSplash();
  } catch {
    /* ignore */
  }
}

let reactRoot = null;
function renderApp(UpdatePopup) {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  const Popup = UpdatePopup || function NoUpdatePopup() { return null; };
  if (!reactRoot) reactRoot = ReactDOM.createRoot(rootEl);
  reactRoot.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
        <Popup />
      </ErrorBoundary>
    </React.StrictMode>,
  );
  signalReady();
}

function startUpdateSystem() {
  Promise.all([
    import('./lib/appUpdate.js'),
    import('./components/AppUpdatePopup.jsx'),
  ])
    .then(([updateMod, popupMod]) => {
      try {
        updateMod.startAppUpdateMonitor(() => swReady);
      } catch (e) {
        console.warn('[Malwa] update monitor failed', e);
      }
      // Remount with popup once available (non-blocking if this fails).
      try {
        renderApp(popupMod.default);
      } catch (e2) {
        console.warn('[Malwa] update popup mount failed', e2);
      }
    })
    .catch((e) => {
      console.warn('[Malwa] update modules failed', e);
    });
}

// Boot CRM first; update UI is secondary and must never leave users on splash.
initI18n()
  .catch(() => {})
  .finally(() => {
    try {
      renderApp(null);
      startUpdateSystem();
    } catch (e) {
      console.error('[Malwa] boot failed', e);
      signalReady();
      try {
        if (typeof window.malwaRecoverCaches === 'function') {
          window.setTimeout(() => window.malwaRecoverCaches(), 500);
        }
      } catch {
        /* ignore */
      }
    }
  });
