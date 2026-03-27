import { useState, useMemo, useEffect } from "react"
import { useDebounce } from "./use-debounce"
import { supabase } from "@/lib/supabase"
import type { Mobile, Accessory, Customer, Supplier } from "@/data/types"

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  type: "mobile" | "accessory" | "customer" | "supplier"
  href: string
}

export function useGlobalSearch() {
  const [query, setQuery] = useState("")
  const [mobiles, setMobiles] = useState<Mobile[]>([])
  const [accessories, setAccessories] = useState<Accessory[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const debouncedQuery = useDebounce(query, 200)

  // Load data once when first search is attempted
  useEffect(() => {
    if (debouncedQuery.length >= 2 && !dataLoaded) {
      loadSearchData()
    }
  }, [debouncedQuery, dataLoaded])

  async function loadSearchData() {
    try {
      const [mobRes, accRes, custRes, supRes] = await Promise.all([
        supabase.from("mobiles").select("id, brand, model, imei, selling_price, stock"),
        supabase.from("accessories").select("id, name, brand, sku, selling_price"),
        supabase.from("customers").select("id, name, phone"),
        supabase.from("suppliers").select("id, company_name, contact_person, city"),
      ])
      setMobiles((mobRes.data ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        brand: m.brand as string,
        model: m.model as string,
        imei: m.imei as string,
        sellingPrice: m.selling_price as number,
        stock: m.stock as number,
      })) as unknown as Mobile[])
      setAccessories((accRes.data ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        name: a.name as string,
        brand: a.brand as string,
        sku: a.sku as string,
        sellingPrice: a.selling_price as number,
      })) as unknown as Accessory[])
      setCustomers((custRes.data ?? []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        name: c.name as string,
        phone: c.phone as string,
      })) as unknown as Customer[])
      setSuppliers((supRes.data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        companyName: s.company_name as string,
        contactPerson: s.contact_person as string,
        city: s.city as string,
      })) as unknown as Supplier[])
      setDataLoaded(true)
    } catch {
      // silently fail — search just won't work
    }
  }

  const results = useMemo((): SearchResult[] => {
    if (!debouncedQuery || debouncedQuery.length < 2) return []
    const q = debouncedQuery.toLowerCase()

    const mobileResults: SearchResult[] = mobiles
      .filter(m => m.brand.toLowerCase().includes(q) || m.model.toLowerCase().includes(q) || m.imei.includes(q))
      .slice(0, 5)
      .map(m => ({ id: m.id, title: `${m.brand} ${m.model}`, subtitle: `₨ ${m.sellingPrice.toLocaleString()} • Stock: ${m.stock}`, type: "mobile", href: "/products/mobiles" }))

    const accessoryResults: SearchResult[] = accessories
      .filter(a => a.name.toLowerCase().includes(q) || a.brand.toLowerCase().includes(q) || a.sku.toLowerCase().includes(q))
      .slice(0, 5)
      .map(a => ({ id: a.id, title: a.name, subtitle: `${a.brand} • ₨ ${a.sellingPrice.toLocaleString()}`, type: "accessory", href: "/products/accessories" }))

    const customerResults: SearchResult[] = customers
      .filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      .slice(0, 3)
      .map(c => ({ id: c.id, title: c.name, subtitle: c.phone, type: "customer", href: `/customers/${c.id}` }))

    const supplierResults: SearchResult[] = suppliers
      .filter(s => s.companyName.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q))
      .slice(0, 3)
      .map(s => ({ id: s.id, title: s.companyName, subtitle: s.city, type: "supplier", href: `/suppliers/${s.id}` }))

    return [...mobileResults, ...accessoryResults, ...customerResults, ...supplierResults]
  }, [debouncedQuery, mobiles, accessories, customers, suppliers])

  return { query, setQuery, results }
}
