"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatTopBar } from "@/components/chat/ChatTopBar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInterview } from "@/hooks/useInterview";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  personaLabel?: string;
  personaType?: string;
  timestamp: Date;
}

const PERSONA_LABELS: Record<string, string> = {
  hr: "HR 면접관",
  tech_lead: "기술 면접관",
  executive: "임원 면접관",
};

const PERSONA_NAMES: Record<string, string> = {
  hr: "HR 김지수",
  tech_lead: "기술 이준혁",
  executive: "임원 박성민",
};

const TOTAL_QUESTIONS = 5;

export default function InterviewPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const { state, sendAnswer, endInterview, resetError } = useInterview({ sessionId });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showBackDialog, setShowBackDialog] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [hintTimer, setHintTimer] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 첫 질문 메시지 초기화
  useEffect(() => {
    if (state.currentQuestion && messages.length === 0) {
      setMessages([{
        id: crypto.randomUUID(),
        role: "ai",
        content: state.currentQuestion,
        personaLabel: PERSONA_LABELS[state.currentPersona] ?? "AI 면접관",
        personaType: state.currentPersona,
        timestamp: new Date(),
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentQuestion]);

  // 새 메시지 시 스크롤 (iOS Safari 호환 방식)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, state.status]);

  // 30초 힌트 타이머
  useEffect(() => {
    if (state.status === "answering") {
      hintTimerRef.current = setTimeout(() => setHintTimer(true), 30000);
    } else {
      setHintTimer(false);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    }
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [state.status, messages.length]);

  // 면접 종료 처리 (엔진 sessionComplete OR 프론트 문항 수 도달)
  useEffect(() => {
    const done =
      state.status === "ending" ||
      (state.status === "answering" && state.questionIndex >= TOTAL_QUESTIONS);
    if (done && !isEnding) {
      setIsEnding(true);
      handleEndInterview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.questionIndex]);

  const handleSendAnswer = async (answer: string) => {
    setHintTimer(false);

    // 유저 메시지 추가
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      content: answer,
      timestamp: new Date(),
    }]);

    await sendAnswer(answer);
  };

  // state 변경 후 AI 메시지 추가 (useEffect로 처리)
  const prevQuestionRef = useRef(state.currentQuestion);
  useEffect(() => {
    if (
      state.currentQuestion &&
      state.currentQuestion !== prevQuestionRef.current &&
      state.status === "answering"
    ) {
      prevQuestionRef.current = state.currentQuestion;
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "ai",
        content: state.currentQuestion,
        personaLabel: PERSONA_LABELS[state.currentPersona] ?? "AI 면접관",
        personaType: state.currentPersona,
        timestamp: new Date(),
      }]);
    }
  }, [state.currentQuestion, state.status, state.currentPersona]);

  const handleEndInterview = async () => {
    const report = await endInterview();
    if (report) {
      router.push(`/report/${sessionId}`);
    }
  };

  const handleBack = () => setShowBackDialog(true);

  const handleConfirmBack = () => {
    try { sessionStorage.removeItem("interview_state"); } catch {}
    router.push("/");
  };

  const isSubmitting = state.status === "submitting" || state.status === "ending";

  return (
    <div className="flex flex-col h-[100dvh] bg-[--color-background]">
      <ChatTopBar
        questionIndex={state.questionIndex}
        totalQuestions={TOTAL_QUESTIONS}
        onBack={handleBack}
        personaName={PERSONA_NAMES[state.currentPersona] ?? "AI 면접관"}
      />

      {/* 채팅 영역 */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto bg-white"
      >
        <div className="flex flex-col gap-3 px-5 py-4">
        {/* 면접 시작 배너 */}
        <div
          className="flex items-center gap-3 bg-teal-50 border border-teal-100 rounded-2xl px-4 py-3"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
            style={{ background: "rgba(13,148,136,0.15)" }}
          >
            🎙️
          </div>
          <div>
            <p className="text-xs font-bold text-teal-800">AI 면접이 시작됐어요!</p>
            <p className="text-xs text-teal-600 mt-0.5">5개 질문에 성실히 답변해 주세요</p>
          </div>
        </div>
        {messages.map(msg => (
          <ChatBubble
            key={msg.id}
            message={msg.content}
            isAI={msg.role === "ai"}
            personaLabel={msg.personaLabel}
            personaType={msg.personaType}
            timestamp={msg.timestamp}
          />
        ))}

        {/* 타이핑 인디케이터 */}
        {isSubmitting && <TypingIndicator />}

        {/* 30초 힌트 */}
        {hintTimer && state.status === "answering" && (
          <p className="bg-teal-50 text-teal-700 rounded-full px-3 py-1 text-xs mx-auto">
            더 구체적인 경험이나 숫자를 포함해보세요
          </p>
        )}

        {/* 에러 상태 */}
        {state.status === "error" && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm text-[--color-muted-foreground]">응답에 문제가 생겼어요</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-[#0D9488] text-[#0D9488]" onClick={resetError}>
                다시 보내기
              </Button>
              <Button size="sm" variant="destructive" onClick={() => router.push("/")}>
                면접 종료
              </Button>
            </div>
          </div>
        )}

        {/* 면접 종료 중 */}
        {(state.status === "ending" || isEnding) && (
          <div className="flex flex-col items-center gap-4 py-10 px-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
              style={{ background: "rgba(13,148,136,0.08)", border: "2px solid rgba(13,148,136,0.2)" }}
            >
              🎉
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold text-gray-800">면접이 완료됐어요!</p>
              <p className="text-sm text-[#0D9488] font-medium">리포트를 생성하는 중이에요</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#0D9488] animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <button
              onClick={() => router.push(`/report/${sessionId}`)}
              className="mt-2 px-8 py-2.5 bg-[#0D9488] text-white text-sm font-bold rounded-full active:scale-95 transition-transform"
            >
              리포트 보기 →
            </button>
          </div>
        )}
        </div>
      </div>

      {/* 입력창 */}
      {(state.status === "answering" || state.status === "submitting") && (
        <ChatInput
          onSend={handleSendAnswer}
          disabled={isSubmitting}
        />
      )}

      {/* 뒤로가기 확인 다이얼로그 */}
      <Dialog open={showBackDialog} onOpenChange={setShowBackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>면접을 중단할까요?</DialogTitle>
            <DialogDescription>
              지금 나가면 면접 기록이 저장되지 않아요.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackDialog(false)}>
              계속하기
            </Button>
            <Button variant="destructive" onClick={handleConfirmBack}>
              중단하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
