import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";
import { withEventLogging } from "@/lib/observability/event-logger";
import { getEngineBaseUrl } from "@/lib/rag/embedding-client";

export const runtime = "nodejs";
export const maxDuration = 60;

function requireEngineBaseUrl(): string {
  const url = getEngineBaseUrl();
  if (!url) throw new Error("ENGINE_BASE_URL 환경변수가 설정되지 않았습니다");
  return url;
}

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
      const parseResp = await fetch(`${requireEngineBaseUrl()}/api/resume/parse`, {
        method: "POST",
        body: engineParseForm,
        signal: AbortSignal.timeout(55000),
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
      const resp = await fetch(`${requireEngineBaseUrl()}/api/resume/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText }),
        signal: AbortSignal.timeout(55000),
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
