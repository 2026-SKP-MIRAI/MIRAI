const ALLOWED_PATHS = [
  "/api/interview/start",
  "/api/interview/answer",
  "/api/report/generate",
  "/api/resume/questions",
  "/api/resume/feedback",
] as const;

type AllowedPath = typeof ALLOWED_PATHS[number];

function isAllowedPath(path: string): path is AllowedPath {
  return ALLOWED_PATHS.includes(path as AllowedPath);
}

function getEngineBaseUrl(): string {
  const url = process.env.ENGINE_BASE_URL;
  if (!url) {
    throw new Error("ENGINE_BASE_URL 환경변수가 설정되지 않았습니다.");
  }
  return url;
}

export async function engineFetch(
  path: string,
  options: RequestInit = {},
  timeoutMs = 95000
): Promise<Response> {
  if (!isAllowedPath(path)) {
    throw new Error(`허용되지 않은 엔진 경로: ${path}`);
  }

  const baseUrl = getEngineBaseUrl();
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw Object.assign(new Error("엔진 응답 타임아웃"), { name: "AbortError" });
    }
    throw err;
  }
}
