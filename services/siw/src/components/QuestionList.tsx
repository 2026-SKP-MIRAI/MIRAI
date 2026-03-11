"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionsResponse, Category } from "@/lib/types";

interface Props {
  data: QuestionsResponse;
  onReset: () => void;
}

const CATEGORIES: Category[] = ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"];

export default function QuestionList({ data, onReset }: Props) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = data.questions.filter(q => q.category === cat);
    return acc;
  }, {} as Record<Category, typeof data.questions>);

  async function handleStartInterview() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: data.resumeId,
          personas: ["hr", "tech_lead", "executive"],
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message); return; }
      sessionStorage.setItem(`interview-first-${json.sessionId}`, JSON.stringify(json.firstQuestion));
      router.push(`/interview/${json.sessionId}`);
    } catch {
      setError("면접 시작에 실패했습니다.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      {CATEGORIES.map(cat => (
        <section key={cat}>
          <h2>{cat}</h2>
          <ul>
            {grouped[cat].map((q, i) => (
              <li key={i} data-testid="question-item">{q.question}</li>
            ))}
          </ul>
        </section>
      ))}
      <button
        data-testid="start-interview"
        onClick={handleStartInterview}
        disabled={starting}
      >
        {starting ? "시작 중..." : "면접 시작하기"}
      </button>
      {error && <p>{error}</p>}
      <button onClick={onReset}>다시 하기</button>
    </div>
  );
}
