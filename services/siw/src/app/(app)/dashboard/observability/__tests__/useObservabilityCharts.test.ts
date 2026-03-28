import { describe, it, expect } from "vitest"
import { featureName, featureDesc } from "../useObservabilityCharts"
import {
  FEATURE_META,
  FEATURE_MODE,
  MODE_GROUPS,
  MODE_LABEL,
} from "@/lib/observability/constants"

// ── constants.ts 검증 ──────────────────────────────────────────

describe("FEATURE_META", () => {
  const EXPECTED_TYPES = [
    "interview_start",
    "interview_answer",
    "interview_followup",
    "report_generate",
    "practice_feedback",
    "resume_parse",
    "resume_analyze",
    "resume_questions",
    "resume_feedback",
  ]

  it("정확히 9개 feature_type만 포함한다", () => {
    expect(Object.keys(FEATURE_META)).toHaveLength(9)
  })

  it.each(EXPECTED_TYPES)("%s 가 name과 desc를 갖는다", (ft) => {
    expect(FEATURE_META[ft]).toBeDefined()
    expect(FEATURE_META[ft].name).toBeTruthy()
    expect(FEATURE_META[ft].desc).toBeTruthy()
  })

  it("존재하지 않는 타입(interview_eval 등 구 타입)은 포함하지 않는다", () => {
    const REMOVED = ["interview_eval", "practice_start", "resume_upload", "report_summary"]
    for (const ft of REMOVED) {
      expect(FEATURE_META[ft]).toBeUndefined()
    }
  })
})

describe("MODE_GROUPS", () => {
  it("3개 그룹(interview/practice/resume)을 갖는다", () => {
    expect(Object.keys(MODE_GROUPS)).toEqual(["interview", "practice", "resume"])
  })

  it("interview 그룹에 report_generate가 포함된다 (event-logger.ts 기준)", () => {
    expect(MODE_GROUPS.interview).toContain("report_generate")
  })

  it("MODE_GROUPS의 모든 feature_type이 FEATURE_META에 존재한다", () => {
    for (const features of Object.values(MODE_GROUPS)) {
      for (const ft of features) {
        expect(FEATURE_META[ft]).toBeDefined()
      }
    }
  })

  it("MODE_GROUPS의 모든 feature_type이 FEATURE_MODE와 일치한다", () => {
    for (const [mode, features] of Object.entries(MODE_GROUPS)) {
      for (const ft of features) {
        expect(FEATURE_MODE[ft]).toBe(mode)
      }
    }
  })

  it("총 feature_type 수가 9개다 (중복 없음)", () => {
    const all = Object.values(MODE_GROUPS).flat()
    expect(all).toHaveLength(9)
    expect(new Set(all).size).toBe(9)
  })
})

describe("MODE_LABEL", () => {
  it("3개 모드 한국어 레이블을 갖는다", () => {
    expect(MODE_LABEL.interview).toBe("면접")
    expect(MODE_LABEL.practice).toBe("연습")
    expect(MODE_LABEL.resume).toBe("이력서")
  })
})

// ── useObservabilityCharts 헬퍼 함수 ──────────────────────────

describe("featureName", () => {
  it("알려진 feature_type은 한국어 이름을 반환한다", () => {
    expect(featureName("interview_start")).toBe("면접 시작")
    expect(featureName("resume_parse")).toBe("이력서 파싱")
    expect(featureName("practice_feedback")).toBe("연습 피드백")
  })

  it("알 수 없는 feature_type은 언더스코어를 공백으로 변환한다", () => {
    expect(featureName("unknown_feature")).toBe("unknown feature")
  })
})

describe("featureDesc", () => {
  it("알려진 feature_type은 설명 문자열을 반환한다", () => {
    const desc = featureDesc("report_generate")
    expect(desc).toBeTruthy()
    expect(typeof desc).toBe("string")
  })

  it("알 수 없는 feature_type은 fallback 설명을 반환한다", () => {
    const desc = featureDesc("nonexistent_type")
    expect(desc).toContain("nonexistent_type")
  })
})
