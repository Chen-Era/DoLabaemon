import assert from "node:assert/strict";
import test from "node:test";

import { repositoryTechniqueCatalog } from "@/lib/experiment-techniques/catalog";
import {
  getIntegrativeBiologyDomain,
  integrativeBiologyDomains,
  summarizeIntegrativeBiologyDomains,
  techniqueIntegrativeDomainCodes,
} from "@/lib/experiment-techniques/integrative-domains";

test("integrative-biology domain map covers mainstream research fields with real techniques", () => {
  const catalogCodes = new Set(repositoryTechniqueCatalog.map((technique) => technique.code));
  const summaries = summarizeIntegrativeBiologyDomains(catalogCodes);

  assert.equal(integrativeBiologyDomains.length, 12);
  for (const domain of integrativeBiologyDomains) {
    assert.ok(domain.description.zh.length > 20, `${domain.code} needs a study-scope description`);
    assert.ok(domain.specializedReagents.zh.length > 20, `${domain.code} needs specialized reagent guidance`);
    assert.ok(domain.targetRequirements.zh.length > 20, `${domain.code} needs target guidance`);
    assert.ok(domain.techniqueCodes.length >= 2, `${domain.code} needs more than one representative method`);
    for (const techniqueCode of domain.techniqueCodes) {
      assert.ok(catalogCodes.has(techniqueCode), `${domain.code} references missing ${techniqueCode}`);
    }
  }
  assert.ok(summaries.every((domain) => domain.techniqueCount >= 2));
});

test("domain lookup and reverse technique membership preserve the extracellular-vesicle focus", () => {
  const extracellularVesicleDomain = getIntegrativeBiologyDomain("EXTRACELLULAR_VESICLES");
  assert.equal(extracellularVesicleDomain?.name.zh, "细胞外囊泡与细胞间通信");
  assert.ok(techniqueIntegrativeDomainCodes("WB").includes("EXTRACELLULAR_VESICLES"));
  assert.equal(getIntegrativeBiologyDomain("NOT_A_DOMAIN"), null);
});
