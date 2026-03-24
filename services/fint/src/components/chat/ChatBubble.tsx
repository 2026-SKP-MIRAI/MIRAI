import { cn } from "@/lib/utils";

const PERSONA_AVATARS: Record<string, string> = {
  hr: "👩‍💼",
  tech_lead: "👨‍💻",
  executive: "👔",
};

interface ChatBubbleProps {
  message: string;
  isAI?: boolean;
  personaLabel?: string;
  personaType?: string;
  timestamp?: Date;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function ChatBubble({ message, isAI = false, personaLabel, personaType, timestamp }: ChatBubbleProps) {
  if (isAI) {
    return (
      <div className="flex items-start gap-2 max-w-[85%]">
        {/* AI 아바타 */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D9488] to-[#059669] flex items-center justify-center text-base shrink-0 mt-0.5">
          {personaType ? (PERSONA_AVATARS[personaType] ?? "🤖") : "🤖"}
        </div>
        <div className="flex flex-col gap-0.5">
          {personaLabel && (
            <span className="text-xs text-gray-400 ml-1">{personaLabel}</span>
          )}
          <div className={cn(
            "px-4 py-3 text-sm leading-relaxed break-words",
            "bg-gray-100 text-gray-900",
            "rounded-2xl rounded-tl-sm",
            "max-w-[240px]",
            "shadow-sm"
          )}>
            {message}
          </div>
          {timestamp && (
            <span className="text-[10px] text-gray-400 ml-1">{formatTime(timestamp)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end max-w-[85%] ml-auto">
      <div className={cn(
        "px-4 py-3 text-sm leading-relaxed break-words",
        "bg-[#0D9488] text-white",
        "rounded-2xl rounded-tr-sm",
        "max-w-[240px]"
      )}>
        {message}
      </div>
      {timestamp && (
        <span className="text-[10px] text-gray-400 mt-0.5 mr-0.5">{formatTime(timestamp)}</span>
      )}
    </div>
  );
}
