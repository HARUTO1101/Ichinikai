import type { OrderSummary } from '../types/order'

const STORAGE_KEY = 'order-history.v1'
const HISTORY_LIMIT = 20

export interface OrderHistoryEntry extends OrderSummary {
  savedAt: string
}

const listeners = new Set<() => void>()

const isBrowser = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readHistory = (): OrderHistoryEntry[] => {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OrderHistoryEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && 'orderId' in entry && 'ticket' in entry)
      .map((entry) => ({
        ...entry,
        callNumber:
          typeof entry.callNumber === 'number' && Number.isFinite(entry.callNumber)
            ? entry.callNumber
            : 0,
      }))
  } catch (error) {
    console.warn('Failed to parse order history from storage', error)
    return []
  }
}

const writeHistory = (history: OrderHistoryEntry[]) => {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch (error) {
    console.warn('Failed to write order history to storage', error)
  }
}

const emitChange = () => {
  listeners.forEach((listener) => listener())
}

export const getOrderHistory = (): OrderHistoryEntry[] => readHistory()

export const addOrderHistory = (summary: OrderSummary): OrderHistoryEntry[] => {
  const history = readHistory()
  const entry: OrderHistoryEntry = {
    ...summary,
    callNumber:
      typeof summary.callNumber === 'number' && Number.isFinite(summary.callNumber)
        ? summary.callNumber
        : 0,
    savedAt: new Date().toISOString(),
  }

  const nextHistory = [entry, ...history.filter((item) => item.orderId !== summary.orderId && item.ticket !== summary.ticket)].slice(0, HISTORY_LIMIT)
  writeHistory(nextHistory)
  emitChange()
  return nextHistory
}

export const clearOrderHistory = () => {
  writeHistory([])
  emitChange()
}

export const subscribeOrderHistory = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (isBrowser()) {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      emitChange()
    }
  })
}
