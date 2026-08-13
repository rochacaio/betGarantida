import { Module } from "@nestjs/common";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";
import { PrismaOperationsRepository } from "./prisma-operations.repository";
import { OPERATIONS_REPOSITORY } from "./operations.types";

@Module({
  controllers: [OperationsController],
  providers: [
    OperationsService,
    PrismaOperationsRepository,
    { provide: OPERATIONS_REPOSITORY, useExisting: PrismaOperationsRepository },
  ],
  exports: [OperationsService, OPERATIONS_REPOSITORY],
})
export class OperationsModule {}
