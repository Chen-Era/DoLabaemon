import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVendor, resolveNormalizedVendor } from "@/lib/vendor-normalization";

test("normalizeVendor unifies Chinese, English and mixed Procell aliases", () => {
  assert.equal(normalizeVendor("普诺赛procell"), "普诺赛 Procell");
  assert.equal(normalizeVendor("Procell/普诺赛"), "普诺赛 Procell");
  assert.equal(normalizeVendor("  PROCELL  "), "普诺赛 Procell");
});

test("normalizeVendor covers common abbreviated and Chinese supplier names", () => {
    assert.equal(normalizeVendor("雅酶"), "雅酶 Epizyme");
    assert.equal(normalizeVendor("翌圣生物"), "翌圣生物 Yeasen");
  assert.equal(normalizeVendor("CST"), "Cell Signaling Technology");
  assert.equal(normalizeVendor("MCE"), "MedChemExpress");
  assert.equal(normalizeVendor("Leagene/雷根"), "雷根 Leagene");
});

test("resolveNormalizedVendor prefers an explicit supplier column over a model guess", () => {
  assert.equal(
    resolveNormalizedVendor({ rawVendor: "普诺赛procell", detectedVendor: "Gibco" }),
    "普诺赛 Procell",
  );
  assert.equal(resolveNormalizedVendor({ detectedVendor: "CST" }), "Cell Signaling Technology");
});
