export type CoursePricing = {
  price: number
  discount_percent: number
}

export function finalPrice(p: CoursePricing): number {
  const base = Number(p.price) || 0
  const pct = Math.max(0, Math.min(100, Number(p.discount_percent) || 0))
  if (base <= 0) return 0
  return Math.round(base * (100 - pct)) / 100
}

export function isPaid(p: CoursePricing): boolean {
  return finalPrice(p) > 0
}

export function formatINR(amount: number): string {
  const rounded = Math.round(amount * 100) / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rounded % 1 === 0 ? 0 : 2,
  }).format(rounded)
}

export function amountInPaise(p: CoursePricing): number {
  return Math.round(finalPrice(p) * 100)
}
