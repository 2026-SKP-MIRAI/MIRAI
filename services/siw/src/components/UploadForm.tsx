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
  const [resumeText, setResumeText] = useState<string>("")
  const [targetRole, setTargetRole] = useState<string>("")
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setState("ready"); }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/resumes/analyze", { method: "POST", body: formData });
      if (!resp.ok) {
        const body = await resp.json();
        setError(body.message ?? ENGINE_ERROR_MESSAGES.llmError);
        setState("error");
        return;
      }
      const data = await resp.json();
      setResumeText(data.resumeText);
      setTargetRole(data.targetRole === "미지정" ? "" : data.targetRole);
      setState("confirming");
    } catch {
      setError(ENGINE_ERROR_MESSAGES.llmError);
      setState("error");
    }
  };

  const handleConfirmSubmit = async () => {
    if (!file) return;
    setState("submitting");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetRole", targetRole);
      formData.append("resumeText", resumeText);
      const resp = await fetch("/api/resumes", { method: "POST", body: formData });
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
    setError(""); setState("idle"); setFile(null); setResumeText(""); setTargetRole("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const dropzoneClass = file
    ? "border-2 border-dashed border-indigo-400 rounded-xl bg-indigo-50 p-10 text-center cursor-pointer"
    : "border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 p-10 text-center cursor-pointer hover:border-indigo-400 transition-colors";

  return (
    <div className="glass-card rounded-2xl p-8 shadow-sm">
      {!hideTitle && <h2 className="text-2xl font-bold gradient-text mb-2">자소서 분석</h2>}

      {(state === "confirming" || state === "submitting") && (
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-6 text-center">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-3">지원 직무 확인</p>
          <div className="inline-flex items-center gap-2 bg-white rounded-xl px-5 py-2.5 shadow-sm border border-indigo-100 focus-within:ring-2 focus-within:ring-indigo-300 transition-all">
            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="직무 미지정"
              disabled={state === "submitting"}
              className="text-base font-semibold text-[#1F2937] bg-transparent border-none outline-none disabled:opacity-60"
              style={{ width: `${Math.max((targetRole || "직무 미지정").length + 4, 10)}ch` }}
            />
          </div>
          <p className="text-xs text-[#9CA3AF] mt-3">AI가 추출한 직무 · 다르다면 수정해주세요</p>
        </div>
      )}

      {!["confirming", "submitting", "done"].includes(state) && (
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
      )}

      {error && <p role="alert" className="mt-3 text-sm text-[#EF4444]">{error}</p>}

      <div className="mt-6 flex gap-3">
        {state === "error" && (
          <button onClick={handleRetry} className="btn-outline rounded-xl px-5 py-3 flex-1">다시 시도</button>
        )}

        {(state === "confirming" || state === "submitting") && (
          <button
            onClick={handleConfirmSubmit}
            disabled={state === "submitting"}
            className="btn-primary rounded-xl px-5 py-3 flex-1 flex items-center justify-center gap-2"
          >
            {state === "submitting"
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />이력서를 분석하고 있습니다...</>
              : "이 직무로 면접 준비하기"
            }
          </button>
        )}

        {state !== "confirming" && state !== "submitting" && state !== "done" && state !== "error" && (
          <button
            onClick={handleAnalyze}
            disabled={state === "uploading" || !file}
            aria-label="이력서 분석"
            className="btn-primary rounded-xl px-5 py-3 flex-1 flex items-center justify-center gap-2"
          >
            {state === "uploading"
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />자소서를 분석하고 있습니다...</>
              : "이력서 분석"
            }
          </button>
        )}
      </div>
    </div>
  );
}
