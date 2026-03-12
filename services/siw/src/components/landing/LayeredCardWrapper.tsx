"use client";

import { ReactNode } from "react";

interface LayeredCardWrapperProps {
  children: ReactNode;
  className?: string;
}

/**
 * 3중 레이어 카드 래퍼
 * 레이어 구조: layer-3 (맨 아래 흐림) → layer-2 (중간) → layer-1 (최상위, 보라 경계선)
 */
export default function LayeredCardWrapper({ children, className = "" }: LayeredCardWrapperProps) {
  return (
    <div className={`layered-card-wrapper ${className}`}>
      <div className="lc-layer-3" aria-hidden="true" />
      <div className="lc-layer-2" aria-hidden="true" />
      <div className="lc-layer-1">
        {children}
      </div>
    </div>
  );
}
