"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

const routeLabels: Record<string, string> = {
  "": "Dashboard",
  products: "Products",
  mobiles: "Mobile Phones",
  accessories: "Accessories",
  catalog: "Catalog",
  categories: "Categories",
  brands: "Brands",
  models: "Models",
  colors: "Colors",
  storage: "Storage",
  ram: "RAM",
  sales: "Sales",
  "new": "New",
  purchases: "Purchases",
  "purchase-returns": "Purchase Returns",
  returns: "Sale Returns",
  suppliers: "Suppliers",
  customers: "Customers",
  persons: "Persons",
  reports: "Reports & Analytics",
  settings: "Settings",
  rebate: "Rebate",
  ledger: "Ledger",
  finance: "Finance",
  expenses: "Expenses",
  payments: "Payments",
  staff: "Staff",
  "audit-log": "Audit Log",
  inventory: "Inventory",
  "stock-alerts": "Stock Alerts",
  "used-phones": "Used Phones",
  auth: "Authentication",
  login: "Login",
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm">
        <Home className="w-4 h-4 text-slate-400" />
        <span className="text-slate-900 font-medium">Dashboard</span>
      </div>
    )
  }

  const lastSegment = segments[segments.length - 1]
  const isLastId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment) || lastSegment.startsWith("cust-") || lastSegment.startsWith("sup-")
  const currentTitle = isLastId ? "Detail" : (routeLabels[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1))

  return (
    <>
      {/* Mobile: just the current page title, no trail, never truncated mid-word */}
      <h1 className="sm:hidden text-base font-bold text-slate-900 truncate">{currentTitle}</h1>

      {/* Tablet/desktop: full breadcrumb trail */}
      <div className="hidden sm:flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
        <Link href="/" className="flex items-center shrink-0 text-slate-400 hover:text-slate-700 transition-colors">
          <Home className="w-4 h-4" />
        </Link>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/")
          const isLast = index === segments.length - 1
          const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || segment.startsWith("cust-") || segment.startsWith("sup-")
          const label = isId ? "Detail" : (routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))

          return (
            <div key={href} className="flex items-center gap-1.5 min-w-0">
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              {isLast ? (
                <span className="text-slate-900 font-semibold truncate">{label}</span>
              ) : (
                <Link href={href} className="text-slate-400 hover:text-slate-700 transition-colors truncate shrink-0">{label}</Link>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
