import React, { useEffect } from 'react';
import { Header } from './Header';
import { Navbar } from './Navbar';
import { StatusBar } from './StatusBar';
import { PersistentPages } from './PersistentPages';
import { useCredStore } from '../../store/useCredStore';
import { bootTheme, readStoredTheme } from '../../store/useThemeStore';

export const AppLayout: React.FC = () => {
  const loadCredentialsFromEnv = useCredStore((state) => state.loadCredentialsFromEnv);

  useEffect(() => {
    bootTheme();
    window.electronAPI?.setNativeTheme?.(readStoredTheme());
    loadCredentialsFromEnv();
  }, [loadCredentialsFromEnv]);

  useEffect(() => {
    // Never globally lock the shell — pages stay usable while work runs in the background.
    document.body.classList.remove('analyzing');
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-app text-fg">
      <Header />
      <Navbar />
      <main className="flex-1 min-h-0 overflow-hidden relative contain-paint">
        <PersistentPages />
      </main>
      <StatusBar />
    </div>
  );
};
