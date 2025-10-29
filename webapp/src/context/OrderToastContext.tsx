import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { type MenuItem, type MenuItemKey, type OrderDetail } from '../types/order'
import { subscribeNewOrders } from '../services/orders'
import {
  subscribeKitchenToastTest,
  type KitchenToastTestDetail,
} from '../events/kitchenToastTest'
import { useMenuConfig } from '../hooks/useMenuConfig'
import { useAuth } from './AuthContext'

export interface OrderToast {
  id: string
  orderId: string
  callNumber: number
  total: number
  itemSummary: string
  createdAt?: Date
  source: 'new-order' | 'test' | 'custom'
}

export interface OrderToastEvent {
  type: 'new-order' | 'test' | 'custom'
  toast: OrderToast
  order?: OrderDetail
}

interface OrderToastContextValue {
  toasts: OrderToast[]
  removeToast: (id: string) => void
  addToast: (
    toast: Omit<OrderToast, 'id' | 'source'> & { id?: string; source?: OrderToast['source'] },
    eventOverride?: Omit<OrderToastEvent, 'toast'>,
  ) => OrderToast
  registerListener: (listener: (event: OrderToastEvent) => void) => () => void
}

const OrderToastContext = createContext<OrderToastContextValue | undefined>(undefined)

const TOAST_DURATION_MS = 6_000

function buildToastFromOrder(
  menuItemMap: Record<MenuItemKey, MenuItem>,
  order: OrderDetail,
): OrderToast {
  const itemSummary = Object.entries(order.items)
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => {
      const menu = menuItemMap[key as MenuItemKey]
      const label = menu?.label ?? key
      return `${label} ×${quantity}`
    })
    .join(' / ')

  return {
    id: `${order.orderId}-${Date.now()}`,
    orderId: order.orderId,
    callNumber: order.callNumber ?? 0,
    total: order.total,
    itemSummary: itemSummary || '新しい注文を受け付けました。',
    createdAt: order.createdAt ?? order.updatedAt ?? new Date(),
    source: 'new-order',
  }
}

function buildToastFromTest(detail: KitchenToastTestDetail): OrderToast {
  return {
    id: `test-${Date.now()}`,
    orderId: detail.orderId ?? 'TEST-ORDER',
    callNumber: detail.callNumber ?? 0,
    total: detail.total ?? 0,
    itemSummary:
      detail.itemSummary ?? 'テスト通知: 注文内容がここに表示されます。',
    createdAt: detail.createdAt ? new Date(detail.createdAt) : new Date(),
    source: 'test',
  }
}

interface OrderToastProviderProps {
  children: React.ReactNode
}

export function OrderToastProvider({ children }: OrderToastProviderProps) {
  const [toasts, setToasts] = useState<OrderToast[]>([])
  const toastTimersRef = useRef<Map<string, number>>(new Map())
  const listenersRef = useRef(new Set<(event: OrderToastEvent) => void>())
  const { status, hasRole } = useAuth()
  const { menuItemMap } = useMenuConfig()
  const canSubscribe = status === 'signed-in' && hasRole(['admin', 'staff', 'kitchen'])

  const emit = useCallback((event: OrderToastEvent) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error('OrderToast listener failed', error)
      }
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    const timerId = toastTimersRef.current.get(id)
    if (timerId) {
      window.clearTimeout(timerId)
      toastTimersRef.current.delete(id)
    }
  }, [])

  const scheduleRemoval = useCallback(
    (toastId: string) => {
      const existingTimer = toastTimersRef.current.get(toastId)
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }
      const timerId = window.setTimeout(() => removeToast(toastId), TOAST_DURATION_MS)
      toastTimersRef.current.set(toastId, timerId)
    },
    [removeToast],
  )

  const enqueueToast = useCallback(
    (toast: OrderToast, eventOverride?: Omit<OrderToastEvent, 'toast'>) => {
      setToasts((prev) => [...prev, toast])
      scheduleRemoval(toast.id)

      const event: OrderToastEvent = eventOverride
        ? { ...eventOverride, toast }
        : { type: toast.source, toast }

      emit(event)
      return toast
    },
    [emit, scheduleRemoval],
  )

  const addToast = useCallback(
    (
      toastInput: Omit<OrderToast, 'id' | 'source'> & { id?: string; source?: OrderToast['source'] },
      eventOverride?: Omit<OrderToastEvent, 'toast'>,
    ) => {
      const id = toastInput.id ?? `${toastInput.orderId}-${Date.now()}`
      const toast: OrderToast = {
        ...toastInput,
        id,
        source: toastInput.source ?? 'custom',
      }

      return enqueueToast(toast, eventOverride)
    },
    [enqueueToast],
  )

  useEffect(() => {
    const timers = toastTimersRef.current
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId))
      timers.clear()
    }
  }, [])

  useEffect(() => {
    if (!canSubscribe) {
      return
    }

    const unsubscribe = subscribeNewOrders((order) => {
      const toast = buildToastFromOrder(menuItemMap, order)
      enqueueToast(toast, { type: 'new-order', order })
    })

    return () => {
      unsubscribe?.()
    }
  }, [canSubscribe, enqueueToast, menuItemMap])

  useEffect(() => {
    const unsubscribe = subscribeKitchenToastTest((detail) => {
      const toast = buildToastFromTest(detail)
      enqueueToast(toast, { type: 'test' })
    })

    return () => {
      unsubscribe?.()
    }
  }, [enqueueToast])

  const registerListener = useCallback((listener: (event: OrderToastEvent) => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const value = useMemo<OrderToastContextValue>(
    () => ({
      toasts,
      removeToast,
      addToast,
      registerListener,
    }),
    [addToast, registerListener, removeToast, toasts],
  )

  return <OrderToastContext.Provider value={value}>{children}</OrderToastContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrderToasts() {
  const context = useContext(OrderToastContext)
  if (!context) {
    throw new Error('useOrderToasts must be used within an OrderToastProvider')
  }
  return context
}