# [#262] feat: resumes 페이지 이력서 업로드 영역 상단으로 이동 — 구현 계획

> 작성: 2026-03-26

---

## 배경

이력서 목록 하단에 업로드 버튼이 있어 이력서가 많을수록 스크롤을 내려야 업로드할 수 있었다. 주요 액션인 업로드를 목록 상단에 배치하여 즉시 접근 가능하게 한다.

## 완료 기준

- [x] 이력서 목록 상단에 업로드 영역(dashed border 버튼 또는 UploadForm)이 표시된다
- [x] 이력서가 없을 때는 기존 빈 상태 UI만 표시된다
- [x] 업로드 완료 후 새 이력서 상세 페이지로 이동한다

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/resumes/page.tsx` | 업로드 영역 상단 이동, 하단 카드 제거 |
| `services/siw/src/app/(app)/resumes/.ai.md` | 업로드 위치 변경 반영 |

### 구현 상세

**변경 전**: 이력서 목록 `map` 블록 마지막에 `motion.div` 래핑 업로드 카드

**변경 후**: `resumes.length > 0` 조건 블록 상단에 업로드 영역 추가

```tsx
{/* 업로드 영역 (상단) — resumes.length > 0 일 때만 */}
{!loading && resumes.length > 0 && (
  <div className="mb-6">
    {showUpload ? (
      <div className="bg-white/90 ... rounded-2xl p-6">
        <UploadForm hideTitle onComplete={(data) => router.push(`/resumes/${data.resumeId}`)} />
      </div>
    ) : (
      <button
        onClick={() => setShowUpload(true)}
        className="w-full border-2 border-dashed ... py-8 ..."
      >
        {/* Plus 아이콘 + "새 이력서 추가" 텍스트 */}
      </button>
    )}
  </div>
)}
```

기존 `motion.div` 내 하단 업로드 카드(`showUpload` 분기 포함) 완전 제거. `showUpload` 상태 로직은 그대로 유지.

### 테스트 전략
기존 업로드 플로우 테스트 통과 확인.
