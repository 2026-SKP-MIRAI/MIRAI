import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ resume: null })

  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from("resumes")
    .select("file_name, updated_at, resume_text")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ resume: null })

  return NextResponse.json({
    resume: {
      fileName: data.file_name,
      uploadedAt: data.updated_at,
      hasResumeText: !!data.resume_text,
    },
  })
}
