import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";
import { parsePdf } from "@/lib/pdf-parser";
import { resumeRepository } from "@/lib/resume-repository";

export const runtime = "nodejs";
export const maxDuration = 35;

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.noFile },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  let resumeText = "";
  try {
    resumeText = await parsePdf(buffer);
  } catch {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.corruptedPdf },
      { status: 422 }
    );
  }

  const engineForm = new FormData();
  engineForm.append("file", file, file.name);

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      body: engineForm,
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ detail: "" }));
      const key = mapDetailToKey(body.detail ?? "", resp.status);
      return Response.json(
        { message: ENGINE_ERROR_MESSAGES[key] },
        { status: resp.status }
      );
    }

    const engineData = await resp.json();
    const resumeId = await resumeRepository.create(resumeText);
    return Response.json({ ...engineData, resumeId });
  } catch {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
