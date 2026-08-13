import { isValidCpf, normalizeCpf } from "../src/modules/auth/cpf";

describe("CPF utilities", () => {
  it("normalizes a formatted CPF", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
  });

  it.each(["52998224725", "11144477735"])('accepts valid CPF "%s"', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each(["11111111111", "52998224724", "123"])(
    'rejects invalid CPF "%s"',
    (cpf) => {
      expect(isValidCpf(cpf)).toBe(false);
    },
  );
});
