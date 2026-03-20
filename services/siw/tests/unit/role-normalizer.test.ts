import { describe, it, expect } from "vitest"
import { normalizeRole } from "@/lib/role-normalizer"

describe("normalizeRole", () => {
  it("react → 프론트엔드 개발자", () => {
    expect(normalizeRole("react")).toBe("프론트엔드 개발자")
  })

  it("백엔드 → 백엔드 개발자", () => {
    expect(normalizeRole("백엔드")).toBe("백엔드 개발자")
  })

  it("데이터 엔지니어 → 데이터 엔지니어", () => {
    expect(normalizeRole("데이터 엔지니어")).toBe("데이터 엔지니어")
  })

  it("빈 문자열 → 소프트웨어 개발자 (기본값)", () => {
    expect(normalizeRole("")).toBe("소프트웨어 개발자")
  })

  it("null → 소프트웨어 개발자 (기본값)", () => {
    expect(normalizeRole(null)).toBe("소프트웨어 개발자")
  })

  it("undefined → 소프트웨어 개발자 (기본값)", () => {
    expect(normalizeRole(undefined)).toBe("소프트웨어 개발자")
  })

  it("매칭 없는 직무 → 원문 반환", () => {
    expect(normalizeRole("알 수 없는 직무")).toBe("알 수 없는 직무")
  })

  it("50자 초과 입력 → 50자로 잘림", () => {
    const long = "a".repeat(60)
    expect(normalizeRole(long)).toBe("a".repeat(50))
  })
})
