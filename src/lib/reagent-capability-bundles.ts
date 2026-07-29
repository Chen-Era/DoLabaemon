import type { ExperimentTag } from "@/lib/rules/catalog";

// A named ELISA kit normally supplies the complete, mutually compatible assay
// workflow (often through a pre-coated plate rather than separate bottles).
// Do not infer this for a kit explicitly sold as one component or a
// development/uncoated format.
const completeElisaKitPattern =
  /\b(?:sandwich\s+)?elisa(?:\s+(?:assay|test))?\s+kit\b|(?:夹心)?(?:elisa|酶联免疫(?:吸附)?(?:测定|检测)?)\s*(?:检测试剂)?盒/i;
const elisaComponentOrDevelopmentPattern =
  /\b(?:uncoated|development|capture|detection|standard|calibrator|substrate|wash|blocking|buffer|plate|antibody\s*pair|accessory|component)\b|(?:未包被|开发|捕获抗体|检测抗体|标准品|校准品|底物|洗涤|封闭|缓冲液|包被板|抗体对|配件|组分)/i;

const completeElisaKitCapabilities: ExperimentTag[] = [
  "ELISA_COMPLETE_KIT",
  "ELISA_COATING_REAGENT",
  "ELISA_BLOCKING_REAGENT",
  "ELISA_WASH_BUFFER",
  "ELISA_CAPTURE_ANTIBODY",
  "ELISA_DETECTION_ANTIBODY",
  "ELISA_STANDARD",
  "ELISA_SUBSTRATE",
  "BLOCKING_REAGENT",
];

export function isCompleteElisaKit(name: string) {
  return (
    completeElisaKitPattern.test(name) &&
    !elisaComponentOrDevelopmentPattern.test(name)
  );
}

/**
 * Expands an explicitly complete ELISA kit into the assay capabilities it
 * supplies. This is evaluated at read time as well, so existing inventory
 * records gain the corrected behaviour without requiring a database rewrite.
 */
export function supplementReagentCapabilityTags<T extends string>(
  name: string,
  experimentTags: readonly T[],
): Array<T | ExperimentTag> {
  const tags = new Set<T | ExperimentTag>(experimentTags);
  if (isCompleteElisaKit(name) || tags.has("ELISA_COMPLETE_KIT")) {
    for (const tag of completeElisaKitCapabilities) tags.add(tag);
  }
  return [...tags];
}
