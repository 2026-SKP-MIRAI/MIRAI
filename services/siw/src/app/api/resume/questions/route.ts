import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";

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

  if (file.type !== "application/pdf") {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.noFile },
      { status: 400 }
    );
  }

  const engineParseForm = new FormData();
  engineParseForm.append("file", file, file.name);
  const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
    method: "POST",
    body: engineParseForm,
    signal: AbortSignal.timeout(30000),
  });
  if (!parseResp.ok) {
    const body = await parseResp.json().catch(() => ({ detail: "" }));
    const key = mapDetailToKey(body.detail ?? "", parseResp.status);
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES[key] },
      { status: parseResp.status }
    );
  }
  const { resumeText } = await parseResp.json();

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
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
    return Response.json({ ...engineData });
  } catch {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
