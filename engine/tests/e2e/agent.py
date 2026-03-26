"""CandidateAgent: 지원자 역할 LLM 답변 생성기.

app.* 임포트 금지 — engine 내부 서비스에 의존하지 않는 독립 테스트 유틸리티.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Callable

PROMPTS_DIR = Path(__file__).parent / "prompts"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "google/gemini-2.5-flash"
MAX_ANSWER_TOKENS = 512


class CandidateAgent:
    """면접 질문에 대해 지원자 역할로 LLM 답변을 생성한다."""

    def __init__(
        self,
        llm_fn: Callable[[str], str] | None = None,
        prompt_variant: str = "v1",
        prior_feedback: str = "",
    ) -> None:
        """
        Args:
            llm_fn: 프롬프트 문자열을 받아 답변 문자열을 반환하는 함수.
                    None이면 실제 OpenRouter API를 호출한다.
            prompt_variant: 사용할 프롬프트 버전 ("v1" 또는 "v2").
            prior_feedback: 이전 세션의 피드백 텍스트. 빈 문자열이면 무시된다.
        """
        self._llm_fn = llm_fn
        self.prompt_variant = prompt_variant
        self.prior_feedback = prior_feedback
        self._prompt_template: str | None = None
        self.prompt_log: list[str] = []  # 실제로 LLM에 전달된 프롬프트 기록

    def _load_prompt(self) -> str:
        if self._prompt_template is None:
            prompt_file = PROMPTS_DIR / f"candidate_{self.prompt_variant}.md"
            self._prompt_template = prompt_file.read_text(encoding="utf-8")
        return self._prompt_template

    def _call_real_llm(self, prompt: str) -> str:
        from openai import OpenAI  # noqa: PLC0415

        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.")
        model = os.getenv("CANDIDATE_MODEL", DEFAULT_MODEL)
        client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            max_tokens=MAX_ANSWER_TOKENS,
            messages=[{"role": "user", "content": prompt}],
            timeout=30.0,
        )
        content = response.choices[0].message.content
        return content or ""

    def generate_answer(
        self,
        question: str,
        resume_text: str,
        history: list[dict],
    ) -> str:
        """질문에 대한 지원자 답변을 생성한다.

        Args:
            question: 현재 면접 질문 텍스트.
            resume_text: 자소서 전문.
            history: 이전 Q&A 이력 ({"question": ..., "answer": ...} 리스트).

        Returns:
            생성된 답변 문자열 (최대 5000자 — InterviewAnswerRequest 제한).
        """
        template = self._load_prompt()

        history_text = ""
        if history:
            lines = []
            for item in history:
                q = item.get("question", "")
                a = item.get("answer", "")
                lines.append(f"Q: {q}\nA: {a}")
            history_text = "\n\n".join(lines)

        prompt = (
            template
            .replace("{resume_text}", resume_text[:8000])
            .replace("{history}", history_text)
            .replace("{question}", question)
            .replace("{prior_feedback}", self.prior_feedback)
        )

        self.prompt_log.append(prompt)

        if self._llm_fn is not None:
            answer = self._llm_fn(prompt)
        else:
            answer = self._call_real_llm(prompt)

        return answer[:5000]
