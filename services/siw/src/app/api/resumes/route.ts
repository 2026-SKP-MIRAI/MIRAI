import { NextResponse } from "next/server"

// TODO: 실제 DB 연결은 인증 + userId 연결 이슈 완료 후 별도 PR
const MOCK_RESUMES = [
  {
    id: "mock-1",
    fileName: "홍길동_자소서_2026.pdf",
    uploadedAt: "2026-03-10T09:00:00Z",
    questionCount: 12,
    categories: ["직무 역량", "기술 역량", "성과 근거"],
  },
  {
    id: "mock-2",
    fileName: "홍길동_자소서_카카오.pdf",
    uploadedAt: "2026-03-08T14:30:00Z",
    questionCount: 10,
    categories: ["직무 역량", "경험의 구체성"],
  },
]

export async function GET() {
  return NextResponse.json(MOCK_RESUMES)
}
