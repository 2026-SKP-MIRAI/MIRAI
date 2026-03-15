"use client";
import React, { useState, useRef } from "react";
import { QuestionsResponse, UploadState } from "@/lib/types";
import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";

interface Props {
  onComplete: (data: QuestionsResponse) => void;
  hideTitle?: boolean;
}

export default function UploadForm({ onComplete, hideTitle }: Props) {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setState("ready"); }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/resume/questions", { method: "POST", body: formData });
      if (!resp.ok) {
        const body = await resp.json();
        setError(body.message ?? ENGINE_ERROR_MESSAGES.llmError);
        setState("error");
        return;
      }
      const data = await resp.json();
      setState("done");
      onComplete(data);
    } catch {
      setError(ENGINE_ERROR_MESSAGES.llmError);
      setState("error");
    }
  };

  const handleRetry = () => {
    setError(""); setState("idle"); setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const dropzoneClass = file
    ? "border-2 border-dashed border-indigo-400 rounded-xl bg-indigo-50 p-10 text-center cursor-pointer"
    : "border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 p-10 text-center cursor-pointer hover:border-indigo-400 transition-colors";

  return (
    <div className="glass-card rounded-2xl p-8 shadow-sm">
      {!hideTitle && <h2 className="text-2xl font-bold gradient-text mb-2">자소서 분석</h2>}
      <p className="text-sm text-[#4B5563] mb-6">PDF 자소서를 업로드하면 맞춤 면접 질문을 생성해드립니다</p>

      <div className={dropzoneClass} onClick={() => inputRef.current?.click()}>
        <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
        {file ? (
          <>
            <span className="tag tag-purple">{file.name}</span>
            <p className="mt-2 text-sm text-[#4B5563]">파일이 선택됐습니다</p>
          </>
        ) : (
          <>
            <p className="text-[#9CA3AF]">PDF 파일을 클릭해서 선택하세요</p>
            <p className="text-xs text-[#9CA3AF] mt-1">최대 5MB · 10페이지 이내</p>
          </>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-[#EF4444]">{error}</p>}

      <div className="mt-6 flex gap-3">
        {state === "error" && (
          <button onClick={handleRetry} className="btn-outline rounded-xl px-5 py-3 flex-1">다시 시도</button>
        )}
        <button
          onClick={handleSubmit}
          disabled={state === "uploading" || !file}
          aria-label="이력서 분석"
          className="btn-primary rounded-xl px-5 py-3 flex-1 flex items-center justify-center gap-2"
        >
          {state === "uploading" ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />자소서를 분석하고 있습니다...</>
          ) : "이력서 분석"}
        </button>
      </div>
    </div>
  );
}
