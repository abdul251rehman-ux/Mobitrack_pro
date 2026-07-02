"use client"

import Link from "next/link"
import { BookOpen, UserCheck, Building2, UserRound, ArrowRight } from "lucide-react"

const ledgers = [
  {
    href: "/ledger/customers",
    icon: UserCheck,
    color: "bg-blue-500",
    title: "Customer Ledger",
    desc: "View outstanding balances, sales history and payments received from customers.",
  },
  {
    href: "/ledger/suppliers",
    icon: Building2,
    color: "bg-orange-500",
    title: "Supplier Ledger",
    desc: "Track what you owe suppliers, purchase history and payments made to suppliers.",
  },
  {
    href: "/ledger/persons",
    icon: UserRound,
    color: "bg-violet-500",
    title: "Person Ledger",
    desc: "Record informal money transactions with individuals — gave / took money.",
  },
]

export default function LedgerIndexPage() {
  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900 leading-none">Ledger</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">Select a ledger to view financial records</p>
        </div>
      </div>

      <div className="grid gap-3">
        {ledgers.map(({ href, icon: Icon, color, title, desc }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 px-4 py-3.5 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}
