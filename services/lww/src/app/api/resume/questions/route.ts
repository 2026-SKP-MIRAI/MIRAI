import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";

export const runtime = "nodejs";
export const maxDuration = 110;

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  console.log("[resume/questions] 요청 수신:", file instanceof Blob ? `파일명=${(file as File).name}, 크기=${file.size}bytes` : "파일 없음");

  if (!(file instanceof Blob)) {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.noFile },
      { status: 400 }
    );
  }

  const engineForm = new FormData();
  engineForm.append("file", file, (file as File).name ?? "upload.pdf");

  console.log(`[resume/questions] 엔진 호출: ${ENGINE_BASE_URL}/api/resume/questions`);

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      body: engineForm,
      signal: AbortSignal.timeout(95000),
    });

    console.log(`[resume/questions] 엔진 응답: ${resp.status}`);

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
    console.error("[resume/questions] 엔진 호출 실패:", err);
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
