import { createServiceClient } from "@/lib/supabase/server"

const getBucket = () => {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET is not set")
  return bucket
}

export async function uploadResumePdf(
  userId: string,
  buffer: Buffer
): Promise<string> {
  const storageKey = `${userId}/${crypto.randomUUID()}.pdf`
  const bucket = getBucket()
  const supabase = createServiceClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(storageKey, buffer, { contentType: "application/pdf", upsert: false })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return storageKey
}

export async function deleteResumePdf(storageKey: string): Promise<void> {
  const bucket = getBucket()
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from(bucket).remove([storageKey])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}
