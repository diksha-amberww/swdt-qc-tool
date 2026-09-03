import { contextBridge, ipcRenderer } from 'electron';

export interface SeawideLoginProgress {
  step: string;
  detail?: string;
}

export interface SeawideLoginResult {
  success: boolean;
  message: string;
  finalUrl?: string;
  pageTitle?: string;
  welcomeText?: string;
  responseTimeMs: number;
  steps: string[];
  error?: string;
}

const electronAPI = {
  isElectron: true,
  readEnv: () => ipcRenderer.invoke('env:read'),
  writeEnv: (data: Record<string, string>) => ipcRenderer.invoke('env:write', data),
  openFileDialog: (filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:openFile', filters),
  saveFileDialog: (options: { defaultName: string; content: any; isBinary?: boolean }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  setNativeTheme: (theme: 'light' | 'dark') => ipcRenderer.invoke('theme:set', theme),
  testVendorLogin: (payload: { username: string; password: string; loginUrl?: string }) =>
    ipcRenderer.invoke('vendor:testLogin', payload) as Promise<SeawideLoginResult>,
  ensureVendorSession: (payload?: {
    username?: string;
    password?: string;
    loginUrl?: string;
    reuseSession?: boolean;
  }) => ipcRenderer.invoke('vendor:ensureSession', payload || {}) as Promise<SeawideLoginResult & { reused?: boolean }>,
  getVendorSessionStatus: () =>
    ipcRenderer.invoke('vendor:sessionStatus') as Promise<{
      authenticated: boolean;
      welcomeText?: string;
      url?: string;
      title?: string;
      reason?: string;
    }>,
  clearVendorSession: () => ipcRenderer.invoke('vendor:clearSession') as Promise<boolean>,
  scrapeVendorListing: (payload: { upc?: string; vendorModel?: string; asin?: string }) =>
    ipcRenderer.invoke('vendor:scrapeListing', payload),
  fetchAmazonListing: (payload: { asin: string }) => ipcRenderer.invoke('amazon:fetchListing', payload),
  testAmazonConnection: () => ipcRenderer.invoke('amazon:testConnection'),
  evaluateQcRow: (payload: {
    row: { asin: string; upc: string; vendorModel: string };
    settings: {
      priceVarianceThreshold: number;
      titleSimilarityThreshold: number;
      imageSimilarityThreshold: number;
      strictPackQuantity: boolean;
      specMatchThreshold?: number;
      descriptionMatchThreshold?: number;
    };
  }) => ipcRenderer.invoke('qc:evaluateRow', payload),
  onVendorLoginProgress: (callback: (progress: SeawideLoginProgress) => void) => {
    const listener = (_event: unknown, progress: SeawideLoginProgress) =>
      callback(progress);
    ipcRenderer.on('vendor:loginProgress', listener);
    return () => ipcRenderer.removeListener('vendor:loginProgress', listener);
  },
};
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
