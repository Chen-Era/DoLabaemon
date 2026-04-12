import test from "node:test";
import assert from "node:assert/strict";
import { ruleCatalog } from "@/lib/rules/catalog";
import { selectApplicableRules } from "@/lib/rules/engine";

test("selectApplicableRules returns ELISA built-in rules", () => {
  const rules = selectApplicableRules(ruleCatalog, "ELISA");

  assert.ok(rules.length > 0);
  assert.ok(rules.some((rule) => rule.displayNameZh === "ELISA 需要检测抗体"));
});

test("selectApplicableRules keeps direction-specific WB rules", () => {
  const rules = selectApplicableRules(ruleCatalog, "WB", "EXOSOME");

  assert.ok(rules.some((rule) => rule.displayNameZh === "外泌体 WB 需要至少一个 tetraspanin 标志物"));
});
