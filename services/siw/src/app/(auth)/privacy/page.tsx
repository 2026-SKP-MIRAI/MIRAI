export default function PrivacyPage() {
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <a href="/signup" className="text-sm text-gray-400 hover:underline mb-6 block">
        ← 회원가입으로 돌아가기
      </a>
      <div className="overflow-y-auto max-h-[80vh] bg-white rounded-2xl border border-black/[0.06] shadow-sm p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">개인정보 처리방침</h1>
          <p className="text-xs text-gray-400 mt-1">시행일: 2026년 3월 25일</p>
        </div>

        {/* 1. 수집 항목 및 목적 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">1. 개인정보 수집 항목 및 처리 목적</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08] w-1/3">수집 항목</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">처리 목적</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08] w-1/4">법적 근거</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top">이름, 이메일, 비밀번호</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">회원가입 및 서비스 제공</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">계약 이행</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top">자기소개서, 이력서</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">AI 면접 코칭 분석·피드백 제공</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">계약 이행</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top">접속 IP, 쿠키, 서비스 이용 기록</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">서비스 보안·통계 분석</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">정당한 이익</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            ※ 장애·보훈·종교 등 민감정보는 수집하지 않습니다.
          </p>
        </section>

        {/* 2. 보유기간 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">2. 개인정보 보유 및 이용기간</h2>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1 list-disc list-inside pl-2">
            <li>회원 정보 및 자기소개서·이력서: 회원 탈퇴 시까지</li>
            <li>접속 로그(IP, 쿠키, 이용 기록): 3개월</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed">
            단, 관련 법령에 따라 보관이 필요한 경우 해당 법령에서 정한 기간 동안 보유합니다.
          </p>
        </section>

        {/* 3. 처리위탁 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">3. 개인정보 처리위탁</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">수탁자</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">위탁 업무</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top whitespace-nowrap">Anthropic, PBC</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">
                    AI 기반 자기소개서·이력서 분석 피드백
                    <p className="text-xs text-gray-400 mt-1">API 정책상 입력 데이터는 모델 학습에 사용되지 않는 것으로 안내되어 있으며, Anthropic API 이용약관에 따라 처리됩니다.</p>
                  </td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top whitespace-nowrap">Amazon Web Services, Inc.</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">서버 운영 및 데이터 저장</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. 국외이전 */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">4. 개인정보의 국외 이전</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-800 font-medium">
              ※ 귀하의 자기소개서·이력서는 AI 분석을 위해 미국에 위치한 Anthropic 서버로 전송됩니다.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">이전 국가 / 수신자</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">이전 항목</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">이전 목적</th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2 border border-black/[0.08]">법적 근거</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top">미국<br /><span className="text-xs text-gray-500">Anthropic PBC</span></td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">자기소개서, 이력서</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">AI 분석</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">정보주체 동의</td>
                </tr>
                <tr className="bg-gray-50/50">
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-700 align-top">미국<br /><span className="text-xs text-gray-500">Amazon Web Services</span></td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">서비스 전반 데이터</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">서버 운영</td>
                  <td className="px-3 py-2 border border-black/[0.08] text-gray-600">정보주체 동의</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. 정보주체 권리 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">5. 정보주체의 권리</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이용자는 언제든지 다음의 권리를 행사할 수 있습니다. 요청은 10일 이내에 처리됩니다.
          </p>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1 list-disc list-inside pl-2">
            <li>개인정보 열람 요구</li>
            <li>오류 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리정지 요구</li>
            <li>AI 분석 결과에 대한 설명 요구 및 이의제기</li>
          </ul>
          <p className="text-sm text-gray-600 leading-relaxed">
            권리 행사는 서비스 내 설정 메뉴 또는 개인정보 보호책임자에게 문의하여 신청할 수 있습니다.
          </p>
        </section>

        {/* 6. 쿠키 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">6. 쿠키(Cookie) 사용</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            회사는 세션 유지 목적으로 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 서비스 이용이 제한될 수 있습니다.
          </p>
          <p className="text-sm text-gray-500 text-xs">
            쿠키 거부 방법: 브라우저 설정 → 개인정보 보호 → 쿠키 및 사이트 데이터 → 모든 쿠키 차단
          </p>
        </section>

        {/* 7. 파기 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">7. 개인정보 파기</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            개인정보 보유기간이 종료되거나 처리 목적이 달성된 경우, 해당 정보를 지체 없이(보유기간 종료 후 5일 이내) 복구할 수 없는 방법으로 파기합니다.
          </p>
          <ul className="text-sm text-gray-600 leading-relaxed space-y-1 list-disc list-inside pl-2">
            <li>전자적 파일: 기술적 방법으로 복원 불가능하게 영구 삭제</li>
            <li>출력물 등 비전자적 기록: 분쇄 또는 소각</li>
          </ul>
        </section>

        {/* 8. 보호책임자 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">8. 개인정보 보호책임자</h2>
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 space-y-1">
            <p><span className="font-medium text-gray-700">담당자:</span> MirAI 운영팀</p>
            <p><span className="font-medium text-gray-700">이메일:</span> mirainterview5@gmail.com</p>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            개인정보 처리에 관한 문의, 불만 처리, 피해 구제 등에 관한 사항은 위 담당자에게 문의하시기 바랍니다.
          </p>
        </section>

        {/* 9. 변경 고지 */}
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-800">9. 개인정보 처리방침 변경 고지</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            이 개인정보 처리방침이 변경되는 경우, 시행일 7일 전부터 서비스 내 공지사항을 통해 사전 고지합니다. 중요한 변경 사항(수집 항목 추가, 처리 목적 변경 등)의 경우 30일 전에 고지합니다.
          </p>
        </section>

        <div className="pt-4 border-t border-black/[0.06]">
          <p className="text-xs text-gray-400">본 방침은 2026년 3월 25일부터 시행됩니다.</p>
        </div>
      </div>
    </div>
  )
}
