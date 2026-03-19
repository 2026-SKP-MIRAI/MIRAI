"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { UploadForm } from "@/components/UploadForm";
import { QuestionList } from "@/components/QuestionList";
import type { QuestionsResponse, UploadState } from "@/lib/types";

export default function ResumePage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [questions, setQuestions] = useState<QuestionsResponse | null>(null);
  const [error, setError] = useState<string>();

  const handleUpload = async (file: File) => {
    setUploadState("uploading");
    setError(undefined);

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadState("processing");
      const res = await fetch("/api/resume/questions", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.message ?? "업로드에 실패했습니다.");
        setUploadState("error");
        return;
      }

      const data: QuestionsResponse = await res.json();
      setQuestions(data);
      setUploadState("done");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setUploadState("error");
    }
  };

  return (
    <div className="w-full flex flex-col min-h-[100dvh] bg-gray-50">
      <TopBar title="자소서 기반 면접" showBack backHref="/" />

      {/* 헤더 설명 */}
      <div
        className="relative px-5 py-12 text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D9488 0%, #0F766E 60%, #134E4A 100%)" }}
      >
        {/* 장식 원 */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />
        <p className="text-2xl font-extrabold leading-tight tracking-tight relative">✨ 자소서를 올려주시면</p>
        <p className="text-2xl font-extrabold leading-tight tracking-tight relative">맞춤 면접 질문을 드려요</p>
        <p className="text-sm text-white/70 mt-2 relative">AI가 자소서를 분석해 실제 면접 질문을 예측해드립니다</p>
        {uploadState === "done" && questions && (
          <span className="inline-block mt-3 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white backdrop-blur-sm relative">
            AI가 {questions.questions.length}개 질문 생성
          </span>
        )}
      </div>

      <main className="flex-1 px-5 py-6 space-y-6">
        <UploadForm onUpload={handleUpload} state={uploadState} error={error} />

        {/* 업로드 전 안내 */}
        {uploadState === "idle" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">이런 질문을 받을 수 있어요</p>
              <div className="h-px flex-1" style={{ background: "#E5E7EB" }} />
            </div>
            {[
              "지원 동기가 무엇인가요?",
              "팀 프로젝트에서 갈등 상황을 어떻게 해결했나요?",
              "본인의 강점과 약점을 말씀해주세요",
            ].map((q, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl shadow-sm"
                style={{ border: "1px solid #F3F4F6", borderLeft: "3px solid #0D9488" }}
              >
                <span
                  className="text-xs font-black flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600 leading-snug">{q}</p>
              </div>
            ))}
          </div>
        )}

        {questions && uploadState === "done" && (
          <QuestionList questions={questions.questions} />
        )}
      </main>
    </div>
  );
}
