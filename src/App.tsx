import React, { lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })));
const OutputPage = lazy(() => import('./pages/OutputPage').then((m) => ({ default: m.OutputPage })));
const ExportPage = lazy(() => import('./pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const LogsPage = lazy(() => import('./pages/LogsPage').then((m) => ({ default: m.LogsPage })));
const SandboxPage = lazy(() => import('./pages/SandboxPage').then((m) => ({ default: m.SandboxPage })));
const AICostsPage = lazy(() => import('./pages/AICostsPage').then((m) => ({ default: m.AICostsPage })));
const CredentialsPage = lazy(() => import('./pages/CredentialsPage').then((m) => ({ default: m.CredentialsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="output" element={<OutputPage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="sandbox" element={<SandboxPage />} />
          <Route path="ai-costs" element={<AICostsPage />} />
          <Route path="credentials" element={<CredentialsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
