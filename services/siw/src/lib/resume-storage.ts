import { createServiceClient } from "@/lib/supabase/server"

export async function uploadResumePdf(
  userId: string,
  buffer: Buffer,
  originalFileName: string
): Promise<string> {
  const uuid = crypto.randomUUID()
  const storageKey = `${userId}/${uuid}.pdf`
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is not set")

  const supabase = createServiceClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storageKey, buffer, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return storageKey
}
