import type { PackagingComparison } from '../types/scrapeResult';
import type { PackagingProfile } from '../types/comparisonProfile';

export function comparePackaging(
  vendor: PackagingProfile,
  amazon: PackagingProfile,
): PackagingComparison {
  const notes: string[] = [];
  let unitQtyMatch: boolean | null = null;
  let caseQtyMatch: boolean | null = null;

  if (vendor.unitQuantity != null && amazon.unitQuantity != null) {
    unitQtyMatch = vendor.unitQuantity === amazon.unitQuantity;
    if (!unitQtyMatch) {
      notes.push(`Unit quantity ${vendor.unitQuantity} vs ${amazon.unitQuantity}`);
    }
  } else {
    notes.push('Unit quantity missing on one or both listings');
  }

  if (vendor.caseQuantity != null && amazon.caseQuantity != null) {
    caseQtyMatch = vendor.caseQuantity === amazon.caseQuantity;
    if (!caseQtyMatch) {
      notes.push(
        `Case quantity differs (contents per case/box): vendor ${vendor.caseQuantity} vs Amazon ${amazon.caseQuantity}`,
      );
    }
  } else if (vendor.caseQuantity != null) {
    notes.push(`Vendor case qty ${vendor.caseQuantity}; Amazon case qty not published`);
  } else if (amazon.caseQuantity != null) {
    notes.push(`Amazon case qty ${amazon.caseQuantity}; vendor case qty not published`);
  }

  if (vendor.unitSize && amazon.unitSize && vendor.unitSize.toLowerCase() !== amazon.unitSize.toLowerCase()) {
    notes.push(`Unit size ${vendor.unitSize} vs ${amazon.unitSize}`);
  }

  return {
    unitQtyMatch,
    caseQtyMatch,
    notes,
    vendorPackaging: vendor,
    amazonPackaging: amazon,
  };
}
