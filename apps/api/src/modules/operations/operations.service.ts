import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  balanceStakes,
  calculateOperationSnapshot,
  CalculationValidationError,
  OperationSnapshot,
  serializeDecimals,
} from "@betgarantida/calculation-engine";
import {
  CreateOperationDto,
  PreviewOperationDto,
  UpdateOperationDto,
} from "./dto/operation-write.dto";
import { OperationLegDto } from "./dto/operation-leg.dto";
import { ListOperationsDto } from "./dto/list-operations.dto";
import { SettleOperationDto } from "./dto/settle-operation.dto";
import { CorrectGeneratedCreditDto } from "./dto/correct-generated-credit.dto";
import { GrantGeneratedCreditDto } from "./dto/grant-generated-credit.dto";
import { RecordEarlyWinsDto } from "./dto/record-early-wins.dto";
import { UpdateLegNamesDto } from "./dto/update-leg-names.dto";
import {
  OPERATIONS_REPOSITORY,
  OperationAccountError,
  OperationCreditUnavailableError,
  OperationCreditReservedError,
  OperationCreditCorrectionUnavailableError,
  OperationCreditGrantUnavailableError,
  OperationCreditExpirationUnavailableError,
  OperationDeleteCreditInUseError,
  OperationInsufficientBalanceError,
  OperationIdempotencyConflictError,
  OperationInvalidSettlementError,
  OperationNotFoundError,
  OperationNotOpenError,
  OperationRecord,
  OperationsRepository,
  OperationStaleVersionError,
  OperationWriteCommand,
} from "./operations.types";

@Injectable()
export class OperationsService {
  constructor(
    @Inject(OPERATIONS_REPOSITORY)
    private readonly repository: OperationsRepository,
  ) {}

  preview(dto: PreviewOperationDto) {
    try {
      const balanceInputs = dto.legs.map((leg) => ({
        stake: leg.stake,
        betType: leg.betType ?? "BACK",
        odd: leg.odd,
        commissionPercent: leg.commissionPercent ?? "0",
        cashbackPercent: leg.cashbackPercent ?? "0",
        increasePercent: leg.increasePercent ?? "0",
        usesBetCredit: leg.usesBetCredit ?? false,
        manualStake: leg.manualStake,
      }));
      const needsBalance = balanceInputs.some(
        (leg, index) => index > 0 && (!leg.stake || leg.manualStake === false),
      );
      const finalInputs = needsBalance
        ? balanceStakes(balanceInputs)
        : balanceInputs.map((leg, index) => {
            if (!leg.stake)
              throw new CalculationValidationError(
                "A stake é obrigatória.",
                `legs.${index}.stake`,
              );
            return { ...leg, stake: leg.stake };
          });
      return {
        snapshot: serializeDecimals(calculateOperationSnapshot(finalInputs)),
        stakes: finalInputs.map((leg) =>
          new Prisma.Decimal(leg.stake.toString()).toFixed(2),
        ),
      };
    } catch (error) {
      this.handleCalculation(error);
    }
  }

  async create(
    userId: string,
    dto: CreateOperationDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.create(
            this.command(userId, dto, idempotencyKey, "CREATE"),
          ),
        ),
      ),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateOperationDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const command = this.command(
      userId,
      dto,
      idempotencyKey,
      `UPDATE:${id}:${dto.version}`,
    );
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.update({
            ...command,
            operationId: id,
            version: dto.version,
          }),
        ),
      ),
    };
  }

  async updateLegNames(
    userId: string,
    id: string,
    dto: UpdateLegNamesDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    if (new Set(dto.legs.map((leg) => leg.legId)).size !== dto.legs.length)
      throw new UnprocessableEntityException("Linha repetida na atualização.");
    const legs = dto.legs.map((leg) => ({
      legId: leg.legId,
      selectionName: leg.selectionName.trim(),
    }));
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.updateLegNames({
            userId,
            operationId: id,
            version: dto.version,
            legs,
            idempotencyKey,
            requestHash: this.hash(["UPDATE_LEG_NAMES", id, dto.version, legs]),
          }),
        ),
      ),
    };
  }

  async get(userId: string, id: string) {
    const operation = await this.repository.findById(userId, id);
    if (!operation) throw new NotFoundException("Operação não encontrada.");
    return { operation: this.response(operation) };
  }

  async list(userId: string, dto: ListOperationsDto) {
    const result = await this.repository.list({
      userId,
      status: dto.status,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      bookmakerAccountId: dto.bookmakerAccountId,
      search: dto.search,
      cursor: dto.cursor,
      limit: dto.limit,
    });
    return {
      data: result.items.map((item) => this.response(item)),
      pageInfo: {
        nextCursor: result.nextCursor,
        hasNextPage: result.nextCursor !== null,
      },
    };
  }

  async cancel(
    userId: string,
    id: string,
    version: number,
    reason: string | undefined,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.cancel({
            userId,
            operationId: id,
            version,
            reason,
            idempotencyKey,
            requestHash: this.hash(["CANCEL", id, version, reason ?? ""]),
          }),
        ),
      ),
    };
  }

  async settle(
    userId: string,
    id: string,
    dto: SettleOperationDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    if (
      !dto.legs.some((leg) => leg.result === "WON") ||
      dto.legs.some((leg) => leg.result === "PENDING")
    )
      throw new UnprocessableEntityException({
        code: "INVALID_SETTLEMENT",
        message: "Informe todas as linhas e ao menos um green.",
        fields: [{ path: "legs", code: "INVALID_RESULTS" }],
      });
    if (
      dto.creditGenerated === true &&
      (!dto.grantedCreditAmount ||
        new Prisma.Decimal(dto.grantedCreditAmount).lte(0))
    )
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Informe o crédito concedido.",
        fields: [
          {
            path: "grantedCreditAmount",
            code: "REQUIRED_WHEN_CREDIT_GENERATED",
          },
        ],
      });
    const payload = [
      "SETTLE",
      id,
      dto.version,
      dto.creditGenerated ?? null,
      dto.grantedCreditAmount ?? null,
      dto.legs,
    ];
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.settle({
            userId,
            operationId: id,
            version: dto.version,
            creditGenerated: dto.creditGenerated,
            grantedCreditAmount: dto.grantedCreditAmount
              ? new Prisma.Decimal(dto.grantedCreditAmount)
              : undefined,
            legs: dto.legs.map((leg) => ({
              legId: leg.legId,
              result: leg.result as "WON" | "LOST",
            })),
            idempotencyKey,
            requestHash: this.hash(payload),
          }),
        ),
      ),
    };
  }

  async recordEarlyWins(
    userId: string,
    id: string,
    dto: RecordEarlyWinsDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    if (new Set(dto.legIds).size !== dto.legIds.length)
      throw new UnprocessableEntityException({
        code: "INVALID_EARLY_WINS",
        message: "Selecione cada linha apenas uma vez.",
      });
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.recordEarlyWins({
            userId,
            operationId: id,
            version: dto.version,
            legIds: dto.legIds,
            idempotencyKey,
            requestHash: this.hash([
              "RECORD_EARLY_WINS",
              id,
              dto.version,
              dto.legIds,
            ]),
          }),
        ),
      ),
    };
  }

  async correctGeneratedCredit(
    userId: string,
    id: string,
    dto: CorrectGeneratedCreditDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const grantedCreditAmount = new Prisma.Decimal(dto.grantedCreditAmount);
    if (!grantedCreditAmount.isPositive())
      throw new UnprocessableEntityException(
        "O valor do crédito deve ser maior que zero.",
      );
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.correctGeneratedCredit({
            userId,
            operationId: id,
            version: dto.version,
            grantedCreditAmount,
            idempotencyKey,
            requestHash: this.hash([
              "CORRECT_GENERATED_CREDIT",
              id,
              dto.version,
              grantedCreditAmount.toFixed(2),
            ]),
          }),
        ),
      ),
    };
  }

  async grantGeneratedCredit(
    userId: string,
    id: string,
    dto: GrantGeneratedCreditDto,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    const grantedCreditAmount = new Prisma.Decimal(dto.grantedCreditAmount);
    if (!grantedCreditAmount.isPositive())
      throw new UnprocessableEntityException(
        "O valor do crédito deve ser maior que zero.",
      );
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.grantGeneratedCredit({
            userId,
            operationId: id,
            version: dto.version,
            grantedCreditAmount,
            idempotencyKey,
            requestHash: this.hash([
              "GRANT_GENERATED_CREDIT",
              id,
              dto.version,
              grantedCreditAmount.toFixed(2),
            ]),
          }),
        ),
      ),
    };
  }

  async deleteOperation(
    userId: string,
    id: string,
    version: number,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.deleteOperation({
            userId,
            operationId: id,
            version,
            idempotencyKey,
            requestHash: this.hash(["DELETE", id, version]),
          }),
        ),
      ),
    };
  }

  async expireGeneratedCredit(
    userId: string,
    id: string,
    version: number,
    idempotencyKey: string,
  ) {
    this.assertIdempotencyKey(idempotencyKey);
    return {
      operation: this.response(
        await this.execute(() =>
          this.repository.expireGeneratedCredit({
            userId,
            operationId: id,
            version,
            idempotencyKey,
            requestHash: this.hash(["EXPIRE_GENERATED_CREDIT", id, version]),
          }),
        ),
      ),
    };
  }

  private command(
    userId: string,
    dto: CreateOperationDto,
    idempotencyKey: string,
    action: string,
  ): OperationWriteCommand {
    this.validateConditional(dto);
    const snapshot = this.snapshot(dto);
    return {
      userId,
      idempotencyKey,
      requestHash: this.hash([action, dto]),
      eventName: dto.eventName.trim(),
      notes: dto.notes?.trim() || undefined,
      generatesBetCredit: dto.generatesBetCredit ?? false,
      expectedBetCredit: dto.expectedBetCredit
        ? new Prisma.Decimal(dto.expectedBetCredit)
        : undefined,
      realCashInvestment: new Prisma.Decimal(
        snapshot.realCashInvestment.toString(),
      ),
      promotionalStake: new Prisma.Decimal(
        snapshot.promotionalStake.toString(),
      ),
      protectedReturn: new Prisma.Decimal(snapshot.protectedReturn.toString()),
      projectedProfit: new Prisma.Decimal(snapshot.projectedProfit.toString()),
      projectedRoiPercent: new Prisma.Decimal(
        snapshot.projectedRoiPercent.toString(),
      ),
      engineVersion: snapshot.engineVersion,
      calculationSnapshot: serializeDecimals(snapshot) as Prisma.InputJsonValue,
      legs: snapshot.legs.map((leg, index) => ({
        selectionName: dto.legs[index].selectionName || undefined,
        bookmakerAccountId: dto.legs[index].bookmakerAccountId,
        betCreditId: dto.legs[index].betCreditId,
        usesFreeBetCredit: dto.legs[index].usesFreeBetCredit ?? false,
        betType: leg.betType,
        stake: new Prisma.Decimal(leg.stake.toString()),
        riskAmount: new Prisma.Decimal(leg.riskAmount.toString()),
        odd: new Prisma.Decimal(leg.odd.toString()),
        commissionPercent: new Prisma.Decimal(leg.commissionPercent.toString()),
        cashbackPercent: new Prisma.Decimal(leg.cashbackPercent.toString()),
        increasePercent: new Prisma.Decimal(leg.increasePercent.toString()),
        usesBetCredit: leg.usesBetCredit,
        profitFactor: new Prisma.Decimal(leg.profitFactor.toString()),
        effectiveOdd: new Prisma.Decimal(leg.effectiveOdd.toString()),
        projectedPayout: new Prisma.Decimal(leg.projectedPayout.toString()),
        scenarioResult: new Prisma.Decimal(leg.scenarioResult.toString()),
      })),
    };
  }

  private engineLeg(leg: OperationLegDto) {
    return {
      stake: leg.stake,
      betType: leg.betType ?? "BACK",
      odd: leg.odd,
      commissionPercent: leg.commissionPercent ?? "0",
      cashbackPercent: leg.cashbackPercent ?? "0",
      increasePercent: leg.increasePercent ?? "0",
      usesBetCredit: leg.usesBetCredit ?? false,
    };
  }

  private snapshot(dto: CreateOperationDto): OperationSnapshot {
    try {
      return calculateOperationSnapshot(
        dto.legs.map((leg) => this.engineLeg(leg)),
      );
    } catch (error) {
      this.handleCalculation(error);
    }
  }

  private validateConditional(dto: CreateOperationDto) {
    const fields: Array<{ path: string; code: string }> = [];
    if (
      dto.generatesBetCredit &&
      (!dto.expectedBetCredit ||
        new Prisma.Decimal(dto.expectedBetCredit).lte(0))
    )
      fields.push({
        path: "expectedBetCredit",
        code: "REQUIRED_WHEN_GENERATES_CREDIT",
      });
    dto.legs.forEach((leg, index) => {
      if (leg.betType === "LAY" && leg.usesBetCredit)
        fields.push({
          path: `legs.${index}.usesBetCredit`,
          code: "FORBIDDEN_FOR_LAY",
        });
      if (leg.usesBetCredit && !leg.usesFreeBetCredit && !leg.betCreditId)
        fields.push({
          path: `legs.${index}.betCreditId`,
          code: "REQUIRED_WHEN_USES_CREDIT",
        });
      if (!leg.usesBetCredit && leg.betCreditId)
        fields.push({
          path: `legs.${index}.betCreditId`,
          code: "FORBIDDEN_WITHOUT_CREDIT",
        });
      if (!leg.usesBetCredit && leg.usesFreeBetCredit)
        fields.push({
          path: `legs.${index}.usesFreeBetCredit`,
          code: "FORBIDDEN_WITHOUT_CREDIT",
        });
      if (leg.usesFreeBetCredit && leg.betCreditId)
        fields.push({
          path: `legs.${index}.betCreditId`,
          code: "FORBIDDEN_WITH_FREE_CREDIT",
        });
    });
    const ids = dto.legs.flatMap((leg) =>
      leg.betCreditId ? [leg.betCreditId] : [],
    );
    if (new Set(ids).size !== ids.length)
      fields.push({ path: "legs", code: "DUPLICATE_BET_CREDIT" });
    if (fields.length)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Revise os campos obrigatórios.",
        fields,
      });
  }

  private handleCalculation(error: unknown): never {
    if (error instanceof CalculationValidationError)
      throw new UnprocessableEntityException({
        code: "CALCULATION_ERROR",
        message: error.message,
        fields: error.path
          ? [{ path: error.path, code: "INVALID_VALUE" }]
          : undefined,
      });
    throw error;
  }

  private async execute<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof OperationNotFoundError)
        throw new NotFoundException("Operação não encontrada.");
      if (error instanceof OperationNotOpenError)
        throw new ConflictException({
          code: "OPERATION_NOT_OPEN",
          message: "Somente operações abertas podem ser alteradas.",
        });
      if (error instanceof OperationStaleVersionError)
        throw new ConflictException({
          code: "STALE_VERSION",
          message: "A operação foi alterada em outra sessão.",
        });
      if (error instanceof OperationAccountError)
        throw new UnprocessableEntityException({
          code: "INVALID_BOOKMAKER_ACCOUNT",
          message:
            "Uma das casas não existe, está arquivada ou não pertence ao usuário.",
        });
      if (error instanceof OperationInsufficientBalanceError)
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_BALANCE",
          message: "Saldo insuficiente em uma das casas.",
          fields: [{ path: "legs", code: error.bookmakerAccountId }],
        });
      if (error instanceof OperationCreditUnavailableError)
        throw new ConflictException({
          code: "BET_CREDIT_UNAVAILABLE",
          message: "O crédito selecionado não está disponível.",
        });
      if (error instanceof OperationCreditReservedError)
        throw new ConflictException({
          code: "BET_CREDIT_ALREADY_RESERVED",
          message:
            "Este crédito já está reservado por outra surebet aberta. Edite ou cancele a operação que possui a reserva.",
        });
      if (error instanceof OperationCreditCorrectionUnavailableError)
        throw new ConflictException({
          code: "BET_CREDIT_CORRECTION_UNAVAILABLE",
          message:
            "O crédito só pode ser corrigido enquanto aguarda uso e ainda não foi reservado por outra surebet.",
        });
      if (error instanceof OperationCreditGrantUnavailableError)
        throw new ConflictException({
          code: "BET_CREDIT_GRANT_UNAVAILABLE",
          message:
            "O crédito só pode ser liberado antecipadamente em uma surebet aberta que ainda aguarda a geração do crédito.",
        });
      if (error instanceof OperationCreditExpirationUnavailableError)
        throw new ConflictException({
          code: "BET_CREDIT_EXPIRATION_UNAVAILABLE",
          message:
            "O crédito só pode ser marcado como perdido enquanto estiver disponível e sem reserva em outra surebet.",
        });
      if (error instanceof OperationDeleteCreditInUseError)
        throw new ConflictException({
          code: "BET_CREDIT_IN_USE",
          message:
            "Este crédito está vinculado a outra surebet. Exclua primeiro a bet que utilizou o crédito.",
        });
      if (error instanceof OperationInvalidSettlementError)
        throw new ConflictException({
          code: "INVALID_STATE_TRANSITION",
          message: "A operação não pode ser liquidada com estes dados.",
        });
      if (error instanceof OperationIdempotencyConflictError)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "A chave de idempotência já foi usada com outro conteúdo.",
        });
      throw error;
    }
  }

  private response(operation: OperationRecord) {
    const decimal = (value: Prisma.Decimal | null) =>
      value === null || value === undefined ? null : value.toFixed(2);
    return {
      ...operation,
      realCashInvestment: decimal(operation.realCashInvestment),
      promotionalStake: decimal(operation.promotionalStake),
      protectedReturn: decimal(operation.protectedReturn),
      projectedProfit: decimal(operation.projectedProfit),
      projectedRoiPercent: operation.projectedRoiPercent.toString(),
      realizedReturn: decimal(operation.realizedReturn),
      realizedProfit: decimal(operation.realizedProfit),
      realizedRoiPercent: operation.realizedRoiPercent?.toString() ?? null,
      legs: operation.legs.map((leg) => ({
        ...leg,
        stake: decimal(leg.stake),
        riskAmount: decimal(leg.riskAmount),
        odd: leg.odd.toString(),
        commissionPercent: leg.commissionPercent.toString(),
        cashbackPercent: leg.cashbackPercent.toString(),
        increasePercent: leg.increasePercent.toString(),
        profitFactor: leg.profitFactor.toString(),
        effectiveOdd: leg.effectiveOdd.toString(),
        projectedPayout: decimal(leg.projectedPayout),
        scenarioResult: decimal(leg.scenarioResult),
      })),
      generatedCredit: operation.generatedCredit
        ? {
            ...operation.generatedCredit,
            expectedAmount: decimal(operation.generatedCredit.expectedAmount),
            grantedAmount: decimal(operation.generatedCredit.grantedAmount),
          }
        : null,
      snapshot: operation.calculationSnapshot,
      combinedPromotionProfit: this.combinedPromotionProfit(operation),
    };
  }

  private combinedPromotionProfit(operation: OperationRecord): string | null {
    if (!operation.realizedProfit || operation.consumedCredits.length === 0)
      return null;
    const qualificationProfit = operation.consumedCredits.reduce(
      (total, credit) => total.add(credit.sourceOperation.realizedProfit ?? 0),
      new Prisma.Decimal(0),
    );
    return operation.realizedProfit.add(qualificationProfit).toFixed(2);
  }

  private assertIdempotencyKey(key: string) {
    if (!key || key.length < 8 || key.length > 160)
      throw new UnprocessableEntityException({
        code: "VALIDATION_ERROR",
        message: "Idempotency-Key inválida ou ausente.",
        fields: [{ path: "headers.idempotency-key", code: "REQUIRED" }],
      });
  }

  private hash(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
