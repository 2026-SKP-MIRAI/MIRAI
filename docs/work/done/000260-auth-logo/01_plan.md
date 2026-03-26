# [#260] feat: 회원가입·로그인 페이지 좌상단 MirAI 로고 추가 — 구현 계획

> 작성: 2026-03-26

---

## 배경

인증 페이지(로그인·회원가입)에 브랜드 로고가 없어 사용자가 서비스 이름을 인지하기 어렵고, 랜딩페이지로 돌아가는 경로가 없었다.

## 완료 기준

- [x] 회원가입·로그인 페이지 좌상단에 MirAI 로고가 표시된다
- [x] 로고 클릭 시 랜딩페이지(/)로 이동한다
- [x] 로고에 gradient-text 스타일이 적용된다
- [x] 테스트 추가

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(auth)/layout.tsx` | Link import, 로고 삽입 |
| `services/siw/src/app/(auth)/__tests__/layout.test.tsx` | 신규 테스트 |
| `services/siw/src/app/(auth)/.ai.md` | 신규 생성 |

### 구현 상세

**layout.tsx 변경:**
```tsx
import Link from "next/link"

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F8F9FB] bg-grid flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* 좌상단 MirAI 로고 */}
      <Link
        href="/"
        className="absolute top-6 left-6 z-20 text-xl font-bold gradient-text hover:opacity-80 transition-opacity"
      >
        MirAI
      </Link>
      {/* 배경 orbs와 children은 그대로 */}
    </div>
  )
}
```

`absolute top-6 left-6 z-20` — 기존 배경 orbs와 children 정렬 구조에 영향 없이 독립적 레이어에 배치.

### 테스트 전략
- 로고 텍스트("MirAI") 렌더링 확인
- `<a href="/">` 연결 확인
- `gradient-text` className 포함 확인
