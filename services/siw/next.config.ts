import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
  // pdf-parse 내부 파일이 standalone 출력에 포함되도록 강제 지정
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdf-parse/**/*"],
  },
};

export default nextConfig;
