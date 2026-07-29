import assert from "node:assert/strict";
import test from "node:test";

// The route authenticates through the demo store in this isolated API test.
process.env.DEMO_MODE = "true";

const routePromise = import("@/app/api/experiment-techniques/route");

type TechniqueListResponse = {
  total: number;
  items: Array<{ code: string; phenotypeCodes: string[] }>;
  phenotypeDomains: Array<{
    code: string;
    category: string;
    techniqueCount: number;
    targetPanel: { mechanistic: string[]; readout: string[]; controls: string[] };
    reagentRequirements: Array<{ level: string; items: Array<{ zh: string }> }>;
  }>;
};

async function get(path: string) {
  const route = await routePromise;
  const response = await route.GET(new Request(`http://localhost${path}`));
  return { response, data: await response.json() as TechniqueListResponse & { code?: string } };
}

test("filters techniques by phenotype/pathway topics and exposes detailed requirements", async () => {
  const { response, data } = await get("/api/experiment-techniques?phenotype=EXOSOME");

  assert.equal(response.status, 200);
  assert.ok(data.total >= 3);
  assert.ok(data.items.some((item) => item.code === "WB"));
  assert.ok(data.items.every((item) => item.phenotypeCodes.includes("EXOSOME")));

  const tgfBeta = data.phenotypeDomains.find((domain) => domain.code === "TGF_BETA_SMAD_SIGNALING");
  assert.equal(tgfBeta?.category, "TISSUE_MICROENVIRONMENT");
  assert.ok(tgfBeta?.targetPanel.mechanistic.includes("TGFB1"));
  assert.ok(tgfBeta?.targetPanel.readout.includes("p-SMAD2/3"));
  assert.ok(tgfBeta?.targetPanel.controls.length);
  assert.ok(tgfBeta?.reagentRequirements.some((requirement) => requirement.level === "REQUIRED"));
  assert.ok(tgfBeta?.reagentRequirements.flatMap((requirement) => requirement.items).some((item) => item.zh.includes("TGF-β")));
  assert.equal(data.phenotypeDomains.some((domain) => domain.code === "INTERFERON_RESPONSE"), false);
});

test("accepts the former domain query key as an alias and rejects ambiguous or unknown topics", async () => {
  const legacy = await get("/api/experiment-techniques?domain=AUTOPHAGY");
  assert.equal(legacy.response.status, 200);
  assert.ok(legacy.data.items.every((item) => item.phenotypeCodes.includes("AUTOPHAGY")));

  const ambiguous = await get("/api/experiment-techniques?phenotype=AUTOPHAGY&domain=EXOSOME");
  assert.equal(ambiguous.response.status, 400);
  assert.equal(ambiguous.data.code, "AMBIGUOUS_PHENOTYPE_FILTER");

  const invalid = await get("/api/experiment-techniques?phenotype=UNKNOWN_TOPIC");
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.data.code, "INVALID_PHENOTYPE");
});
