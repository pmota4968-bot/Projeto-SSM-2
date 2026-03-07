
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// --- DIAGNOSTIC ERROR CATCHER ---
window.onerror = function (message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; border: 2px solid #ef4444; color: #b91c1c; font-family: sans-serif; border-radius: 8px;">
        <h1 style="margin-top: 0;">DIAGNOSTIC ERROR</h1>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
        <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow: auto;">${error?.stack || 'No stack trace available'}</pre>
      </div>
    `;
  }
  return false;
};

window.onunhandledrejection = function (event) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; background: #ffedd5; border: 2px solid #f97316; color: #9a3412; font-family: sans-serif; border-radius: 8px;">
        <h1 style="margin-top: 0;">UNHANDLED PROMISE REJECTION</h1>
        <p><strong>Reason:</strong> ${event.reason}</p>
      </div>
    `;
  }
};
// ---------------------------------

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e) {
  rootElement.innerHTML = `<div style="color: red; padding: 20px;">FAILED TO RENDER APP: ${e}</div>`;
}
