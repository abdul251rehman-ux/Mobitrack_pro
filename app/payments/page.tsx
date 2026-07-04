"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Wallet } from "lucide-react"

export default function PaymentsRedirect() {
  const router = useRouter()
  useEffect(() => {
    const t = setTimeout(() => router.replace("/finance"), 1500)
    return () => clearTimeout(t)
  }, [router])
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
          <Wallet className="w-6 h-6 text-blue-600" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Payments have moved to Finance</p>
        <p className="text-xs text-slate-400">Redirecting you now...</p>
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  )
}
