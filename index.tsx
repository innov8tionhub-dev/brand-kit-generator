
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Prevent accidental logging of secrets
if ((import.meta as any) && (import.meta as any).env) {
  // Do not log any env values
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
