import { validateContentData } from "./content-renderers.mjs";

const report = validateContentData();

console.log(`Verified package keys: ${report.packageKeys.join(", ")}.`);
console.log(
  `Verified ${report.materialCount} materials (${report.freeCount} free, ${report.premiumCount} premium, ${report.featuredCount} featured).`,
);
console.log(
  `Filter counts: grammar=${report.filterResults.grammar}, B2 including All=${report.filterResults.b2IncludingAll}, PDF=${report.filterResults.pdf}, free=${report.filterResults.free}, combined=${report.filterResults.combined}.`,
);
