import { create } from 'zustand';
import { RawInputRow, ValidationSummary, QCRowResult, QCExecutionState, QCRunMetrics, QCStatus } from '../types/qc';
import { ValidatorService } from '../services/validatorService';

interface QCStoreState {
  rawInputText: string;
  uploadedFileName: string | null;
  validationSummary: ValidationSummary | null;
  isValidating: boolean;
  
  // Execution queue & results
  queue: RawInputRow[];
  results: QCRowResult[];
  activeSkuIndex: number;
  executionState: QCExecutionState;
  startTime: number | null;
  elapsedSeconds: number;
  
  // Sandbox item
  sandboxInputText: string;
  sandboxResult: QCRowResult | null;
  isSandboxRunning: boolean;
  sandboxTrace: string[];
  sandboxPushMessage: string | null;
  /** True during session ensure / pre-flight before RUNNING or sandbox flag flips */
  isAnalysisPending: boolean;

  // Selected result for detail drawer
  selectedResultId: string | null;

  // Incremental verdict counters (avoid scanning results on every render)
  statusCounts: { passed: number; failed: number; manualReview: number };
  
  // Actions
  setRawInputText: (text: string) => void;
  setUploadedFileName: (name: string | null) => void;
  setValidationSummary: (summary: ValidationSummary | null) => void;
  setIsValidating: (isValidating: boolean) => void;
  
  setQueue: (queue: RawInputRow[]) => void;
  addResult: (result: QCRowResult) => void;
  updateResult: (id: string, updates: Partial<QCRowResult>) => void;
  setExecutionState: (state: QCExecutionState) => void;
  setActiveSkuIndex: (idx: number) => void;
  setElapsedSeconds: (seconds: number) => void;
  tickElapsed: () => void;
  startQC: () => void;
  pauseQC: () => void;
  resumeQC: () => void;
  stopQC: () => void;
  resetQC: () => void;
  
  // Sandbox actions
  setSandboxInputText: (text: string) => void;
  setSandboxResult: (result: QCRowResult | null) => void;
  setIsSandboxRunning: (running: boolean) => void;
  setSandboxTrace: (lines: string[] | ((prev: string[]) => string[])) => void;
  setSandboxPushMessage: (message: string | null) => void;
  setAnalysisPending: (pending: boolean) => void;
  overrideSandboxStatus: (status: QCStatus) => void;
  pushSandboxToOutput: () => void;
  
  setSelectedResultId: (id: string | null) => void;
  
  // Computed helpers
  getMetrics: () => QCRunMetrics;
}

export const useQCStore = create<QCStoreState>((set, get) => ({
  rawInputText: ValidatorService.getInputTemplate(),
  uploadedFileName: null,
  validationSummary: null,
  isValidating: false,
  
  queue: [],
  results: [],
  activeSkuIndex: -1,
  executionState: 'IDLE',
  startTime: null,
  elapsedSeconds: 0,
  
  sandboxInputText: 'B0000AXN5U\t686226806970\tPRM80697',
  sandboxResult: null,
  isSandboxRunning: false,
  sandboxTrace: [],
  sandboxPushMessage: null,
  isAnalysisPending: false,
  
  selectedResultId: null,
  statusCounts: { passed: 0, failed: 0, manualReview: 0 },

  setRawInputText: (text) => set({ rawInputText: text }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setValidationSummary: (summary) => set({ validationSummary: summary }),
  setIsValidating: (isValidating) => set({ isValidating }),
  
  setQueue: (queue) => set({ queue }),
  addResult: (result) => set((state) => {
    const statusCounts = { ...state.statusCounts };
    if (result.status === 'PASSED') statusCounts.passed += 1;
    else if (result.status === 'FAILED') statusCounts.failed += 1;
    else statusCounts.manualReview += 1;
    return {
      results: [result, ...state.results],
      statusCounts,
    };
  }),
  updateResult: (id, updates) => set((state) => {
    const existing = state.results.find((item) => item.id === id);
    const nextCounts = { ...state.statusCounts };
    if (existing && updates.status && updates.status !== existing.status) {
      if (existing.status === 'PASSED') nextCounts.passed = Math.max(0, nextCounts.passed - 1);
      else if (existing.status === 'FAILED') nextCounts.failed = Math.max(0, nextCounts.failed - 1);
      else nextCounts.manualReview = Math.max(0, nextCounts.manualReview - 1);
      if (updates.status === 'PASSED') nextCounts.passed += 1;
      else if (updates.status === 'FAILED') nextCounts.failed += 1;
      else nextCounts.manualReview += 1;
    }
    return {
      results: state.results.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      sandboxResult: state.sandboxResult?.id === id ? { ...state.sandboxResult, ...updates } : state.sandboxResult,
      statusCounts: nextCounts,
    };
  }),
  
  setExecutionState: (executionState) => set({ executionState }),
  setActiveSkuIndex: (activeSkuIndex) => set({ activeSkuIndex }),
  setElapsedSeconds: (elapsedSeconds) => set({ elapsedSeconds }),
  tickElapsed: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  
  startQC: () => {
    const queue = get().validationSummary?.validRows || [];
    set({
      queue,
      results: [],
      activeSkuIndex: 0,
      executionState: 'RUNNING',
      startTime: Date.now(),
      elapsedSeconds: 0,
      statusCounts: { passed: 0, failed: 0, manualReview: 0 },
      isAnalysisPending: false,
    });
  },
  
  pauseQC: () => set({ executionState: 'PAUSED', isAnalysisPending: false }),
  resumeQC: () => set({ executionState: 'RUNNING', isAnalysisPending: false }),
  stopQC: () => set({ executionState: 'STOPPED', isAnalysisPending: false }),
  
  resetQC: () => set({
    queue: [],
    results: [],
    activeSkuIndex: -1,
    executionState: 'IDLE',
    startTime: null,
    elapsedSeconds: 0,
    statusCounts: { passed: 0, failed: 0, manualReview: 0 },
    isAnalysisPending: false,
  }),
  
  setSandboxInputText: (text) => set({ sandboxInputText: text }),
  setSandboxResult: (sandboxResult) => set({ sandboxResult }),
  setIsSandboxRunning: (isSandboxRunning) => set({ isSandboxRunning }),
  setSandboxTrace: (lines) =>
    set((state) => ({
      sandboxTrace: typeof lines === 'function' ? lines(state.sandboxTrace) : lines,
    })),
  setSandboxPushMessage: (sandboxPushMessage) => set({ sandboxPushMessage }),
  setAnalysisPending: (isAnalysisPending) => set({ isAnalysisPending }),
  
  overrideSandboxStatus: (status) => set((state) => {
    if (!state.sandboxResult) return state;
    return {
      sandboxResult: {
        ...state.sandboxResult,
        status,
        manualOverride: true,
        overrideNotes: `Manually verified as ${status} by operator.`,
      },
    };
  }),
  
  pushSandboxToOutput: () => {
    const current = get().sandboxResult;
    if (current) {
      const cloned = { ...current, id: 'sbx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6) };
      set((state) => {
        const statusCounts = { ...state.statusCounts };
        if (cloned.status === 'PASSED') statusCounts.passed += 1;
        else if (cloned.status === 'FAILED') statusCounts.failed += 1;
        else statusCounts.manualReview += 1;
        return { results: [cloned, ...state.results], statusCounts };
      });
    }
  },
  
  setSelectedResultId: (id) => set({ selectedResultId: id }),
  
  getMetrics: () => {
    const state = get();
    const total = state.queue.length || state.results.length || 0;
    const processed = state.results.length;
    const passed = state.statusCounts.passed;
    const failed = state.statusCounts.failed;
    const manualReview = state.statusCounts.manualReview;
    const elapsed = state.elapsedSeconds || 1;
    const speed = processed > 0 ? Number(((processed / elapsed) * 60).toFixed(1)) : 0;
    const remaining = Math.max(0, total - processed);
    const estSec = speed > 0 ? Math.round((remaining / speed) * 60) : 0;
    
    return {
      total,
      processed,
      passed,
      failed,
      manualReview,
      elapsedSeconds: state.elapsedSeconds,
      speedSkuPerMin: speed,
      estimatedSecondsRemaining: estSec,
    };
  },
}));
