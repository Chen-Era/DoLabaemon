export type SafeJsonValue =
  | null
  | boolean
  | number
  | string
  | SafeJsonValue[]
  | { [key: string]: SafeJsonValue };

function normalizePrimitive(value: unknown): SafeJsonValue | undefined {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

export function toSafeJsonValue(value: unknown): SafeJsonValue {
  const primitive = normalizePrimitive(value);
  if (primitive !== undefined) return primitive;

  if (Array.isArray(value)) {
    return value.map((item) => toSafeJsonValue(item));
  }

  if (value && typeof value === "object") {
    const output: Record<string, SafeJsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      output[key] = toSafeJsonValue(item);
    }
    return output;
  }

  return null;
}
