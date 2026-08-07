"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useParams, useRouter } from "next/navigation"
import { NewPurchaseSheet } from "@/app/purchases/new-purchase-sheet"

function EditPurchasePageInner() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  return (
    <NewPurchaseSheet
      editPurchaseId={params.id}
      onClose={() => router.push("/purchases")}
      onCreated={() => router.push("/purchases")}
    />
  )
}

export default function EditPurchasePage() {
  return (
    <PermissionGate permission="purchases.create">
      <EditPurchasePageInner />
    </PermissionGate>
  )
}
