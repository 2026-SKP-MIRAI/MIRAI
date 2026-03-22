"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface ToastProps {
  message: string
  type?: "default" | "error"
  visible: boolean
}

export const Toast = ({ message, type = "default", visible }: ToastProps) => {
  if (!visible) return null
  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg",
        "transition-all duration-300",
        type === "error" ? "bg-red-500 text-white" : "bg-[--color-foreground] text-white"
      )}
    >
      {message}
    </div>
  )
}

// Toast context for global usage
interface ToastContextValue {
  showToast: (message: string, type?: "default" | "error") => void
}

export const ToastContext = React.createContext<ToastContextValue>({
  showToast: () => {},
})

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = React.useState<{ message: string; type: "default" | "error"; visible: boolean }>({
    message: "",
    type: "default",
    visible: false,
  })

  const showToast = React.useCallback((message: string, type: "default" | "error" = "default") => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2500)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </ToastContext.Provider>
  )
}

export const useToast = () => React.useContext(ToastContext)
