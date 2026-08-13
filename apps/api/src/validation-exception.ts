import { UnprocessableEntityException, ValidationError } from "@nestjs/common";

export function validationException(errors: ValidationError[]) {
  return new UnprocessableEntityException({
    code: "VALIDATION_ERROR",
    message: "Revise os campos obrigatórios.",
    fields: flattenValidationErrors(errors),
  });
}

export function flattenValidationErrors(
  errors: ValidationError[],
  prefix = "",
): Array<{ path: string; code: string }> {
  return errors.flatMap((error) => {
    const path = prefix ? `${prefix}.${error.property}` : error.property;
    const own = Object.keys(error.constraints ?? {}).map((code) => ({
      path,
      code: code.toUpperCase(),
    }));
    return [...own, ...flattenValidationErrors(error.children ?? [], path)];
  });
}
