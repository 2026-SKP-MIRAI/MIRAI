import { Lock } from "lucide-react";

export function OrbPreviewCard() {
  return (
    <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-[--color-border] p-6 overflow-hidden">
      {/* Background orb glow */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: "radial-gradient(ellipse at center, #0D9488 0%, transparent 70%)",
        }}
      />

      {/* Blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[2px] bg-white/50 flex flex-col items-center justify-center gap-3 z-10 rounded-2xl">
        <div className="w-14 h-14 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-400" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-gray-700">당신의 합격 가능성을 분석했어요</p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-xs text-[#0D9488] font-medium">🔜 곧 열려요</span>
          </div>
        </div>
      </div>

      {/* Background content (blurred) */}
      <div className="flex flex-col items-center gap-4 opacity-25 pointer-events-none">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0D9488] to-[#0F766E] flex items-center justify-center shadow-lg">
          <span className="text-3xl">🔮</span>
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-bold text-gray-900">합격 예언 오브</p>
          <p className="text-sm text-gray-500">합격 가능성을 예측해요</p>
          <div className="mt-2 flex gap-1 justify-center">
            {[75, 82, 68, 90].map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-6 rounded-full bg-[#0D9488]" style={{ height: `${v * 0.4}px` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
