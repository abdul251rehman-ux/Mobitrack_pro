import { formatCurrency } from "@/lib/utils"

interface CurrencyProps {
  amount: number
  className?: string
}

export function Currency({ amount, className }: CurrencyProps) {
  return <span className={className}>{formatCurrency(amount)}</span>
}
