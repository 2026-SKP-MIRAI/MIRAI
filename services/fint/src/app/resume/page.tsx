"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { UploadForm } from "@/components/UploadForm";
import type { UploadState } from "@/lib/types";

interface CurrentResume {
  fileName: string;
  uploadedAt: string;
  hasResumeText: boolean;
}

export default function ResumePage() {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [error, setError] = useState<string>();
  const [currentResume, setCurrentResume] = useState<CurrentResume | null>(null);

  useEffect(() => {
    fetch("/api/resume")
      .then((res) => res.json())
      .then((data) => {
        if (data.resume) setCurrentResume(data.resume);
      })
      .catch((err) => {
        console.error("[resume page] 자소서 조회 실패:", err);
      });
  }, []);

  const handleUpload = async (file: File) => {
    setUploadState("processing");
    setError(undefined);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "업로드에 실패했습니다.");
        setUploadState("error");
        return;
      }

      const data = await res.json();
      setCurrentResume({
        fileName: data.fileName,
        uploadedAt: new Date().toISOString(),
        hasResumeText: !!data.resumeText,
      });
      setUploadState("done");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setUploadState("error");
    }
  };

  const handleReplace = () => {
    setUploadState("idle");
    setError(undefined);
  };

  return (
    <div className="w-full flex flex-col min-h-[100dvh] bg-gray-50">
      <TopBar title="자소서 기반 면접" showBack backHref="/" />

      <div
        className="relative px-5 py-12 text-white overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0D9488 0%, #0F766E 60%, #134E4A 100%)" }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }} />
        <p className="text-2xl font-extrabold leading-tight tracking-tight relative">✨ 자소서를 올려주시면</p>
        <p className="text-2xl font-extrabold leading-tight tracking-tight relative">맞춤 면접 질문을 드려요</p>
        <p className="text-sm text-white/70 mt-2 relative">AI가 자소서를 분석해 면접 시작 시 맞춤 질문을 제공합니다</p>
        {uploadState === "done" && (
          <span className="inline-block mt-3 px-3 py-1 bg-white/20 rounded-full text-xs font-semibold text-white backdrop-blur-sm relative">
            자소서 저장 완료
          </span>
        )}
      </div>

      <main className="flex-1 px-5 py-6 space-y-6">
        {currentResume && uploadState !== "done" && (
          <div className="flex items-center justify-between px-4 py-3.5 bg-white rounded-2xl shadow-sm" style={{ border: "1px solid #F3F4F6", borderLeft: "3px solid #0D9488" }}>
            <div>
              <p className="text-sm font-semibold text-gray-700">{currentResume.fileName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(currentResume.uploadedAt).toLocaleDateString("ko-KR")} 업로드됨
              </p>
            </div>
            <button
              onClick={handleReplace}
              className="text-xs font-medium text-[#0D9488] hover:underline"
            >
              교체하기
            </button>
          </div>
        )}

        <UploadForm onUpload={handleUpload} state={uploadState} error={error} />

        {uploadState === "idle" && !currentResume && (
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

        {uploadState === "done" && (
          <div className="px-4 py-4 bg-teal-50 rounded-2xl" style={{ border: "1px solid #99F6E4" }}>
            <p className="text-sm font-semibold text-[#0D9488]">자소서가 저장되었습니다 🎉</p>
            <p className="text-xs text-gray-500 mt-1">이제 면접 시작 시 자소서 기반 맞춤 질문이 제공됩니다.</p>
          </div>
        )}
      </main>
    </div>
  );
}
