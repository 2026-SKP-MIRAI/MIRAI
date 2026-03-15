import { prisma } from "@/lib/prisma";

export const resumeRepository = {
  async create(resumeText: string): Promise<string> {
    const session = await prisma.resumeSession.create({ data: { resumeText } });
    return session.id;
  },
  async findById(id: string): Promise<string> {
    const s = await prisma.resumeSession.findUniqueOrThrow({ where: { id } });
    return s.resumeText;
  },
  async findDetailById(id: string): Promise<{ id: string; resumeText: string; createdAt: Date }> {
    return prisma.resumeSession.findUniqueOrThrow({
      where: { id },
      select: { id: true, resumeText: true, createdAt: true },
    });
  },
  async listAll(): Promise<Array<{ id: string; resumeText: string; createdAt: Date }>> {
    return prisma.resumeSession.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, resumeText: true, createdAt: true },
    });
  },
};
