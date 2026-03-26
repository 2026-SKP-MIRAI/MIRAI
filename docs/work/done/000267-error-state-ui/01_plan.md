# [#267] fix: 에러 상태 UI 미처리 수정 — API 실패 빈 화면 + 잘못된 업로드 에러 메시지 — 구현 계획

> 작성: 2026-03-26

---

## 배경

`/resumes` 페이지의 fetch에서 에러 처리가 부재했다:
- API 5xx 또는 네트워크 오류 시 `catch(() => setLoading(false))`만 실행 → 빈 화면
- `Array.isArray` 체크 없어 비배열 응답 시 `.map()` 런타임 에러

## 완료 기준

- [x] `/resumes` 페이지에서 API 실패(네트워크 오류/5xx) 시 에러 메시지와 새로고침 버튼이 표시된다
- [x] PDF 아닌 파일 업로드 시 "PDF 파일만 업로드 가능합니다." 메시지가 표시된다
- [x] 정상 케이스(이력서 있음/없음)는 기존과 동일하게 동작한다

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/resumes/page.tsx` | error 상태, loadResumes 함수, 에러 배너 |
| `services/siw/src/app/(app)/resumes/.ai.md` | error 상태 기술 |

### 구현 상세

**loadResumes 함수 분리:**
```tsx
const loadResumes = () => {
  setLoading(true)
  setError("")
  fetch("/api/resumes")
    .then(r => {
      if (!r.ok) throw new Error("이력서 목록을 불러오지 못했습니다.")
      return r.json()
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error("이력서 목록을 불러오지 못했습니다.")
      setResumes(data)
      setLoading(false)
    })
    .catch(() => {
      setError("이력서 목록을 불러오지 못했습니다.")
      setLoading(false)
    })
}

useEffect(() => { loadResumes() }, [])
```

**에러 배너:**
```tsx
{!loading && error && (
  <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
    <p className="text-red-600 font-semibold mb-2">{error}</p>
    <p className="text-sm text-red-400 mb-4">네트워크 상태를 확인하고 다시 시도해주세요.</p>
    <button onClick={loadResumes} ...>새로고침</button>
  </div>
)}
```

이력서 목록 렌더링에 `!error` 조건 추가.

### 테스트 전략
- 5xx 응답 시 에러 배너 표시 확인
- 비배열 응답 시 에러 배너 표시 확인
- 새로고침 버튼 클릭 시 재요청 확인
- 정상 응답 시 이력서 목록 표시 확인
