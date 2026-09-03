import { RawInputRow, QCRowResult } from '../types/qc';
import { useLogStore } from '../store/useLogStore';
import { useQCStore } from '../store/useQCStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCredStore } from '../store/useCredStore';
import { useCostStore } from '../store/useCostStore';
import { yieldToMain } from '../utils/yieldToMain';
import {
  ensureVendorSessionForRun,
  isVendorSessionCached,
} from './vendorSessionService';
import type { QcEvaluateResult } from '../../scraping/qc/evaluateRow';

function toQcRowResult(evaluated: QcEvaluateResult): QCRowResult {
  return {
    id: evaluated.id,
    vendorModel: evaluated.vendorModel,
    partSku: evaluated.partSku,
    asin: evaluated.asin,
    brand: evaluated.brand,
    line: evaluated.line,
    upc: evaluated.upc,
    vendorListing: evaluated.vendorListing,
    amazonListing: evaluated.amazonListing,
    vendorListingFull: evaluated.vendorListingFull,
    amazonListingFull: evaluated.amazonListingFull,
    comparisonPayload: evaluated.comparisonPayload,
    titleMatchPct: evaluated.titleMatchPct,
    priceVariancePct: evaluated.priceVariancePct,
    imageSimilarityPct: evaluated.imageSimilarityPct,
    packQtyMatch: evaluated.packQtyMatch,
    upcMatch: evaluated.upcMatch,
    modelMatch: evaluated.modelMatch,
    brandMatch: evaluated.brandMatch,
    specMatchPct: evaluated.specMatchPct,
    descriptionMatchPct: evaluated.descriptionMatchPct,
    titleSameProduct: evaluated.titleSameProduct,
    verdictSentence: evaluated.verdictSentence,
    status: evaluated.status,
    aiVerdictReason: evaluated.aiVerdictReason,
    aiTokensUsed: evaluated.aiTokensUsed,
    confidenceScore: evaluated.confidenceScore,
    timestamp: evaluated.timestamp,
    errors: evaluated.errors,
  };
}

export class QcEngine {
  private static isRunning = false;
  private static timerId: ReturnType<typeof setTimeout> | null = null;
  private static sessionEnsuring: Promise<boolean> | null = null;

  static async ensureBatchSession(): Promise<boolean> {
    if (isVendorSessionCached()) return true;
    if (this.sessionEnsuring) return this.sessionEnsuring;

    this.sessionEnsuring = (async () => {
      const logStore = useLogStore.getState();
      const reuseSession = useSettingsStore.getState().settings.reuseSession;
      logStore.addLog(
        'INFO',
        'LOGIN',
        reuseSession
          ? 'Checking Seawide session before batch run...'
          : 'Starting fresh Seawide login for batch run...',
      );

      const result = await ensureVendorSessionForRun((message) => {
        logStore.addLog('INFO', 'LOGIN', message);
      });

      if (result.success) {
        useCredStore.setState((state) => ({
          credentials: {
            ...state.credentials,
            vendor: {
              ...state.credentials.vendor,
              isConnected: true,
              lastTestedAt: new Date().toLocaleTimeString(),
            },
          },
        }));
        logStore.addLog(
          'SUCCESS',
          'LOGIN',
          result.reused
            ? `Reusing existing Seawide session. ${result.message}`
            : `Seawide login successful. ${result.message}`,
        );
        return true;
      }

      logStore.addLog('ERROR', 'LOGIN', result.message || 'Could not establish Seawide session for batch run.');
      return false;
    })();

    try {
      return await this.sessionEnsuring;
    } finally {
      this.sessionEnsuring = null;
    }
  }

  static async evaluateSingleSku(row: RawInputRow): Promise<QCRowResult> {
    const logStore = useLogStore.getState();
    const settings = useSettingsStore.getState().settings;
    const sku = row.vendorModel || row.partSku;

    if (!isVendorSessionCached()) {
      const sessionOk = await this.ensureBatchSession();
      if (!sessionOk) {
        throw new Error('Seawide vendor session is not available. Save credentials and ensure login succeeds.');
      }
    }

    const payload = {
      row: {
        asin: row.asin,
        upc: row.upc,
        vendorModel: row.vendorModel || row.partSku,
      },
      settings: {
        priceVarianceThreshold: settings.priceVarianceThreshold,
        titleSimilarityThreshold: settings.titleSimilarityThreshold,
        imageSimilarityThreshold: settings.imageSimilarityThreshold,
        strictPackQuantity: settings.strictPackQuantity,
      },
    };

    logStore.addLog('INFO', 'SCRAPER', `Scraping SeaWide listing for ${sku} (UPC ${row.upc})`, {
      sku,
      asin: row.asin,
    });

    let evaluated: QcEvaluateResult;
    if (window.electronAPI?.evaluateQcRow) {
      evaluated = await window.electronAPI.evaluateQcRow(payload);
    } else {
      const response = await fetch('/api/dev/qc-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success?: boolean;
        result?: QcEvaluateResult;
        message?: string;
        error?: string;
      };
      if (!response.ok || !body.success || !body.result) {
        throw new Error(
          body.message ||
            body.error ||
            `QC evaluate failed (HTTP ${response.status}). Run npm run dev so Vite can spawn the Electron QC worker.`,
        );
      }
      evaluated = body.result;
    }

    logStore.addLog('INFO', 'AMAZON_API', `Fetched Amazon catalog item ${row.asin}`, {
      sku,
      asin: row.asin,
    });

    const result = toQcRowResult(evaluated);
    if (result.aiTokensUsed.input || result.aiTokensUsed.output) {
      useCostStore.getState().recordSkuTokens(result.aiTokensUsed.input, result.aiTokensUsed.output);
    }
    const logType = result.status === 'PASSED' ? 'SUCCESS' : result.status === 'FAILED' ? 'ERROR' : 'WARNING';
    logStore.addLog(logType, 'QC_ENGINE', `Verdict for ${sku}: ${result.status} - ${result.aiVerdictReason}`, {
      sku,
      asin: row.asin,
      details: { upcMatch: result.upcMatch, titleMatch: result.titleMatchPct },
    });
    return result;
  }

  static startLiveProcessing(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    void (async () => {
      const sessionOk = await this.ensureBatchSession();
      if (!sessionOk) {
        const qcStore = useQCStore.getState();
        if (qcStore.executionState === 'RUNNING') qcStore.setExecutionState('PAUSED');
        this.isRunning = false;
        return;
      }
      this.tick();
    })();
  }

  private static tick(): void {
    void (async () => {
      const qcStore = useQCStore.getState();
      const settings = useSettingsStore.getState().settings;
      if (qcStore.executionState !== 'RUNNING') {
        this.isRunning = false;
        return;
      }

      const currentIndex = qcStore.results.length;
      if (currentIndex >= qcStore.queue.length) {
        qcStore.setExecutionState('COMPLETED');
        useQCStore.setState({ isAnalysisPending: false });
        useLogStore.getState().addLog('SUCCESS', 'SYSTEM', `QC Batch Completed! Processed ${qcStore.queue.length} SKUs.`);
        this.isRunning = false;
        return;
      }

      const itemToProcess = qcStore.queue[currentIndex];
      qcStore.setActiveSkuIndex(currentIndex);
      await yieldToMain();

      try {
        const result = await this.evaluateSingleSku(itemToProcess);
        qcStore.addResult(result);
        if (settings.autoPauseOnError && result.status === 'FAILED') {
          const recentFails = qcStore.results.slice(0, 5).filter((r) => r.status === 'FAILED').length;
          if (recentFails >= 3) {
            qcStore.pauseQC();
            useLogStore.getState().addLog('WARNING', 'SYSTEM', 'Auto-paused batch due to error spike threshold.');
            this.isRunning = false;
            return;
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        useLogStore
          .getState()
          .addLog('ERROR', 'ERROR', `Error processing ${itemToProcess.vendorModel || itemToProcess.partSku}: ${message}`);
      }

      if (qcStore.executionState === 'RUNNING') {
        const delay = Math.max(400, 1500 / settings.concurrencyWorkers);
        this.timerId = setTimeout(() => this.tick(), delay);
      } else {
        this.isRunning = false;
      }
    })();
  }

  static stopProcessing(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}

/** @deprecated use QcEngine */
export const MockQCEngine = QcEngine;
