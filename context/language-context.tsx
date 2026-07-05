"use client"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

export type Language = "en" | "ur"

// ---------------------------------------------------------------------------
// Translations dictionary
// Rules:
//  - English = default, clear plain text (no Dr/Cr jargon)
//  - Urdu = Pakistani shopkeeper Urdu (not formal/literary), written in Nastaliq script
//  - Data values (IMEI, prices, names) are NEVER translated — only labels/buttons/placeholders
// ---------------------------------------------------------------------------
const translations = {
  // ── Sidebar sections ──────────────────────────────────────────────────────
  "nav.section.MAIN":         { en: "MAIN",         ur: "مین" },
  "nav.section.INVENTORY":    { en: "INVENTORY",    ur: "اسٹاک" },
  "nav.section.TRANSACTIONS": { en: "TRANSACTIONS", ur: "لین دین" },
  "nav.section.PEOPLE":       { en: "PEOPLE",       ur: "افراد" },
  "nav.section.INSIGHTS":     { en: "INSIGHTS",     ur: "رپورٹس" },
  "nav.section.SYSTEM":       { en: "SYSTEM",       ur: "سسٹم" },

  // ── Sidebar nav items ─────────────────────────────────────────────────────
  "nav.Dashboard":          { en: "Dashboard",         ur: "ڈیش بورڈ" },
  "nav.Mobile Phones":      { en: "Mobile Phones",     ur: "موبائل فون" },
  "nav.Accessories":        { en: "Accessories",       ur: "اضافی سامان" },
  "nav.Stock Alerts":       { en: "Stock Alerts",      ur: "اسٹاک الرٹ" },
  "nav.Used Phones":        { en: "Used Phones",       ur: "پرانے فون" },
  "nav.Catalog":            { en: "Catalog",           ur: "کیٹالاگ" },
  "nav.Categories":         { en: "Categories",        ur: "اقسام" },
  "nav.Brands":             { en: "Brands",            ur: "برانڈز" },
  "nav.Models":             { en: "Models",            ur: "ماڈلز" },
  "nav.Colors":             { en: "Colors",            ur: "رنگ" },
  "nav.Storage":            { en: "Storage",           ur: "میموری" },
  "nav.RAM":                { en: "RAM",               ur: "ریم" },
  "nav.Sales":              { en: "Sales",             ur: "فروخت" },
  "nav.Purchases":          { en: "Purchases",         ur: "خریداری" },
  "nav.Returns":            { en: "Returns",           ur: "واپسی" },
  "nav.Purchase Returns":   { en: "Purchase Returns",  ur: "خریداری واپسی" },
  "nav.Finance":            { en: "Finance",           ur: "مالیات" },
  "nav.Expenses":           { en: "Expenses",          ur: "اخراجات" },
  "nav.Ledger":             { en: "Ledger",            ur: "کھاتہ" },
  "nav.Customer Ledger":    { en: "Customer Ledger",   ur: "گاہک کھاتہ" },
  "nav.Supplier Ledger":    { en: "Supplier Ledger",   ur: "سپلائر کھاتہ" },
  "nav.Person Ledger":      { en: "Person Ledger",     ur: "ذاتی کھاتہ" },
  "nav.Suppliers":          { en: "Suppliers",         ur: "سپلائرز" },
  "nav.Customers":          { en: "Customers",         ur: "گاہک" },
  "nav.Persons":            { en: "Persons",           ur: "افراد" },
  "nav.Reports & Analytics":{ en: "Reports & Analytics", ur: "رپورٹس" },
  "nav.Staff":              { en: "Staff",             ur: "عملہ" },
  "nav.Audit Log":          { en: "Audit Log",         ur: "تبدیلی لاگ" },
  "nav.Settings":           { en: "Settings",          ur: "ترتیبات" },

  // ── Quick action buttons ──────────────────────────────────────────────────
  "action.New Sale":     { en: "New Sale",     ur: "نئی فروخت" },
  "action.New Purchase": { en: "New Purchase", ur: "نئی خریداری" },

  // ── Common buttons ────────────────────────────────────────────────────────
  "btn.Save":           { en: "Save Changes",   ur: "محفوظ کریں" },
  "btn.Saving":         { en: "Saving…",        ur: "محفوظ ہو رہا ہے…" },
  "btn.Cancel":         { en: "Cancel",         ur: "منسوخ" },
  "btn.Delete":         { en: "Delete",         ur: "حذف کریں" },
  "btn.Edit":           { en: "Edit",           ur: "ترمیم" },
  "btn.Add":            { en: "Add",            ur: "شامل کریں" },
  "btn.Search":         { en: "Search",         ur: "تلاش کریں" },
  "btn.Filter":         { en: "Filter",         ur: "فلٹر" },
  "btn.Export":         { en: "Export",         ur: "برآمد کریں" },
  "btn.Print":          { en: "Print",          ur: "پرنٹ کریں" },
  "btn.Close":          { en: "Close",          ur: "بند کریں" },
  "btn.Confirm":        { en: "Confirm",        ur: "تصدیق کریں" },
  "btn.Submit":         { en: "Submit",         ur: "جمع کروائیں" },
  "btn.Update":         { en: "Update",         ur: "اپ ڈیٹ کریں" },
  "btn.View":           { en: "View",           ur: "دیکھیں" },

  // ── Common labels ─────────────────────────────────────────────────────────
  "label.Name":         { en: "Name",           ur: "نام" },
  "label.Phone":        { en: "Phone",          ur: "فون نمبر" },
  "label.Email":        { en: "Email",          ur: "ای میل" },
  "label.Address":      { en: "Address",        ur: "پتہ" },
  "label.City":         { en: "City",           ur: "شہر" },
  "label.Date":         { en: "Date",           ur: "تاریخ" },
  "label.Notes":        { en: "Notes",          ur: "نوٹس" },
  "label.Status":       { en: "Status",         ur: "حیثیت" },
  "label.Amount":       { en: "Amount",         ur: "رقم" },
  "label.Price":        { en: "Price",          ur: "قیمت" },
  "label.Total":        { en: "Total",          ur: "کل رقم" },
  "label.Paid":         { en: "Paid",           ur: "ادا شدہ" },
  "label.Balance":      { en: "Balance",        ur: "بقایا" },
  "label.Brand":        { en: "Brand",          ur: "برانڈ" },
  "label.Model":        { en: "Model",          ur: "ماڈل" },
  "label.Color":        { en: "Color",          ur: "رنگ" },
  "label.Storage":      { en: "Storage",        ur: "میموری" },
  "label.Quantity":     { en: "Quantity",       ur: "تعداد" },
  "label.Category":     { en: "Category",       ur: "قسم" },
  "label.Supplier":     { en: "Supplier",       ur: "سپلائر" },
  "label.Customer":     { en: "Customer",       ur: "گاہک" },
  "label.IMEI":         { en: "IMEI",           ur: "آئی ایم ای آئی" },
  "label.CNIC":         { en: "CNIC",           ur: "شناختی کارڈ" },

  // ── Status values ─────────────────────────────────────────────────────────
  "status.In Stock":      { en: "In Stock",       ur: "موجود ہے" },
  "status.Sold":          { en: "Sold",           ur: "فروخت ہو گیا" },
  "status.Under Repair":  { en: "Under Repair",   ur: "مرمت میں ہے" },
  "status.Active":        { en: "Active",         ur: "فعال" },
  "status.Inactive":      { en: "Inactive",       ur: "غیر فعال" },
  "status.Settled":       { en: "Settled",        ur: "حساب صاف" },
  "status.Pending":       { en: "Pending",        ur: "زیر التواء" },

  // ── Financial labels ──────────────────────────────────────────────────────
  "fin.Opening Balance":         { en: "Previous Balance",           ur: "پرانا بقایا" },
  "fin.Outstanding":             { en: "Outstanding",                ur: "باقی رقم" },
  "fin.Total Purchases":         { en: "Total Purchases",            ur: "کل خریداری" },
  "fin.Total Paid":              { en: "Total Paid",                 ur: "کل ادائیگی" },
  "fin.Net Balance":             { en: "Net Balance",                ur: "خالص بقایا" },
  "fin.We owe supplier":         { en: "We need to pay this supplier", ur: "ہمیں ابھی دینا ہے" },
  "fin.Supplier advance":        { en: "We paid extra (advance)",      ur: "ہم نے زیادہ دیا" },
  "fin.Customer owes":           { en: "Customer needs to pay",        ur: "گاہک کا بقایا ہے" },
  "fin.Customer advance":        { en: "Customer paid extra",          ur: "گاہک نے زیادہ دیا" },
  "fin.Account settled":         { en: "Account settled",              ur: "حساب صاف ہے" },
  "fin.They owe us":             { en: "They need to pay us",          ur: "انہیں دینا ہے" },
  "fin.We owe them":             { en: "We need to pay them",          ur: "ہمیں دینا ہے" },

  // ── Settings page ─────────────────────────────────────────────────────────
  "settings.title":              { en: "Settings",                   ur: "ترتیبات" },
  "settings.language":           { en: "Language",                   ur: "زبان" },
  "settings.language.desc":      { en: "Choose your preferred language for the interface", ur: "انٹرفیس کے لیے زبان منتخب کریں" },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  "dash.Today Sales":    { en: "Today's Sales",   ur: "آج کی فروخت" },
  "dash.Total Revenue":  { en: "Total Revenue",   ur: "کل آمدنی" },
  "dash.Inventory":      { en: "Inventory Items", ur: "اسٹاک آئٹمز" },
  "dash.Customers":      { en: "Customers",       ur: "گاہک" },
} as const

export type TranslationKey = keyof typeof translations

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
  isRTL: boolean
}

const LanguageContext = createContext<LanguageContextType | null>(null)

const STORAGE_KEY = "mobitrack_language"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null
      if (saved === "en" || saved === "ur") setLanguageState(saved)
    } catch {}
    setMounted(true)
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  }, [])

  const activeLang = mounted ? language : "en"

  const t = useCallback((key: TranslationKey): string => {
    const entry = translations[key]
    if (!entry) return key
    return entry[activeLang] ?? entry.en
  }, [activeLang])

  const isRTL = false // Layout always stays LTR — only specific terms are translated

  return (
    <LanguageContext.Provider value={{ language: activeLang, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider")
  return ctx
}
