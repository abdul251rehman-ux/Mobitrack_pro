﻿"use client"

import { PermissionGate } from "@/components/shared/permission-gate"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Users, Phone, StickyNote, Wallet, Check, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { getPersons, getPersonTransactions, createPerson, updatePerson, deletePerson } from "@/lib/api/persons"
import type { Person } from "@/lib/api/persons"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { PageHeader } from "@/components/shared/page-header"
import { PageLoader } from "@/components/shared/page-loader"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

const EMPTY: Omit<Person, "id" | "tenantId" | "createdAt"> = {
  name: "",
  phone: "",
  notes: "",
  openingBalance: 0,
  status: "Active",
}

function PersonsPageInner() {
  const router = useRouter()
  const [persons, setPersons] = useState<Person[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const [data, transactions] = await Promise.all([getPersons(), getPersonTransactions()])
      setPersons(data)
      const net: Record<string, number> = {}
      for (const p of data) net[p.id] = p.openingBalance ?? 0
      for (const t of transactions) {
        if (!(t.personId in net)) continue
        net[t.personId] += t.type === "gave" ? t.amount : -t.amount
      }
      setBalances(net)
    } catch (err) {
      toast.error("Failed to load persons")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function openAdd() {
    setForm({ ...EMPTY })
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(p: Person) {
    setForm({
      name: p.name,
      phone: p.phone,
      notes: p.notes,
      openingBalance: p.openingBalance,
      status: p.status,
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...EMPTY })
  }

  async function handleSave() {
    if (saving) return
    if (!form.name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      if (editingId) {
        await updatePerson(editingId, form)
        toast.success("Person updated")
      } else {
        await createPerson(form)
        toast.success("Person added")
      }
      await load()
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await deletePerson(deleteTarget.id)
      setPersons(p => p.filter(x => x.id !== deleteTarget.id))
      toast.success("Person deleted")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    } finally {
      setDeleting(false)
    }
  }

  const filtered = persons.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  )

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Persons"
        description="Manage people for informal money transactions"
        icon={<Users />}
        iconBg="bg-indigo-600"
        action={
          <Button onClick={openAdd} size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Person
          </Button>
        }
      />

      {/* Search */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <Input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </CardContent>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">
              {search ? "No persons match your search" : "No persons added yet"}
            </p>
            {!search && (
              <button onClick={openAdd} className="mt-3 text-xs text-indigo-600 hover:underline">
                Add your first person
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="px-3 py-2 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-800">
              {filtered.length} {filtered.length === 1 ? "person" : "persons"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {filtered.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/persons/${p.id}`)}>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-700 text-xs font-bold">
                      {p.name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {p.phone && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Phone className="w-2.5 h-2.5" />
                          {p.phone}
                        </span>
                      )}
                      {p.notes && (
                        <span className="flex items-center gap-1 text-[10px] text-slate-400 truncate max-w-[160px]">
                          <StickyNote className="w-2.5 h-2.5 shrink-0" />
                          {p.notes}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 mr-2">
                    {(balances[p.id] ?? p.openingBalance) !== 0 && (
                      <div className="flex items-center gap-1">
                        <Wallet className="w-2.5 h-2.5 text-slate-400" />
                        <span className={`text-[10px] font-semibold ${(balances[p.id] ?? p.openingBalance) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {formatCurrency(Math.abs(balances[p.id] ?? p.openingBalance))}
                          <span className="font-medium ml-0.5">{(balances[p.id] ?? p.openingBalance) > 0 ? " Dr" : " Cr"}</span>
                        </span>
                      </div>
                    )}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${p.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); openEdit(p) }}
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                      className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 ml-0.5" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit modal */}
      <Dialog open={showForm} onOpenChange={open => !open && closeForm()}>
        <DialogContent className="sm:max-w-sm p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-slate-100">
            <DialogTitle className="text-sm font-bold text-slate-800">
              {editingId ? "Edit Person" : "Add Person"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ahmad Bhai"
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Phone</Label>
              <Input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="03xx-xxxxxxx"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Opening Balance (Rs)
              </Label>
              <MoneyInput
                value={form.openingBalance}
                onChange={v => setForm(f => ({ ...f, openingBalance: Number(v) }))}
                className="h-8 text-xs"
                placeholder="0"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Positive = they need to pay us · Negative = we need to pay them</p>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Notes</Label>
              <Input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Person["status"] }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-4 py-3 border-t border-slate-100 gap-2">
            <Button variant="outline" size="sm" onClick={closeForm} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none gap-1.5">
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Person"
        description={`This will delete "${deleteTarget?.name}" and all their transactions. This cannot be undone.`}
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}


export default function PersonsPage() {
  return (
    <PermissionGate permission="ledger.view">
      <PersonsPageInner />
    </PermissionGate>
  )
}

