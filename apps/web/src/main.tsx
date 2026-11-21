import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Off by default fallback MSW if requested via VITE_USE_MSW=true
if (import.meta.env.VITE_USE_MSW === 'true') {
  console.info('[Champions Club] MSW fixture fallback enabled via VITE_USE_MSW=true');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
