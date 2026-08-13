import Decimal from "decimal.js";

export function serializeDecimals<T>(value: T): unknown {
  if (value instanceof Decimal) return value.toFixed();
  if (Array.isArray(value)) return value.map(serializeDecimals);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeDecimals(entry)]),
    );
  }
  return value;
}
