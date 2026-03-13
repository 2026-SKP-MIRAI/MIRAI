export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default
    const data = await pdfParse(Buffer.from(buffer))
    return data.text
  } catch {
    return ''
  }
}
