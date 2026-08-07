import * as React from "react"
import { cn } from "@/lib/utils"

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: string | number
  onChange: (value: string) => void
}

// Strips everything except digits and a single decimal point, e.g. "40,000.5x" -> "40000.5"
function toRaw(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, "")
  const firstDot = cleaned.indexOf(".")
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "")
}

// Formats a raw numeric string with thousands separators, preserving a trailing "." while typing
function toDisplay(raw: string): string {
  if (!raw) return ""
  const [intPart, decPart] = raw.split(".")
  const groupedInt = intPart === "" ? "" : Number(intPart).toLocaleString("en-US")
  if (decPart === undefined) return raw.endsWith(".") ? `${groupedInt}.` : groupedInt
  return `${groupedInt}.${decPart}`
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, onWheel, ...props }, ref) => {
    const raw = toRaw(String(value ?? ""))
    return (
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        value={toDisplay(raw)}
        onChange={e => onChange(toRaw(e.target.value))}
        onWheel={onWheel ?? (e => e.currentTarget.blur())}
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        {...props}
      />
    )
  }
)
MoneyInput.displayName = "MoneyInput"

export { MoneyInput }
