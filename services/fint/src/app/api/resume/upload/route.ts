import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { engineFetch } from "@/lib/engine-client"
import { uploadResumePdf, deleteResumePdf } from "@/lib/resume-storage"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let file: File | null = null
  try {
    const formData = await req.formData()
    file = formData.get("file") as File | null
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 })
  }

  if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "5MB 이하 파일만 업로드할 수 있습니다." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 1. 엔진 parse + 기존 레코드 조회 — 독립적이므로 병렬 실행
  const parseFormData = new FormData()
  parseFormData.append("file", new Blob([buffer], { type: "application/pdf" }), file.name)
  const serviceClient = createServiceClient()
  const [parseResult, { data: existing }] = await Promise.all([
    engineFetch("/api/resume/parse", { method: "POST", body: parseFormData }),
    serviceClient.from("resumes").select("storage_key").eq("user_id", user.id).maybeSingle(),
  ])
  if (!parseResult.ok) {
    const err = await parseResult.json().catch(() => ({}))
    return NextResponse.json({ error: "자소서 분석에 실패했습니다.", detail: err }, { status: 400 })
  }
  const { resumeText } = await parseResult.json()

  // 2. Storage 업로드
  const storageKey = await uploadResumePdf(user.id, buffer)

  try {
    // 4. DB upsert
    const { error: dbError } = await serviceClient.from("resumes").upsert(
      {
        user_id: user.id,
        file_name: file.name,
        storage_key: storageKey,
        resume_text: resumeText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    if (dbError) throw dbError

    // 5. DB 성공 후 이전 파일 삭제 (실패해도 무시)
    if (existing?.storage_key && existing.storage_key !== storageKey) {
      await deleteResumePdf(existing.storage_key).catch(() => {})
    }
  } catch (err) {
    // DB 실패 시 방금 올린 Storage 파일 롤백
    await deleteResumePdf(storageKey).catch(() => {})
    console.error("[resume/upload] DB upsert 실패:", err)
    return NextResponse.json({ error: "저장에 실패했습니다." }, { status: 500 })
  }

  return NextResponse.json({ storageKey, fileName: file.name, resumeText })
}
