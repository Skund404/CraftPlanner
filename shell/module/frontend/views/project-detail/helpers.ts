export function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function statusVariant(status: string): 'warning' | 'accent' | 'muted' | 'success' | 'default' {
  switch (status) {
    case 'planning': return 'warning'
    case 'active': return 'accent'
    case 'paused': return 'muted'
    case 'completed': return 'success'
    case 'archived': return 'default'
    default: return 'default'
  }
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  target.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function deadlineColor(days: number | null): string {
  if (days === null) return 'text-text-faint'
  if (days < 0) return 'text-danger'
  if (days <= 3) return 'text-danger'
  if (days <= 7) return 'text-warning'
  return 'text-success'
}

export function parseNotes(raw: string): { client: string; construction: string; lessons: string; general: string } {
  if (!raw) return { client: '', construction: '', lessons: '', general: '' }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return {
        client: parsed.client ?? '',
        construction: parsed.construction ?? '',
        lessons: parsed.lessons ?? '',
        general: parsed.general ?? '',
      }
    }
  } catch {
    // plain text — migrate to general
  }
  return { client: '', construction: '', lessons: '', general: raw }
}

export function serializeNotes(notes: { client: string; construction: string; lessons: string; general: string }): string {
  return JSON.stringify(notes)
}
