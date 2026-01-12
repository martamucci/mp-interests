// Date formatting utilities

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return '—'
  }

  const d = typeof date === 'string' ? new Date(date) : date

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) {
    return '—'
  }

  const d = typeof date === 'string' ? new Date(date) : date

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} month${months > 1 ? 's' : ''} ago`
  }

  const years = Math.floor(diffDays / 365)
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function getISODate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}
