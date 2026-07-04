"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Smartphone, Package, ShoppingCart, TrendingUp, Users, Truck, ShoppingBag,
  BarChart2, Settings, ChevronLeft, ChevronRight, LogOut, Layers, Tag, Award, ChevronDown, X, BookOpen, UserCheck, Building2, Bell, RefreshCw, Plus, Receipt,
  RotateCcw, Wallet, ClipboardList, UserRound, Palette, HardDrive, Cpu,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/app-context"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"

type SubItem = { label: string; icon: React.ElementType; href: string; permission?: string }
type NavLink = { label: string; icon: React.ElementType; href: string; children?: never; permission?: string }
type NavAccordion = { label: string; icon: React.ElementType; href?: never; children: SubItem[]; permission?: string }
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
      { label: "Mobile Phones", icon: Smartphone, href: "/products/mobiles", permission: "products.view" },
      { label: "Accessories", icon: Package, href: "/products/accessories", permission: "products.view" },
      { label: "Stock Alerts", icon: Bell, href: "/inventory/stock-alerts", permission: "inventory.view" },
      { label: "Used Phones", icon: RefreshCw, href: "/inventory/used-phones", permission: "inventory.view" },
      {
        label: "Catalog",
        icon: Layers,
        permission: "catalog.view",
        children: [
          { label: "Categories", icon: Tag, href: "/catalog/categories", permission: "catalog.view" },
          { label: "Brands", icon: Award, href: "/catalog/brands", permission: "catalog.view" },
          { label: "Models", icon: Smartphone, href: "/catalog/models", permission: "catalog.view" },
          { label: "Colors", icon: Palette, href: "/catalog/colors", permission: "catalog.view" },
          { label: "Storage", icon: HardDrive, href: "/catalog/storage", permission: "catalog.view" },
          { label: "RAM", icon: Cpu, href: "/catalog/ram", permission: "catalog.view" },
        ],
      },
    ],
  },
  {
    section: "TRANSACTIONS",
    items: [
      { label: "Sales", icon: ShoppingCart, href: "/sales", permission: "sales.view" },
      { label: "Purchases", icon: TrendingUp, href: "/purchases", permission: "purchases.view" },
      { label: "Returns", icon: RotateCcw, href: "/returns", permission: "returns.view" },
      { label: "Purchase Returns", icon: RefreshCw, href: "/purchase-returns", permission: "purchases.view" },
      { label: "Finance", icon: Wallet, href: "/finance", permission: "payments.view" },
      { label: "Expenses", icon: Receipt, href: "/expenses", permission: "expenses.view" },
      {
        label: "Ledger",
        icon: BookOpen,
        permission: "ledger.view",
        children: [
          { label: "Customer Ledger", icon: UserCheck, href: "/ledger/customers", permission: "ledger.view" },
          { label: "Supplier Ledger", icon: Building2, href: "/ledger/suppliers", permission: "ledger.view" },
          { label: "Person Ledger", icon: UserRound, href: "/ledger/persons", permission: "ledger.view" },
        ],
      },
    ],
  },
  {
    section: "PEOPLE",
    items: [
      { label: "Suppliers", icon: Truck, href: "/suppliers", permission: "suppliers.view" },
      { label: "Customers", icon: Users, href: "/customers", permission: "customers.view" },
      { label: "Persons", icon: UserRound, href: "/persons", permission: "ledger.view" },
    ],
  },
  {
    section: "INSIGHTS",
    items: [
      { label: "Reports & Analytics", icon: BarChart2, href: "/reports", permission: "reports.view" },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      { label: "Staff", icon: UserCheck, href: "/staff", permission: "settings.general" },
      { label: "Audit Log", icon: ClipboardList, href: "/audit-log", permission: "audit-log.view" },
      { label: "Settings", icon: Settings, href: "/settings", permission: "settings.general" },
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
  const { user, logout, hasPermission } = useAuth()
  const [openAccordion, setOpenAccordion] = useState<string | null>(
    pathname.startsWith("/catalog") ? "Catalog"
      : pathname.startsWith("/ledger") ? "Ledger"
      : null
  )
  // Keep accordion open when navigating within it
  useEffect(() => {
    if (pathname.startsWith("/catalog")) setOpenAccordion("Catalog")
    else if (pathname.startsWith("/ledger")) setOpenAccordion("Ledger")
  }, [pathname])

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
        sidebarCollapsed ? "w-[60px]" : "w-[220px] max-w-[85vw]"
      )}
      style={{ backgroundColor: "#0F172A" }}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center h-12 border-b border-white/[0.07] flex-shrink-0",
          sidebarCollapsed ? "justify-center px-2" : "px-3 gap-2.5"
        )}
      >
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-900/40">
          <Smartphone className="w-4 h-4 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-[13px] leading-tight tracking-tight">MobiTrack Pro</p>
            <p className="text-slate-500 text-[10px] leading-tight">Management System</p>
          </div>
        )}
        {onNavClick && (
          <button
            onClick={onNavClick}
            className="ml-auto p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className={cn("px-2.5 pt-2.5 pb-1 shrink-0 space-y-1.5", sidebarCollapsed && "px-2")}>
        {sidebarCollapsed ? (
          <>
            {hasPermission("sales.create") && (
              <button
                onClick={() => { router.push("/sales/new"); onNavClick?.() }}
                title="New Sale"
                className="group relative w-full flex items-center justify-center py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all shadow-md shadow-blue-900/30"
              >
                <Plus className="w-4 h-4 text-white" />
                <div className="absolute left-full ml-2.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                  New Sale
                </div>
              </button>
            )}
            {hasPermission("purchases.create") && (
              <button
                onClick={() => { router.push("/purchases/new"); onNavClick?.() }}
                title="New Purchase"
                className="group relative w-full flex items-center justify-center py-2 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 transition-all"
              >
                <ShoppingCart className="w-4 h-4 text-white" />
                <div className="absolute left-full ml-2.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                  New Purchase
                </div>
              </button>
            )}
          </>
        ) : (
          <>
            {hasPermission("sales.create") && (
              <button
                onClick={() => { router.push("/sales/new"); onNavClick?.() }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-md shadow-blue-900/30 group"
              >
                <Plus className="w-3.5 h-3.5 text-white" />
                <span className="text-white font-semibold text-xs tracking-wide">New Sale</span>
              </button>
            )}
            {hasPermission("purchases.create") && (
              <button
                onClick={() => { router.push("/purchases/new"); onNavClick?.() }}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-[0.98] transition-all group"
              >
                <ShoppingCart className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-slate-300 font-medium text-xs tracking-wide">New Purchase</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1.5 px-2 space-y-px scrollbar-none">
        {navSections.map(({ section, items }) => {
          const visibleItems = items.filter(item => !item.permission || hasPermission(item.permission))
          if (visibleItems.length === 0) return null
          return (
          <div key={section} className="mb-0.5">
            {!sidebarCollapsed && (
              <p className="text-slate-600 text-[9px] font-bold uppercase tracking-widest px-2 pt-3 pb-1">
                {section}
              </p>
            )}
            {sidebarCollapsed && <div className="h-2.5" />}

            {visibleItems.map((item) => {
              if (item.children) {
                const visibleChildren = item.children.filter(c => !c.permission || hasPermission(c.permission))
                if (visibleChildren.length === 0) return null
                const isOpen = openAccordion === item.label
                const anyChildActive = visibleChildren.some((c) => isActive(c.href))
                const Icon = item.icon

                if (sidebarCollapsed) {
                  return visibleChildren.map((child) => {
                    const ChildIcon = child.icon
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        title={child.label}
                        onClick={onNavClick}
                        className={cn(
                          "flex items-center justify-center rounded-md mb-px py-2 transition-all duration-150 group relative",
                          active
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-900/40"
                            : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                        )}
                      >
                        <ChildIcon className="flex-shrink-0 w-4 h-4" />
                        <div className="absolute left-full ml-2.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                          {child.label}
                        </div>
                      </Link>
                    )
                  })
                }

                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleAccordion(item.label)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md mb-px transition-all duration-150 group",
                        anyChildActive
                          ? "text-slate-200 bg-white/5"
                          : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                      )}
                    >
                      <Icon className={cn("flex-shrink-0 w-4 h-4", anyChildActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                      <span className={cn("text-[12px] font-medium flex-1 text-left truncate", anyChildActive ? "text-slate-200" : "text-slate-400 group-hover:text-slate-200")}>
                        {item.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 text-slate-600 transition-transform duration-200",
                          isOpen && "rotate-180"
                        )}
                      />
                    </button>

                    {isOpen && (
                      <div className="ml-3 pl-2.5 border-l border-white/[0.07] space-y-px mb-0.5">
                        {visibleChildren.map((child) => {
                          const ChildIcon = child.icon
                          const active = isActive(child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={onNavClick}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-150 group",
                                active
                                  ? "bg-blue-600/20 text-blue-300"
                                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                              )}
                            >
                              <ChildIcon className={cn("flex-shrink-0 w-3.5 h-3.5", active ? "text-blue-400" : "text-slate-600 group-hover:text-slate-400")} />
                              <span className={cn("text-[11px] font-medium", active ? "text-blue-300" : "text-slate-500 group-hover:text-slate-200")}>
                                {child.label}
                              </span>
                              {active && <span className="ml-auto w-1 h-1 rounded-full bg-blue-400" />}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              const active = isActive(item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-md mb-px transition-all duration-150 group relative",
                    sidebarCollapsed ? "justify-center w-full py-2" : "gap-2.5 px-2 py-1.5",
                    active
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-900/30"
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  )}
                >
                  <Icon className={cn("flex-shrink-0 w-4 h-4", active ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
                  {!sidebarCollapsed && (
                    <span className={cn("text-[12px] font-medium truncate", active ? "text-white" : "text-slate-400 group-hover:text-slate-200")}>
                      {item.label}
                    </span>
                  )}
                  {active && !sidebarCollapsed && (
                    <span className="ml-auto w-1 h-1 rounded-full bg-white/50" />
                  )}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-2.5 px-2 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                      {item.label}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className={cn("border-t border-white/[0.07] p-2 flex-shrink-0", sidebarCollapsed && "flex justify-center")}>
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-white text-[10px] font-bold">
                {user ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2) : "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-[12px] font-semibold leading-tight truncate">{user?.name ?? "Guest"}</p>
              <p className="text-slate-500 text-[10px] leading-tight">{user?.role ?? "Unknown"}</p>
            </div>
            <button
              onClick={async () => { await logout(); router.push("/auth/login") }}
              className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500 hover:text-red-400 transition-colors" />
            </button>
          </div>
        ) : (
          <button
            onClick={async () => { await logout(); router.push("/auth/login") }}
            className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer shadow-sm hover:bg-red-500 transition-colors"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5 text-white" />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      {showCollapseBtn && (
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center hover:bg-blue-600 hover:border-blue-500 transition-all z-50 shadow-md"
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-3 h-3 text-slate-400" />
            : <ChevronLeft className="w-3 h-3 text-slate-400" />
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-shrink-0 relative h-screen sticky top-0 z-40">
        <SidebarContent
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          showCollapseBtn={true}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeMobileSidebar}
          />
          <aside className="relative h-full w-[220px] max-w-[85vw] shadow-2xl">
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
