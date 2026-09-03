import { app } from 'electron';
import { ensureVendorSession } from './seawideSession';
import { getVendorPartitionFetch } from './vendorFetch';
import { scrapeVendorListing } from '../scraping/vendor/seawideVendorEngine';
import { readProjectEnv, resolveVendorCredentials } from '../shared/envUtils';

const vendorModel = process.argv[2] || '';
const upc = process.argv[3] || '';
const asin = process.argv[4] || 'TESTASIN01';

if (!vendorModel && !upc) {
  process.stderr.write('Usage: scrapeVendorCli <VENDOR_MODEL> [UPC] [ASIN]\n');
  app.quit();
} else {
  app.whenReady().then(async () => {
    try {
      const env = readProjectEnv(process.cwd());
      const { username, password } = resolveVendorCredentials('', '', process.cwd());
      const sessionResult = await ensureVendorSession({
        username,
        password,
        loginUrl: env.VENDOR_PORTAL_URL,
        reuseSession: true,
        onProgress: (p) => process.stderr.write(`${p.step}${p.detail ? ` — ${p.detail}` : ''}\n`),
      });
      if (!sessionResult.success) {
        process.stdout.write(JSON.stringify(sessionResult, null, 2));
        return;
      }
      const result = await scrapeVendorListing(
        { asin, upc, vendorModel },
        { fetchImpl: getVendorPartitionFetch() },
      );
      process.stdout.write(JSON.stringify(result, null, 2));
    } catch (err) {
      process.stdout.write(
        JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      );
    } finally {
      app.quit();
    }
  });
}

app.on('window-all-closed', () => {
  // Headless CLI: do not auto-quit; app.quit() runs in finally after scrape completes.
});
