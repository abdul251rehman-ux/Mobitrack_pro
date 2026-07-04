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
  sales: "Sales",
  "new": "New",
  purchases: "Purchases",
  suppliers: "Suppliers",
  customers: "Customers",
  reports: "Reports & Analytics",
  settings: "Settings",
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

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 text-sm min-w-0 overflow-hidden">
      <Link href="/" className="flex items-center shrink-0 text-slate-400 hover:text-slate-700 transition-colors">
        <Home className="w-4 h-4" />
      </Link>
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/")
        const isLast = index === segments.length - 1
        const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || segment.startsWith("cust-") || segment.startsWith("sup-")
        const label = isId ? "Detail" : (routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))
        // On mobile only show the last 2 segments to prevent overflow
        const isMobileHidden = !isLast && index < segments.length - 2

        return (
          <div key={href} className={`flex items-center gap-1 sm:gap-1.5 min-w-0 ${isMobileHidden ? "hidden sm:flex" : "flex"}`}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {isLast ? (
              <span className="text-slate-900 font-semibold truncate max-w-30 sm:max-w-none">{label}</span>
            ) : (
              <Link href={href} className="text-slate-400 hover:text-slate-700 transition-colors truncate max-w-20 sm:max-w-none shrink-0">{label}</Link>
            )}
          </div>
        )
      })}
    </div>
  )
}
