// Currency formatting utilities

const GBP_FORMATTER = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const GBP_FORMATTER_PRECISE = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(amount: number | null | undefined, precise = false): string {
  if (amount === null || amount === undefined) {
    return '—'
  }

  const formatter = precise ? GBP_FORMATTER_PRECISE : GBP_FORMATTER
  return formatter.format(amount)
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}K`
  }
  return formatCurrency(amount)
}

// Parse currency string to number
// Handles formats like "£10,000", "10000", "10,000-15,000" (returns midpoint)
// Also handles "Estimated value £xxx" format
export function parseCurrencyAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return value
  }

  // Handle "Estimated value £xxx" format
  let processedValue = value
  const estimatedMatch = value.match(/estimated\s+value\s*[:\s]*£?([\d,]+(?:\.\d+)?)/i)
  if (estimatedMatch) {
    processedValue = estimatedMatch[1]
  }

  const cleaned = processedValue.replace(/[£,\s]/g, '')

  // Handle ranges (e.g., "10000-15000")
  if (cleaned.includes('-')) {
    const [minStr, maxStr] = cleaned.split('-')
    const min = parseFloat(minStr)
    const max = parseFloat(maxStr)

    if (!isNaN(min) && !isNaN(max)) {
      return (min + max) / 2 // Return midpoint
    }
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}
