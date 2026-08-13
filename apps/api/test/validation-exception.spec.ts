import { ValidationError } from "@nestjs/common";
import { flattenValidationErrors } from "../src/validation-exception";

describe("flattenValidationErrors", () => {
  it("preserva o caminho completo de campos dentro das pernas", () => {
    const errors: ValidationError[] = [
      {
        property: "legs",
        children: [
          {
            property: "1",
            children: [
              {
                property: "odd",
                constraints: { isString: "odd must be a string" },
              },
            ],
          },
        ],
      },
    ];
    expect(flattenValidationErrors(errors)).toEqual([
      { path: "legs.1.odd", code: "ISSTRING" },
    ]);
  });
});
