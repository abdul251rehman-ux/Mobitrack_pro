"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Smartphone, Package, ShoppingCart, TrendingUp, Users, Truck,
  BarChart2, Settings, ChevronLeft, ChevronRight, LogOut, Layers, Tag, Award, ChevronDown, X, BookOpen, UserCheck, Building2, ScanLine, Bell, RefreshCw, Plus, Receipt,
  RotateCcw, Shield, Wallet, ClipboardList, DollarSign,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/app-context"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

type SubItem = { label: string; icon: React.ElementType; href: string }
type NavLink = { label: string; icon: React.ElementType; href: string; children?: never }
type NavAccordion = { label: string; icon: React.ElementType; href?: never; children: SubItem[] }
type NavItem = NavLink | NavAccordion
type NavSection = { section: string; items: NavItem[] }

const navSections: NavSection[] = [
  {
    section: "MAIN",
    items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/" }],
  },
  {
    section: "INVENTORY",
    items: [
      { label: "Mobile Phones", icon: Smartphone, href: "/products/mobiles" },
      { label: "Accessories", icon: Package, href: "/products/accessories" },
      { label: "IMEI Tracker", icon: ScanLine, href: "/inventory/imei-tracker" },
      { label: "Stock Alerts", icon: Bell, href: "/inventory/stock-alerts" },
      { label: "Used Phones", icon: RefreshCw, href: "/inventory/used-phones" },
      {
        label: "Catalog",
        icon: Layers,
        children: [
          { label: "Categories", icon: Tag, href: "/catalog/categories" },
          { label: "Brands", icon: Award, href: "/catalog/brands" },
        ],
      },
    ],
  },
  {
    section: "TRANSACTIONS",
    items: [
      { label: "Sales", icon: ShoppingCart, href: "/sales" },
      { label: "Purchases", icon: TrendingUp, href: "/purchases" },
      { label: "Returns", icon: RotateCcw, href: "/returns" },
      { label: "Payments", icon: Wallet, href: "/payments" },
      { label: "Expenses", icon: Receipt, href: "/expenses" },
      {
        label: "Ledger",
        icon: BookOpen,
        children: [
          { label: "Customer Ledger", icon: UserCheck, href: "/ledger/customers" },
          { label: "Supplier Ledger", icon: Building2, href: "/ledger/suppliers" },
        ],
      },
    ],
  },
  {
    section: "PEOPLE",
    items: [
      { label: "Suppliers", icon: Truck, href: "/suppliers" },
      { label: "Customers", icon: Users, href: "/customers" },
      { label: "Shops", icon: Building2, href: "/shops" },
    ],
  },
  {
    section: "SERVICES",
    items: [
      { label: "Warranty & Repair", icon: Shield, href: "/warranty" },
    ],
  },
  {
    section: "INSIGHTS",
    items: [
      { label: "Reports & Analytics", icon: BarChart2, href: "/reports" },
      { label: "Profit & Loss", icon: DollarSign, href: "/profit-loss" },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { label: "Audit Log", icon: ClipboardList, href: "/audit-log" },
      { label: "Settings", icon: Settings, href: "/settings" },
    ],
  },
]

function SidebarContent({
  sidebarCollapsed,
  toggleSidebar,
  onNavClick,
  showCollapseBtn,
}: {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  onNavClick?: () => void
  showCollapseBtn: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [openAccordion, setOpenAccordion] = useState<string | null>(
    pathname.startsWith("/catalog") ? "Catalog"
      : pathname.startsWith("/ledger") ? "Ledger"
      : null
  )

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  const toggleAccordion = (label: string) => {
    setOpenAccordion((prev) => (prev === label ? null : label))
  }

  return (
    <div
      className={cn(
        "flex flex-col h-full transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-[256px] max-w-[85vw]"
      )}
      style={{ backgroundColor: "#0F172A" }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-16 border-b px-4 flex-shrink-0 border-white/10",
          sidebarCollapsed ? "justify-center px-2" : "gap-3"
        )}
      >
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/40">
          <Smartphone className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-bold text-sm leading-tight tracking-tight">MobiTrack Pro</p>
            <p className="text-slate-400 text-[11px]">Management System</p>
          </div>
        )}
        {/* Close button — mobile drawer only */}
        {onNavClick && (
          <button
            onClick={onNavClick}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── New Sale Button ── */}
      <div className={cn("px-3 pt-3 pb-1 shrink-0", sidebarCollapsed && "px-2")}>
        {sidebarCollapsed ? (
          <button
            onClick={() => { router.push("/sales/new"); onNavClick?.() }}
            title="New Sale"
            className="group relative w-full flex items-center justify-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/40"
          >
            <Plus className="w-5 h-5 text-white" />
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
              New Sale
            </div>
          </button>
        ) : (
          <button
            onClick={() => { router.push("/sales/new"); onNavClick?.() }}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/40 group"
          >
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">New Sale</span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navSections.map(({ section, items }) => (
          <div key={section} className="mb-1">
            {!sidebarCollapsed && (
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest px-3 py-2 mt-2">
                {section}
              </p>
            )}
            {sidebarCollapsed && <div className="h-3" />}

            {items.map((item) => {
              // ── Accordion item ─────────────────────────────────────────
              if (item.children) {
                const isOpen = openAccordion === item.label
                const anyChildActive = item.children.some((c) => isActive(c.href))
                const Icon = item.icon

                // Collapsed: show each child icon individually
                if (sidebarCollapsed) {
                  return item.children.map((child) => {
                    const ChildIcon = child.icon
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        title={child.label}
                        onClick={onNavClick}
                        className={cn(
                          "flex items-center justify-center rounded-lg mb-0.5 py-3 transition-all duration-150 group relative",
                          active
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        )}
                      >
                        <ChildIcon className={cn("flex-shrink-0 w-[18px] h-[18px]", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                          {child.label}
                        </div>
                      </Link>
                    )
                  })
                }

                // Expanded: accordion trigger + children
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleAccordion(item.label)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-0.5 transition-all duration-150 group",
                        anyChildActive
                          ? "text-white bg-white/5"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      )}
                    >
                      <Icon className={cn("flex-shrink-0 w-[18px] h-[18px]", anyChildActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200")} />
                      <span className={cn("text-[13px] font-medium flex-1 text-left truncate", anyChildActive ? "text-slate-200" : "text-slate-300 group-hover:text-white")}>
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 text-slate-500 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {/* Sub-items */}
                    {isOpen && (
                      <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 mb-1">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon
                          const active = isActive(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onNavClick}
                              className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 group",
                                active
                                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/30"
                                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                              )}
                            >
                              <ChildIcon className={cn("flex-shrink-0 w-[15px] h-[15px]", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                              <span className={cn("text-[12px] font-medium", active ? "text-white" : "text-slate-400 group-hover:text-white")}>
                                {child.label}
                              </span>
                              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              // ── Regular link item ──────────────────────────────────────
              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg mb-0.5 transition-all duration-150 group relative",
                    sidebarCollapsed ? "justify-center w-full px-0 py-3" : "gap-3 px-3 py-3",
                    active
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  )}
                >
                  <Icon className={cn("flex-shrink-0 w-[18px] h-[18px]", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")} />
                  {!sidebarCollapsed && (
                    <span className={cn("text-[13px] font-medium truncate", active ? "text-white" : "text-slate-300 group-hover:text-white")}>
                      {item.label}
                    </span>
                  )}
                  {active && !sidebarCollapsed && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                  )}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                      {item.label}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className={cn("border-t border-white/10 p-3 flex-shrink-0", sidebarCollapsed && "flex justify-center")}>
        {!sidebarCollapsed ? (
          <div
            onClick={() => { logout(); router.push("/auth/login") }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <span className="text-white text-xs font-bold">
                {user ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight truncate">{user?.name ?? "Guest"}</p>
              <p className="text-slate-500 text-[11px]">{user?.role ?? "Unknown"}</p>
            </div>
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
          </div>
        ) : (
          <div
            onClick={() => { logout(); router.push("/auth/login") }}
            className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer shadow-md"
            title="Logout"
          >
            <span className="text-white text-xs font-bold">
              {user ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
            </span>
          </div>
        )}
      </div>

      {/* Collapse toggle — desktop only */}
      {showCollapseBtn && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-[72px] w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center hover:bg-blue-600 hover:border-blue-500 transition-all z-50 shadow-lg"
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            : <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
          }
        </button>
      )}
    </div>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, closeMobileSidebar } = useApp()

  return (
    <>
      {/* ── Desktop sidebar (md and above) ─────────────────────── */}
      <aside className="hidden md:flex flex-shrink-0 relative h-screen sticky top-0 z-40">
        <SidebarContent
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          showCollapseBtn={true}
        />
      </aside>

      {/* ── Mobile drawer overlay ───────────────────────────────── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeMobileSidebar}
          />
          {/* Drawer */}
          <aside className="relative h-full w-[256px] max-w-[85vw] shadow-2xl">
            <SidebarContent
              sidebarCollapsed={false}
              toggleSidebar={toggleSidebar}
              onNavClick={closeMobileSidebar}
              showCollapseBtn={false}
            />
          </aside>
        </div>
      )}
    </>
  )
}
