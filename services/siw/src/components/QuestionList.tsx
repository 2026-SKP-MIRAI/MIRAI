"use client";
import React from "react";
import { QuestionsResponse, Category } from "@/lib/types";

interface Props {
  data: QuestionsResponse;
  onReset: () => void;
}

const CATEGORIES: Category[] = ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"];

export default function QuestionList({ data, onReset }: Props) {
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = data.questions.filter(q => q.category === cat);
    return acc;
  }, {} as Record<Category, typeof data.questions>);

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
      <button onClick={onReset}>다시 하기</button>
    </div>
  );
}
