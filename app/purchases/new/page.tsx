"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useRouter } from "next/navigation"
import { NewPurchaseSheet } from "@/app/purchases/new-purchase-sheet"

function NewPurchasePageInner() {
  const router = useRouter()
  return (
    <NewPurchaseSheet
      onClose={() => router.push("/purchases")}
      onCreated={() => router.push("/purchases")}
    />
  )
}

export default function NewPurchasePage() {
  return (
    <PermissionGate permission="purchases.create">
      <NewPurchasePageInner />
    </PermissionGate>
  )
}
