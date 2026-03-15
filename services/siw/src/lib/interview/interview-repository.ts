import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QueueItem, HistoryItem } from "@/lib/types";
import { QueueItemArraySchema, HistoryItemArraySchema, QuestionTypeSchema } from "./schemas";

export type SessionSnapshot = {
  id: string;
  resumeText: string;
  currentQuestion: string;
  currentPersona: string;
  currentQuestionType: "main" | "follow_up";
  questionsQueue: QueueItem[];
  history: HistoryItem[];
  sessionComplete: boolean;
  engineResultCache: object | null;
};

export const interviewRepository = {
  async create(data: {
    resumeText: string;
    currentQuestion: string;
    currentPersona: string;
    currentQuestionType: "main" | "follow_up";
    questionsQueue: QueueItem[];
  }): Promise<string> {
    const session = await prisma.interviewSession.create({
      data: { ...data, history: [] },
    });
    return session.id;
  },

  async findById(id: string): Promise<SessionSnapshot> {
    const s = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    const questionsQueue = QueueItemArraySchema.parse(s.questionsQueue);
    const history = HistoryItemArraySchema.parse(s.history);
    return {
      id: s.id,
      resumeText: s.resumeText,
      currentQuestion: s.currentQuestion,
      currentPersona: s.currentPersona,
      currentQuestionType: QuestionTypeSchema.parse(s.currentQuestionType ?? "main"),
      questionsQueue,
      history,
      sessionComplete: s.sessionComplete,
      engineResultCache: (s.engineResultCache as object | null) ?? null,
    };
  },

  /** engine 호출 성공 직후 write-ahead 캐시 저장 */
  async saveEngineResult(id: string, result: object): Promise<void> {
    await prisma.interviewSession.update({
      where: { id },
      data: { engineResultCache: result },
    });
  },

  async updateAfterAnswer(
    id: string,
    data: {
      history: HistoryItem[];
      questionsQueue: QueueItem[];
      currentQuestion: string;
      currentPersona: string;
      currentQuestionType: "main" | "follow_up";
      sessionComplete: boolean;
      engineResultCache: object | null;
    }
  ): Promise<void> {
    try {
      const { engineResultCache, ...rest } = data;
      await prisma.interviewSession.update({
        where: { id },
        data: {
          ...rest,
          engineResultCache: engineResultCache === null ? Prisma.DbNull : engineResultCache,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new Error("session_not_found");
      }
      throw e;
    }
  },

  /** 면접 세션을 완료 처리 */
  async complete(id: string): Promise<void> {
    try {
      await prisma.interviewSession.update({
        where: { id },
        data: { sessionComplete: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new Error("session_not_found");
      }
      throw e;
    }
  },

  /** 리포트 점수 저장 (best-effort) */
  async saveReport(id: string, scores: import("@/lib/types").AxisScores, totalScore: number): Promise<void> {
    try {
      await prisma.interviewSession.update({
        where: { id },
        data: { reportScores: scores, reportTotalScore: totalScore },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new Error("session_not_found");
      }
      throw e;
    }
  },

  /** 완료된 세션 목록 (reportScores 있는 것만) */
  async listCompleted(): Promise<Array<{
    id: string;
    createdAt: Date;
    resumeText: string;
    reportScores: unknown;
    reportTotalScore: number;
  }>> {
    const sessions = await prisma.interviewSession.findMany({
      where: {
        sessionComplete: true,
        reportScores: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        resumeText: true,
        reportScores: true,
        reportTotalScore: true,
      },
    });
    return sessions.map(s => ({
      ...s,
      reportTotalScore: s.reportTotalScore ?? 0,
    }));
  },
};
