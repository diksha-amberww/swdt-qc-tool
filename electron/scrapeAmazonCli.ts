import { app } from 'electron';
import { fetchAmazonListing } from '../scraping/amazon/amazonSpApiEngine';
import { resolveAmazonCredentials } from '../scraping/amazon/amazonTokenProvider';

const asin = process.argv[2] || '';

if (!asin) {
  process.stderr.write('Usage: scrapeAmazonCli <ASIN>\n');
  app.quit();
} else {
  app.whenReady().then(async () => {
    try {
      const result = await fetchAmazonListing(asin, resolveAmazonCredentials(process.cwd()));
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

app.on('window-all-closed', () => app.quit());
