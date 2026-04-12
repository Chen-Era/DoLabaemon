function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmptyValues(value: unknown): unknown {
  if (typeof value === "string") {
    return value.trim() === "" ? null : value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeEmptyValues).filter((item) => item !== null);
  }

  if (isPlainObject(value)) {
    const normalizedEntries = Object.entries(value).map(([key, item]) => [key, normalizeEmptyValues(item)] as const);
    const normalizedObject = Object.fromEntries(normalizedEntries);
    const hasMeaningfulValue = Object.values(normalizedObject).some((item) => item !== null);
    return hasMeaningfulValue ? normalizedObject : null;
  }

  return value;
}

export function normalizeLlmParsedPayload<T>(value: T): T {
  return normalizeEmptyValues(value) as T;
}
