import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-md p-8">
        <div className="mb-8">
          <Link href="/signup" className="text-sm text-[#4361ee] hover:underline">← 회원가입으로 돌아가기</Link>
        </div>

        <h1 className="text-2xl font-bold text-[#1a1a2e] mb-2">이용약관</h1>
        <p className="text-sm text-gray-500 mb-8">최종 수정일: 2026년 3월 30일</p>

        <div className="space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제1조 (목적)</h2>
            <p>
              본 약관은 MirAI(이하 &quot;서비스&quot;)가 제공하는 AI 면접 코칭 서비스의 이용 조건 및 절차,
              이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제2조 (서비스 내용)</h2>
            <p>MirAI는 다음 서비스를 제공합니다.</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>AI 기반 면접 질문 생성 및 답변 코칭</li>
              <li>이력서 진단 및 피드백</li>
              <li>면접 연습 세션 및 결과 리포트</li>
              <li>직군별 업계 동향 정보 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제3조 (이용자 의무)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위 금지</li>
              <li>서비스를 이용하여 법령이나 공서양속에 반하는 행위 금지</li>
              <li>서비스의 안정적 운영을 방해하는 행위 금지</li>
              <li>서비스 내 콘텐츠를 무단으로 복제·배포·상업적으로 이용하는 행위 금지</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제4조 (서비스 제공 및 변경)</h2>
            <p>
              서비스는 연중무휴, 24시간 제공을 원칙으로 하나, 시스템 점검·장애·운영상의 이유로
              일시 중단될 수 있습니다. 서비스 내용의 변경 시 사전에 공지합니다.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제5조 (면책조항)</h2>
            <p>
              MirAI는 AI가 생성한 면접 코칭 내용의 정확성을 보증하지 않으며, 해당 내용을 활용한
              결과에 대해 법적 책임을 지지 않습니다. 이용자는 서비스를 참고 자료로만 활용하시기 바랍니다.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-[#1a1a2e] mb-2">제6조 (준거법 및 관할)</h2>
            <p>
              본 약관은 대한민국 법령에 따라 해석되며, 분쟁 발생 시 서울중앙지방법원을 제1심 관할로 합니다.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
