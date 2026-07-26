import {
  repositoryCatalogValidation,
  repositoryTechniqueCatalog,
} from "../src/lib/experiment-techniques/catalog";

const strict = process.argv.includes("--strict");
const result = repositoryCatalogValidation;

console.log(
  JSON.stringify(
    {
      valid: result.valid,
      strict,
      techniques: repositoryTechniqueCatalog.length,
      ...result.summary,
      errors: result.errors,
      warnings: result.warnings,
    },
    null,
    2,
  ),
);

if (!result.valid || (strict && result.warnings.length > 0)) {
  process.exitCode = 1;
}
