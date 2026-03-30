import React from 'react';
import ReactDOM from 'react-dom/client';

// Prevent ReferenceError: "module is not defined" in browser-run code
// Some legacy/third-party snippets reference a global `module` identifier.
// Create a best-effort global property to avoid runtime ReferenceError.
if (typeof window !== 'undefined' && typeof (window as any).module === 'undefined') {
  try {
    (window as any).module = { exports: {} };
  } catch (e) {
    // ignore - non-critical
  }
}

import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

const DEV_SW_RESET_VERSION = '2026-02-27-batch-fix';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Register Service Worker for offline functionality (Disabled due to MIME type issues in production)
if ('serviceWorker' in navigator) {
  // Always unregister any existing service workers to ensure clean state
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        if (registrations && registrations.length > 0) {
          for (const registration of registrations) {
            registration.unregister();
            console.log('SW unregistered successfully');
          }
        }
      }).catch(err => {
        console.warn('SW unregistration failed:', err);
      });
    } catch (e) {
      console.warn('SW cleanup error:', e);
    }
  });
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
