"use client";

import { useRef, useState, DragEvent } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadState, QuestionsResponse } from "@/lib/types";

// 외부에서 상태를 주입하는 레거시 인터페이스
interface UploadFormControlledProps {
  onUpload: (file: File) => void;
  state: UploadState;
  error?: string;
  onComplete?: never;
}

// 테스트 계약: onComplete만 받고 내부 상태 관리
interface UploadFormSelfContainedProps {
  onComplete: (data: QuestionsResponse) => void;
  onUpload?: never;
  state?: never;
  error?: never;
}

type UploadFormProps = UploadFormControlledProps | UploadFormSelfContainedProps;

function UploadForm(props: UploadFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 자체 상태 관리 (self-contained 모드)
  const [internalState, setInternalState] = useState<UploadState>("idle");
  const [internalError, setInternalError] = useState<string | undefined>(undefined);

  const isSelfContained = "onComplete" in props && props.onComplete !== undefined;
  const state: UploadState = isSelfContained ? internalState : (props.state ?? "idle");
  const error = isSelfContained ? internalError : props.error;

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      alert("PDF 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("10MB 이하 파일만 업로드할 수 있어요.");
      return;
    }
    setSelectedFile(file);
    if (!isSelfContained) {
      props.onUpload(file);
    }
    // self-contained: 파일 선택만 하고 버튼 클릭으로 submit
  };

  const handleSubmit = async () => {
    if (!isSelfContained || !selectedFile) return;
    setInternalState("uploading");
    setInternalError(undefined);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/resume/questions", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "업로드 실패");
      }
      const data: QuestionsResponse = await res.json();
      setInternalState("done");
      props.onComplete(data);
    } catch (e) {
      setInternalState("error");
      setInternalError(e instanceof Error ? e.message : "오류가 발생했어요");
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const isUploading = state === "uploading" || state === "processing";
  const isIdle = state === "idle" && !selectedFile;

  return (
    <div className="flex flex-col gap-4">
      {/* 업로드 영역 */}
      <div
        className={cn(
          "group relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200",
          isDragging
            ? "border-[#0D9488] bg-teal-50 shadow-[0_0_0_4px_rgba(13,148,136,0.15)]"
            : state === "done"
              ? "border-[#0D9488] bg-teal-50/50"
              : state === "error"
                ? "border-red-400 bg-red-50"
                : "border-teal-200 bg-teal-50/40 hover:border-teal-400 hover:bg-teal-50/70 hover:shadow-[0_0_0_3px_rgba(13,148,136,0.08)]"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {/* 아이콘 영역 */}
        {state === "done" ? (
          <CheckCircle className="w-11 h-11 text-[#0D9488]" />
        ) : state === "error" ? (
          <AlertCircle className="w-11 h-11 text-red-500" />
        ) : isUploading ? (
          <div className="w-11 h-11 rounded-full border-2 border-[#0D9488] border-t-transparent animate-spin" />
        ) : selectedFile ? (
          <FileText className="w-11 h-11 text-[#0D9488]" />
        ) : (
          <Upload className={cn("w-11 h-11 text-gray-400 transition-transform", isIdle && "animate-bounce")} />
        )}

        {/* 텍스트 영역 */}
        <div className="text-center flex flex-col items-center gap-1">
          {state === "done" ? (
            <p className="text-sm font-semibold text-[#0D9488]">업로드 완료!</p>
          ) : state === "error" ? (
            <>
              <p className="text-sm font-semibold text-red-500">업로드 실패</p>
              {error && <p className="text-xs text-gray-400 mt-1">{error}</p>}
            </>
          ) : isUploading ? (
            <p className="text-sm text-gray-500">
              {state === "uploading" ? "업로드 중..." : "맞춤 질문 생성 중..."}
            </p>
          ) : selectedFile ? (
            /* 파일 선택됨: pill badge 스타일 */
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-sm font-medium text-[#0D9488]">
              <FileText className="w-3.5 h-3.5" />
              {selectedFile.name}
            </span>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700">
                자소서 PDF를 업로드하세요
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                PDF · 최대 10MB · 파일 앱에서 선택 가능
              </p>
            </>
          )}
        </div>

        {selectedFile && state === "idle" && (
          <button
            onClick={e => {
              e.stopPropagation();
              setSelectedFile(null);
            }}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* self-contained 모드: 질문 생성 버튼 */}
      {isSelfContained && (
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || isUploading || state === "done"}
          className="w-full"
        >
          질문 생성
        </Button>
      )}

      {/* 에러 재시도 버튼 */}
      {state === "error" && (
        <Button
          variant="outline"
          onClick={() => {
            if (isSelfContained) setInternalState("idle");
            inputRef.current?.click();
          }}
          className="w-full"
        >
          다시 시도하기
        </Button>
      )}
    </div>
  );
}

export { UploadForm };
export default UploadForm;
