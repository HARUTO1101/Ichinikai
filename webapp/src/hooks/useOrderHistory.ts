import { useSyncExternalStore } from 'react'
import {
  getOrderHistory,
  subscribeOrderHistory,
  type OrderHistoryEntry,
} from '../services/orderHistory'

const getSnapshot = (): OrderHistoryEntry[] => getOrderHistory()

export function useOrderHistory() {
  return useSyncExternalStore(subscribeOrderHistory, getSnapshot, getSnapshot)
}
