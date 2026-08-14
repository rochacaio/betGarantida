const { PrismaClient } = require("@prisma/client");

const email = process.argv[2];
const confirmation = process.argv[3];
const databaseUrl = process.env.RESET_DATABASE_URL;

if (!email || confirmation !== "RESETAR") {
  throw new Error(
    "Uso: npm run admin:reset-user -- <email> RESETAR (com RESET_DATABASE_URL configurada)",
  );
}
if (!databaseUrl) throw new Error("RESET_DATABASE_URL não foi configurada.");

const target = new URL(databaseUrl);
if (
  !target.hostname.endsWith(".neon.tech") ||
  target.hostname === "localhost" ||
  target.pathname.replace(/^\//, "") !== "neondb"
) {
  throw new Error(
    `Banco recusado: ${target.hostname}/${target.pathname.replace(/^\//, "")}. O reset exige neondb em *.neon.tech.`,
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`Usuário não encontrado: ${email}`);

  const deleted = await prisma.$transaction(async (tx) => ({
    operationMutations: (
      await tx.operationMutation.deleteMany({ where: { userId: user.id } })
    ).count,
    auditLogs: (await tx.auditLog.deleteMany({ where: { userId: user.id } }))
      .count,
    walletTransactions: (
      await tx.walletTransaction.deleteMany({ where: { userId: user.id } })
    ).count,
    betLegs: (
      await tx.betLeg.deleteMany({ where: { operation: { userId: user.id } } })
    ).count,
    betCredits: (await tx.betCredit.deleteMany({ where: { userId: user.id } }))
      .count,
    operations: (await tx.operation.deleteMany({ where: { userId: user.id } }))
      .count,
    bookmakerAccounts: (
      await tx.bookmakerAccount.deleteMany({ where: { userId: user.id } })
    ).count,
  }));

  const remaining = await Promise.all([
    prisma.operation.count({ where: { userId: user.id } }),
    prisma.bookmakerAccount.count({ where: { userId: user.id } }),
    prisma.walletTransaction.count({ where: { userId: user.id } }),
    prisma.betCredit.count({ where: { userId: user.id } }),
  ]);
  console.log(
    JSON.stringify(
      {
        database: `${target.hostname}/neondb`,
        user: user.email,
        deleted,
        remaining: {
          operations: remaining[0],
          bookmakerAccounts: remaining[1],
          walletTransactions: remaining[2],
          betCredits: remaining[3],
        },
        loginPreserved: true,
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
