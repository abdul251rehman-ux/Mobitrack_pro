import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, DM_Sans, Noto_Sans_Arabic } from "next/font/google"
import "./globals.css"
import { AppProvider } from "@/context/app-context"
import { CartProvider } from "@/context/cart-context"
import { AuthProvider } from "@/context/auth-context"
import { LanguageProvider } from "@/context/language-context"
import { AuthGuard } from "@/components/layout/auth-guard"
import { AppShell } from "@/components/layout/app-shell"
import { HtmlLangSync } from "@/components/layout/html-lang-sync"
import { Toaster } from "sonner"

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
})

// Urdu script has no glyphs in the Latin fonts above, so this is added to the
// font stack (see globals.css) rather than replacing anything - English text
// keeps rendering in Plus Jakarta Sans / DM Sans exactly as before, and only
// Urdu characters pick this font up automatically.
const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-urdu",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "MobiTrack Pro - Mobile Shop Management",
  description: "Professional mobile shop management system.",
}

// interactiveWidget: "resizes-content" makes the on-screen keyboard actually
// shrink the visual viewport on Android Chrome, instead of overlaying fixed-
// position elements (like the bottom-sheet dialog) without moving them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} ${dmSans.variable} ${notoSansArabic.variable} antialiased`}>
        <AuthProvider>
          <LanguageProvider>
            <HtmlLangSync />
            <AppProvider>
              <CartProvider>
                <AuthGuard>
                  <AppShell>
                    {children}
                  </AppShell>
                </AuthGuard>
                <Toaster position="top-right" richColors closeButton />
              </CartProvider>
            </AppProvider>
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
