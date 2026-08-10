import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// A tab left open during a deployment may still reference lazy chunks from the
// previous build. Vite emits this event before the rejected import reaches the
// error boundary, so refresh once and load the current asset manifest.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const reloadKey = 'hubvault-chunk-recovery';
  const lastRecovery = Number(sessionStorage.getItem(reloadKey) || 0);
  if (Date.now() - lastRecovery < 30_000) return;
  sessionStorage.setItem(reloadKey, String(Date.now()));
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="HubVault could not load">
      <App />
    </ErrorBoundary>
  </StrictMode>
);
