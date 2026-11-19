export interface OverdueDuration {
  overdueTotalDays: number
  overdueMonths: number
  overdueDays: number
  overdueLabel: string
}

export function formatDateOnly(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null
    const y = dateInput.getUTCFullYear()
    const m = String(dateInput.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dateInput.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(dateInput).trim()
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

export function parseDateOnlyUTC(dateInput: string | Date | null | undefined): Date | null {
  const formatted = formatDateOnly(dateInput)
  if (!formatted) return null
  const [y, m, d] = formatted.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

export function getTodayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000)
}

export function diffDaysUTC(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000)
}

export function formatOverdueDuration(totalDays: number): OverdueDuration {
  const safeDays = Math.max(0, Math.floor(totalDays || 0))
  if (safeDays <= 0) {
    return {
      overdueTotalDays: 0,
      overdueMonths: 0,
      overdueDays: 0,
      overdueLabel: 'Al día'
    }
  }

  const overdueMonths = Math.floor(safeDays / 30)
  const overdueDays = safeDays % 30

  let overdueLabel = ''
  if (overdueMonths > 0 && overdueDays > 0) {
    overdueLabel = `${overdueMonths} ${overdueMonths === 1 ? 'mes' : 'meses'} y ${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`
  } else if (overdueMonths > 0) {
    overdueLabel = `${overdueMonths} ${overdueMonths === 1 ? 'mes' : 'meses'}`
  } else {
    overdueLabel = `${overdueDays} ${overdueDays === 1 ? 'día' : 'días'}`
  }

  return {
    overdueTotalDays: safeDays,
    overdueMonths,
    overdueDays,
    overdueLabel
  }
}

export function calculateQuotaByFrequency(monthlySavings: number, frequency: number): number {
  const value = Number(monthlySavings) || 0
  const freq = Number(frequency) || 30
  if (freq === 15) return Math.round(value / 2)
  if (freq === 8) return Math.round(value / 4)
  return Math.round(value)
}
