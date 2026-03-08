"use client";
import React, { useState } from "react";
import UploadForm from "@/components/UploadForm";
import QuestionList from "@/components/QuestionList";
import { QuestionsResponse } from "@/lib/types";

export default function ResumePage() {
  const [result, setResult] = useState<QuestionsResponse | null>(null);

  if (result) {
    return <QuestionList data={result} onReset={() => setResult(null)} />;
  }
  return <UploadForm onComplete={setResult} />;
}
