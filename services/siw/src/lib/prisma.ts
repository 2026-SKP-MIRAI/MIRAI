import { PrismaClient } from "@prisma/client";

// Warning #9 fix: globalThis 싱글턴으로 HMR 중 다중 인스턴스 방지
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
