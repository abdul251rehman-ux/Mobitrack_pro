"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search, Plus, AlertTriangle, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  value: string
  onChange: (val: string) => void
  options: string[]
  placeholder?: string
  allowCustom?: boolean
  customWarning?: string
  onAddNew?: (val: string) => Promise<void> | void
  disabled?: boolean
  error?: boolean
  className?: string
  maxHeight?: number
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search or select...",
  allowCustom = false,
  customWarning,
  onAddNew,
  disabled = false,
  error = false,
  className,
  maxHeight = 220,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  )

  const isCustom =
    query.trim() !== "" &&
    !options.some((o) => o.toLowerCase() === query.trim().toLowerCase())

  function handleToggle() {
    if (disabled) return
    if (open) {
      setOpen(false)
      setQuery("")
    } else {
      setOpen(true)
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }

  function handleSelect(val: string) {
    onChange(val)
    setOpen(false)
    setQuery("")
  }

  async function handleAddNew() {
    const trimmed = query.trim()
    if (!trimmed) return
    if (onAddNew) await onAddNew(trimmed)
    handleSelect(trimmed)
  }

  return (
    // wrapperRef covers both trigger and dropdown — so clicks inside never close it
    <div ref={wrapperRef} className={cn("relative", className)}>

      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-2 h-9 px-3 rounded-md border bg-slate-50 text-sm transition-colors",
          "hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400",
          error ? "border-red-400" : "border-slate-200",
          disabled && "opacity-50 cursor-not-allowed",
          !value && "text-slate-400"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {/* Dropdown — absolutely positioned, no portal needed */}
      {open && (
        <div className="absolute left-0 right-0 z-[999] mt-1 rounded-xl border border-slate-200 bg-white shadow-xl">

          {/* Search box */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to search..."
                autoComplete="off"
                spellCheck={false}
                className="w-full pl-8 pr-3 h-8 text-xs rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto" style={{ maxHeight }}>
            {filtered.length === 0 && !isCustom && (
              <p className="text-center text-xs text-slate-400 py-5">No results found</p>
            )}

            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-blue-50 transition-colors",
                  value === opt && "bg-blue-50 text-blue-700 font-semibold"
                )}
              >
                <Check className={cn("w-3 h-3 shrink-0", value === opt ? "opacity-100 text-blue-600" : "opacity-0")} />
                <span>{opt}</span>
              </button>
            ))}

            {/* Custom entry */}
            {isCustom && allowCustom && (
              <div className="border-t border-slate-100">
                {customWarning && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-700 leading-tight">{customWarning}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleSelect(query.trim())}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-50 text-slate-700"
                >
                  <span className="text-slate-400 shrink-0">Use:</span>
                  <span className="font-medium truncate">&ldquo;{query.trim()}&rdquo;</span>
                </button>
                {onAddNew && (
                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-green-50 text-green-700 border-t border-slate-100"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Add &ldquo;{query.trim()}&rdquo; permanently</span>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
