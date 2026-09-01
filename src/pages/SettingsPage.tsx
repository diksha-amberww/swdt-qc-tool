import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  CheckSquare,
  Zap,
  RotateCcw,
  Save,
  CheckCircle2,
  ShieldAlert,
  Palette,
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useLogStore } from '../store/useLogStore';
import { useThemeStore } from '../store/useThemeStore';
import { ThemeToggle } from '../components/ui/ThemeToggle';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetDefaults } = useSettingsStore();
  const addLog = useLogStore((state) => state.addLog);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const handleSave = () => {
    setSavedFeedback('Settings and operational thresholds saved successfully!');
    addLog('INFO', 'SYSTEM', 'Updated QC comparison thresholds and scraper settings.');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  const handleReset = () => {
    resetDefaults();
    setSavedFeedback('Settings restored to default configurations.');
    addLog('INFO', 'SYSTEM', 'Reset QC operational thresholds to factory defaults.');
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <span>Quality Control Thresholds & Engine Settings</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure matching tolerance parameters, scraper execution modes, concurrency levels, and error policies.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedFeedback && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg animate-in fade-in">
              {savedFeedback}
            </span>
          )}

          <button
            onClick={handleReset}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-6 pt-4 overflow-y-auto">
        {/* Appearance */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Appearance
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dark mode applies to every page, panel, input, table, and modal. Preference is saved locally.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  theme === 'light'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Dark
              </button>
              <ThemeToggle compact />
            </div>
          </div>
        </div>

        {/* Left Card: Custom Comparison Thresholds */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              1) Discrepancy & Similarity Thresholds
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            {/* Price Variance */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Max Allowed Price Variance (±%)</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  ±{settings.priceVarianceThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={settings.priceVarianceThreshold}
                onChange={(e) => updateSettings({ priceVarianceThreshold: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Differences above ±{settings.priceVarianceThreshold}% between Seawide dealer cost and Amazon retail will trigger FAILED or MANUAL REVIEW.
              </p>
            </div>

            {/* Title Similarity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Minimum Title Similarity (%)</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {settings.titleSimilarityThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={99}
                value={settings.titleSimilarityThreshold}
                onChange={(e) => updateSettings({ titleSimilarityThreshold: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Minimum semantic NLP match percentage required to automatically mark listing titles as PASSED.
              </p>
            </div>

            {/* Image Similarity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">Minimum Image Similarity Score (%)</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {settings.imageSimilarityThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={40}
                max={95}
                value={settings.imageSimilarityThreshold}
                onChange={(e) => updateSettings({ imageSimilarityThreshold: Number(e.target.value) })}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Visual feature hash comparison threshold between catalog photo and Amazon main listing image.
              </p>
            </div>

            {/* AI Auto-Verify */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-800">AI Confidence Auto-Approve Threshold (%)</span>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {settings.aiAutoVerifyThreshold}%
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={99}
                value={settings.aiAutoVerifyThreshold}
                onChange={(e) => updateSettings({ aiAutoVerifyThreshold: Number(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                Claude 3.5 confidence level above which a listing is certified without requiring manual human review.
              </p>
            </div>
          </div>
        </div>

        {/* Right Card: Behavioral Toggles & Concurrency */}
        <div className="space-y-5">
          {/* Behavior Checkboxes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                2) Scraper & System Behaviors
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-start space-x-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.reuseSession}
                  onChange={(e) => updateSettings({ reuseSession: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Reuse Vendor Portal Session Cookies</span>
                  <span className="text-[11px] text-slate-500">
                    Maintains authenticated cookies across requests to reduce Seawide login roundtrips.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.headlessMode}
                  onChange={(e) => updateSettings({ headlessMode: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Run Scraping in Headless Mode</span>
                  <span className="text-[11px] text-slate-500">
                    Executes automated browser scraping quietly in the background without launching visual windows.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.strictPackQuantity}
                  onChange={(e) => updateSettings({ strictPackQuantity: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Strict Pack Quantity Match</span>
                  <span className="text-[11px] text-slate-500">
                    Instantly flags as FAILED if Amazon pack count differs from Seawide catalog packaging.
                  </span>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.autoPauseOnError}
                  onChange={(e) => updateSettings({ autoPauseOnError: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="font-bold text-slate-800 block">Auto-Pause on Error Spike</span>
                  <span className="text-[11px] text-slate-500">
                    Automatically pauses live queue if 3 consecutive failures or API rejections occur.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Concurrency Workers Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                3) Concurrency & Network Performance
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">Parallel Worker Threads</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                    {settings.concurrencyWorkers} Workers
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={settings.concurrencyWorkers}
                  onChange={(e) => updateSettings({ concurrencyWorkers: Number(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700">Request Timeout:</span>
                <span className="font-mono font-semibold text-slate-800">{settings.requestTimeoutSeconds}s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
