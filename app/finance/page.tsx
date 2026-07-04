﻿"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Plus, Banknote, Building2, Smartphone, Zap, CreditCard,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Wallet,
  Search, Download, Eye, Pencil, X, CheckCircle, AlertCircle,
  Users, Truck, TrendingUp, FileText,
} from "lucide-react"
import { toast } from "sonner"

import {
  getFinanceAccounts, createFinanceAccount, updateFinanceAccount,
  ensureDefaultCashAccount, getFinanceTransactions,
  createDeposit, createWithdrawal, createTransfer,
} from "@/lib/api/finance"
import { supabase } from "@/lib/supabase"
import { getTenantId } from "@/lib/api/helpers"
import { getPayments, createPayment } from "@/lib/api/payments"
import { getCustomers } from "@/lib/api/customers"
import { getSuppliers } from "@/lib/api/suppliers"
import { getSales } from "@/lib/api/sales"
import { getPurchases } from "@/lib/api/purchases"
import type {
  FinanceAccount, FinanceTransaction, FinanceAccountType,
} from "@/lib/api/types"
import type { Payment, Customer, Supplier, Sale, Purchase } from "@/data/types"
import { formatCurrency, formatDate, cn, todayPKT } from "@/lib/utils"
import { exportToCSV } from "@/lib/csv-export"
import { generateReportPDF } from "@/lib/pdf/report"
import { getTenant } from "@/lib/api/settings"

import { PageHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

// â"€â"€â"€ Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const ACCOUNT_TYPE_META: Record<FinanceAccountType, {
  label: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
  topBorder: string
}> = {
  cash:          { label: "Cash",          icon: <Banknote className="h-5 w-5" />,   color: "text-emerald-700", bg: "bg-emerald-600", border: "border-emerald-200", topBorder: "border-t-emerald-500" },
  bank:          { label: "Bank",          icon: <Building2 className="h-5 w-5" />,  color: "text-purple-700",  bg: "bg-purple-600",  border: "border-purple-200",  topBorder: "border-t-purple-500"  },
  mobile_wallet: { label: "Mobile Wallet", icon: <Smartphone className="h-5 w-5" />, color: "text-red-700",     bg: "bg-red-600",     border: "border-red-200",     topBorder: "border-t-red-500"     },
}

const TX_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  deposit:          { label: "Deposit",          color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ArrowDownLeft className="h-3 w-3" /> },
  withdrawal:       { label: "Withdrawal",       color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: <ArrowUpRight className="h-3 w-3" />  },
  transfer_in:      { label: "Transfer In",      color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: <ArrowDownLeft className="h-3 w-3" /> },
  transfer_out:     { label: "Transfer Out",     color: "text-orange-700",  bg: "bg-orange-50",  border: "border-orange-200",  icon: <ArrowUpRight className="h-3 w-3" />  },
  sale_receipt:     { label: "Sale Receipt",     color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ArrowDownLeft className="h-3 w-3" /> },
  purchase_payment: { label: "Purchase Payment", color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: <ArrowUpRight className="h-3 w-3" />  },
  expense:          { label: "Expense",          color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: <ArrowUpRight className="h-3 w-3" />  },
  opening_balance:  { label: "Opening Balance",  color: "text-slate-700",   bg: "bg-slate-50",   border: "border-slate-200",   icon: <Wallet className="h-3 w-3" />        },
  person_gave:      { label: "Gave to Person",   color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    icon: <ArrowUpRight className="h-3 w-3" />  },
  person_took:      { label: "Took from Person", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <ArrowDownLeft className="h-3 w-3" /> },
}

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "JazzCash", "EasyPaisa", "Card", "Cheque"]

const BANK_NAMES = ["HBL", "Meezan Bank", "UBL", "MCB", "Bank Alfalah", "Allied Bank", "Standard Chartered", "Faysal Bank", "Askari Bank", "Silk Bank", "Other"]
const WALLET_NAMES = ["JazzCash", "EasyPaisa", "NayaPay", "SadaPay", "UPaisa", "Other"]

// â"€â"€â"€ Helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

const TODAY = todayPKT()

function isInflow(type: string) {
  return ["deposit", "transfer_in", "sale_receipt", "opening_balance", "person_took"].includes(type)
}

// â"€â"€â"€ Page â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

export default function FinancePage() {
  // â"€â"€ Data state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("accounts")

  // â"€â"€ Dialog state â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  type ModalType = null | "addAccount" | "deposit" | "withdraw" | "transfer" | "editAccount" | "recordPayment"
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedAccount, setSelectedAccount] = useState<FinanceAccount | null>(null)
  const [saving, setSaving] = useState(false)

  // â"€â"€ Add Account form â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [accForm, setAccForm] = useState({
    type: "bank" as FinanceAccountType,
    name: "",
    accountTitle: "",
    bankName: "",
    accountNumber: "",
    openingBalance: "",
  })

  // â"€â"€ Deposit/Withdraw form â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [txForm, setTxForm] = useState({ amount: "", date: TODAY, description: "", notes: "" })

  // â"€â"€ Transfer form â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [transferForm, setTransferForm] = useState({ fromId: "", toId: "", amount: "", date: TODAY, notes: "" })

  // â"€â"€ Record Payment form (receivables tab) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [payForm, setPayForm] = useState({
    type: "Received" as "Received" | "Paid",
    entityType: "Customer" as "Customer" | "Supplier",
    entityId: "",
    referenceNumber: "",
    amount: "",
    method: "Cash",
    accountId: "",
    notes: "",
  })

  // â"€â"€ Transaction filters â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const [txSearch, setTxSearch] = useState("")
  const [txFilterType, setTxFilterType] = useState("All")
  const [txFilterAccount, setTxFilterAccount] = useState("All")
  const [txDateFrom, setTxDateFrom] = useState("")
  const [txDateTo, setTxDateTo] = useState("")
  const [reportPeriod, setReportPeriod] = useState("this_month")

  // â"€â"€ Load â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        // Ensure Cash account exists first (backfills existing data)
        await ensureDefaultCashAccount()
        const [accs, txs, pays, custs, supps, sls, purs] = await Promise.all([
          getFinanceAccounts(),
          getFinanceTransactions(),
          getPayments(),
          getCustomers(),
          getSuppliers(),
          getSales(),
          getPurchases(),
        ])
        setAccounts(accs)
        setTransactions(txs)
        setPayments(pays)
        setCustomers(custs)
        setSuppliers(supps)
        setSales(sls)
        setPurchases(purs)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load finance data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // â"€â"€ Summary stats â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const summary = useMemo(() => {
    const cash  = accounts.filter(a => a.type === "cash").reduce((s, a) => s + a.currentBalance, 0)
    const banks = accounts.filter(a => a.type === "bank").reduce((s, a) => s + a.currentBalance, 0)
    const wallets = accounts.filter(a => a.type === "mobile_wallet").reduce((s, a) => s + a.currentBalance, 0)
    return { cash, banks, wallets, total: cash + banks + wallets }
  }, [accounts])

  // â"€â"€ Filtered transactions â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const filteredTx = useMemo(() => {
    return transactions.filter(tx => {
      if (txSearch) {
        const q = txSearch.toLowerCase()
        if (
          !tx.description?.toLowerCase().includes(q) &&
          !tx.referenceNumber?.toLowerCase().includes(q) &&
          !tx.notes?.toLowerCase().includes(q)
        ) return false
      }
      if (txFilterType !== "All" && tx.type !== txFilterType) return false
      if (txFilterAccount !== "All" && tx.accountId !== txFilterAccount) return false
      if (txDateFrom && tx.date < txDateFrom) return false
      if (txDateTo && tx.date > txDateTo) return false
      return true
    })
  }, [transactions, txSearch, txFilterType, txFilterAccount, txDateFrom, txDateTo])

  // â"€â"€ Customer receivables â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const customerReceivables = useMemo(() => {
    return customers.map(c => {
      const custSales = sales.filter(s => s.customerId === c.id)
      const totalBilled = custSales.reduce((s, sl) => s + sl.total, 0)
      const totalReceivedSales = custSales.reduce((s, sl) => s + sl.amountReceived, 0)
      const totalReceivedPayments = payments
        .filter(p => p.entityType === "Customer" && p.entityId === c.id && p.type === "Received" && p.status === "Completed")
        .reduce((s, p) => s + p.amount, 0)
      const effective = Math.max(totalReceivedSales, totalReceivedPayments)
      const outstanding = Math.max(0, totalBilled - effective)
      const lastPay = payments
        .filter(p => p.entityType === "Customer" && p.entityId === c.id && p.type === "Received")
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      return { id: c.id, name: c.name, phone: c.phone, outstanding, lastPayDate: lastPay?.date }
    }).filter(c => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
  }, [customers, sales, payments])

  // â"€â"€ Supplier payables â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  const supplierPayables = useMemo(() => {
    return suppliers.map(s => {
      const suppPurchases = purchases.filter(p => p.supplierId === s.id)
      const totalBilled = suppPurchases.reduce((sum, p) => sum + p.total, 0)
      const totalPaidPurchases = suppPurchases.reduce((sum, p) => sum + p.amountPaid, 0)
      const totalPaidPayments = payments
        .filter(p => p.entityType === "Supplier" && p.entityId === s.id && p.type === "Paid" && p.status === "Completed")
        .reduce((sum, p) => sum + p.amount, 0)
      const effective = Math.max(totalPaidPurchases, totalPaidPayments)
      const outstanding = Math.max(0, totalBilled - effective)
      const lastPay = payments
        .filter(p => p.entityType === "Supplier" && p.entityId === s.id && p.type === "Paid")
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      return { id: s.id, name: s.companyName, phone: s.phone, outstanding, lastPayDate: lastPay?.date }
    }).filter(s => s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
  }, [suppliers, purchases, payments])

  // â"€â"€ Handlers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  function openDeposit(acc: FinanceAccount) {
    setSelectedAccount(acc)
    setTxForm({ amount: "", date: TODAY, description: "", notes: "" })
    setModal("deposit")
  }
  function openWithdraw(acc: FinanceAccount) {
    setSelectedAccount(acc)
    setTxForm({ amount: "", date: TODAY, description: "", notes: "" })
    setModal("withdraw")
  }
  function openTransfer(acc: FinanceAccount) {
    setSelectedAccount(acc)
    setTransferForm({ fromId: acc.id, toId: "", amount: "", date: TODAY, notes: "" })
    setModal("transfer")
  }
  function openEdit(acc: FinanceAccount) {
    setSelectedAccount(acc)
    setAccForm({
      type: acc.type,
      name: acc.name,
      accountTitle: acc.accountTitle ?? "",
      bankName: acc.bankName ?? "",
      accountNumber: acc.accountNumber ?? "",
      openingBalance: String(acc.openingBalance),
    })
    setModal("editAccount")
  }

  async function handleAddAccount() {
    if (!accForm.name.trim()) { toast.error("Account name is required"); return }
    const ob = Number(accForm.openingBalance) || 0
    setSaving(true)
    try {
      const created = await createFinanceAccount({
        name: accForm.name.trim(),
        type: accForm.type,
        accountTitle: accForm.accountTitle || undefined,
        bankName: accForm.bankName || undefined,
        accountNumber: accForm.accountNumber || undefined,
        openingBalance: ob,
      })
      setAccounts(prev => [...prev, created])
      setModal(null)
      toast.success(`Account "${created.name}" created`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create account")
    } finally {
      setSaving(false)
    }
  }

  async function handleEditAccount() {
    if (!selectedAccount) return
    if (!accForm.name.trim()) { toast.error("Account name is required"); return }
    setSaving(true)
    try {
      const updated = await updateFinanceAccount(selectedAccount.id, {
        name: accForm.name.trim(),
        accountTitle: accForm.accountTitle || undefined,
        bankName: accForm.bankName || undefined,
        accountNumber: accForm.accountNumber || undefined,
      })
      setAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))
      setModal(null)
      toast.success("Account updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update account")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeposit() {
    if (!selectedAccount) return
    const amount = Number(txForm.amount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    setSaving(true)
    try {
      const tx = await createDeposit({
        accountId: selectedAccount.id,
        amount,
        date: txForm.date,
        description: txForm.description || "Deposit",
        notes: txForm.notes || undefined,
      })
      setTransactions(prev => [tx, ...prev])
      setAccounts(prev => prev.map(a => a.id === selectedAccount.id ? { ...a, currentBalance: a.currentBalance + amount } : a))
      setModal(null)
      toast.success(`Deposited ${formatCurrency(amount)} into ${selectedAccount.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deposit failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleWithdraw() {
    if (!selectedAccount) return
    const amount = Number(txForm.amount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (amount > selectedAccount.currentBalance) { toast.error("Insufficient balance"); return }
    setSaving(true)
    try {
      const tx = await createWithdrawal({
        accountId: selectedAccount.id,
        amount,
        date: txForm.date,
        description: txForm.description || "Withdrawal",
        notes: txForm.notes || undefined,
      })
      setTransactions(prev => [tx, ...prev])
      setAccounts(prev => prev.map(a => a.id === selectedAccount.id ? { ...a, currentBalance: a.currentBalance - amount } : a))
      setModal(null)
      toast.success(`Withdrew ${formatCurrency(amount)} from ${selectedAccount.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleTransfer() {
    const amount = Number(transferForm.amount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!transferForm.toId) { toast.error("Select destination account"); return }
    if (transferForm.fromId === transferForm.toId) { toast.error("Source and destination cannot be the same"); return }
    setSaving(true)
    try {
      const { out, into } = await createTransfer({
        fromAccountId: transferForm.fromId,
        toAccountId: transferForm.toId,
        amount,
        date: transferForm.date,
        notes: transferForm.notes || undefined,
      })
      setTransactions(prev => [out, into, ...prev])
      setAccounts(prev => prev.map(a => {
        if (a.id === transferForm.fromId) return { ...a, currentBalance: a.currentBalance - amount }
        if (a.id === transferForm.toId)   return { ...a, currentBalance: a.currentBalance + amount }
        return a
      }))
      setModal(null)
      toast.success(`Transferred ${formatCurrency(amount)} successfully`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed")
    } finally {
      setSaving(false)
    }
  }

  async function handleRecordPayment() {
    if (!payForm.entityId) { toast.error("Select an entity"); return }
    const amount = Number(payForm.amount)
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return }
    const entityName = payForm.entityType === "Customer"
      ? customers.find(c => c.id === payForm.entityId)?.name ?? ""
      : suppliers.find(s => s.id === payForm.entityId)?.companyName ?? ""
    if (!payForm.accountId) { toast.error("Select a finance account"); return }
    setSaving(true)
    try {
      const created = await createPayment({
        date: TODAY,
        type: payForm.type,
        entityType: payForm.entityType,
        entityId: payForm.entityId,
        entityName,
        referenceType: payForm.type === "Received" ? "Sale" : "Purchase",
        referenceNumber: payForm.referenceNumber || undefined,
        amount,
        method: payForm.method,
        status: "Completed",
        notes: payForm.notes || undefined,
        processedBy: "",
        createdAt: new Date().toISOString(),
      })

      // Finance transaction: customer payment â†' money IN, supplier payment â†' money OUT
      const txType = payForm.type === "Received" ? "customer_payment" : "supplier_payment"
      const { data: accRow } = await supabase
        .from("finance_accounts").select("current_balance").eq("id", payForm.accountId).single()
      if (accRow) {
        const current = (accRow as any).current_balance
        const newBal = payForm.type === "Received" ? current + amount : Math.max(0, current - amount)
        await Promise.all([
          supabase.from("finance_transactions").insert({
            tenant_id: await getTenantId(),
            date: TODAY,
            type: txType,
            account_id: payForm.accountId,
            amount,
            reference_type: payForm.type === "Received" ? "Sale" : "Purchase",
            reference_number: payForm.referenceNumber || undefined,
            description: `${payForm.type === "Received" ? "Collected from" : "Paid to"} ${entityName}`,
            notes: payForm.notes || null,
          }),
          supabase.from("finance_accounts").update({ current_balance: newBal }).eq("id", payForm.accountId),
          supabase.from("payments").update({ account_id: payForm.accountId }).eq("id", (created as any).id),
        ])
        setAccounts(prev => prev.map(a => a.id === payForm.accountId ? { ...a, currentBalance: newBal } : a))
      }

      setPayments(prev => [created, ...prev])
      setModal(null)
      toast.success(`${formatCurrency(amount)} ${payForm.type === "Received" ? "collected" : "paid"} - account updated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  function handleExportTx() {
    exportToCSV(filteredTx.map(tx => {
      const inflow = isInflow(tx.type)
      return {
        date:        tx.date,
        type:        TX_META[tx.type]?.label ?? tx.type,
        account:     accounts.find(a => a.id === tx.accountId)?.name ?? "",
        flow:        inflow ? "IN (+)" : "OUT (-)",
        amount:      tx.amount,
        signed:      inflow ? tx.amount : -tx.amount,
        description: (tx.description ?? "").replace(/[^\x20-\x7E]/g, ""),
        reference:   tx.referenceNumber ?? "",
        notes:       (tx.notes ?? "").replace(/[^\x20-\x7E]/g, ""),
      }
    }), "finance-transactions", [
      { key: "date",        header: "Date" },
      { key: "type",        header: "Transaction Type" },
      { key: "account",     header: "Account" },
      { key: "flow",        header: "Flow" },
      { key: "amount",      header: "Amount (Rs)" },
      { key: "signed",      header: "Signed Amount (Rs)" },
      { key: "description", header: "Description" },
      { key: "reference",   header: "Reference No." },
      { key: "notes",       header: "Notes" },
    ])
    toast.success(`Exported ${filteredTx.length} transactions`)
  }

  async function handlePDFReport() {
    // Determine date range from selected period
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, "0")
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

    let fromDate = ""
    let toDate = fmt(now)
    let periodLabel = ""

    if (reportPeriod === "this_week") {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      fromDate = fmt(mon); toDate = fmt(now)
      periodLabel = `Week: ${fromDate} to ${toDate}`
    } else if (reportPeriod === "last_week") {
      const day = now.getDay()
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      fromDate = fmt(mon); toDate = fmt(sun)
      periodLabel = `Week: ${fromDate} to ${toDate}`
    } else if (reportPeriod === "this_month") {
      fromDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
      toDate = fmt(now)
      const monthName = now.toLocaleString("en-PK", { month: "long", year: "numeric" })
      periodLabel = `Month: ${monthName}`
    } else if (reportPeriod === "last_month") {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last  = new Date(now.getFullYear(), now.getMonth(), 0)
      fromDate = fmt(first); toDate = fmt(last)
      const monthName = first.toLocaleString("en-PK", { month: "long", year: "numeric" })
      periodLabel = `Month: ${monthName}`
    } else if (reportPeriod === "this_year") {
      fromDate = `${now.getFullYear()}-01-01`; toDate = fmt(now)
      periodLabel = `Year: ${now.getFullYear()}`
    } else if (reportPeriod === "last_year") {
      const y = now.getFullYear() - 1
      fromDate = `${y}-01-01`; toDate = `${y}-12-31`
      periodLabel = `Year: ${y}`
    } else {
      // "all" — no filter
      periodLabel = "All Time"
    }

    const txForPeriod = transactions.filter(tx => {
      if (fromDate && tx.date < fromDate) return false
      if (toDate   && tx.date > toDate)   return false
      return true
    })

    if (txForPeriod.length === 0) {
      toast.error("No transactions found for the selected period")
      return
    }

    const totalIn  = txForPeriod.filter(tx => isInflow(tx.type)).reduce((s, tx) => s + tx.amount, 0)
    const totalOut = txForPeriod.filter(tx => !isInflow(tx.type)).reduce((s, tx) => s + tx.amount, 0)
    const netFlow  = totalIn - totalOut

    let shopName = "MobiTrack Pro", shopAddress = "", shopPhone = ""
    try {
      const tenant = await getTenant()
      shopName    = tenant.name ?? shopName
      shopAddress = tenant.address ?? ""
      shopPhone   = tenant.phone ?? ""
    } catch { /* use defaults */ }

    const periodSlug = periodLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")

    generateReportPDF({
      shopName, shopAddress, shopPhone,
      title: "Finance Transaction Report",
      subtitle: `${periodLabel}  |  ${txForPeriod.length} transactions`,
      orientation: "landscape",
      columns: [
        { header: "Date",        dataKey: "date",        width: 24,  halign: "center" },
        { header: "Type",        dataKey: "type",        width: 30 },
        { header: "Account",     dataKey: "account",     width: 28 },
        { header: "Description", dataKey: "description"              },
        { header: "Reference",   dataKey: "reference",   width: 40 },
        { header: "Amount (Rs)", dataKey: "amount",      width: 32,  halign: "right", bold: true },
      ],
      rows: txForPeriod.map(tx => {
        const inflow = isInflow(tx.type)
        return {
          date:        tx.date,
          type:        TX_META[tx.type]?.label ?? tx.type,
          account:     accounts.find(a => a.id === tx.accountId)?.name ?? "-",
          description: tx.description ?? "-",
          reference:   tx.referenceNumber ?? "-",
          amount:      `${inflow ? "+" : "-"} Rs ${tx.amount.toLocaleString("en-PK")}`,
        }
      }),
      summary: [
        { label: "Total Inflow",  value: `Rs ${totalIn.toLocaleString("en-PK")}` },
        { label: "Total Outflow", value: `Rs ${totalOut.toLocaleString("en-PK")}` },
        { label: "Net Cash Flow", value: `${netFlow >= 0 ? "+" : "-"} Rs ${Math.abs(netFlow).toLocaleString("en-PK")}` },
      ],
      filename: `finance-report-${periodSlug}`,
      action: "save",
    })
    toast.success(`Finance report downloaded (${txForPeriod.length} transactions)`)
  }

  // â"€â"€ Render â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finance Center"
        description="Manage all money accounts, track balances, and approve payments"
        icon={<Banknote />}
        iconBg="bg-emerald-600"
      />

      {/* â"€â"€â"€ Summary Bar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <div className="grid grid-cols-4 gap-2.5">
        <StatCard title="Cash in Hand"   value={formatCurrency(summary.cash)}    icon={Banknote}   iconBg="bg-emerald-100" subtext={`${accounts.filter(a => a.type === "cash").length} cash account(s)`} />
        <StatCard title="In Banks"        value={formatCurrency(summary.banks)}   icon={Building2}  iconBg="bg-violet-100"  subtext={`${accounts.filter(a => a.type === "bank").length} bank account(s)`} />
        <StatCard title="Mobile Wallets"  value={formatCurrency(summary.wallets)} icon={Smartphone} iconBg="bg-red-100"     subtext={`${accounts.filter(a => a.type === "mobile_wallet").length} wallet(s)`} />
        <StatCard title="Total Available" value={formatCurrency(summary.total)}   icon={Wallet}     iconBg="bg-blue-100"    subtext="Across all accounts" />
      </div>

      {/* â"€â"€â"€ Tabs â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
        <div className="flex items-center justify-between">
          <TabsList className="bg-slate-100 h-8 p-0.5">
            <TabsTrigger value="accounts"       className="text-xs h-7 px-3">Accounts</TabsTrigger>
            <TabsTrigger value="transactions"   className="text-xs h-7 px-3">Transactions</TabsTrigger>
            <TabsTrigger value="receivables"    className="text-xs h-7 px-3">Receivables &amp; Payables</TabsTrigger>
          </TabsList>
          {activeTab === "accounts" && (
            <Button
              onClick={() => { setAccForm({ type: "bank", name: "", accountTitle: "", bankName: "", accountNumber: "", openingBalance: "" }); setModal("addAccount") }}
              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5 px-3"
            >
              <Plus className="h-3.5 w-3.5" /> Add Account
            </Button>
          )}
          {activeTab === "receivables" && (
            <Button
              onClick={() => { const def = accounts.find(a => a.isDefaultCash) ?? accounts[0]; setPayForm({ type: "Received", entityType: "Customer", entityId: "", referenceNumber: "", amount: "", method: "Cash", accountId: def?.id ?? "", notes: "" }); setModal("recordPayment") }}
              className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5 px-3"
            >
              <Plus className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
        </div>

        {/* â•â•â•â• ACCOUNTS TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="accounts" className="space-y-3">
          {accounts.length === 0 ? (
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="py-16 text-center">
                <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-600">No accounts yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "Add Account" to create your first bank or wallet account.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {accounts.map(acc => {
                const meta = ACCOUNT_TYPE_META[acc.type]
                return (
                  <div
                    key={acc.id}
                    className={cn(
                      "relative rounded-xl bg-white border border-slate-100 border-t-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden",
                      meta.topBorder
                    )}
                  >
                    <div className="p-4">
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shadow-sm text-white", meta.bg)}>
                            {meta.icon}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 leading-tight">{acc.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {meta.label}
                              {acc.bankName ? ` - ${acc.bankName}` : ""}
                              {acc.accountTitle ? ` - ${acc.accountTitle}` : ""}
                              {acc.accountNumber ? ` - ****${acc.accountNumber.slice(-4)}` : ""}
                            </p>
                          </div>
                        </div>
                        {!acc.isDefaultCash && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 text-slate-300 hover:text-slate-600 hover:bg-slate-100 shrink-0 -mt-0.5 -mr-0.5"
                            onClick={() => openEdit(acc)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Balance */}
                      <div className="mb-4">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Current Balance</p>
                        <p className={cn("text-2xl font-bold tracking-tight", acc.currentBalance >= 0 ? "text-slate-900" : "text-red-600")}>
                          {formatCurrency(acc.currentBalance)}
                        </p>
                        {acc.openingBalance > 0 && (
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Opening: {formatCurrency(acc.openingBalance)}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-[11px] gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 px-2"
                          onClick={() => openDeposit(acc)}
                        >
                          <ArrowDownLeft className="h-3 w-3" /> Deposit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-[11px] gap-1 text-red-600 border-red-200 hover:bg-red-50 px-2"
                          onClick={() => openWithdraw(acc)}
                        >
                          <ArrowUpRight className="h-3 w-3" /> Withdraw
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-[11px] gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 px-2"
                          onClick={() => openTransfer(acc)}
                        >
                          <ArrowLeftRight className="h-3 w-3" /> Transfer
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* â•â•â•â• TRANSACTIONS TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="transactions" className="space-y-3">
          {/* Filters */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="px-3 py-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="relative flex-1 min-w-[150px] max-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input placeholder="Search..." value={txSearch} onChange={e => setTxSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
                <Select value={txFilterType} onValueChange={setTxFilterType}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {Object.entries(TX_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={txFilterAccount} onValueChange={setTxFilterAccount}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="All Accounts" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Accounts</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)} className="h-8 w-[108px] text-xs" />
                <span className="text-slate-400 text-xs">-</span>
                <Input type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)} className="h-8 w-[108px] text-xs" />
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" onClick={handleExportTx} className="h-8 text-xs gap-1.5 px-3">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                  <Select value={reportPeriod} onValueChange={setReportPeriod}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="last_week">Last Week</SelectItem>
                      <SelectItem value="this_month">This Month</SelectItem>
                      <SelectItem value="last_month">Last Month</SelectItem>
                      <SelectItem value="this_year">This Year</SelectItem>
                      <SelectItem value="last_year">Last Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handlePDFReport} className="h-8 text-xs gap-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white">
                    <FileText className="h-3.5 w-3.5" /> PDF Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap">Date</TableHead>
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap">Type</TableHead>
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap">Account</TableHead>
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap">Description</TableHead>
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap">Reference</TableHead>
                      <TableHead className="text-xs px-3 py-2 whitespace-nowrap text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTx.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : filteredTx.map(tx => {
                      const meta = TX_META[tx.type] ?? TX_META.deposit
                      const accName = accounts.find(a => a.id === tx.accountId)?.name ?? "-"
                      const inflow = isInflow(tx.type)
                      return (
                        <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0 h-5 gap-0.5", meta.color, meta.bg, meta.border)}>
                              {meta.icon} {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap">
                            {accName}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 max-w-[180px] truncate">
                            {tx.description ?? "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs font-mono text-slate-400">
                            {tx.referenceNumber ?? "-"}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right whitespace-nowrap">
                            <span className={cn("text-xs font-semibold", inflow ? "text-emerald-600" : "text-red-600")}>
                              {inflow ? "+" : "-"}{formatCurrency(tx.amount)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredTx.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                  <span>Showing {filteredTx.length} of {transactions.length} transactions</span>
                  <span className="font-semibold text-slate-700">
                    Net: {formatCurrency(
                      filteredTx.reduce((s, tx) => isInflow(tx.type) ? s + tx.amount : s - tx.amount, 0)
                    )}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* â•â•â•â• RECEIVABLES & PAYABLES TAB â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <TabsContent value="receivables" className="space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* Customer Receivables */}
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Customer Receivables</h3>
                    <p className="text-xs text-slate-400">Outstanding amounts to collect</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    {customerReceivables.length} pending
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {customerReceivables.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">All customers settled</p>
                    </div>
                  ) : customerReceivables.map(c => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{c.phone}</p>
                      </div>
                      <div className="text-right mr-2 shrink-0">
                        <p className="text-xs font-bold text-emerald-600">{formatCurrency(c.outstanding)}</p>
                        <p className="text-[10px] text-slate-400">{c.lastPayDate ? `Last: ${formatDate(c.lastPayDate)}` : "No payments"}</p>
                      </div>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-2 shrink-0"
                        onClick={() => { const def = accounts.find(a => a.isDefaultCash) ?? accounts[0]; setPayForm({ type: "Received", entityType: "Customer", entityId: c.id, referenceNumber: "", amount: String(c.outstanding), method: "Cash", accountId: def?.id ?? "", notes: "" }); setModal("recordPayment") }}
                      >
                        Collect
                      </Button>
                    </div>
                  ))}
                </div>
                {customerReceivables.length > 0 && (
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">Total Receivable</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(customerReceivables.reduce((s, c) => s + c.outstanding, 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Supplier Payables */}
            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
                    <Truck className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Supplier Payables</h3>
                    <p className="text-xs text-slate-400">Outstanding amounts to pay</p>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px] bg-red-50 text-red-700 border-red-200">
                    {supplierPayables.length} pending
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {supplierPayables.length === 0 ? (
                    <div className="py-8 text-center">
                      <CheckCircle className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">All suppliers settled</p>
                    </div>
                  ) : supplierPayables.map(s => (
                    <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{s.phone}</p>
                      </div>
                      <div className="text-right mr-2 shrink-0">
                        <p className="text-xs font-bold text-red-600">{formatCurrency(s.outstanding)}</p>
                        <p className="text-[10px] text-slate-400">{s.lastPayDate ? `Last: ${formatDate(s.lastPayDate)}` : "No payments"}</p>
                      </div>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-2 shrink-0"
                        onClick={() => { const def = accounts.find(a => a.isDefaultCash) ?? accounts[0]; setPayForm({ type: "Paid", entityType: "Supplier", entityId: s.id, referenceNumber: "", amount: String(s.outstanding), method: "Cash", accountId: def?.id ?? "", notes: "" }); setModal("recordPayment") }}
                      >
                        Pay
                      </Button>
                    </div>
                  ))}
                </div>
                {supplierPayables.length > 0 && (
                  <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/50 flex justify-between text-xs">
                    <span className="font-medium text-slate-600">Total Payable</span>
                    <span className="font-bold text-red-600">{formatCurrency(supplierPayables.reduce((s, sp) => s + sp.outstanding, 0))}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* â•â•â•â• ADD ACCOUNT DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "addAccount"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Account Type <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {(["bank", "mobile_wallet", "cash"] as FinanceAccountType[]).map(t => {
                  const m = ACCOUNT_TYPE_META[t]
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAccForm(f => ({ ...f, type: t, accountTitle: "", bankName: "", name: t === "cash" ? "Cash" : "" }))}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-xs font-medium",
                        accForm.type === t
                          ? cn("border-blue-500 bg-blue-50 text-blue-700")
                          : "border-slate-200 hover:border-slate-300 text-slate-600"
                      )}
                    >
                      <span className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", accForm.type === t ? "bg-blue-500" : m.bg)}>
                        {m.icon}
                      </span>
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {accForm.type === "bank" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Bank Name</Label>
                <Select value={accForm.bankName} onValueChange={v => setAccForm(f => ({ ...f, bankName: v, name: f.name || v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select bank..." /></SelectTrigger>
                  <SelectContent>
                    {BANK_NAMES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {accForm.type === "mobile_wallet" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Wallet Provider</Label>
                <Select value={accForm.bankName} onValueChange={v => setAccForm(f => ({ ...f, bankName: v, name: f.name || v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select wallet..." /></SelectTrigger>
                  <SelectContent>
                    {WALLET_NAMES.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Account Name <span className="text-red-500">*</span></Label>
              <Input
                value={accForm.name}
                onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))}
                placeholder={accForm.type === "bank" ? "e.g. HBL Saving Account" : accForm.type === "mobile_wallet" ? "e.g. JazzCash Business" : "Cash"}
                className="h-9 text-sm"
              />
            </div>

            {accForm.type !== "cash" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Account Title <span className="text-slate-400">(optional)</span></Label>
                <Input
                  value={accForm.accountTitle}
                  onChange={e => setAccForm(f => ({ ...f, accountTitle: e.target.value }))}
                  placeholder="e.g. Muhammad Ali"
                  className="h-9 text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Account Number <span className="text-slate-400">(optional)</span></Label>
              <Input
                value={accForm.accountNumber}
                onChange={e => setAccForm(f => ({ ...f, accountNumber: e.target.value }))}
                placeholder={accForm.type === "mobile_wallet" ? "03XX-XXXXXXX" : "XXXX-XXXX-XXXX"}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Opening Balance (Rs)</Label>
              <Input
                type="number" onWheel={e => e.currentTarget.blur()}
                min="0"
                value={accForm.openingBalance}
                onChange={e => setAccForm(f => ({ ...f, openingBalance: e.target.value }))}
                placeholder="0"
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-slate-400">Enter the current amount already in this account, if any.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddAccount} disabled={saving}>
              {saving ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â• EDIT ACCOUNT DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "editAccount"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Account Name <span className="text-red-500">*</span></Label>
              <Input value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" />
            </div>
            {accForm.type !== "cash" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">
                    {accForm.type === "bank" ? "Bank Name" : "Wallet Provider"}
                  </Label>
                  <Input value={accForm.bankName} onChange={e => setAccForm(f => ({ ...f, bankName: e.target.value }))} className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Account Title</Label>
                  <Input value={accForm.accountTitle} onChange={e => setAccForm(f => ({ ...f, accountTitle: e.target.value }))} placeholder="e.g. Muhammad Ali" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-slate-600">Account Number</Label>
                  <Input value={accForm.accountNumber} onChange={e => setAccForm(f => ({ ...f, accountNumber: e.target.value }))} className="h-9 text-sm" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleEditAccount} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â• DEPOSIT DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "deposit"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5 text-emerald-600" /> Deposit
            </DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{selectedAccount.name}</span>
              <span className="text-slate-500">Balance: <span className="font-semibold text-slate-800">{formatCurrency(selectedAccount.currentBalance)}</span></span>
            </div>
          )}
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
              <Input type="number" onWheel={e => e.currentTarget.blur()} min="1" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-9 text-sm" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date</Label>
              <Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Description</Label>
              <Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Cash received from owner" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Textarea value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleDeposit} disabled={saving}>
              {saving ? "Processing..." : "Confirm Deposit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â• WITHDRAW DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "withdraw"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-red-600" /> Withdraw
            </DialogTitle>
          </DialogHeader>
          {selectedAccount && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700">{selectedAccount.name}</span>
              <span className="text-slate-500">Balance: <span className="font-semibold text-slate-800">{formatCurrency(selectedAccount.currentBalance)}</span></span>
            </div>
          )}
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
              <Input type="number" onWheel={e => e.currentTarget.blur()} min="1" max={selectedAccount?.currentBalance} value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-9 text-sm" autoFocus />
              {selectedAccount && Number(txForm.amount) > selectedAccount.currentBalance && (
                <p className="text-[10px] text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Exceeds available balance</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date</Label>
              <Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Description</Label>
              <Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Petty cash withdrawn" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Textarea value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleWithdraw} disabled={saving}>
              {saving ? "Processing..." : "Confirm Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â• TRANSFER DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "transfer"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-blue-600" /> Transfer Between Accounts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">From Account</Label>
              <Select value={transferForm.fromId} onValueChange={v => setTransferForm(f => ({ ...f, fromId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select source..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} - {formatCurrency(a.currentBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-center">
              <ArrowDownLeft className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">To Account</Label>
              <Select value={transferForm.toId} onValueChange={v => setTransferForm(f => ({ ...f, toId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select destination..." /></SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== transferForm.fromId).map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
              <Input type="number" onWheel={e => e.currentTarget.blur()} min="1" value={transferForm.amount} onChange={e => setTransferForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Date</Label>
              <Input type="date" value={transferForm.date} onChange={e => setTransferForm(f => ({ ...f, date: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Textarea value={transferForm.notes} onChange={e => setTransferForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleTransfer} disabled={saving}>
              {saving ? "Processing..." : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* â•â•â•â• RECORD PAYMENT DIALOG â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Dialog open={modal === "recordPayment"} onOpenChange={o => !o && setModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Type</Label>
                <Select value={payForm.type} onValueChange={v => setPayForm(f => ({ ...f, type: v as "Received" | "Paid" }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Received">Received</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Entity</Label>
                <Select value={payForm.entityType} onValueChange={v => setPayForm(f => ({ ...f, entityType: v as "Customer" | "Supplier", entityId: "" }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">
                {payForm.entityType} <span className="text-red-500">*</span>
              </Label>
              <Select value={payForm.entityId} onValueChange={v => setPayForm(f => ({ ...f, entityId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`Select ${payForm.entityType.toLowerCase()}...`} /></SelectTrigger>
                <SelectContent>
                  {payForm.entityType === "Customer"
                    ? customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    : suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.companyName}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Amount (Rs) <span className="text-red-500">*</span></Label>
                <Input type="number" onWheel={e => e.currentTarget.blur()} min="1" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Method</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">
                {payForm.type === "Received" ? "Receive Into Account" : "Pay From Account"} <span className="text-red-500">*</span>
              </Label>
              <Select value={payForm.accountId} onValueChange={v => setPayForm(f => ({ ...f, accountId: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} - Rs {a.currentBalance.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Reference # <span className="text-slate-400">(optional)</span></Label>
              <Input value={payForm.referenceNumber} onChange={e => setPayForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g. INV-2026-0011 or PO-2026-0138" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-600">Notes</Label>
              <Textarea value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRecordPayment} disabled={saving}>
              {saving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
