"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

interface SaveAccountCTAProps {
  sessionId: string;
}

export function SaveAccountCTA({ sessionId }: SaveAccountCTAProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });
  }, []);

  // 로딩 중이거나 로그인 상태면 표시 안 함
  if (isLoggedIn !== false) return null;

  return (
    <div className="mx-5 my-4 p-4 rounded-2xl border border-[#0D9488]/20 bg-[#0D9488]/5">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">결과를 영구 저장하려면 로그인하세요</p>
          <p className="text-xs text-gray-500 mt-0.5">로그인하면 이 면접 결과가 내 계정에 저장됩니다</p>
        </div>
        <Link
          href={`/login?next=/report/${sessionId}`}
          className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center"
          style={{ backgroundColor: "#0D9488" }}
        >
          로그인 / 가입하기
        </Link>
      </div>
    </div>
  );
}
