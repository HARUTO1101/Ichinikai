const DEFAULT_BASE_URL = import.meta.env.VITE_APP_BASE_URL ?? ''

const ensureBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return DEFAULT_BASE_URL || 'https://example.com'
}

export const buildTicketUrl = (ticket: string): string => {
  const base = ensureBaseUrl().replace(/\/$/, '')
  return `${base}/order/complete/${encodeURIComponent(ticket)}`
}

export const extractTicketFromInput = (rawValue: string): string => {
  if (!rawValue) return ''
  const value = rawValue.trim()
  if (!value) return ''

  try {
    const maybeUrl = new URL(value)
    const directMatch = maybeUrl.pathname.match(/\/order\/complete\/(.+)$/)
    if (directMatch && directMatch[1]) {
      return decodeURIComponent(directMatch[1]).replace(/[^0-9a-z]/gi, '').toUpperCase()
    }
    const ticketParam = maybeUrl.searchParams.get('ticket')
    if (ticketParam) {
      return ticketParam.replace(/[^0-9a-z]/gi, '').toUpperCase()
    }
  } catch {
    // value was not a URL; continue with fallback parsing
  }

  return value.replace(/[^0-9a-z]/gi, '').toUpperCase()
}