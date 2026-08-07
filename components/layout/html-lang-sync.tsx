"use client"

import { useEffect } from "react"
import { useLanguage } from "@/context/language-context"

// Keeps <html lang="..."> in sync with the active language so screen readers
// and browser spellcheck/font-hinting behave correctly. Layout direction
// always stays "ltr" - Urdu mode translates text only, it never mirrors the UI.
export function HtmlLangSync() {
  const { language } = useLanguage()

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = "ltr"
  }, [language])

  return null
}
