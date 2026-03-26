"""SessionRunner: 단일 면접 세션의 전체 HTTP 흐름을 자동 실행한다."""
from __future__ import annotations

import time
import uuid
import warnings
from datetime import datetime, timezone
from pathlib import Path

import httpx

from tests.e2e.agent import CandidateAgent
from tests.e2e.reporter import SessionResult

RESULTS_DIR = Path(__file__).parent / "results"
DEFAULT_PERSONAS = ["hr", "tech_lead", "executive"]


def format_feedback(feedback: list[dict]) -> str:
    """axisFeedbacks 목록을 에이전트 프롬프트용 텍스트로 변환한다."""
    if not feedback:
        return ""
    lines = []
    for item in feedback:
        label = item.get("axisLabel", item.get("axis", ""))
        score = item.get("score")
        fb_type = item.get("type", "")
        fb_text = item.get("feedback", "")
        score_str = f"{score}점" if score is not None else "미평가"
        lines.append(f"- {label} ({score_str}, {fb_type}): {fb_text}")
    return "\n".join(lines)


MAX_TURNS = 15          # runner 측 안전 리밋 (엔진은 내부적으로 10턴 제한)
MIN_HISTORY_FOR_REPORT = 5
REQUEST_TIMEOUT = 120.0  # 엔진 LLM 응답 최대 대기 (report는 최대 60s+)


class SessionRunError(Exception):
    """세션 실행 중 복구 불가능한 오류."""


def run_session(
    base_url: str,
    pdf_bytes: bytes,
    agent: CandidateAgent,
    personas: list[str] | None = None,
) -> SessionResult:
    """단일 면접 세션을 처음부터 끝까지 실행하고 SessionResult를 반환한다.

    Args:
        base_url: 엔진 서버 주소 (예: "http://localhost:8000").
        pdf_bytes: 자소서 PDF 바이트.
        agent: 지원자 답변을 생성할 CandidateAgent.
        personas: 면접관 페르소나 리스트. None이면 기본값 사용.

    Returns:
        SessionResult (8축 점수, 이력, 소요 시간 포함).

    Raises:
        SessionRunError: 서버 미구동, API 오류 등 복구 불가능한 오류.
    """
    if personas is None:
        personas = DEFAULT_PERSONAS

    start_time = time.monotonic()
    run_id = str(uuid.uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()

    with httpx.Client(base_url=base_url, timeout=REQUEST_TIMEOUT) as client:
        # ── Step 1: PDF 파싱 ──────────────────────────────────────────────
        try:
            parse_resp = client.post(
                "/api/resume/parse",
                files={"file": ("resume.pdf", pdf_bytes, "application/pdf")},
            )
        except httpx.ConnectError as e:
            raise SessionRunError(
                f"엔진 서버에 연결할 수 없습니다. ENGINE_BASE_URL({base_url})에 서버가 구동 중인지 확인하세요."
            ) from e

        if parse_resp.status_code != 200:
            raise SessionRunError(f"/api/resume/parse 실패: {parse_resp.status_code} {parse_resp.text}")

        resume_text: str = parse_resp.json()["resumeText"]

        # ── Step 2: 면접 시작 ─────────────────────────────────────────────
        start_resp = client.post(
            "/api/interview/start",
            json={"resumeText": resume_text, "personas": personas, "mode": "panel"},
        )
        if start_resp.status_code != 200:
            raise SessionRunError(f"/api/interview/start 실패: {start_resp.status_code} {start_resp.text}")

        start_data = start_resp.json()
        first_q = start_data["firstQuestion"]
        current_q: str = first_q["question"]
        current_p: str = first_q["persona"]
        current_pl: str = first_q["personaLabel"]
        queue: list[dict] = start_data["questionsQueue"]
        history: list[dict] = []

        # ── Step 3: 답변 루프 ─────────────────────────────────────────────
        for turn in range(MAX_TURNS):
            answer = agent.generate_answer(current_q, resume_text, history)
            answer = answer[:5000]  # InterviewAnswerRequest.currentAnswer max_length

            answer_resp = client.post(
                "/api/interview/answer",
                json={
                    "resumeText": resume_text,
                    "history": history,
                    "questionsQueue": queue,
                    "currentQuestion": current_q,
                    "currentPersona": current_p,
                    "currentAnswer": answer,
                },
            )
            if answer_resp.status_code != 200:
                raise SessionRunError(
                    f"/api/interview/answer 실패 (턴 {turn + 1}): "
                    f"{answer_resp.status_code} {answer_resp.text}"
                )

            # history는 엔진이 반환하지 않으므로 runner가 직접 누적
            history.append({
                "persona": current_p,
                "personaLabel": current_pl,
                "question": current_q,
                "answer": answer,
            })

            answer_data = answer_resp.json()
            if answer_data["sessionComplete"]:
                break

            next_q = answer_data["nextQuestion"]
            current_q = next_q["question"]
            current_p = next_q["persona"]
            current_pl = next_q["personaLabel"]
            queue = answer_data["updatedQueue"]
        else:
            # MAX_TURNS 초과 — 강제 종료
            warnings.warn(
                f"MAX_TURNS({MAX_TURNS}) 초과로 세션을 강제 종료합니다. "
                "엔진의 sessionComplete가 반환되지 않는지 확인하세요.",
                RuntimeWarning,
                stacklevel=2,
            )

        # ── Step 4: 최소 턴 검증 ──────────────────────────────────────────
        if len(history) < MIN_HISTORY_FOR_REPORT:
            raise SessionRunError(
                f"history가 {len(history)}턴으로 report 최소 요건({MIN_HISTORY_FOR_REPORT}턴)에 미달합니다."
            )

        # ── Step 5: 리포트 생성 ───────────────────────────────────────────
        report_resp = client.post(
            "/api/report/generate",
            json={"resumeText": resume_text, "history": history},
        )
        if report_resp.status_code != 200:
            raise SessionRunError(
                f"/api/report/generate 실패: {report_resp.status_code} {report_resp.text}"
            )

        report_data = report_resp.json()

        # AxisScores는 flat dict — {"communication": 85, ...}
        scores: dict[str, int | None] = dict(report_data.get("scores", {}))
        axis_feedbacks: list[dict] = report_data.get("axisFeedbacks", [])
        summary: str = report_data.get("summary", "")

        duration_sec = round(time.monotonic() - start_time, 2)

        return SessionResult(
            run_id=run_id,
            timestamp=timestamp,
            variant=agent.prompt_variant,
            scores=scores,
            total_score=report_data.get("totalScore", 0),
            turn_count=len(history),
            history=history,
            duration_sec=duration_sec,
            feedback=axis_feedbacks,
            summary=summary,
        )
