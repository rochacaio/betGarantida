import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BookmakerAccountStatus, Prisma } from "@prisma/client";
import { WalletService } from "../wallets/wallet.service";
import {
  BOOKMAKER_ACCOUNTS_REPOSITORY,
  BookmakerAccountsRepository,
} from "./bookmaker-account.types";
import { CreateBookmakerAccountDto } from "./dto/create-bookmaker-account.dto";
import { UpdateBookmakerAccountDto } from "./dto/update-bookmaker-account.dto";

@Injectable()
export class BookmakerAccountsService {
  constructor(
    @Inject(BOOKMAKER_ACCOUNTS_REPOSITORY)
    private readonly repository: BookmakerAccountsRepository,
    private readonly wallets: WalletService,
  ) {}

  async create(
    userId: string,
    dto: CreateBookmakerAccountDto,
    idempotencyKey: string,
  ) {
    return this.wallets.createAccount({
      userId,
      name: dto.name.trim(),
      ownerName: dto.ownerName?.trim() || undefined,
      nickname: dto.nickname?.trim() || undefined,
      currency: (dto.currency ?? "BRL").toUpperCase(),
      initialBalance: dto.initialBalance,
      idempotencyKey,
    });
  }

  async list(userId: string, status?: BookmakerAccountStatus) {
    const accounts = await this.repository.list(userId, status);
    return { data: accounts.map((account) => this.response(account)) };
  }

  async get(userId: string, id: string) {
    const account = await this.repository.findById(userId, id);
    if (!account) throw new NotFoundException("Casa de aposta não encontrada.");
    return { account: this.response(account) };
  }

  async update(userId: string, id: string, dto: UpdateBookmakerAccountDto) {
    const result = await this.repository.updateMetadata({
      userId,
      id,
      version: dto.version,
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.ownerName !== undefined
        ? { ownerName: dto.ownerName.trim() || null }
        : {}),
      ...(dto.nickname !== undefined
        ? { nickname: dto.nickname.trim() || null }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });
    if (result.result === "NOT_FOUND")
      throw new NotFoundException("Casa de aposta não encontrada.");
    if (result.result === "STALE_VERSION") {
      throw new ConflictException({
        code: "STALE_VERSION",
        message:
          "A casa foi alterada em outra sessão. Atualize os dados e tente novamente.",
      });
    }
    if (result.result !== "UPDATED")
      throw new NotFoundException("Casa de aposta não encontrada.");
    return { account: this.response(result.account) };
  }

  private response(account: {
    id: string;
    name: string;
    ownerName: string | null;
    nickname: string | null;
    currency: string;
    status: BookmakerAccountStatus;
    cachedBalance: Prisma.Decimal;
    openStake: Prisma.Decimal;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: account.id,
      name: account.name,
      ownerName: account.ownerName,
      nickname: account.nickname,
      currency: account.currency,
      status: account.status,
      availableBalance: account.cachedBalance.toFixed(2),
      openStake: account.openStake.toFixed(2),
      equity: account.cachedBalance.add(account.openStake).toFixed(2),
      version: account.version,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }
}
