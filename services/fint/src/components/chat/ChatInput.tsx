"use client";

import { useRef, useState, useEffect } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder = "답변을 입력하세요" }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="bg-[--color-surface] border-t border-[--color-border] pl-4 pt-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-end gap-2 pr-4">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            "flex-1 resize-none rounded-3xl border border-gray-200 bg-[--color-muted]",
            "px-4 py-2.5 text-sm leading-relaxed",
            "placeholder:text-[--color-muted-foreground]",
            "focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-[#0D9488]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200 overflow-y-auto"
          )}
          style={{ minHeight: "40px", maxHeight: "120px" }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            "bg-[#0D9488] text-white hover:bg-[#0F766E]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-all duration-200 active:scale-95"
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
