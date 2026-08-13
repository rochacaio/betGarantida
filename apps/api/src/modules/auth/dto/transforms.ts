import { TransformFnParams } from "class-transformer";

export function trimString({ value: rawValue }: TransformFnParams): unknown {
  const value: unknown = rawValue;
  return typeof value === "string" ? value.trim() : value;
}
