import { MobileShell } from "@/components/layout/MobileShell";
import { ToastProvider } from "@/components/ui/toast";
import Script from "next/script";

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <MobileShell>
        {children}
      </MobileShell>
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
        integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
        crossOrigin="anonymous"
        strategy="lazyOnload"
        onLoad={() => {
          if (window.Kakao && !window.Kakao.isInitialized()) {
            window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "");
          }
        }}
      />
    </ToastProvider>
  );
}
