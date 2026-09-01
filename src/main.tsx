import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootTheme } from './store/useThemeStore';
import { App } from './App';
import './index.css';

bootTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
