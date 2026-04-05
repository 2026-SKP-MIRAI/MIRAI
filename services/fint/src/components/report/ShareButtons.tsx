"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonsProps {
  sessionId: string;
  totalScore: number;
  summary?: string;
}

export function ShareButtons({ sessionId, totalScore, summary }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [isKakaoAvailable, setIsKakaoAvailable] = useState(false);

  useEffect(() => {
    const check = () => setIsKakaoAvailable(!!window.Kakao?.Share?.sendDefault);
    check();
    const timer = setTimeout(check, 3000);
    return () => clearTimeout(timer);
  }, []);

  function handleKakaoShare() {
    const origin = window.location.origin;
    const reportUrl = `${origin}/report/${sessionId}`;

    window.Kakao?.Share?.sendDefault({
      objectType: "feed",
      content: {
        title: `내 면접 점수는 ${totalScore}점!`,
        description: summary ? `${summary.slice(0, 50)} | Fint` : "AI 모의면접 결과를 확인해보세요 | Fint",
        imageUrl: `${origin}/api/og/report?sessionId=${sessionId}`,
        link: {
          mobileWebUrl: reportUrl,
          webUrl: reportUrl,
        },
      },
      buttons: [
        {
          title: "결과 보기",
          link: {
            mobileWebUrl: reportUrl,
            webUrl: reportUrl,
          },
        },
      ],
    });
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleKakaoShare}
        disabled={!isKakaoAvailable}
        className="bg-[#FEE500] text-[#3C1E1E] hover:bg-[#F5DC00] disabled:opacity-50"
      >
        카카오톡 공유
      </Button>
      <Button variant="outline" onClick={handleCopyLink}>
        {copied ? "복사됨!" : "링크 복사"}
      </Button>
    </div>
  );
}
