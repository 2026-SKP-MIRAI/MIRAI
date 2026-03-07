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

    return Response.json(await resp.json());
  } catch {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
