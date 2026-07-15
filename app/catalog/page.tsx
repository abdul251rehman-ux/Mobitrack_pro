"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CatalogPage() {
  const router = useRouter()
  useEffect(() => { router.replace("/catalog/brands") }, [router])
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
    </div>
  )
}
