import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";
import { withEventLogging } from "@/lib/observability/event-logger";

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
  let resumeText: string;
  try {
    const parsed = await withEventLogging('resume_parse', null, async (meta) => {
      const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
        method: "POST",
        body: engineParseForm,
        signal: AbortSignal.timeout(30000),
      });
      if (!parseResp.ok) {
        const body = await parseResp.json().catch(() => ({ detail: "" }));
        const key = mapDetailToKey(body.detail ?? "", parseResp.status);
        throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: parseResp.status });
      }
      const d = await parseResp.json();
      if (d.usage) meta.usage = d.usage;
      return d as { resumeText: string };
    });
    resumeText = parsed.resumeText;
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      return Response.json({ message: err.message }, { status: (err as { status: number }).status });
    }
    throw err;
  }

  try {
    const engineData = await withEventLogging('resume_questions', null, async (meta) => {
      const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
        signal: AbortSignal.timeout(30000),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: "" }));
        const key = mapDetailToKey(body.detail ?? "", resp.status);
        throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: resp.status });
      }
      const d = await resp.json();
      if (d.usage) meta.usage = d.usage;
      return d;
    });
    return Response.json({ ...engineData });
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      return Response.json({ message: err.message }, { status: (err as { status: number }).status });
    }
    return Response.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 });
  }
}
