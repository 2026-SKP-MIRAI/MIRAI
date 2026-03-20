"use client"

import dynamic from "next/dynamic"

// SSR 완전 비활성화 — hydration mismatch 방지
const ObservabilityDashboard = dynamic(
  () => import("./ObservabilityDashboard"),
  { ssr: false }
)

export default function ObservabilityPage() {
  return <ObservabilityDashboard />
}
