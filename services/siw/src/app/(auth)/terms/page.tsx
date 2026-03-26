export default async function TermsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const backHref = from === "landing" ? "/" : "/signup";
  const backLabel = from === "landing" ? "← 돌아가기" : "← 회원가입으로 돌아가기";

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <a href={backHref} className="text-sm text-gray-400 hover:underline mb-6 block">
        {backLabel}
      </a>
      <div className="overflow-y-auto max-h-[80vh] bg-white rounded-2xl border border-black/[0.06] shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">이용약관</h1>
          <p className="text-xs text-gray-400 mt-1">시행일: 2026년 3월 25일</p>
        </div>

        {/* 제1조 목적 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제1조 (목적)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 약관은 MirAI(이하 "회사")가 제공하는 AI 면접 코칭 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        {/* 제2조 정의 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제2조 (정의)</h2>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1.5 list-none">
            <li><span className="font-medium text-gray-700">① "서비스"</span>란 회사가 제공하는 AI 기반 자기소개서 분석, 면접 피드백 등 일체의 서비스를 의미합니다.</li>
            <li><span className="font-medium text-gray-700">② "이용자"</span>란 이 약관에 동의하고 회사가 제공하는 서비스를 이용하는 자를 의미합니다.</li>
            <li><span className="font-medium text-gray-700">③ "AI 분석 결과"</span>란 인공지능 모델이 이용자가 제출한 자기소개서·이력서를 분석하여 생성한 피드백, 점수, 제안 등을 의미합니다.</li>
          </ul>
        </section>

        {/* 제3조 서비스 내용 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제3조 (서비스 내용)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            본 서비스는 인공지능(AI)을 활용하여 자기소개서·면접 피드백을 제공합니다(AI기본법 제22조 참조). 회사는 다음의 서비스를 제공합니다.
          </p>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1 list-disc list-inside pl-2">
            <li>AI 기반 자기소개서 및 이력서 분석</li>
            <li>다양한 면접관 페르소나를 활용한 모의 면접</li>
            <li>8축 정밀 피드백 및 성장 추이 분석</li>
            <li>맞춤형 면접 개선 방향 제시</li>
          </ul>
        </section>

        {/* 제4조 AI 서비스 특성 및 책임 한계 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제4조 (AI 서비스 특성 및 책임 한계)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            AI 분석 결과는 참고용이며 실제 채용 결과를 보장하지 않습니다. 회사는 고의 또는 중과실이 없는 한 AI 분석 결과의 오류로 인한 손해에 대해 책임을 지지 않습니다.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            AI 분석은 통계적 패턴과 학습 데이터에 기반하므로 개별 채용 상황, 기업 문화, 직무 특성에 따라 결과가 다를 수 있습니다. 최종 판단은 이용자 본인이 내려야 합니다.
          </p>
        </section>

        {/* 제5조 자동화 의사결정 이의제기 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제5조 (자동화 의사결정 설명 요구 및 이의제기)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이용자는 AI 분석 결과에 대해 설명을 요구하거나 이의를 제기할 수 있습니다(개인정보보호법 제37조의2 적용 가능성). 이의제기는 [운영팀 이메일]로 이메일 문의를 통해 접수할 수 있으며, 회사는 합리적인 기간 내에 검토 후 회신합니다.
          </p>
        </section>

        {/* 제6조 이용자 의무 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제6조 (이용자 의무)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1 list-disc list-inside pl-2">
            <li>허위 정보가 포함된 자기소개서·이력서 업로드</li>
            <li>타인의 자기소개서·이력서를 본인 것으로 가장하여 사용(도용)</li>
            <li>서비스를 통해 취득한 정보를 상업적으로 이용하거나 제3자에게 제공</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>관련 법령을 위반하는 행위</li>
          </ul>
        </section>

        {/* 제7조 저작권 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제7조 (저작권 및 지식재산권)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            AI 생성 피드백은 개인적인 참고 목적으로만 사용할 수 있으며, 상업적 재배포 또는 제3자 제공은 금지됩니다. 회사가 제공하는 서비스 및 콘텐츠에 대한 저작권과 지식재산권은 회사에 귀속됩니다.
          </p>
        </section>

        {/* 제8조 서비스 변경·중단 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제8조 (서비스 변경·중단)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            회사는 서비스를 변경하거나 중단할 경우 사전 공지를 원칙으로 합니다. 다만 천재지변, 시스템 장애, 긴급 보안 패치 등 불가피한 사유가 있는 경우에는 즉시 조치 후 사후 공지할 수 있습니다.
          </p>
        </section>

        {/* 제9조 연령 제한 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제9조 (연령 제한)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            만 14세 미만의 아동은 본 서비스를 이용할 수 없습니다. 만 14세 미만임이 확인된 경우 회사는 해당 계정의 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.
          </p>
        </section>

        {/* 제10조 준거법 및 관할 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">제10조 (준거법 및 관할)</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 약관의 해석 및 이에 따른 분쟁에 관하여는 대한민국 법률을 준거법으로 합니다. 서비스 이용으로 발생한 분쟁에 대한 소송은 회사 본점 소재지를 관할하는 법원을 1심 관할 법원으로 합니다.
          </p>
        </section>

        <div className="pt-4 border-t border-black/[0.06]">
          <p className="text-xs text-gray-400">본 약관은 2026년 3월 25일부터 시행됩니다.</p>
        </div>
      </div>
    </div>
  )
}
