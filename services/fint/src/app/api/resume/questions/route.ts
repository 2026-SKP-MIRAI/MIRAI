import { engineFetch } from "@/lib/engine-client";
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";

export const runtime = "nodejs";
export const maxDuration = 110;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof Blob)) {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.noFile },
      { status: 400 }
    );
  }

  const engineForm = new FormData();
  engineForm.append("file", file, (file as File).name ?? "upload.pdf");

  try {
    const resp = await engineFetch("/api/resume/questions", {
      method: "POST",
      body: engineForm,
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
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return Response.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 504 });
    }
    console.error("[resume/questions] 엔진 호출 실패:", err);
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
