import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-md p-8">
        <div className="mb-8">
          <Link href="/signup" className="text-sm text-[#4361ee] hover:underline">← 회원가입으로 돌아가기</Link>
        </div>

        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-8">최종 수정일: 2026년 3월 30일</p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제1조 (수집하는 개인정보 항목)</h2>
            <p>MirAI는 회원가입 및 서비스 제공을 위해 다음 항목을 수집합니다.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>필수 항목: 이메일 주소, 이름</li>
              <li>서비스 이용 중 자동 수집: 접속 IP, 서비스 이용 기록, 면접 연습 데이터</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제2조 (개인정보 수집 목적)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>회원 가입 및 본인 확인</li>
              <li>AI 면접 코칭 서비스 제공 및 개인화</li>
              <li>서비스 품질 개선 및 통계 분석</li>
              <li>공지사항 전달 및 고객 지원</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제3조 (개인정보 보유 및 이용 기간)</h2>
            <p>
              회원 탈퇴 시까지 보유하며, 탈퇴 즉시 지체 없이 파기합니다.
              단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제4조 (개인정보 제3자 제공)</h2>
            <p>
              MirAI는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.
              다만, 이용자가 사전에 동의한 경우 또는 법령에 의거한 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제5조 (이용자의 권리)</h2>
            <p>이용자는 언제든지 다음 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>개인정보 조회·수정 요청</li>
              <li>개인정보 처리 정지 요청</li>
              <li>회원 탈퇴 및 개인정보 삭제 요청</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제6조 (문의처)</h2>
            <p>
              개인정보 관련 문의는 서비스 내 고객 지원 채널을 통해 접수해 주시기 바랍니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
