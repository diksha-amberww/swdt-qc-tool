import React, { Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const UploadPage = lazy(() => import('../../pages/UploadPage').then((m) => ({ default: m.UploadPage })));
const OutputPage = lazy(() => import('../../pages/OutputPage').then((m) => ({ default: m.OutputPage })));
const ExportPage = lazy(() => import('../../pages/ExportPage').then((m) => ({ default: m.ExportPage })));
const LogsPage = lazy(() => import('../../pages/LogsPage').then((m) => ({ default: m.LogsPage })));
const SandboxPage = lazy(() => import('../../pages/SandboxPage').then((m) => ({ default: m.SandboxPage })));
const AICostsPage = lazy(() => import('../../pages/AICostsPage').then((m) => ({ default: m.AICostsPage })));
const CredentialsPage = lazy(() =>
  import('../../pages/CredentialsPage').then((m) => ({ default: m.CredentialsPage })),
);
const SettingsPage = lazy(() => import('../../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const PAGE_ENTRIES: { path: string; Component: React.LazyExoticComponent<React.FC> }[] = [
  { path: '/upload', Component: UploadPage },
  { path: '/output', Component: OutputPage },
  { path: '/export', Component: ExportPage },
  { path: '/logs', Component: LogsPage },
  { path: '/sandbox', Component: SandboxPage },
  { path: '/ai-costs', Component: AICostsPage },
  { path: '/credentials', Component: CredentialsPage },
  { path: '/settings', Component: SettingsPage },
];

/**
 * Keeps each visited page mounted (hidden when inactive) so in-flight work,
 * local UI state, and live logs survive route changes.
 */
export const PersistentPages: React.FC = () => {
  const { pathname } = useLocation();
  const activePath = PAGE_ENTRIES.some((p) => p.path === pathname) ? pathname : '/upload';
  const [visited, setVisited] = React.useState<string[]>(() => [activePath]);

  useEffect(() => {
    setVisited((prev) => (prev.includes(activePath) ? prev : [...prev, activePath]));
  }, [activePath]);

  const mountedPaths = visited.includes(activePath) ? visited : [...visited, activePath];

  return (
    <>
      {PAGE_ENTRIES.map(({ path, Component }) => {
        if (!mountedPaths.includes(path)) return null;
        const isActive = path === activePath;
        return (
          <div
            key={path}
            className="h-full w-full"
            style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column' }}
            aria-hidden={!isActive}
            data-persistent-page={path}
          >
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center text-xs text-fg-muted bg-app">
                  Loading section…
                </div>
              }
            >
              <Component />
            </Suspense>
          </div>
        );
      })}
    </>
  );
};
