export function scoreKnowledgeMutationRisk(input: {
  domain: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const beforeJson = JSON.stringify(input.beforeData ?? null);
  const afterJson = JSON.stringify(input.afterData ?? null);

  if (!input.afterData) return 1;
  if (beforeJson === afterJson) return 0.1;
  if (!input.beforeData) return input.domain === "REAGENT" ? 0.35 : 0.45;
  return 0.7;
}
