import assert from "node:assert/strict";
import { test } from "node:test";

import { toPlainLanguageTechniqueScope } from "@/lib/experiment-techniques/presentation";

test("toPlainLanguageTechniqueScope uses complete sentences without changing the scope", () => {
  assert.equal(
    toPlainLanguageTechniqueScope("用于血液学检测；抗凝剂须与下游分析相容。"),
    "这项实验可用于血液学检测。抗凝剂需要与下游分析相容。",
  );
  assert.equal(
    toPlainLanguageTechniqueScope("适用于血清抗体测定，不适用于凝血因子实验。"),
    "这项实验适合用于血清抗体测定，不适用于凝血因子实验。",
  );
  assert.equal(
    toPlainLanguageTechniqueScope("用于细胞培养；需控制细胞密度。"),
    "这项实验可用于细胞培养。还需要控制细胞密度。",
  );
});
