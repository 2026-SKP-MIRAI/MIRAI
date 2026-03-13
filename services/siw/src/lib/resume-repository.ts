import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export const resumeRepository = {
  async create(resumeText: string): Promise<string> {
    const session = await prisma.resumeSession.create({ data: { resumeText } });
    return session.id;
  },
  async findById(id: string): Promise<string> {
    const s = await prisma.resumeSession.findUniqueOrThrow({ where: { id } });
    return s.resumeText;
  },
};
