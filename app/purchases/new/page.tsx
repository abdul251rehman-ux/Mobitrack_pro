"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { NewPurchaseSheet } from "@/app/purchases/new-purchase-sheet"

export default function NewPurchasePage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  return (
    <NewPurchaseSheet
      open={open}
      onClose={() => { setOpen(false); router.push("/purchases") }}
      onCreated={() => router.push("/purchases")}
    />
  )
}
