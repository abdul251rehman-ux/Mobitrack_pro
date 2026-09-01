"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Plus, Pencil, Trash2, ShieldCheck, User, Phone, Mail, Lock,
  Eye, EyeOff, Check, X, ChevronDown, ChevronUp, Save,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { getTenantId, hashPassword } from "@/lib/api/helpers"
import { createAuditLog } from "@/lib/api/audit"
import { useAuth, type UserRole, ALL_MODULES, ROLE_PERMISSION_TEMPLATES } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { PermissionGate } from "@/components/shared/permission-gate"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
  createdAt: string
  permissions: string[] | null
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const addSchema = z.object({
  name:     z.string().min(2, "Name required"),
  email:    z.string().email("Valid email required"),
  phone:    z.string().min(7, "Phone required"),
  role:     z.string().min(1, "Role required"),
  password: z.string().min(6, "Min 6 characters"),
})
type AddForm = z.infer<typeof addSchema>

const editSchema = z.object({
  name:     z.string().min(2, "Name required"),
  phone:    z.string().min(7, "Phone required"),
  role:     z.string().min(1, "Role required"),
  status:   z.enum(["Active", "Inactive"] as const),
  password: z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

// ── Permission Matrix ──────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit", delete: "Delete", general: "Access",
}

function permKey(moduleKey: string, action: string) {
  return `${moduleKey}.${action}`
}

function PermissionMatrix({
  permissions,
  onChange,
  disabled,
}: {
  permissions: string[]
  onChange: (perms: string[]) => void
  disabled?: boolean
}) {
  const toggle = (key: string) => {
    if (disabled) return
    onChange(
      permissions.includes(key)
        ? permissions.filter(p => p !== key)
        : [...permissions, key]
    )
  }

  const toggleModule = (moduleKey: string, actions: readonly string[]) => {
    if (disabled) return
    const keys = actions.map(a => permKey(moduleKey, a))
    const allChecked = keys.every(k => permissions.includes(k))
    if (allChecked) {
      onChange(permissions.filter(p => !keys.includes(p)))
    } else {
      const next = [...permissions]
      keys.forEach(k => { if (!next.includes(k)) next.push(k) })
      onChange(next)
    }
  }

  const selectAll = () => {
    if (disabled) return
    const all: string[] = []
    ALL_MODULES.forEach(m => m.actions.forEach(a => all.push(permKey(m.key, a))))
    onChange(all)
  }

  const clearAll = () => {
    if (disabled) return
    onChange([])
  }

  return (
    <div className="space-y-2">
      {!disabled && (
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={selectAll} className="text-[11px] text-indigo-600 hover:underline font-medium">Select All</button>
          <span className="text-slate-300">·</span>
          <button type="button" onClick={clearAll} className="text-[11px] text-slate-500 hover:underline">Clear All</button>
          <span className="ml-auto text-[11px] text-slate-400">{permissions.length} permissions selected</span>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Module</th>
              {["view","create","edit","delete","general"].map(a => (
                <th key={a} className="px-2 py-2 text-center font-semibold text-slate-500 capitalize w-16">{ACTION_LABELS[a]}</th>
              ))}
              <th className="px-2 py-2 text-center font-semibold text-slate-400 w-14">All</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ALL_MODULES.map((mod) => {
              const allKeys = mod.actions.map(a => permKey(mod.key, a))
              const allChecked = allKeys.every(k => permissions.includes(k))
              const someChecked = allKeys.some(k => permissions.includes(k))
              return (
                <tr key={mod.key} className={cn("transition-colors", someChecked && "bg-indigo-50/30")}>
                  <td className="px-3 py-2 font-medium text-slate-700">{mod.label}</td>
                  {["view","create","edit","delete","general"].map(action => {
                    const hasAction = (mod.actions as readonly string[]).includes(action)
                    const key = permKey(mod.key, action)
                    const checked = permissions.includes(key)
                    return (
                      <td key={action} className="px-2 py-2 text-center">
                        {hasAction ? (
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggle(key)}
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all",
                              checked
                                ? "bg-indigo-600 border-indigo-600 text-white"
                                : "border-slate-300 hover:border-indigo-400",
                              disabled && "cursor-default opacity-60"
                            )}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span className="block w-5 h-5 mx-auto" />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleModule(mod.key, mod.actions)}
                      className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all",
                        allChecked
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : someChecked
                          ? "bg-amber-400 border-amber-400 text-white"
                          : "border-slate-300 hover:border-emerald-400",
                        disabled && "cursor-default opacity-60"
                      )}
                    >
                      {allChecked && <Check className="w-3 h-3" />}
                      {someChecked && !allChecked && <span className="block w-1.5 h-0.5 bg-white rounded" />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

const avatarColors = ["bg-indigo-600","bg-violet-600","bg-emerald-600","bg-amber-600","bg-rose-600","bg-cyan-600"]

function Avatar({ name, id }: { name: string; id: string }) {
  const idx = id.charCodeAt(0) % avatarColors.length
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColors[idx]}`}>
      {getInitials(name)}
    </div>
  )
}

function RoleBadge({ role, permissions }: { role: string; permissions: string[] | null }) {
  const isAdmin = role === "Admin"
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
      isAdmin
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : "bg-indigo-50 text-indigo-700 border-indigo-200"
    )}>
      <ShieldCheck className="w-3 h-3" />
      {role}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function StaffPageInner() {
  const { user: currentUser, hasPermission } = useAuth()
  const [staff, setStaff]             = useState<StaffMember[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [editTarget, setEditTarget]   = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [expandedPerms, setExpandedPerms] = useState<string | null>(null)

  async function fetchStaff() {
    try {
      const tenantId = await getTenantId()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, status, created_at, permissions")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
      if (error) throw error
      setStaff((data ?? []).map((r: any) => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone,
        role: r.role, status: r.status, createdAt: r.created_at,
        permissions: Array.isArray(r.permissions) ? r.permissions : null,
      })))
    } catch {
      toast.error("Failed to load staff")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const tenantId = await getTenantId()
      const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id).eq("tenant_id", tenantId)
      if (error) throw error
      setStaff(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success(`${deleteTarget.name} removed`)
      await createAuditLog({
        timestamp: new Date().toISOString(),
        userId: currentUser?.id ?? "system",
        userName: currentUser?.name ?? "Unknown",
        userRole: currentUser?.role ?? "Admin",
        action: "DELETE",
        module: "Settings",
        entityId: deleteTarget.id,
        entityName: deleteTarget.name,
        description: `Removed staff member ${deleteTarget.name} (${deleteTarget.role})`,
        oldValue: JSON.stringify({ name: deleteTarget.name, role: deleteTarget.role, email: deleteTarget.email }),
      })
      setDeleteTarget(null)
    } catch {
      toast.error("Failed to delete staff member")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const isAdmin = hasPermission("settings.general")
  // Distinct from isAdmin above (which really means "can access this page") -
  // only a true Admin may grant the Admin role to anyone, themselves included.
  const isTrueAdmin = currentUser?.role === "Admin" || currentUser?.permissions === "*"

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description="Manage staff accounts and their access permissions"
        action={isAdmin ? (
          <Button onClick={() => setShowAdd(true)} className="h-9 gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
        ) : undefined}
      />

      {/* Staff list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <User className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No staff members yet</p>
            {isAdmin && <p className="text-xs mt-1">Click "Add Staff" to get started</p>}
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-slate-100">
            {staff.map(member => {
              const effectivePerms = member.role === "Admin"
                ? "*"
                : (member.permissions ?? ROLE_PERMISSION_TEMPLATES[member.role] ?? []) as string[] | "*"
              const permCount = effectivePerms === "*" ? "All" : `${(effectivePerms as string[]).length}`
              const isExpanded = expandedPerms === member.id
              return (
                <div key={member.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} id={member.id} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                        {member.name}
                        {member.id === currentUser?.id && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">You</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{member.email}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                          onClick={() => setEditTarget(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {member.id !== currentUser?.id && (
                          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-rose-600"
                            onClick={() => setDeleteTarget(member)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {member.phone && (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" /> {member.phone}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <RoleBadge role={member.role} permissions={member.permissions} />
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full border",
                      member.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      {member.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedPerms(isExpanded ? null : member.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                      effectivePerms === "*" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {permCount}
                    </span>
                    <span className="text-[11px]">permissions</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    effectivePerms === "*" ? (
                      <p className="text-xs text-violet-700 font-medium">Full access to everything — Admin</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(effectivePerms as string[]).map(p => (
                          <span key={p} className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            {p}
                          </span>
                        ))}
                        {(effectivePerms as string[]).length === 0 && (
                          <span className="text-xs text-slate-400">No permissions assigned</span>
                        )}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Staff Member</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Contact</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden md:table-cell">Permissions</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(member => {
                  const effectivePerms = member.role === "Admin"
                    ? "*"
                    : (member.permissions ?? ROLE_PERMISSION_TEMPLATES[member.role] ?? []) as string[] | "*"
                  const permCount = effectivePerms === "*" ? "All" : `${(effectivePerms as string[]).length}`
                  const isExpanded = expandedPerms === member.id

                  return (
                    <React.Fragment key={member.id}>
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} id={member.id} />
                            <div>
                              <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                {member.name}
                                {member.id === currentUser?.id && (
                                  <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">You</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <p className="text-xs text-slate-600">{member.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <RoleBadge role={member.role} permissions={member.permissions} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full border",
                            member.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          )}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <button
                            type="button"
                            onClick={() => setExpandedPerms(isExpanded ? null : member.id)}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
                          >
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-semibold",
                              effectivePerms === "*" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {permCount}
                            </span>
                            <span className="text-[11px]">permissions</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-indigo-600"
                                onClick={() => setEditTarget(member)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {member.id !== currentUser?.id && (
                                <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-rose-600"
                                  onClick={() => setDeleteTarget(member)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={isAdmin ? 6 : 5} className="px-4 py-3">
                            {effectivePerms === "*" ? (
                              <p className="text-xs text-violet-700 font-medium">Full access to everything — Admin</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {(effectivePerms as string[]).map(p => (
                                  <span key={p} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    {p}
                                  </span>
                                ))}
                                {(effectivePerms as string[]).length === 0 && (
                                  <span className="text-xs text-slate-400">No permissions assigned</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {isAdmin && (
        <AddStaffDialog
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={member => { setStaff(prev => [...prev, member]); setShowAdd(false) }}
          actor={currentUser}
          canGrantAdmin={isTrueAdmin}
        />
      )}

      {isAdmin && editTarget && (
        <EditStaffDialog
          member={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={updated => {
            setStaff(prev => prev.map(s => s.id === updated.id ? updated : s))
            setEditTarget(null)
          }}
          actor={currentUser}
          canGrantAdmin={isTrueAdmin}
          isSelf={editTarget.id === currentUser?.id}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => { if (!v) setDeleteTarget(null) }}
        title="Remove Staff Member?"
        description={`This will permanently remove ${deleteTarget?.name} and they will no longer be able to log in.`}
        confirmLabel={deleting ? "Removing..." : "Remove"}
        onConfirm={handleDelete}
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}

// ── Add Staff Dialog ──────────────────────────────────────────────────────────

const PRESET_ROLES = ["Admin", "Manager", "Cashier", "Custom"]

function AddStaffDialog({ open, onClose, onAdded, actor, canGrantAdmin }: {
  open: boolean
  onClose: () => void
  onAdded: (member: StaffMember) => void
  actor: import("@/context/auth-context").AuthUser | null
  /** Only a true Admin can create another Admin account. */
  canGrantAdmin: boolean
}) {
  const availableRoles = canGrantAdmin ? PRESET_ROLES : PRESET_ROLES.filter(r => r !== "Admin")
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState("Cashier")
  const [permissions, setPermissions] = useState<string[]>([])
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { role: "Cashier" },
  })

  useEffect(() => {
    if (open) {
      reset({ role: "Cashier" })
      setSelectedRole("Cashier")
      const tmpl = ROLE_PERMISSION_TEMPLATES["Cashier"]
      setPermissions(tmpl === "*" ? [] : tmpl as string[])
    }
  }, [open, reset])

  function handleRoleChange(role: string) {
    setSelectedRole(role)
    if (role !== "Custom") {
      const tmpl = ROLE_PERMISSION_TEMPLATES[role]
      setPermissions(tmpl === "*" ? [] : (tmpl as string[]) ?? [])
    }
  }

  async function onSubmit(data: AddForm) {
    if (saving) return
    if (selectedRole === "Admin" && !canGrantAdmin) {
      toast.error("Only an Admin can grant the Admin role")
      return
    }
    setSaving(true)
    try {
      const tenantId = await getTenantId()
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", data.email.toLowerCase().trim()).single()
      if (existing) { toast.error("Email already registered"); return }

      const isAdminRole = selectedRole === "Admin"
      const finalPerms = isAdminRole ? null : permissions
      // "Custom" is a UI label only — store as "Cashier" in DB to satisfy the CHECK constraint
      const dbRole = selectedRole === "Custom" ? "Cashier" : selectedRole

      const { data: created, error } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone.trim(),
        role: dbRole,
        password: await hashPassword(data.password),
        status: "Active",
        permissions: finalPerms,
      }).select().single()

      if (error) throw error
      toast.success(`${data.name} added`)
      await createAuditLog({
        timestamp: new Date().toISOString(),
        userId: actor?.id ?? "system",
        userName: actor?.name ?? "Unknown",
        userRole: actor?.role ?? "Admin",
        action: "CREATE",
        module: "Settings",
        entityId: created.id,
        entityName: created.name,
        description: `Added new staff member ${created.name} as ${selectedRole}`,
        newValue: JSON.stringify({ name: created.name, email: created.email, role: selectedRole, permissions: finalPerms }),
      })
      onAdded({
        id: created.id, name: created.name, email: created.email, phone: created.phone,
        role: created.role, status: created.status, createdAt: created.created_at,
        permissions: Array.isArray(created.permissions) ? created.permissions : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add staff")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Plus className="w-4 h-4 text-indigo-600" /> Add Staff Member
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Create login credentials and set permissions</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1 min-w-0">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("name")} placeholder="e.g. Ali Hassan" className="pl-8 h-9 text-sm" />
              </div>
              {errors.name && <p className="text-[11px] text-rose-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("phone")} placeholder="03001234567" className="pl-8 h-9 text-sm" />
              </div>
              {errors.phone && <p className="text-[11px] text-rose-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Email (Login ID) *</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("email")} placeholder="ali@shop.com" className="pl-8 h-9 text-sm" />
              </div>
              {errors.email && <p className="text-[11px] text-rose-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="Min 6 chars" className="pl-8 pr-9 h-9 text-sm" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-rose-500">{errors.password.message}</p>}
            </div>
          </div>

          {/* Role template picker */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Role Template</Label>
            <div className="flex gap-2 flex-wrap">
              {availableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleChange(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    selectedRole === r
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {selectedRole === "Admin" && (
              <p className="text-[11px] text-violet-600 font-medium mt-1">Admin has full access to everything — no restrictions</p>
            )}
            {selectedRole === "Custom" && (
              <p className="text-[11px] text-amber-600 font-medium mt-1">Manually select which actions this staff can perform</p>
            )}
          </div>

          {/* Permission matrix (hidden for Admin) */}
          {selectedRole !== "Admin" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Permissions</Label>
              <PermissionMatrix permissions={permissions} onChange={setPermissions} />
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-9 text-sm gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Adding..." : "Add Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Staff Dialog ─────────────────────────────────────────────────────────

function EditStaffDialog({ member, onClose, onUpdated, actor, canGrantAdmin, isSelf }: {
  member: StaffMember
  onClose: () => void
  onUpdated: (member: StaffMember) => void
  actor: import("@/context/auth-context").AuthUser | null
  /** Only a true Admin can promote someone to Admin. */
  canGrantAdmin: boolean
  /** Editing your own account - role/permissions are locked to prevent self-escalation. */
  isSelf: boolean
}) {
  const availableRoles = canGrantAdmin ? PRESET_ROLES : PRESET_ROLES.filter(r => r !== "Admin")
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedRole, setSelectedRole] = useState(member.role)
  const [permissions, setPermissions] = useState<string[]>([])

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    reset({ name: member.name, phone: member.phone, role: member.role, status: member.status as any, password: "" })
    setSelectedRole(member.role)
    if (member.role === "Admin") {
      setPermissions([])
    } else if (Array.isArray(member.permissions) && member.permissions.length > 0) {
      setPermissions(member.permissions)
    } else {
      const tmpl = ROLE_PERMISSION_TEMPLATES[member.role]
      setPermissions(tmpl === "*" ? [] : (tmpl as string[]) ?? [])
    }
  }, [member, reset])

  function handleRoleChange(role: string) {
    setSelectedRole(role)
    if (role !== "Custom" && role !== member.role) {
      const tmpl = ROLE_PERMISSION_TEMPLATES[role]
      setPermissions(tmpl === "*" ? [] : (tmpl as string[]) ?? [])
    }
  }

  async function onSubmit(data: EditForm) {
    if (saving) return
    if (isSelf && selectedRole !== member.role) {
      toast.error("You can't change your own role")
      return
    }
    if (selectedRole === "Admin" && member.role !== "Admin" && !canGrantAdmin) {
      toast.error("Only an Admin can grant the Admin role")
      return
    }
    setSaving(true)
    try {
      const tenantId = await getTenantId()
      // Self-edits keep their existing role/permissions no matter what the form
      // holds, so a stale/tampered selectedRole can never smuggle a role change through.
      const effectiveRole = isSelf ? member.role : selectedRole
      const isAdminRole = effectiveRole === "Admin"
      const finalPerms = isAdminRole ? null : (isSelf ? member.permissions ?? permissions : permissions)
      const dbRole = effectiveRole === "Custom" ? "Cashier" : effectiveRole

      const update: any = {
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: dbRole,
        status: data.status,
        permissions: finalPerms,
      }
      if (data.password && data.password.length >= 6) update.password = await hashPassword(data.password)

      const { error } = await supabase.from("profiles").update(update).eq("id", member.id).eq("tenant_id", tenantId)
      if (error) throw error
      toast.success(`${data.name} updated`)
      await createAuditLog({
        timestamp: new Date().toISOString(),
        userId: actor?.id ?? "system",
        userName: actor?.name ?? "Unknown",
        userRole: actor?.role ?? "Admin",
        action: "UPDATE",
        module: "Settings",
        entityId: member.id,
        entityName: data.name.trim(),
        description: `Updated staff member ${data.name.trim()} — role: ${member.role}→${effectiveRole}`,
        oldValue: JSON.stringify({ name: member.name, role: member.role, status: member.status }),
        newValue: JSON.stringify({ name: data.name.trim(), role: effectiveRole, status: data.status, permissions: finalPerms }),
      })
      onUpdated({
        ...member,
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: effectiveRole,
        status: data.status,
        permissions: Array.isArray(finalPerms) ? finalPerms : null,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[96vw] max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Pencil className="w-4 h-4 text-indigo-600" /> Edit Staff Member
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">{member.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Full Name *</Label>
              <Input {...register("name")} className="h-9 text-sm" />
              {errors.name && <p className="text-[11px] text-rose-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Phone *</Label>
              <Input {...register("phone")} className="h-9 text-sm" />
              {errors.phone && <p className="text-[11px] text-rose-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Status *</Label>
              <Select value={watch("status")} onValueChange={v => setValue("status", v as any)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">New Password <span className="text-slate-400 font-normal">(optional)</span></Label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="Leave blank to keep" className="pl-8 pr-9 h-9 text-sm" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role template picker - locked entirely when editing your own account */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Role Template</Label>
            <div className="flex gap-2 flex-wrap">
              {availableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  disabled={isSelf}
                  onClick={() => handleRoleChange(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    isSelf ? "opacity-50 cursor-not-allowed" : "",
                    selectedRole === r
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            {isSelf && (
              <p className="text-[11px] text-slate-400 mt-1">You can't change your own role or permissions</p>
            )}
            {!isSelf && selectedRole === "Admin" && (
              <p className="text-[11px] text-violet-600 font-medium mt-1">Admin has full access to everything</p>
            )}
          </div>

          {selectedRole !== "Admin" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Permissions</Label>
              <PermissionMatrix permissions={permissions} onChange={setPermissions} disabled={isSelf} />
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-9 text-sm gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function StaffPage() {
  return (
    <PermissionGate permission="settings.general">
      <StaffPageInner />
    </PermissionGate>
  )
}
