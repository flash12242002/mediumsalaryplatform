import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global fetch interceptor to bypass Ngrok browser warning for all API calls
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  init = init || {};
  const headers = new Headers(init.headers);
  headers.set('ngrok-skip-browser-warning', 'true');
  init.headers = headers;
  return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
