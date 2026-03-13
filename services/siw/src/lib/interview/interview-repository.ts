import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { QueueItem, HistoryItem } from "@/lib/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export type SessionSnapshot = {
  id: string;
  resumeText: string;
  currentQuestion: string;
  currentPersona: string;
  currentQuestionType: "main" | "follow_up";
  questionsQueue: QueueItem[];
  history: HistoryItem[];
  sessionComplete: boolean;
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
      data: {
        resumeText: data.resumeText,
        currentQuestion: data.currentQuestion,
        currentPersona: data.currentPersona,
        currentQuestionType: data.currentQuestionType,
        questionsQueue: data.questionsQueue,
        history: [],
      },
    });
    return session.id;
  },

  async findById(id: string): Promise<SessionSnapshot> {
    const s = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });
    return {
      id: s.id,
      resumeText: s.resumeText,
      currentQuestion: s.currentQuestion,
      currentPersona: s.currentPersona,
      currentQuestionType: (s.currentQuestionType ?? "main") as "main" | "follow_up",
      questionsQueue: s.questionsQueue as QueueItem[],
      history: s.history as HistoryItem[],
      sessionComplete: s.sessionComplete,
    };
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
    }
  ): Promise<void> {
    await prisma.interviewSession.update({ where: { id }, data });
  },
};
