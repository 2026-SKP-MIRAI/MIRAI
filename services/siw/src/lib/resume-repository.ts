import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ResumeRecord = {
  id: string;
  userId: string;
  fileName: string;
  storageKey: string;
  resumeText: string;
  questions: Prisma.JsonValue;
  feedbackJson: Prisma.JsonValue | null;
  inferredTargetRole: string | null;
  createdAt: Date;
};

export const resumeRepository = {
  async create(data: {
    userId: string;
    fileName: string;
    storageKey: string;
    resumeText: string;
    questions: Prisma.InputJsonValue;
    feedbackJson?: Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue;
    inferredTargetRole?: string | null;
  }): Promise<string> {
    const resume = await prisma.resume.create({ data });
    return resume.id;
  },

  async findById(id: string): Promise<ResumeRecord> {
    return prisma.resume.findUniqueOrThrow({ where: { id } });
  },

  async findDetailById(id: string, userId: string): Promise<ResumeRecord> {
    const resume = await prisma.resume.findFirst({
      where: { id, userId },
    });
    if (!resume) throw new Error("Resume not found");
    return resume;
  },

  async listByUserId(userId: string): Promise<ResumeRecord[]> {
    return prisma.resume.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
};
