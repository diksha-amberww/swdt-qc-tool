import fs from 'fs';
import path from 'path';
import { parseSeawideDetailHtml } from './seawideDetailParser';

const FIXTURES: { file: string; upc: string; vendorModel: string }[] = [
  { file: 'response.html', upc: '790444031103', vendorModel: 'KIT04F-CZ6U51-06' },
  { file: 'response-2.html', upc: '686226806970', vendorModel: 'PRM80697' },
  { file: 'response-3.html', upc: '', vendorModel: 'MST140D' },
];

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  const htmlDir = path.resolve(process.cwd(), 'HTML');
  for (const fixture of FIXTURES) {
    const html = fs.readFileSync(path.join(htmlDir, fixture.file), 'utf-8');
    const listing = parseSeawideDetailHtml(html, {
      asin: 'TESTASIN01',
      upc: fixture.upc,
      vendorModel: fixture.vendorModel,
    });

    assert(listing.title, `${fixture.file}: missing title`);
    assert(listing.brand, `${fixture.file}: missing brand`);
    assert(listing.modelNumber, `${fixture.file}: missing model`);
    assert(listing.raw.attributes.length > 0, `${fixture.file}: no attributes`);
    assert(listing.raw.longDescription, `${fixture.file}: missing description`);
    assert(listing.normalized.packaging.rawSignals, `${fixture.file}: packaging signals missing`);
    assert(listing.raw.config.pid, `${fixture.file}: missing pid`);

    if (fixture.file === 'response-2.html') {
      assert(listing.normalized.packaging.unitQuantity === 1, `${fixture.file}: pack size should be 1 (Single), got ${listing.normalized.packaging.unitQuantity}`);
      assert(listing.normalized.packaging.caseQuantity === 12, `${fixture.file}: case qty should be 12, got ${listing.normalized.packaging.caseQuantity}`);
      assert(listing.raw.images.length >= 1, `${fixture.file}: expected product images, got ${listing.raw.images.length}`);
      assert(/Gasket Sealer/i.test(listing.title), `${fixture.file}: title should use product description, got ${listing.title}`);
    }
    if (fixture.file === 'response.html') {
      assert(listing.normalized.packaging.unitQuantity === 1, `${fixture.file}: pack size should be 1 from description Single, got ${listing.normalized.packaging.unitQuantity}`);
      assert(listing.normalized.packaging.caseQuantity == null, `${fixture.file}: case qty should be empty, got ${listing.normalized.packaging.caseQuantity}`);
      assert(listing.raw.images.length >= 1, `${fixture.file}: expected product images`);
    }
    if (fixture.file === 'response-3.html') {
      assert(listing.normalized.packaging.unitQuantity === 1, `${fixture.file}: pack size should default to 1 when unpublished, got ${listing.normalized.packaging.unitQuantity}`);
      assert(listing.normalized.packaging.caseQuantity == null, `${fixture.file}: case qty should be empty, got ${listing.normalized.packaging.caseQuantity}`);
    }

    process.stdout.write(
      JSON.stringify(
        {
          fixture: fixture.file,
          title: listing.title,
          brand: listing.brand,
          modelNumber: listing.modelNumber,
          pid: listing.raw.config.pid,
          attributes: listing.raw.attributes.length,
          packaging: listing.normalized.packaging,
          upc: listing.upc,
        },
        null,
        2,
      ) + '\n',
    );
  }
  process.stderr.write('All SeaWide HTML fixtures parsed successfully.\n');
}

main();
