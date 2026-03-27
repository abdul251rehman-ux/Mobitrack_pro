"use client"
import React, { createContext, useContext, useReducer, useCallback, useEffect } from "react"

export interface CartItem {
  productId: string
  productName: string
  productType: "Mobile" | "Accessory"
  quantity: number
  unitPrice: number
  discount: number
  lineTotal: number
  maxStock: number
}

interface CartState {
  items: CartItem[]
  overallDiscount: number
  tax: number
  paymentMethod: string
  amountReceived: number
  notes: string
}

type CartAction =
  | { type: "ADD_ITEM"; payload: Omit<CartItem, "lineTotal"> }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QTY"; payload: { productId: string; quantity: number } }
  | { type: "UPDATE_DISCOUNT"; payload: { productId: string; discount: number } }
  | { type: "SET_OVERALL_DISCOUNT"; payload: number }
  | { type: "SET_TAX"; payload: number }
  | { type: "SET_PAYMENT_METHOD"; payload: string }
  | { type: "SET_AMOUNT_RECEIVED"; payload: number }
  | { type: "SET_NOTES"; payload: string }
  | { type: "CLEAR_CART" }

function calcLineTotal(qty: number, price: number, discount: number) {
  return Math.max(0, qty * price - discount)
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = state.items.find(i => i.productId === action.payload.productId)
      if (existing) {
        return {
          ...state,
          items: state.items.map(i =>
            i.productId === action.payload.productId
              ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock), lineTotal: calcLineTotal(Math.min(i.quantity + 1, i.maxStock), i.unitPrice, i.discount) }
              : i
          )
        }
      }
      return {
        ...state,
        items: [...state.items, {
          ...action.payload,
          lineTotal: calcLineTotal(action.payload.quantity, action.payload.unitPrice, action.payload.discount)
        }]
      }
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter(i => i.productId !== action.payload) }
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items.map(i =>
          i.productId === action.payload.productId
            ? { ...i, quantity: action.payload.quantity, lineTotal: calcLineTotal(action.payload.quantity, i.unitPrice, i.discount) }
            : i
        )
      }
    case "UPDATE_DISCOUNT":
      return {
        ...state,
        items: state.items.map(i =>
          i.productId === action.payload.productId
            ? { ...i, discount: action.payload.discount, lineTotal: calcLineTotal(i.quantity, i.unitPrice, action.payload.discount) }
            : i
        )
      }
    case "SET_OVERALL_DISCOUNT": return { ...state, overallDiscount: action.payload }
    case "SET_TAX": return { ...state, tax: action.payload }
    case "SET_PAYMENT_METHOD": return { ...state, paymentMethod: action.payload }
    case "SET_AMOUNT_RECEIVED": return { ...state, amountReceived: action.payload }
    case "SET_NOTES": return { ...state, notes: action.payload }
    case "CLEAR_CART": return { items: [], overallDiscount: 0, tax: 0, paymentMethod: "Cash", amountReceived: 0, notes: "" }
    default: return state
  }
}

interface CartContextType {
  state: CartState
  subtotal: number
  grandTotal: number
  changeDue: number
  addItem: (item: Omit<CartItem, "lineTotal">) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, quantity: number) => void
  updateDiscount: (productId: string, discount: number) => void
  setOverallDiscount: (v: number) => void
  setTax: (v: number) => void
  setPaymentMethod: (v: string) => void
  setAmountReceived: (v: number) => void
  setNotes: (v: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = "mobitrack_cart"

function getInitialCartState(): CartState {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
  }
  return { items: [], overallDiscount: 0, tax: 0, paymentMethod: "Cash", amountReceived: 0, notes: "" }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, getInitialCartState)

  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state])

  const subtotal = state.items.reduce((sum, i) => sum + i.lineTotal, 0)
  const grandTotal = Math.max(0, subtotal - state.overallDiscount + state.tax)
  const changeDue = state.amountReceived - grandTotal

  const addItem = useCallback((item: Omit<CartItem, "lineTotal">) => dispatch({ type: "ADD_ITEM", payload: item }), [])
  const removeItem = useCallback((id: string) => dispatch({ type: "REMOVE_ITEM", payload: id }), [])
  const updateQty = useCallback((id: string, qty: number) => dispatch({ type: "UPDATE_QTY", payload: { productId: id, quantity: qty } }), [])
  const updateDiscount = useCallback((id: string, disc: number) => dispatch({ type: "UPDATE_DISCOUNT", payload: { productId: id, discount: disc } }), [])
  const setOverallDiscount = useCallback((v: number) => dispatch({ type: "SET_OVERALL_DISCOUNT", payload: v }), [])
  const setTax = useCallback((v: number) => dispatch({ type: "SET_TAX", payload: v }), [])
  const setPaymentMethod = useCallback((v: string) => dispatch({ type: "SET_PAYMENT_METHOD", payload: v }), [])
  const setAmountReceived = useCallback((v: number) => dispatch({ type: "SET_AMOUNT_RECEIVED", payload: v }), [])
  const setNotes = useCallback((v: string) => dispatch({ type: "SET_NOTES", payload: v }), [])
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), [])

  return (
    <CartContext.Provider value={{ state, subtotal, grandTotal, changeDue, addItem, removeItem, updateQty, updateDiscount, setOverallDiscount, setTax, setPaymentMethod, setAmountReceived, setNotes, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used within CartProvider")
  return ctx
}
