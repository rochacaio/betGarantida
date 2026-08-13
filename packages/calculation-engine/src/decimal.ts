import Decimal from "decimal.js";
import { CalculationValidationError } from "./errors";
import { DecimalInput } from "./types";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 40 });

export function decimal(value: DecimalInput, path?: string): Decimal {
  try {
    const result = new Decimal(value);
    if (!result.isFinite()) throw new Error("not finite");
    return result;
  } catch {
    throw new CalculationValidationError("Valor decimal inválido.", path);
  }
}

export function roundMoney(value: DecimalInput): Decimal {
  return decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function roundFactor(value: DecimalInput): Decimal {
  return decimal(value).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

export { Decimal };
