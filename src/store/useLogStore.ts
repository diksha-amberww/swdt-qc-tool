import { create } from 'zustand';
import { LogEntry, LogCategory, LogLevel } from '../types/log';

const MAX_LOGS = 800;

interface LogStoreState {
  logs: LogEntry[];
  errorCount: number;
  activeLevelFilter: LogLevel;
  activeCategoryFilter: 'ALL' | LogCategory;
  searchQuery: string;
  isStreamingPaused: boolean;
  
  // Actions
  addLog: (level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR', category: LogCategory, message: string, meta?: { sku?: string; asin?: string; details?: any }) => void;
  clearLogs: () => void;
  setActiveLevelFilter: (level: LogLevel) => void;
  setActiveCategoryFilter: (category: 'ALL' | LogCategory) => void;
  setSearchQuery: (query: string) => void;
  setIsStreamingPaused: (paused: boolean) => void;
}

export const useLogStore = create<LogStoreState>((set) => ({
  logs: [
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: "SWDT VENDOR QC TOOL initialized for Seawide Distribution.",
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      level: 'INFO',
      category: 'SYSTEM',
      message: 'Electron Desktop Wrapper and IPC channels ready.',
    },
  ],
  errorCount: 0,
  activeLevelFilter: 'ALL',
  activeCategoryFilter: 'ALL',
  searchQuery: '',
  isStreamingPaused: false,
  
  addLog: (level, category, message, meta) => set((state) => {
    if (state.isStreamingPaused) return state;
    const newEntry: LogEntry = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString(),
      level,
      category,
      sku: meta?.sku,
      asin: meta?.asin,
      message,
      details: meta?.details,
    };
    const dropped = state.logs.length >= MAX_LOGS ? state.logs[state.logs.length - 1] : null;
    let errorCount = state.errorCount;
    if (level === 'ERROR') errorCount += 1;
    if (dropped?.level === 'ERROR') errorCount = Math.max(0, errorCount - 1);
    const updated = state.logs.length >= MAX_LOGS
      ? [newEntry, ...state.logs.slice(0, MAX_LOGS - 1)]
      : [newEntry, ...state.logs];
    return { logs: updated, errorCount };
  }),
  
  clearLogs: () => set({ logs: [], errorCount: 0 }),
  setActiveLevelFilter: (activeLevelFilter) => set({ activeLevelFilter }),
  setActiveCategoryFilter: (activeCategoryFilter) => set({ activeCategoryFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setIsStreamingPaused: (isStreamingPaused) => set({ isStreamingPaused }),
}));
