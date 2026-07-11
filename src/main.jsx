import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { startKeepAlive } from './lib/keepAlive.js';
import './index.css';

// Backend keep-alive: silent 14-min ping so the Render backend never sleeps.
// Started once at app boot, entirely outside React — zero UI impact.
startKeepAlive();

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
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ color: '#1e3261', fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Something went wrong</h1>
            <p style={{ color: '#53647f', fontSize: 14, fontWeight: 600, lineHeight: 1.6, margin: '0 0 20px' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
