"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, ShieldCheck, User, Phone, Mail, Lock, Eye, EyeOff } from "lucide-react"

import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { createAuditLog } from "@/lib/api/audit"
import { useAuth, type UserRole } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string
  role: UserRole
  status: string
  createdAt: string
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const addSchema = z.object({
  name:     z.string().min(2, "Name required"),
  email:    z.string().email("Valid email required"),
  phone:    z.string().min(7, "Phone required"),
  role:     z.enum(["Admin", "Manager", "Cashier"] as const),
  password: z.string().min(6, "Min 6 characters"),
})
type AddForm = z.infer<typeof addSchema>

const editSchema = z.object({
  name:     z.string().min(2, "Name required"),
  phone:    z.string().min(7, "Phone required"),
  role:     z.enum(["Admin", "Manager", "Cashier"] as const),
  status:   z.enum(["Active", "Inactive"] as const),
  password: z.string().optional(),
})
type EditForm = z.infer<typeof editSchema>

// ── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<UserRole, { color: string; bg: string; border: string; desc: string }> = {
  Admin:   { color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", desc: "Full access to everything" },
  Manager: { color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   desc: "All except settings & staff" },
  Cashier: { color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200",desc: "Sales & basic inventory only" },
}

const PERMISSION_SUMMARY: Record<UserRole, string[]> = {
  Admin:   ["Full system access", "Manage staff & settings", "All reports & finance", "Delete anything"],
  Manager: ["Sales, Purchases, Returns", "Inventory & products", "Customers & suppliers", "Ledger & expenses", "Reports"],
  Cashier: ["Create & view sales", "View products & inventory", "Add customers"],
}

function RoleBadge({ role }: { role: UserRole }) {
  const c = ROLE_CONFIG[role]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.color} ${c.bg} ${c.border}`}>
      <ShieldCheck className="w-3 h-3" />
      {role}
    </span>
  )
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
}

const avatarColors = ["bg-blue-600","bg-violet-600","bg-emerald-600","bg-amber-600","bg-rose-600","bg-cyan-600"]

function Avatar({ name, id }: { name: string; id: string }) {
  const idx = id.charCodeAt(0) % avatarColors.length
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColors[idx]}`}>
      {getInitials(name)}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { user: currentUser, hasPermission } = useAuth()
  const [staff, setStaff]         = useState<StaffMember[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)
  const [deleting, setDeleting]   = useState(false)

  async function fetchStaff() {
    try {
      const tenantId = await getTenantId()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, status, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
      if (error) throw error
      setStaff((data ?? []).map((r: any) => ({
        id: r.id, name: r.name, email: r.email, phone: r.phone,
        role: r.role, status: r.status, createdAt: r.created_at,
      })))
    } catch (err) {
      toast.error("Failed to load staff")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  async function handleDelete() {
    if (!deleteTarget) return
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  const isAdmin = hasPermission("settings.general")

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff"
        description="Manage staff accounts and their access roles"
        action={isAdmin ? (
          <Button onClick={() => setShowAdd(true)} className="h-9 gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> Add Staff
          </Button>
        ) : undefined}
      />

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(["Admin", "Manager", "Cashier"] as UserRole[]).map(role => {
          const c = ROLE_CONFIG[role]
          const count = staff.filter(s => s.role === role).length
          return (
            <div key={role} className={`rounded-xl border p-3.5 ${c.bg} ${c.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold uppercase tracking-wide ${c.color}`}>{role}</span>
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${c.bg} ${c.color} border ${c.border}`}>{count} staff</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">{ROLE_CONFIG[role].desc}</p>
              <ul className="space-y-0.5">
                {PERMISSION_SUMMARY[role].map(p => (
                  <li key={p} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full shrink-0 ${c.color.replace("text-","bg-")}`} />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* Staff list */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {staff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <User className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No staff members yet</p>
            {isAdmin && <p className="text-xs mt-1">Click "Add Staff" to get started</p>}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Staff Member</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 hidden sm:table-cell">Contact</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} id={member.id} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                          {member.name}
                          {member.id === currentUser?.id && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">You</span>
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
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      member.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-blue-600"
                          onClick={() => setEditTarget(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {member.id !== currentUser?.id && (
                          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400 hover:text-red-600"
                            onClick={() => setDeleteTarget(member)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Dialog */}
      {isAdmin && (
        <AddStaffDialog
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdded={member => { setStaff(prev => [...prev, member]); setShowAdd(false) }}
          actor={currentUser}
        />
      )}

      {/* Edit Dialog */}
      {isAdmin && editTarget && (
        <EditStaffDialog
          member={editTarget}
          onClose={() => setEditTarget(null)}
          onUpdated={updated => {
            setStaff(prev => prev.map(s => s.id === updated.id ? updated : s))
            setEditTarget(null)
          }}
          actor={currentUser}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => { if (!v) setDeleteTarget(null) }}
        title="Remove Staff Member?"
        description={`This will permanently remove ${deleteTarget?.name} and they will no longer be able to log in.`}
        confirmLabel={deleting ? "Removing..." : "Remove"}
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}

// ── Add Staff Dialog ──────────────────────────────────────────────────────────

function AddStaffDialog({ open, onClose, onAdded, actor }: {
  open: boolean
  onClose: () => void
  onAdded: (member: StaffMember) => void
  actor: import("@/context/auth-context").AuthUser | null
}) {
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { role: "Cashier" },
  })

  useEffect(() => { if (open) reset({ role: "Cashier" }) }, [open, reset])

  async function onSubmit(data: AddForm) {
    setSaving(true)
    try {
      const tenantId = await getTenantId()
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", data.email.toLowerCase().trim()).single()
      if (existing) { toast.error("Email already registered"); return }

      const { data: created, error } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        phone: data.phone.trim(),
        role: data.role,
        password: data.password,
        status: "Active",
      }).select().single()

      if (error) throw error
      toast.success(`${data.name} added as ${data.role}`)
      await createAuditLog({
        timestamp: new Date().toISOString(),
        userId: actor?.id ?? "system",
        userName: actor?.name ?? "Unknown",
        userRole: actor?.role ?? "Admin",
        action: "CREATE",
        module: "Settings",
        entityId: created.id,
        entityName: created.name,
        description: `Added new staff member ${created.name} as ${data.role}`,
        newValue: JSON.stringify({ name: created.name, email: created.email, role: data.role }),
      })
      onAdded({ id: created.id, name: created.name, email: created.email, phone: created.phone, role: created.role, status: created.status, createdAt: created.created_at })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add staff")
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = watch("role")

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Plus className="w-4 h-4 text-blue-600" /> Add Staff Member
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Create login credentials and assign a role</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Full Name *</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("name")} placeholder="e.g. Ali Hassan" className="pl-8 h-9 text-sm" />
              </div>
              {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Phone *</Label>
              <div className="relative">
                <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <Input {...register("phone")} placeholder="03001234567" className="pl-8 h-9 text-sm" />
              </div>
              {errors.phone && <p className="text-[11px] text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Email (Login ID) *</Label>
            <div className="relative">
              <Mail className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input {...register("email")} placeholder="ali@yourshop.com" className="pl-8 h-9 text-sm" />
            </div>
            {errors.email && <p className="text-[11px] text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Password *</Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="Min 6 characters" className="pl-8 pr-9 h-9 text-sm" />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">Role *</Label>
            <Select value={selectedRole} onValueChange={v => setValue("role", v as UserRole)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["Admin","Manager","Cashier"] as UserRole[]).map(r => (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className={`w-3.5 h-3.5 ${ROLE_CONFIG[r].color}`} />
                      <span>{r}</span>
                      <span className="text-[11px] text-slate-400">— {ROLE_CONFIG[r].desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRole && (
            <div className={`rounded-lg border px-3 py-2 ${ROLE_CONFIG[selectedRole as UserRole].bg} ${ROLE_CONFIG[selectedRole as UserRole].border}`}>
              <p className={`text-[11px] font-semibold mb-1 ${ROLE_CONFIG[selectedRole as UserRole].color}`}>Permissions for {selectedRole}:</p>
              <ul className="space-y-0.5">
                {PERMISSION_SUMMARY[selectedRole as UserRole].map(p => (
                  <li key={p} className="text-[11px] text-slate-600 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-9 text-sm">
              {saving ? "Adding..." : "Add Staff"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Edit Staff Dialog ─────────────────────────────────────────────────────────

function EditStaffDialog({ member, onClose, onUpdated, actor }: {
  member: StaffMember
  onClose: () => void
  onUpdated: (member: StaffMember) => void
  actor: import("@/context/auth-context").AuthUser | null
}) {
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    reset({ name: member.name, phone: member.phone, role: member.role, status: member.status as any, password: "" })
  }, [member, reset])

  async function onSubmit(data: EditForm) {
    setSaving(true)
    try {
      const tenantId = await getTenantId()
      const update: any = { name: data.name.trim(), phone: data.phone.trim(), role: data.role, status: data.status }
      if (data.password && data.password.length >= 6) update.password = data.password

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
        description: `Updated staff member ${data.name.trim()} — role: ${member.role}→${data.role}, status: ${member.status}→${data.status}`,
        oldValue: JSON.stringify({ name: member.name, role: member.role, status: member.status }),
        newValue: JSON.stringify({ name: data.name.trim(), role: data.role, status: data.status }),
      })
      onUpdated({ ...member, name: data.name.trim(), phone: data.phone.trim(), role: data.role, status: data.status })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update staff")
    } finally {
      setSaving(false)
    }
  }

  const selectedRole = watch("role")

  return (
    <Dialog open={true} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Pencil className="w-4 h-4 text-blue-600" /> Edit Staff Member
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">{member.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Full Name *</Label>
              <Input {...register("name")} className="h-9 text-sm" />
              {errors.name && <p className="text-[11px] text-red-500">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Phone *</Label>
              <Input {...register("phone")} className="h-9 text-sm" />
              {errors.phone && <p className="text-[11px] text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-600">Role *</Label>
              <Select value={selectedRole} onValueChange={v => setValue("role", v as UserRole)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["Admin","Manager","Cashier"] as UserRole[]).map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-600">New Password <span className="text-slate-400 font-normal">(leave blank to keep current)</span></Label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <Input {...register("password")} type={showPass ? "text" : "password"} placeholder="Leave blank to keep current" className="pl-8 pr-9 h-9 text-sm" />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-9 text-sm">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
