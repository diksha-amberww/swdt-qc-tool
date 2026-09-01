import { RawInputRow, QCRowResult, QCStatus, ListingDetails } from '../types/qc';
import { useLogStore } from '../store/useLogStore';
import { useCostStore } from '../store/useCostStore';
import { useQCStore } from '../store/useQCStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useCredStore } from '../store/useCredStore';
import { yieldToMain } from '../utils/yieldToMain';
import { placeholderImage } from '../utils/placeholderImage';
import {
  ensureVendorSessionForRun,
  isVendorSessionCached,
} from './vendorSessionService';

export class MockQCEngine {
  private static isRunning = false;
  private static timerId: ReturnType<typeof setTimeout> | null = null;
  private static sessionEnsuring: Promise<boolean> | null = null;

  /**
   * Ensure Seawide vendor session exists before batch/sandbox processing.
   * Reuses existing session when valid; logs in when not.
   */
  static async ensureBatchSession(): Promise<boolean> {
    if (isVendorSessionCached()) {
      return true;
    }

    if (this.sessionEnsuring) {
      return this.sessionEnsuring;
    }

    this.sessionEnsuring = (async () => {
      const logStore = useLogStore.getState();
      const reuseSession = useSettingsStore.getState().settings.reuseSession;

      logStore.addLog('INFO', 'LOGIN', reuseSession
        ? 'Checking Seawide session before batch run...'
        : 'Starting fresh Seawide login for batch run...');

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

  /**
   * Generates realistic simulated listing data for Seawide vendor and Amazon
   */
  static generateListingData(row: RawInputRow): {
    vendorListing: ListingDetails;
    amazonListing: ListingDetails;
    titleMatchPct: number;
    priceVariancePct: number;
    imageSimilarityPct: number;
    packQtyMatch: boolean;
    upcMatch: boolean;
    modelMatch: boolean;
    status: QCStatus;
    aiVerdictReason: string;
    aiTokensUsed: { input: number; output: number };
    confidenceScore: number;
  } {
    // Generate deterministic yet diverse data based on SKU hash
    const hash = row.partSku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mode = hash % 3; // 0 = PASS, 1 = FAIL, 2 = MANUAL REVIEW

    const basePrice = 24.5 + (hash % 180);
    const vendorPrice = Number(basePrice.toFixed(2));
    
    // Vendor Title
    const vendorTitle = `${row.brand} ${row.partSku.replace('SKU-SWD-', '')} High-Grade ${row.line} Component [UPC: ${row.upc}]`;
    
    let amazonTitle = vendorTitle;
    let amazonPrice = vendorPrice;
    let amazonPackQty = 1;
    let vendorPackQty = 1;
    let titleMatchPct = 95;
    let priceVariancePct = 2.4;
    let imageSimilarityPct = 94;
    let packQtyMatch = true;
    let upcMatch = true;
    let modelMatch = true;
    let status: QCStatus = 'PASSED';
    let aiVerdictReason = 'All primary attributes match: Title 95%, Price variance +2.4%, Exact UPC & Pack Qty 1 match.';
    const confidenceScore = 0.96;

    if (mode === 1) {
      // FAILED Case
      status = 'FAILED';
      amazonPrice = Number((vendorPrice * 1.45).toFixed(2));
      priceVariancePct = 45.0;
      titleMatchPct = 48;
      imageSimilarityPct = 52;
      packQtyMatch = false;
      amazonPackQty = 2;
      vendorPackQty = 1;
      amazonTitle = `${row.brand} Replacement Pack of 2 for Boating & Marine - Generic Variation`;
      aiVerdictReason = `Critical Mismatch: Amazon listing is a Pack of 2 ($${amazonPrice}) vs Vendor Pack of 1 ($${vendorPrice}). Price variance is +45.0% exceeding 15% threshold. Title similarity 48% below 70%.`;
    } else if (mode === 2) {
      // MANUAL REVIEW Case
      status = 'MANUAL REVIEW';
      amazonPrice = Number((vendorPrice * 1.14).toFixed(2));
      priceVariancePct = 14.0;
      titleMatchPct = 68;
      imageSimilarityPct = 71;
      amazonTitle = `${row.brand} ${row.line} Pro Series Assembly [Compatible with ${row.partSku}]`;
      aiVerdictReason = `Marginal variance: Title similarity 68% is slightly under 70% threshold. Model number phrasing varies in Amazon catalog. Human inspection recommended.`;
    }

    const imgUrl = placeholderImage(row.partSku, hash);

    const vendorListing: ListingDetails = {
      title: vendorTitle,
      price: vendorPrice,
      packQuantity: vendorPackQty,
      imageUrl: imgUrl,
      modelNumber: row.partSku,
      upc: row.upc,
      brand: row.brand,
      availability: 'In Stock (Warehouse East/West)',
      rating: 4.8,
      reviewsCount: 120 + (hash % 800),
    };

    const amazonListing: ListingDetails = {
      title: amazonTitle,
      price: amazonPrice,
      packQuantity: amazonPackQty,
      imageUrl: imgUrl,
      modelNumber: mode === 1 ? 'GEN-MISMATCH-99' : row.partSku,
      upc: mode === 1 ? '000000000000' : row.upc,
      brand: row.brand,
      availability: 'In Stock (Amazon Prime FBA)',
      rating: 4.5,
      reviewsCount: 340 + (hash % 1200),
    };

    const inputTokens = 850 + (hash % 300);
    const outputTokens = 180 + (hash % 90);

    return {
      vendorListing,
      amazonListing,
      titleMatchPct,
      priceVariancePct,
      imageSimilarityPct,
      packQtyMatch,
      upcMatch,
      modelMatch,
      status,
      aiVerdictReason,
      aiTokensUsed: { input: inputTokens, output: outputTokens },
      confidenceScore,
    };
  }

  /**
   * Evaluates a single SKU row (used by Sandbox and Live Worker)
   */
  static async evaluateSingleSku(row: RawInputRow): Promise<QCRowResult> {
    const logStore = useLogStore.getState();
    const costStore = useCostStore.getState();

    if (!isVendorSessionCached()) {
      const sessionOk = await this.ensureBatchSession();
      if (!sessionOk) {
        throw new Error('Seawide vendor session is not available. Save credentials and ensure login succeeds.');
      }
    }

    logStore.addLog('INFO', 'LOGIN', `Using active Seawide session for SKU: ${row.partSku}`, { sku: row.partSku });
    await new Promise((r) => setTimeout(r, 80));

    logStore.addLog('INFO', 'SCRAPER', `GET Seawide Portal listing for SKU: ${row.partSku} [Brand: ${row.brand}]`, { sku: row.partSku });
    await new Promise((r) => setTimeout(r, 180));

    logStore.addLog('INFO', 'AMAZON_API', `SP-API Listings/Items query for ASIN: ${row.asin}`, { asin: row.asin, sku: row.partSku });
    await new Promise((r) => setTimeout(r, 200));

    logStore.addLog('INFO', 'AI_CALL', `Invoking Claude Haiku 4.5 to analyze title, packaging & price consistency...`, { sku: row.partSku, asin: row.asin });
    await new Promise((r) => setTimeout(r, 250));

    const generated = this.generateListingData(row);

    // Record AI cost
    costStore.recordSkuTokens(generated.aiTokensUsed.input, generated.aiTokensUsed.output);

    const logType = generated.status === 'PASSED' ? 'SUCCESS' : generated.status === 'FAILED' ? 'ERROR' : 'WARNING';
    logStore.addLog(logType, 'QC_ENGINE', `Verdict for SKU ${row.partSku}: ${generated.status} - ${generated.aiVerdictReason}`, {
      sku: row.partSku,
      asin: row.asin,
      details: { titleMatch: generated.titleMatchPct, priceVariance: generated.priceVariancePct },
    });

    const result: QCRowResult = {
      id: `qc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      partSku: row.partSku,
      asin: row.asin,
      brand: row.brand,
      line: row.line,
      upc: row.upc,
      vendorListing: generated.vendorListing,
      amazonListing: generated.amazonListing,
      titleMatchPct: generated.titleMatchPct,
      priceVariancePct: generated.priceVariancePct,
      imageSimilarityPct: generated.imageSimilarityPct,
      packQtyMatch: generated.packQtyMatch,
      upcMatch: generated.upcMatch,
      modelMatch: generated.modelMatch,
      status: generated.status,
      aiVerdictReason: generated.aiVerdictReason,
      aiTokensUsed: generated.aiTokensUsed,
      confidenceScore: generated.confidenceScore,
      timestamp: new Date().toLocaleTimeString(),
    };

    return result;
  }

  /**
   * Starts background processing loop for queued items
   */
  static startLiveProcessing(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const run = async () => {
      const sessionOk = await this.ensureBatchSession();
      if (!sessionOk) {
        const qcStore = useQCStore.getState();
        if (qcStore.executionState === 'RUNNING') {
          qcStore.setExecutionState('PAUSED');
        }
        this.isRunning = false;
        return;
      }
      this.tick();
    };

    void run();
  }

  private static tick(): void {
    const tickAsync = async () => {
      const qcStore = useQCStore.getState();
      const settings = useSettingsStore.getState().settings;

      if (qcStore.executionState !== 'RUNNING') {
        this.isRunning = false;
        return;
      }

      const currentIndex = qcStore.results.length;
      if (currentIndex >= qcStore.queue.length) {
        qcStore.setExecutionState('COMPLETED');
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
        
        // Auto-pause if error spike detected and setting enabled
        if (settings.autoPauseOnError && result.status === 'FAILED') {
          const recentFails = qcStore.results.slice(0, 5).filter((r) => r.status === 'FAILED').length;
          if (recentFails >= 3) {
            qcStore.pauseQC();
            useLogStore.getState().addLog('WARNING', 'SYSTEM', `Auto-paused batch due to error spike threshold.`);
            this.isRunning = false;
            return;
          }
        }
      } catch (err: any) {
        useLogStore.getState().addLog('ERROR', 'ERROR', `Error processing SKU ${itemToProcess.partSku}: ${err?.message || 'Unknown error'}`);
      }

      // Schedule next tick based on concurrency simulation
      if (qcStore.executionState === 'RUNNING') {
        const delay = Math.max(400, 1500 / settings.concurrencyWorkers);
        this.timerId = setTimeout(() => this.tick(), delay);
      } else {
        this.isRunning = false;
      }
    };

    void tickAsync();
  }

  static stopProcessing(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
