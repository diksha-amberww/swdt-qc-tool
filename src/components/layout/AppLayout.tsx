import React, { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Navbar } from './Navbar';
import { StatusBar } from './StatusBar';
import { useCredStore } from '../../store/useCredStore';
import { bootTheme, readStoredTheme } from '../../store/useThemeStore';

export const AppLayout: React.FC = () => {
  const loadCredentialsFromEnv = useCredStore((state) => state.loadCredentialsFromEnv);

  useEffect(() => {
    bootTheme();
    window.electronAPI?.setNativeTheme?.(readStoredTheme());
    loadCredentialsFromEnv();
  }, [loadCredentialsFromEnv]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-app text-fg">
      <Header />
      <Navbar />
      <main className="flex-1 min-h-0 overflow-hidden relative contain-paint">
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center text-xs text-fg-muted bg-app">
              Loading section…
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      <StatusBar />
    </div>
  );
};
