export class CalculationValidationError extends Error {
  constructor(
    message: string,
    readonly path?: string,
  ) {
    super(message);
    this.name = "CalculationValidationError";
  }
}
