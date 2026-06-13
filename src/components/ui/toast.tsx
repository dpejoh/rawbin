import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastVariant = "default" | "success" | "error" | "info"

interface ToastProps {
  id: string
  message: string
  variant?: ToastVariant
  onDismiss: (id: string) => void
}

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-green-600 text-white",
  error: "bg-destructive text-destructive-foreground",
  info: "bg-primary text-primary-foreground",
}

export function Toast({ id, message, variant = "default", onDismiss }: ToastProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-4 py-3 text-sm shadow-lg",
        variantStyles[variant]
      )}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        className="opacity-70 hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
