/**
 * Fiscal convention: monetary values in the Drenyra ecosystem are BigInt cents;
 * no float is ever used for money in drenyra-ai; no monetary amount is ever a
 * JavaScript Number; sequence/index/version fields are JSON integers, never floats.
 */
/**
 * Compatibility re-export (SDD-020 slice C, D6): the package-root/metadata
 * primitive moved to `configurator/package-metadata.ts` so the library layer
 * can use it without a reverse import into `cmd/`. Existing command and test
 * imports of `getPackageRoot()`/`getPackageMetadata()`/`PackageMetadata`
 * remain source-compatible.
 */
export * from "../../configurator/package-metadata.js";
