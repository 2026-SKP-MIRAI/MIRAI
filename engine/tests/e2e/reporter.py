"""ResultReporter: SessionResult JSON 저장 + 통계 계산."""
from __future__ import annotations

import json
import statistics
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class SessionResult:
    run_id: str
    timestamp: str       # ISO8601
    variant: str         # "v1" | "v2"
    scores: dict         # 8축 점수 (축 이름 → score int | None)
    total_score: int
    turn_count: int
    history: list[dict]  # 전체 Q&A 이력
    duration_sec: float


AXIS_KEYS = [
    "communication",
    "problemSolving",
    "logicalThinking",
    "jobExpertise",
    "cultureFit",
    "leadership",
    "creativity",
    "sincerity",
]


def save_result(result: SessionResult, results_dir: Path) -> Path:
    """결과를 {timestamp}_{variant}.json 으로 저장한다."""
    results_dir.mkdir(parents=True, exist_ok=True)
    safe_ts = result.timestamp.replace(":", "-").replace(".", "-")
    filename = f"{safe_ts}_{result.variant}.json"
    path = results_dir / filename
    path.write_text(json.dumps(asdict(result), ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def compute_stats(results: list[SessionResult]) -> dict:
    """복수 실행 결과의 축별 통계를 계산한다.

    Returns:
        {
            "axes": {
                "<axis>": {"mean": float, "std": float, "values": list[int|None]}
            },
            "total_score": {"mean": float, "std": float, "values": list[int]},
            "delta": {
                "<axis>": int | None,   # last - first (None이면 비교 불가)
                "total_score": int,
            },
        }
    """
    if not results:
        return {}

    axes_stats: dict[str, dict] = {}
    for axis in AXIS_KEYS:
        values = [r.scores.get(axis) for r in results]
        numeric = [v for v in values if v is not None]
        mean = statistics.mean(numeric) if numeric else 0.0
        std = statistics.stdev(numeric) if len(numeric) >= 2 else 0.0
        axes_stats[axis] = {"mean": round(mean, 2), "std": round(std, 2), "values": values}

    total_values = [r.total_score for r in results]
    total_stats = {
        "mean": round(statistics.mean(total_values), 2),
        "std": round(statistics.stdev(total_values), 2) if len(total_values) >= 2 else 0.0,
        "values": total_values,
    }

    delta: dict[str, int | None] = {}
    if len(results) >= 2:
        first, last = results[0], results[-1]
        for axis in AXIS_KEYS:
            first_score = first.scores.get(axis)
            last_score = last.scores.get(axis)
            delta[axis] = (last_score - first_score) if (first_score is not None and last_score is not None) else None
        delta["total_score"] = last.total_score - first.total_score
    else:
        for axis in AXIS_KEYS:
            delta[axis] = None
        delta["total_score"] = None

    return {"axes": axes_stats, "total_score": total_stats, "delta": delta}


def print_report(stats: dict) -> None:
    """통계 결과를 콘솔에 출력한다."""
    if not stats:
        print("결과 없음")
        return

    print("\n" + "=" * 60)
    print("E2E 에이전트 테스트 결과 리포트")
    print("=" * 60)

    total = stats.get("total_score", {})
    mean_val = total.get("mean")
    std_val = total.get("std")
    mean_str = f"{mean_val:.1f}" if mean_val is not None else "-"
    std_str = f"{std_val:.1f}" if std_val is not None else "-"
    print(f"\n총점  평균: {mean_str}  표준편차: {std_str}")
    delta_total = stats.get("delta", {}).get("total_score")
    if delta_total is not None:
        sign = "+" if delta_total >= 0 else ""
        print(f"      delta (첫 번째 → 마지막): {sign}{delta_total}")

    print("\n축별 상세:")
    print(f"{'축':<20} {'평균':>6} {'표준편차':>8} {'delta':>7}")
    print("-" * 45)
    axes = stats.get("axes", {})
    deltas = stats.get("delta", {})
    for axis in AXIS_KEYS:
        ax = axes.get(axis, {})
        mean = ax.get("mean", "-")
        std = ax.get("std", "-")
        d = deltas.get(axis)
        d_str = f"+{d}" if (d is not None and d >= 0) else (str(d) if d is not None else "N/A")
        print(f"{axis:<20} {mean:>6} {std:>8} {d_str:>7}")

    print("=" * 60 + "\n")
