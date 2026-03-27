import type { Metadata } from "next"
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google"
import "./globals.css"
import { AppProvider } from "@/context/app-context"
import { CartProvider } from "@/context/cart-context"
import { AuthProvider } from "@/context/auth-context"
import { AuthGuard } from "@/components/layout/auth-guard"
import { AppShell } from "@/components/layout/app-shell"
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

export const metadata: Metadata = {
  title: "MobiTrack Pro — Mobile Shop Management",
  description: "Professional mobile shop management system.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${dmSans.variable} antialiased`}>
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  )
}
