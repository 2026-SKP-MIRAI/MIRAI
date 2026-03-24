"""
engine/scripts/analyze_accepted_resumes.py

합격 자소서 1000개 분석 스크립트.
TextSignals 분포를 측정하여 keywords.py 및 루브릭 공식의 임계값 근거를 도출한다.

실행:
    cd engine
    python scripts/analyze_accepted_resumes.py --pdf-dir "경로/pdfs_latest"

출력:
    - 콘솔: 통계 요약 + 임계값 추천
    - scripts/analysis_output.json: 전체 결과 저장
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

import fitz  # PyMuPDF

# engine/app 경로 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.analyzers.keywords import (
    AGENCY_VERB_STEMS,
    ALTERNATIVE_WORDS,
    CAUSE_ANALYSIS_WORDS,
    SPECIFICITY_PATTERNS,
    STAR_KEYWORDS,
    VAGUE_WORDS,
)
from app.analyzers.text_analyzer import analyze


# ── PDF 텍스트 추출 ──────────────────────────────────────────────────────────

def extract_text(pdf_path: Path) -> str | None:
    """PDF에서 텍스트 추출. 실패 시 None 반환."""
    try:
        doc = fitz.open(str(pdf_path))
        parts = []
        with doc:
            for page in doc:
                parts.append(page.get_text())
        text = "\n".join(parts).strip()
        return text if text else None
    except Exception as e:
        print(f"  [SKIP] {pdf_path.name}: {e}", file=sys.stderr)
        return None


def split_paragraphs(text: str, min_len: int = 30) -> list[str]:
    """텍스트를 문단으로 분리. min_len 미만 문단 제외."""
    paragraphs = re.split(r"\n{2,}", text)
    return [p.strip() for p in paragraphs if len(p.strip()) >= min_len]


# ── 통계 계산 ────────────────────────────────────────────────────────────────

def percentile(data: list[float], p: int) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * p / 100)
    return round(sorted_data[min(idx, len(sorted_data) - 1)], 4)


def stats_summary(data: list[float], label: str) -> dict:
    if not data:
        return {}
    return {
        "label": label,
        "n": len(data),
        "mean": round(sum(data) / len(data), 4),
        "p10": percentile(data, 10),
        "p25": percentile(data, 25),
        "p50": percentile(data, 50),
        "p75": percentile(data, 75),
        "p90": percentile(data, 90),
        "min": round(min(data), 4),
        "max": round(max(data), 4),
    }


# ── 키워드 발굴 ──────────────────────────────────────────────────────────────

def tokenize(text: str) -> list[str]:
    """간단한 공백 토크나이저."""
    return re.findall(r"[가-힣a-zA-Z0-9]+", text)


def find_missing_agency_verbs(texts: list[str], top_n: int = 30) -> list[tuple[str, int]]:
    """합격 자소서에서 자주 나오는 행동 동사 중 현재 목록에 없는 것 발굴."""
    # 한국어 동사 어미 패턴
    verb_pattern = re.compile(r"[가-힣]{2,}(했|하여|하고|하였|하며|해서|한|함)")
    counter: Counter = Counter()
    for text in texts:
        for match in verb_pattern.finditer(text):
            verb = match.group()
            stem = re.sub(r"(했|하여|하고|하였|하며|해서|한|함)$", "하", verb)
            counter[stem] += 1

    # 기존 AGENCY_VERB_STEMS에 없는 것만 필터
    missing = [(v, c) for v, c in counter.most_common(200)
               if not any(v.startswith(s) for s in AGENCY_VERB_STEMS)]
    return missing[:top_n]


def find_missing_vague_words(texts: list[str], top_n: int = 20) -> list[tuple[str, int]]:
    """합격 자소서에서 자주 쓰이는 모호 표현 후보 발굴."""
    # 부사/형용사성 표현 패턴
    adverb_pattern = re.compile(r"[가-힣]{2,}(으로|하게|적으로|히|이)")
    counter: Counter = Counter()
    for text in texts:
        tokens = tokenize(text)
        for token in tokens:
            if token in VAGUE_WORDS:
                continue  # 이미 있는 것 제외
        for match in adverb_pattern.finditer(text):
            word = match.group()
            counter[word] += 1

    # 빈도 높은 것 중 vague 후보 (주관적 판단 필요 — 참고용)
    return counter.most_common(top_n)


def check_pattern_coverage(texts: list[str]) -> dict:
    """SPECIFICITY_PATTERNS 각 패턴의 매칭 문서 수 비율."""
    pattern_hits = [0] * len(SPECIFICITY_PATTERNS)
    for text in texts:
        for i, pat in enumerate(SPECIFICITY_PATTERNS):
            if pat.search(text):
                pattern_hits[i] += 1
    return {
        f"pattern_{i}": {
            "regex": SPECIFICITY_PATTERNS[i].pattern[:60],
            "hit_ratio": round(pattern_hits[i] / len(texts), 4),
        }
        for i in range(len(SPECIFICITY_PATTERNS))
    }


def check_star_keyword_coverage(texts: list[str]) -> dict:
    """STAR 요소별 키워드가 합격 자소서에서 등장하는 비율."""
    element_hits = {k: 0 for k in STAR_KEYWORDS}
    for text in texts:
        for element, keywords in STAR_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                element_hits[element] += 1
    return {
        k: {
            "hit_ratio": round(v / len(texts), 4),
            "count": v,
        }
        for k, v in element_hits.items()
    }


# ── 임계값 추천 ──────────────────────────────────────────────────────────────

def recommend_thresholds(para_stats: dict, resume_stats: dict) -> dict:
    """
    현재 임계값과 데이터 기반 추천값 비교.

    기준:
    - has_content: 합격 문단 길이 5th percentile
    - vague_ratio: 합격 문단 vague_ratio 75th percentile (이보다 높으면 이상)
    - star_score CLARIFY 기준: 합격 문단 star_score 25th percentile
    - agency_verb CLARIFY 기준: 합격 문단 agency_verb_count 10th percentile
    """
    para_lengths = para_stats.get("answer_length", {})
    para_vague = para_stats.get("vague_ratio", {})
    para_star = para_stats.get("star_score", {})
    para_agency = para_stats.get("agency_verb_count", {})

    return {
        "has_content_min_chars": {
            "current": 20,
            "recommended": para_lengths.get("p10", "데이터 부족"),
            "basis": "합격 문단 길이 10th percentile",
        },
        "vague_ratio_challenge_threshold": {
            "current": 0.15,
            "recommended": para_vague.get("p75", "데이터 부족"),
            "basis": "합격 문단 vague_ratio 75th percentile",
        },
        "star_score_clarify_threshold": {
            "current": 0.4,
            "recommended": para_star.get("p25", "데이터 부족"),
            "basis": "합격 문단 star_score 25th percentile",
        },
        "agency_verb_clarify_threshold": {
            "current": 0,
            "recommended": para_agency.get("p10", "데이터 부족"),
            "basis": "합격 문단 agency_verb_count 10th percentile",
        },
    }


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="합격 자소서 텍스트 분석")
    parser.add_argument(
        "--pdf-dir",
        default=r"D:\project\T아카데미\python\mirai\포폴,이력서자료\pdfs_latest\pdfs_latest",
        help="PDF 디렉토리 경로",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).parent / "analysis_output.json"),
        help="결과 JSON 저장 경로",
    )
    parser.add_argument("--limit", type=int, default=0, help="처리할 PDF 수 제한 (0=전체)")
    args = parser.parse_args()

    pdf_dir = Path(args.pdf_dir)
    pdf_files = sorted(pdf_dir.glob("*.pdf"))
    if args.limit:
        pdf_files = pdf_files[:args.limit]

    print(f"[PDF] 디렉토리: {pdf_dir}")
    print(f"[PDF] 처리 대상: {len(pdf_files)}개\n")

    # ── 1. 텍스트 추출 ─────────────────────────────────────────────────────
    print("[1] 텍스트 추출 중...")
    resume_texts: list[str] = []
    failed = 0
    for i, pdf_path in enumerate(pdf_files, 1):
        text = extract_text(pdf_path)
        if text:
            resume_texts.append(text)
        else:
            failed += 1
        if i % 100 == 0:
            print(f"   {i}/{len(pdf_files)} 처리 완료...")

    print(f"   성공: {len(resume_texts)}개 / 실패: {failed}개\n")

    # ── 2. 문단 분리 + TextSignals 계산 ────────────────────────────────────
    print("[2] TextSignals 계산 중...")
    all_paragraphs: list[str] = []
    for text in resume_texts:
        all_paragraphs.extend(split_paragraphs(text, min_len=30))

    print(f"   전체 문단 수: {len(all_paragraphs)}개")

    signals_list = []
    for i, para in enumerate(all_paragraphs):
        signals_list.append(analyze(para))
        if i % 5000 == 0 and i > 0:
            print(f"   {i}/{len(all_paragraphs)} 분석 완료...")

    # has_content=True 문단만 필터 (빈 문단 제외)
    content_signals = [s for s in signals_list if s.has_content]
    print(f"   has_content=True 문단: {len(content_signals)}개\n")

    # ── 3. TextSignals 분포 통계 ────────────────────────────────────────────
    print("[3] 통계 계산 중...")

    fields = [
        ("specificity_score", "수치 구체성 (0~1)"),
        ("achievement_score", "성과+수치 조합 (0~1)"),
        ("star_score", "STAR 완성도 (0~1)"),
        ("vague_ratio", "모호 표현 비율 (낮을수록 좋음)"),
        ("agency_verb_count", "주도성 동사 횟수"),
        ("cause_analysis_count", "원인 분석 표현 횟수"),
        ("alternative_count", "대안 고려 표현 횟수"),
        ("answer_length", "문단 길이 (글자 수)"),
    ]

    para_stats = {}
    for field, label in fields:
        values = [float(getattr(s, field)) for s in content_signals]
        para_stats[field] = stats_summary(values, label)

    # 전체 자소서 단위 통계 (자소서 1개를 하나의 답변으로 취급)
    resume_signals = [analyze(t) for t in resume_texts]
    resume_content = [s for s in resume_signals if s.has_content]
    resume_stats = {}
    for field, label in fields:
        values = [float(getattr(s, field)) for s in resume_content]
        resume_stats[field] = stats_summary(values, f"[자소서 전체] {label}")

    # ── 4. 키워드 분석 ─────────────────────────────────────────────────────
    print("[4] 키워드 분석 중...")
    missing_verbs = find_missing_agency_verbs(resume_texts)
    missing_vague = find_missing_vague_words(resume_texts)
    pattern_coverage = check_pattern_coverage(resume_texts)
    star_coverage = check_star_keyword_coverage(resume_texts)

    # ── 5. 임계값 추천 ─────────────────────────────────────────────────────
    thresholds = recommend_thresholds(para_stats, resume_stats)

    # ── 6. 결과 출력 ───────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("[결과] TextSignals 분포 (합격 자소서 문단 기준)")
    print("="*60)
    header = f"{'지표':<25} {'mean':>6} {'p25':>6} {'p50':>6} {'p75':>6} {'p90':>6}"
    print(header)
    print("-"*60)
    for field, label in fields:
        s = para_stats.get(field, {})
        if s:
            print(f"{label:<25} {s['mean']:>6} {s['p25']:>6} {s['p50']:>6} {s['p75']:>6} {s['p90']:>6}")

    print("\n" + "="*60)
    print("[임계값] 추천 (현재값 -> 데이터 기반 추천)")
    print("="*60)
    for key, rec in thresholds.items():
        curr = rec['current']
        sugg = rec['recommended']
        basis = rec['basis']
        changed = "[변경 권장]" if str(curr) != str(sugg) else "[유지]"
        print(f"{key}")
        print(f"  현재: {curr}  ->  추천: {sugg}  ({changed})")
        print(f"  근거: {basis}")

    print("\n" + "="*60)
    print("[STAR] 키워드 등장 비율 (합격 자소서)")
    print("="*60)
    for elem, data in star_coverage.items():
        bar = "#" * int(data["hit_ratio"] * 20)
        print(f"  {elem:<12} {bar:<20} {data['hit_ratio']*100:.1f}%  ({data['count']}개)")

    print("\n" + "="*60)
    print("[SPECIFICITY] PATTERNS 매칭률")
    print("="*60)
    for pat_key, data in pattern_coverage.items():
        bar = "#" * int(data["hit_ratio"] * 20)
        print(f"  {pat_key}  {bar:<20} {data['hit_ratio']*100:.1f}%")
        print(f"    패턴: {data['regex']}")

    print("\n" + "="*60)
    print(f"[동사] 추가 발굴 행동 동사 TOP {len(missing_verbs)} (keywords.py 보완 후보)")
    print("="*60)
    for verb, count in missing_verbs[:20]:
        print(f"  {verb:<15} {count}회")

    # ── 7. JSON 저장 ───────────────────────────────────────────────────────
    output = {
        "meta": {
            "total_pdfs": len(pdf_files),
            "success": len(resume_texts),
            "failed": failed,
            "total_paragraphs": len(all_paragraphs),
            "content_paragraphs": len(content_signals),
        },
        "paragraph_stats": para_stats,
        "resume_stats": resume_stats,
        "thresholds": thresholds,
        "star_coverage": star_coverage,
        "pattern_coverage": pattern_coverage,
        "missing_agency_verbs": missing_verbs,
        "missing_vague_candidates": missing_vague,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n[완료] 결과 저장: {args.output}")


if __name__ == "__main__":
    main()
