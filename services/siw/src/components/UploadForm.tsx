"use client";
import React, { useState, useRef } from "react";
import { QuestionsResponse, UploadState } from "@/lib/types";
import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";

interface Props {
  onComplete: (data: QuestionsResponse) => void;
}

export default function UploadForm({ onComplete }: Props) {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setState("ready");
    }
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
    setError("");
    setState("idle");
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileChange} />
      {error && <p role="alert">{error}</p>}
      {state === "error" && (
        <button onClick={handleRetry}>다시 시도</button>
      )}
      <button
        onClick={handleSubmit}
        disabled={state === "uploading"}
      >
        질문 생성
      </button>
    </div>
  );
}
