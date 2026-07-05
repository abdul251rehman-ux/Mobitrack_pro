"use client"

import Link from "next/link"
import { BookOpen, UserCheck, Building2, UserRound, ArrowRight, DollarSign, Users, Truck } from "lucide-react"

const ledgers = [
  {
    href: "/ledger/customers",
    icon: UserCheck,
    color: "bg-blue-600",
    gradient: "from-blue-50 to-white",
    border: "border-blue-100 hover:border-blue-300",
    iconRing: "ring-blue-200",
    arrow: "group-hover:text-blue-500",
    badge: "bg-blue-50 text-blue-600",
    badgeIcon: Users,
    badgeLabel: "Customers",
    title: "Customer Ledger",
    desc: "View outstanding balances, sales history and payments received from customers.",
    hint: "Track udhaar & credit sales",
  },
  {
    href: "/ledger/suppliers",
    icon: Building2,
    color: "bg-orange-600",
    gradient: "from-orange-50 to-white",
    border: "border-orange-100 hover:border-orange-300",
    iconRing: "ring-orange-200",
    arrow: "group-hover:text-orange-500",
    badge: "bg-orange-50 text-orange-600",
    badgeIcon: Truck,
    badgeLabel: "Suppliers",
    title: "Supplier Ledger",
    desc: "Track payments due to suppliers, purchase history and payments made to suppliers.",
    hint: "Manage payables & dues",
  },
  {
    href: "/ledger/persons",
    icon: UserRound,
    color: "bg-violet-600",
    gradient: "from-violet-50 to-white",
    border: "border-violet-100 hover:border-violet-300",
    iconRing: "ring-violet-200",
    arrow: "group-hover:text-violet-500",
    badge: "bg-violet-50 text-violet-600",
    badgeIcon: DollarSign,
    badgeLabel: "Persons",
    title: "Person Ledger",
    desc: "Record informal money transactions with individuals - gave / took money.",
    hint: "Informal give/receive records",
  },
]

export default function LedgerIndexPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
          <BookOpen className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-none">Ledger</h1>
          <p className="text-xs text-slate-400 mt-0.5">Select a ledger to view financial records</p>
        </div>
      </div>

      {/* Ledger Cards */}
      <div className="grid gap-3">
        {ledgers.map(({ href, icon: Icon, color, gradient, border, iconRing, arrow, badge, badgeIcon: BadgeIcon, badgeLabel, title, desc, hint }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-4 bg-linear-to-r ${gradient} rounded-xl border ${border} px-4 py-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-px group`}
          >
            <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0 ring-2 ${iconRing} shadow-sm`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge}`}>
                  <BadgeIcon className="w-2.5 h-2.5" />{badgeLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{desc}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">{hint}</p>
            </div>
            <ArrowRight className={`w-4 h-4 text-slate-300 ${arrow} transition-colors shrink-0`} />
          </Link>
        ))}
      </div>
    </div>
  )
}
