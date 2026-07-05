﻿"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Users, Phone, StickyNote, Wallet, X, Check, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { getPersons, createPerson, updatePerson, deletePerson } from "@/lib/api/persons"
import type { Person } from "@/lib/api/persons"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const EMPTY: Omit<Person, "id" | "tenantId" | "createdAt"> = {
  name: "",
  phone: "",
  notes: "",
  openingBalance: 0,
  status: "Active",
}

export default function PersonsPage() {
  const router = useRouter()
  const [persons, setPersons] = useState<Person[]>([])
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
      const data = await getPersons()
      setPersons(data)
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
    if (!form.name.trim()) { toast.error("Name is required"); return }
    setSaving(true)
    try {
      if (editingId) {
        await updatePerson(editingId, form)
        setPersons(p => p.map(x => x.id === editingId ? { ...x, ...form } : x))
        toast.success("Person updated")
      } else {
        const created = await createPerson(form)
        setPersons(p => [...p, created].sort((a, b) => a.name.localeCompare(b.name)))
        toast.success("Person added")
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">Persons</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage people for informal money transactions</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Person
        </button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="px-3 py-2.5">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <button onClick={openAdd} className="mt-3 text-xs text-blue-600 hover:underline">
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
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-violet-700 text-xs font-bold">
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
                    {p.openingBalance !== 0 && (
                      <div className="flex items-center gap-1">
                        <Wallet className="w-2.5 h-2.5 text-slate-400" />
                        <span className={`text-[10px] font-semibold ${p.openingBalance > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatCurrency(Math.abs(p.openingBalance))}
                          <span className="font-medium ml-0.5">{p.openingBalance > 0 ? " Dr" : " Cr"}</span>
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
                      className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                      className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
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
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={closeForm} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-800">
                  {editingId ? "Edit Person" : "Add Person"}
                </h2>
                <button onClick={closeForm} className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Ahmad Bhai"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="03xx-xxxxxxx"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Opening Balance (â‚¨)
                  </label>
                  <input
                    type="number" onWheel={e => e.currentTarget.blur()}
                    value={form.openingBalance}
                    onChange={e => setForm(f => ({ ...f, openingBalance: Number(e.target.value) }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Positive = they need to pay us · Negative = we need to pay them</p>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes"
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Person["status"] }))}
                    className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <button
                  onClick={closeForm}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 font-medium"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-5 text-center">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 mb-1">Delete Person?</h3>
              <p className="text-xs text-slate-500 mb-4">
                This will delete <span className="font-semibold text-slate-700">{deleteTarget.name}</span> and all their transactions. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 h-8 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg transition-colors font-medium"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
