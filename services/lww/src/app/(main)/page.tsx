"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingSlider } from "@/components/onboarding/OnboardingSlider";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const done = localStorage.getItem("onboarding_done");
    if (done === "true") {
      router.replace("/onboarding");
    }
  }, [router]);

  return <OnboardingSlider />;
}
