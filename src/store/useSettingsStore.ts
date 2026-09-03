import { create } from 'zustand';
import { AppSettings } from '../types/settings';

interface SettingsStoreState {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetDefaults: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  priceVarianceThreshold: 15,
  titleSimilarityThreshold: 70,
  imageSimilarityThreshold: 50,
  reuseSession: true,
  headlessMode: true,
  strictPackQuantity: true,
  autoPauseOnError: false,
  concurrencyWorkers: 3,
  requestTimeoutSeconds: 30,
  aiAutoVerifyThreshold: 85,
};

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  settings: DEFAULT_SETTINGS,
  updateSettings: (updates) => set((state) => ({
    settings: { ...state.settings, ...updates },
  })),
  resetDefaults: () => set({ settings: DEFAULT_SETTINGS }),
}));
