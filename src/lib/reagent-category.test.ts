import assert from "node:assert/strict";
import test from "node:test";
import { reagentCategoryLabel } from "./reagent-category";

test("reagentCategoryLabel presents stored categories in Chinese", () => {
  assert.equal(reagentCategoryLabel("ANTIBODY"), "抗体");
  assert.equal(reagentCategoryLabel("BUFFER"), "缓冲液");
  assert.equal(reagentCategoryLabel("BIOLOGICAL"), "生物制剂");
});

test("reagentCategoryLabel keeps unknown categories and handles empty values", () => {
  assert.equal(reagentCategoryLabel("CUSTOM"), "CUSTOM");
  assert.equal(reagentCategoryLabel(null), "未分类");
});
