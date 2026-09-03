import { applyElectronStealthSwitches } from './electronStealth';

applyElectronStealthSwitches();

import { app } from 'electron';
import fs from 'node:fs';
import { ensureVendorSession } from './seawideSession';
import { getVendorPartitionFetch } from './vendorFetch';
import { evaluateQcRow, type QcEvaluateResult, type QcEvaluateSettings } from '../scraping/qc/evaluateRow';
import { resolveAmazonCredentials } from '../scraping/amazon/amazonTokenProvider';
import { resolveClaudeCredentials } from '../scraping/ai/claudeCredentials';
import { readProjectEnv, resolveVendorCredentials } from '../shared/envUtils';

const raw = process.argv[2] || '{}';
let payload: {
  row?: { asin?: string; upc?: string; vendorModel?: string };
  settings?: Partial<QcEvaluateSettings>;
  username?: string;
  password?: string;
  loginUrl?: string;
  reuseSession?: boolean;
} = {};

try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

const row = payload.row || {};
const asin = (row.asin || '').trim();
const upc = (row.upc || '').trim();
const vendorModel = (row.vendorModel || '').trim();

/** Drop bulky embedded JSON from CLI stdout. Keep titleHtml and images for debugging. */
function slimResult(result: QcEvaluateResult): QcEvaluateResult {
  if (!result.comparisonPayload) return result;
  return {
    ...result,
    comparisonPayload: {
      ...result.comparisonPayload,
      vendor: {
        ...result.comparisonPayload.vendor,
        raw: {
          ...result.comparisonPayload.vendor.raw,
          embeddedJson: {},
        },
      },
    },
    vendorListingFull: result.vendorListingFull
      ? {
          ...result.vendorListingFull,
          raw: {
            ...result.vendorListingFull.raw,
            embeddedJson: {},
          },
        }
      : null,
  };
}

function writeJsonAndQuit(value: unknown): void {
  try {
    fs.writeSync(process.stdout.fd, `${JSON.stringify(value)}\n`);
  } catch (err) {
    process.stderr.write(`Failed to write QC CLI stdout: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  app.exit(0);
}

if (!asin || !vendorModel) {
  writeJsonAndQuit({
    success: false,
    message: 'QC evaluate requires row.asin and row.vendorModel',
    error: 'INVALID_PAYLOAD',
  });
} else {
  const env = readProjectEnv(process.cwd());
  const { username, password } = resolveVendorCredentials(
    payload.username || '',
    payload.password || '',
    process.cwd(),
  );

  app.whenReady().then(async () => {
    try {
      const sessionResult = await ensureVendorSession({
        username,
        password,
        loginUrl: payload.loginUrl || env.VENDOR_PORTAL_URL,
        reuseSession: payload.reuseSession !== false,
        onProgress: (progress) => {
          process.stderr.write(`${JSON.stringify({ type: 'progress', ...progress })}\n`);
        },
      });

      if (!sessionResult.success) {
        writeJsonAndQuit({
          success: false,
          message: sessionResult.message || 'Seawide session unavailable',
          error: sessionResult.error || 'SESSION_FAILED',
          session: sessionResult,
        });
        return;
      }

      const settings: QcEvaluateSettings = {
        priceVarianceThreshold: payload.settings?.priceVarianceThreshold ?? 15,
        titleSimilarityThreshold: payload.settings?.titleSimilarityThreshold ?? 70,
        imageSimilarityThreshold: payload.settings?.imageSimilarityThreshold ?? 50,
        strictPackQuantity: payload.settings?.strictPackQuantity ?? true,
        specMatchThreshold: payload.settings?.specMatchThreshold ?? 70,
        descriptionMatchThreshold: payload.settings?.descriptionMatchThreshold ?? 70,
      };

      const result = await evaluateQcRow(
        { asin, upc, vendorModel },
        {
          fetchImpl: getVendorPartitionFetch(),
          settings,
          amazonCreds: resolveAmazonCredentials(process.cwd()),
          claudeCreds: resolveClaudeCredentials(process.cwd()),
          appPath: process.cwd(),
        },
      );

      writeJsonAndQuit({ success: true, result: slimResult(result) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      writeJsonAndQuit({
        success: false,
        message: `QC evaluate crashed: ${message}`,
        error: message,
      });
    }
  });
}

app.on('window-all-closed', () => {
  // Headless CLI: do not auto-quit; writeJsonAndQuit calls app.exit().
});
