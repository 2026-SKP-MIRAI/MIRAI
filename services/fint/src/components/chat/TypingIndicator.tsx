export function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D9488] to-[#059669] flex items-center justify-center text-base shrink-0 mt-0.5">
        🤖
      </div>
      <div className="px-4 py-3 bg-[--color-muted] rounded-2xl rounded-tl-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[--color-muted-foreground] inline-block"
              style={{
                animation: "bounce 1.2s infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-6px); }
          }
        `}</style>
        <span className="sr-only">AI 면접관이 생각 중이에요...</span>
      </div>
    </div>
  );
}
