import React, { memo, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Upload,
  Layers,
  Download,
  Terminal,
  FlaskConical,
  Coins,
  KeyRound,
  Settings,
} from 'lucide-react';
import { useQCStore } from '../../store/useQCStore';
import { useLogStore } from '../../store/useLogStore';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string | null;
  badgeColor?: string;
}

export const Navbar: React.FC = memo(() => {
  const resultsCount = useQCStore((state) => state.results.length);
  const queueCount = useQCStore((state) => state.queue.length);
  const logsCount = useLogStore((state) => state.logs.length);
  const errorLogsCount = useLogStore((state) => state.errorCount);

  const navItems: NavItem[] = useMemo(
    () => [
      {
        to: '/upload',
        label: 'UPLOAD',
        icon: Upload,
        badge: queueCount > 0 ? queueCount : null,
        badgeColor: 'bg-blue-100 text-blue-800',
      },
      {
        to: '/output',
        label: 'OUTPUT',
        icon: Layers,
        badge: resultsCount > 0 ? resultsCount : null,
        badgeColor: 'bg-emerald-100 text-emerald-800',
      },
      {
        to: '/export',
        label: 'EXPORT',
        icon: Download,
      },
      {
        to: '/logs',
        label: 'LOGS',
        icon: Terminal,
        badge: errorLogsCount > 0 ? `${errorLogsCount} err` : logsCount > 0 ? logsCount : null,
        badgeColor: errorLogsCount > 0 ? 'bg-red-100 text-red-700 font-bold' : 'bg-slate-100 text-slate-700',
      },
      {
        to: '/sandbox',
        label: 'SANDBOX',
        icon: FlaskConical,
      },
      {
        to: '/ai-costs',
        label: 'AI COSTS',
        icon: Coins,
      },
      {
        to: '/credentials',
        label: 'CREDENTIALS',
        icon: KeyRound,
      },
      {
        to: '/settings',
        label: 'SETTINGS',
        icon: Settings,
      },
    ],
    [queueCount, resultsCount, errorLogsCount, logsCount]
  );

  return (
    <nav className="h-12 bg-header border-b border-line px-6 flex items-center space-x-1 shrink-0 overflow-x-auto select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-fg-secondary hover:text-fg hover:bg-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-fg-muted'}`} />
                <span className="tracking-wider">{item.label}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`ml-1 text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
});

Navbar.displayName = 'Navbar';
