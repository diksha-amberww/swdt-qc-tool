import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/upload" replace />} />
          <Route path="upload" element={null} />
          <Route path="output" element={null} />
          <Route path="export" element={null} />
          <Route path="logs" element={null} />
          <Route path="sandbox" element={null} />
          <Route path="ai-costs" element={null} />
          <Route path="credentials" element={null} />
          <Route path="settings" element={null} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
