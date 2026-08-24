import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  BetLegResult,
  OperationStatus,
  OperationType,
  Prisma,
} from "@prisma/client";
import { OperationsService } from "../src/modules/operations/operations.service";
import { CreateOperationDto } from "../src/modules/operations/dto/operation-write.dto";
import {
  OperationAccountError,
  OperationCreditUnavailableError,
  OperationInsufficientBalanceError,
  OperationNotFoundError,
  OperationNotOpenError,
  OperationRecord,
  OperationsRepository,
  OperationStaleVersionError,
} from "../src/modules/operations/operations.types";

const account1 = "10000000-0000-4000-8000-000000000001";
const account2 = "10000000-0000-4000-8000-000000000002";
const creditId = "20000000-0000-4000-8000-000000000001";
const operationId = "30000000-0000-4000-8000-000000000001";
const userId = "40000000-0000-4000-8000-000000000001";
const idempotencyKey = "test-command-0001";

function dto(): CreateOperationDto {
  return {
    eventName: "Time A x Time B",
    legs: [
      { bookmakerAccountId: account1, stake: "100.00", odd: "2.43" },
      { bookmakerAccountId: account2, stake: "121.50", odd: "2.00" },
    ],
  };
}

function record() {
  const now = new Date("2026-08-13T12:00:00.000Z");
  return {
    id: operationId,
    userId,
    sequenceNumber: 1,
    type: OperationType.SUREBET,
    eventName: "Time A x Time B",
    notes: null,
    status: OperationStatus.OPEN,
    generatesBetCredit: false,
    realCashInvestment: new Prisma.Decimal("221.50"),
    promotionalStake: new Prisma.Decimal(0),
    protectedReturn: new Prisma.Decimal("243"),
    projectedProfit: new Prisma.Decimal("21.50"),
    projectedRoiPercent: new Prisma.Decimal("9.706546"),
    realizedReturn: null,
    realizedProfit: null,
    realizedRoiPercent: null,
    engineVersion: "1.0.0",
    calculationSnapshot: { engineVersion: "1.0.0" },
    version: 1,
    openedAt: now,
    settledAt: null,
    createdAt: now,
    updatedAt: now,
    legs: dto().legs.map((leg, position) => ({
      id: `${position + 1}0000000-0000-4000-8000-000000000001`,
      operationId,
      scenarioId: `${position + 1}0000000-0000-4000-8000-000000000001`,
      groupPosition: 0,
      bookmakerAccountId: leg.bookmakerAccountId,
      betCreditId: null,
      position,
      selectionName: null,
      betType: "BACK" as const,
      stake: new Prisma.Decimal(leg.stake),
      riskAmount: new Prisma.Decimal(leg.stake),
      odd: new Prisma.Decimal(leg.odd),
      commissionPercent: new Prisma.Decimal(0),
      cashbackPercent: new Prisma.Decimal(0),
      increasePercent: new Prisma.Decimal(0),
      usesBetCredit: false,
      usesFreeBetCredit: false,
      result: "PENDING" as const,
      profitFactor: new Prisma.Decimal(position ? 1 : "1.43"),
      effectiveOdd: new Prisma.Decimal(leg.odd),
      projectedPayout: new Prisma.Decimal(243),
      scenarioResult: new Prisma.Decimal("21.50"),
      createdAt: now,
      updatedAt: now,
    })),
    generatedCredit: null,
    consumedCredits: [],
  };
}

describe("OperationsService", () => {
  let repository: jest.Mocked<OperationsRepository>;
  let service: OperationsService;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      update: jest.fn(),
      updateLegNames: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      cancel: jest.fn(),
      settle: jest.fn(),
      recordEarlyWins: jest.fn(),
      grantGeneratedCredit: jest.fn(),
      correctGeneratedCredit: jest.fn(),
      expireGeneratedCredit: jest.fn(),
      deleteOperation: jest.fn(),
    };
    service = new OperationsService(repository);
  });

  it("calcula preview sem persistir", () => {
    const result = service.preview(dto());
    expect(result.snapshot).toMatchObject({
      realCashInvestment: "221.5",
      protectedReturn: "243",
      projectedProfit: "21.5",
      engineVersion: "1.2.0",
    });
    expect(repository.create.mock.calls).toHaveLength(0);
  });

  it("expõe o combinado somente na consumidora sem alterar lucros individuais", async () => {
    const qualification = {
      ...record(),
      id: "50000000-0000-4000-8000-000000000001",
      realizedProfit: new Prisma.Decimal("-5.00"),
    } as OperationRecord;
    const consumer = {
      ...record(),
      id: "60000000-0000-4000-8000-000000000001",
      realizedProfit: new Prisma.Decimal("12.00"),
      consumedCredits: [
        {
          sourceOperation: qualification,
        },
      ],
    } as unknown as OperationRecord;
    repository.list.mockResolvedValue({
      items: [qualification, consumer],
      nextCursor: null,
    });

    const result = await service.list(userId, { limit: 100 });

    expect(result.data[0]).toMatchObject({
      realizedProfit: "-5.00",
      combinedPromotionProfit: null,
    });
    expect(result.data[1]).toMatchObject({
      realizedProfit: "12.00",
      combinedPromotionProfit: "7.00",
    });
  });

  it("rebalanceia somente linhas explicitamente automáticas no preview", () => {
    const input = dto();
    input.legs[1].stake = "1";
    input.legs[1].manualStake = false;
    expect(service.preview(input).stakes).toEqual(["100.00", "121.50"]);
  });

  it("aceita linha automática sem stake e sem dados cadastrais no preview", () => {
    expect(
      service.preview({
        legs: [
          { stake: "100", odd: "2.43" },
          { odd: "2", manualStake: false },
        ],
      }).stakes,
    ).toEqual(["100.00", "121.50"]);
  });

  it("agrupa apostas físicas do mesmo cenário no preview", () => {
    const home = "50000000-0000-4000-8000-000000000001";
    const away = "50000000-0000-4000-8000-000000000002";
    const result = service.preview({
      legs: [
        { scenarioId: home, stake: "100", odd: "2.5", manualStake: true },
        { scenarioId: home, stake: "50", odd: "3", manualStake: true },
        { scenarioId: away, stake: "250", odd: "2", manualStake: true },
      ],
    });
    expect(result.snapshot).toMatchObject({
      realCashInvestment: "400",
      protectedReturn: "400",
      projectedProfit: "0",
    });
    expect(
      (
        result.snapshot as {
          legs: Array<{ scenarioResult: string }>;
        }
      ).legs.map((leg) => leg.scenarioResult),
    ).toEqual(["0", "0", "100"]);
  });

  it("mantém stakes finais informadas na criação e recalcula snapshot no servidor", async () => {
    repository.create.mockResolvedValue(record());
    await service.create(userId, dto(), idempotencyKey);
    const command = repository.create.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    if (!command) throw new Error("Comando de criação não capturado.");
    expect(command.realCashInvestment.toFixed(2)).toBe("221.50");
    expect(command.legs.map((leg) => leg.stake.toFixed(2))).toEqual([
      "100.00",
      "121.50",
    ]);
    expect(command.engineVersion).toBe("1.2.0");
    expect(command.calculationSnapshot).toMatchObject({
      roundingPolicy: "HALF_UP_2_DECIMALS_RECALCULATE",
    });
  });

  it("persiste Lay com valor informado e responsabilidade como risco real", async () => {
    repository.create.mockResolvedValue(record());
    const input = dto();
    input.legs = [
      { ...input.legs[0], stake: "100.00", odd: "2.00" },
      {
        ...input.legs[1],
        betType: "LAY",
        stake: "25.74",
        odd: "7.60",
        commissionPercent: "2.5",
      },
    ];
    await service.create(userId, input, idempotencyKey);
    const lay = repository.create.mock.calls[0]?.[0].legs[1];
    expect(lay?.betType).toBe("LAY");
    expect(lay?.stake.toFixed(2)).toBe("25.74");
    expect(lay?.riskAmount.toFixed(2)).toBe("169.88");
    expect(lay?.effectiveOdd.toFixed(3)).toBe("1.148");
  });

  it("persiste o nome opcional de cada linha", async () => {
    repository.create.mockResolvedValue(record());
    const input = dto();
    input.legs[0].selectionName = "Vitória Cruzeiro";
    await service.create(userId, input, idempotencyKey);
    expect(repository.create.mock.calls[0]?.[0].legs[0]?.selectionName).toBe(
      "Vitória Cruzeiro",
    );
    expect(repository.create.mock.calls[0]?.[0].legs[1]?.selectionName).toBe(
      undefined,
    );
  });

  it("atualiza somente os nomes das linhas de uma operação aberta", async () => {
    repository.updateLegNames.mockResolvedValue(record());
    const legs = record().legs.map((leg, index) => ({
      legId: leg.id,
      selectionName: index === 0 ? "Empate" : "Vitória Criciúma",
    }));
    await service.updateLegNames(
      userId,
      operationId,
      { version: 1, legs },
      idempotencyKey,
    );
    expect(repository.updateLegNames.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ userId, operationId, version: 1, legs }),
    );
  });

  it("não permite usar crédito de aposta em uma linha Lay", async () => {
    const input = dto();
    input.legs[0].betType = "LAY";
    input.legs[0].usesBetCredit = true;
    input.legs[0].usesFreeBetCredit = true;
    await expect(
      service.create(userId, input, idempotencyKey),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("exige valor positivo quando gera crédito", async () => {
    await expect(
      service.create(
        userId,
        { ...dto(), generatesBetCredit: true },
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("exige referência quando uma linha usa crédito", async () => {
    const input = dto();
    input.legs[0].usesBetCredit = true;
    await expect(
      service.create(userId, input, idempotencyKey),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("aceita crédito livre sem vínculo com uma surebet geradora", async () => {
    repository.create.mockResolvedValue(record());
    const input = dto();
    input.legs[0].usesBetCredit = true;
    input.legs[0].usesFreeBetCredit = true;
    input.legs[0].stake = "25.00";
    await service.create(userId, input, idempotencyKey);
    const command = repository.create.mock.calls[0]?.[0];
    expect(command?.legs[0]).toMatchObject({
      usesBetCredit: true,
      usesFreeBetCredit: true,
      betCreditId: undefined,
    });
  });

  it("rejeita o mesmo crédito em duas linhas", async () => {
    const input = dto();
    input.legs.forEach((leg) => {
      leg.usesBetCredit = true;
      leg.betCreditId = creditId;
    });
    await expect(
      service.create(userId, input, idempotencyKey),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("permite corrigir o crédito concedido enquanto aguarda uso", async () => {
    repository.correctGeneratedCredit.mockResolvedValue(record());
    await service.correctGeneratedCredit(
      userId,
      operationId,
      { version: 2, grantedCreditAmount: "25.00" },
      idempotencyKey,
    );
    const command = repository.correctGeneratedCredit.mock.calls[0]?.[0];
    expect(command).toBeDefined();
    if (!command) throw new Error("Comando de correção não capturado.");
    expect(command.userId).toBe(userId);
    expect(command.operationId).toBe(operationId);
    expect(command.version).toBe(2);
    expect(command.grantedCreditAmount.toFixed(2)).toBe("25.00");
  });

  it("libera o crédito antes da liquidação sem encerrar a operação", async () => {
    repository.grantGeneratedCredit.mockResolvedValue({
      ...record(),
      status: OperationStatus.OPEN,
      version: 2,
    });
    await service.grantGeneratedCredit(
      userId,
      operationId,
      { version: 1, grantedCreditAmount: "50.00" },
      idempotencyKey,
    );
    expect(repository.grantGeneratedCredit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId,
        operationId,
        version: 1,
        idempotencyKey,
      }),
    );
    expect(
      repository.grantGeneratedCredit.mock.calls[0]?.[0].grantedCreditAmount,
    ).toEqual(new Prisma.Decimal("50.00"));
  });

  it("finaliza a geradora quando o crédito disponível foi perdido", async () => {
    repository.expireGeneratedCredit.mockResolvedValue({
      ...record(),
      status: OperationStatus.SETTLED,
      version: 3,
    });
    await service.expireGeneratedCredit(userId, operationId, 2, idempotencyKey);
    expect(repository.expireGeneratedCredit.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId,
        operationId,
        version: 2,
        idempotencyKey,
      }),
    );
  });

  it.each([
    [new OperationNotFoundError(), NotFoundException],
    [new OperationNotOpenError(), ConflictException],
    [new OperationStaleVersionError(), ConflictException],
    [new OperationAccountError(), UnprocessableEntityException],
    [
      new OperationInsufficientBalanceError(account1),
      UnprocessableEntityException,
    ],
    [new OperationCreditUnavailableError(), ConflictException],
  ])(
    "traduz erros do repositório em erros HTTP estáveis",
    async (repositoryError, expected) => {
      repository.create.mockRejectedValue(repositoryError);
      await expect(
        service.create(userId, dto(), idempotencyKey),
      ).rejects.toBeInstanceOf(expected);
    },
  );

  it("não retorna detalhe inexistente ou de outro usuário", async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.get(userId, operationId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findById.mock.calls).toContainEqual([
      userId,
      operationId,
    ]);
  });

  it("repassa filtros e cursor sempre com o usuário autenticado", async () => {
    repository.list.mockResolvedValue({
      items: [record()],
      nextCursor: operationId,
    });
    const result = await service.list(userId, {
      status: OperationStatus.OPEN,
      bookmakerAccountId: account1,
      search: "Time",
      cursor: operationId,
      limit: 10,
    });
    expect(repository.list.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId,
        status: OperationStatus.OPEN,
        bookmakerAccountId: account1,
        limit: 10,
      }),
    );
    expect(result.pageInfo.hasNextPage).toBe(true);
  });

  it("envia versão e motivo no cancelamento", async () => {
    repository.cancel.mockResolvedValue({
      ...record(),
      status: OperationStatus.CANCELLED,
      version: 2,
    });
    await service.cancel(userId, operationId, 1, "duplicada", idempotencyKey);
    expect(repository.cancel.mock.calls).toContainEqual([
      expect.objectContaining({
        userId,
        operationId,
        version: 1,
        reason: "duplicada",
        idempotencyKey,
      }),
    ]);
  });

  it("exige chave idempotente nas mutações financeiras", async () => {
    await expect(service.create(userId, dto(), "")).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it("valida e encaminha a liquidação completa", async () => {
    const settled = {
      ...record(),
      status: OperationStatus.SETTLED,
      version: 2,
    };
    repository.settle.mockResolvedValue(settled);
    await service.settle(
      userId,
      operationId,
      {
        version: 1,
        legs: settled.legs.map((leg, index) => ({
          legId: leg.id,
          result: index === 0 ? BetLegResult.WON : BetLegResult.LOST,
        })),
      },
      idempotencyKey,
    );
    expect(repository.settle.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId,
        operationId,
        version: 1,
        idempotencyKey,
      }),
    );
  });

  it("registra green antecipado sem finalizar a operação", async () => {
    repository.recordEarlyWins.mockResolvedValue({
      ...record(),
      status: OperationStatus.OPEN,
      version: 2,
      legs: record().legs.map((leg, index) => ({
        ...leg,
        result: index === 0 ? BetLegResult.WON : BetLegResult.PENDING,
      })),
    });
    const legId = record().legs[0].id;
    const result = await service.recordEarlyWins(
      userId,
      operationId,
      { version: 1, legIds: [legId] },
      idempotencyKey,
    );
    expect(result.operation.status).toBe(OperationStatus.OPEN);
    expect(repository.recordEarlyWins.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        userId,
        operationId,
        version: 1,
        legIds: [legId],
      }),
    );
  });

  it("não aceita liquidação sem green", async () => {
    await expect(
      service.settle(
        userId,
        operationId,
        {
          version: 1,
          legs: record().legs.map((leg) => ({
            legId: leg.id,
            result: BetLegResult.LOST,
          })),
        },
        idempotencyKey,
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
