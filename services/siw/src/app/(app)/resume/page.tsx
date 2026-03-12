"use client";
import React, { useState } from "react";
import UploadForm from "@/components/UploadForm";
import QuestionList from "@/components/QuestionList";
import { QuestionsResponse } from "@/lib/types";

export default function ResumePage() {
  const [result, setResult] = useState<QuestionsResponse | null>(null);

  return (
    <div className="min-h-screen">
      <main className="max-w-2xl mx-auto px-4 py-10">
        {result
          ? <QuestionList data={result} onReset={() => setResult(null)} />
          : <UploadForm onComplete={setResult} />
        }
      </main>
    </div>
  );
}
