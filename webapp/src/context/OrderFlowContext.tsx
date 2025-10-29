import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { FirebaseError } from 'firebase/app'
import QRCode from 'qrcode'
import {
  createOrder,
  fetchOrderByTicket,
  fetchOrderDetail,
  subscribeOrderLookup,
} from '../services/orders'
import { addOrderHistory } from '../services/orderHistory'
import { useMenuConfig } from '../hooks/useMenuConfig'
import {
  MENU_ITEMS,
  type MenuItem,
  type MenuItemKey,
  type OrderLookupResult,
  type OrderSummary,
} from '../types/order'
import { buildTicketUrl, extractTicketFromInput } from '../utils/ticket'
import { ensurePlatingProgress } from '../utils/plating'

interface CartItemView {
  item: MenuItem
  quantity: number
  subtotal: number
}

interface OrderResultPayload {
  summary: OrderSummary
  qrCode: string
  progressUrl: string
}

const ensureCallNumber = (value: number | undefined): number =>
  Number.isInteger(value) && value !== null && value !== undefined && value > 0 ? value : 0

const createSummaryFromDetail = (detail: OrderLookupResult | OrderSummary): OrderSummary => {
  const items = detail.items ?? {}
  return {
    orderId: detail.orderId,
    ticket: detail.ticket,
    callNumber: ensureCallNumber(detail.callNumber),
    total: detail.total,
    items,
    payment: detail.payment,
    progress: detail.progress,
    plating: ensurePlatingProgress(items, detail.plating),
    createdAt: detail.createdAt ? new Date(detail.createdAt) : undefined,
  }
}

const isPermissionDeniedError = (error: unknown): boolean =>
  error instanceof FirebaseError && error.code === 'permission-denied'

interface OrderFlowContextValue {
  items: Record<MenuItemKey, number>
  updateQuantity: (key: MenuItemKey, nextValue: number) => void
  resetItems: () => void
  cartItems: CartItemView[]
  total: number
  hasItems: boolean
  loading: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  confirmOrder: () => Promise<OrderSummary | null>
  orderResult: OrderResultPayload | null
  clearOrderResult: () => void
  startNewOrder: () => void
  refreshOrderResult: () => Promise<OrderSummary | null>
  loadOrderByTicket: (ticket: string) => Promise<OrderSummary | null>
}

const OrderFlowContext = createContext<OrderFlowContextValue | undefined>(undefined)

const createInitialQuantities = () =>
  Object.keys(MENU_ITEMS).reduce(
    (acc, key) => {
      acc[key as MenuItemKey] = 0
      return acc
    },
    {} as Record<MenuItemKey, number>,
  )

export function OrderFlowProvider({ children }: { children: ReactNode }) {
  const { menuItems } = useMenuConfig()
  const [items, setItems] = useState<Record<MenuItemKey, number>>(createInitialQuantities)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderResult, setOrderResult] = useState<OrderResultPayload | null>(null)

  const updateQuantity = useCallback((key: MenuItemKey, nextValue: number) => {
    setItems((prev) => ({
      ...prev,
      [key]: Math.max(0, Number.isFinite(nextValue) ? Math.floor(nextValue) : 0),
    }))
  }, [])

  const resetItems = useCallback(() => {
    setItems(createInitialQuantities())
  }, [])

  const cartItems = useMemo<CartItemView[]>(
    () =>
      menuItems
        .map((item) => ({
          item,
          quantity: items[item.key],
          subtotal: items[item.key] * item.price,
        }))
        .filter(({ quantity }) => quantity > 0),
    [items, menuItems],
  )

  const total = useMemo(
    () => cartItems.reduce((sum, entry) => sum + entry.subtotal, 0),
    [cartItems],
  )

  const hasItems = cartItems.length > 0

  const buildOrderResultPayload = useCallback(async (summary: OrderSummary) => {
    const progressUrl = buildTicketUrl(summary.ticket)
    const qrCode = await QRCode.toDataURL(progressUrl, { width: 256, margin: 1 })
    return { summary, qrCode, progressUrl }
  }, [])

  const confirmOrder = useCallback(async () => {
    if (loading) return null

    if (!hasItems) {
      setError('商品を1点以上ご注文ください。')
      return null
    }

    setLoading(true)
    setError(null)
    setOrderResult(null)

    try {
      const created = await createOrder(items)
      const summary = createSummaryFromDetail(created)
      const payload = await buildOrderResultPayload(summary)
      setOrderResult(payload)
      try {
        addOrderHistory(summary)
      } catch (historyError) {
        console.warn('注文履歴の保存に失敗しました', historyError)
      }
      return summary
    } catch (err) {
      console.error(err)
      setError('注文処理に失敗しました。通信環境をご確認ください。')
      return null
    } finally {
      setLoading(false)
    }
  }, [buildOrderResultPayload, hasItems, items, loading])

  const clearOrderResult = useCallback(() => {
    setOrderResult(null)
  }, [])

  const startNewOrder = useCallback(() => {
    resetItems()
    clearOrderResult()
    setError(null)
  }, [clearOrderResult, resetItems])

  const refreshOrderResult = useCallback(async () => {
    if (!orderResult) return null

    try {
      const lookup = await fetchOrderByTicket(orderResult.summary.ticket)
      if (!lookup) {
        setOrderResult(null)
        return null
      }

      let detail = null
      try {
        detail = await fetchOrderDetail(lookup.orderId)
      } catch (detailError) {
        if (!isPermissionDeniedError(detailError)) {
          throw detailError
        }
        console.info('orders コレクションの参照権限がないため orderLookup の情報を利用します。', detailError)
      }

      const nextSummary = createSummaryFromDetail(detail ?? lookup)

      setOrderResult((prev) => (prev ? { ...prev, summary: nextSummary } : prev))
      return nextSummary
    } catch (error) {
      console.error('最新の注文情報の取得に失敗しました', error)
      throw error
    }
  }, [orderResult])

  const loadOrderByTicket = useCallback(
    async (ticket: string) => {
      const normalized = extractTicketFromInput(ticket)
      if (!normalized) return null

      try {
        const lookup = await fetchOrderByTicket(normalized)
        if (!lookup) {
          setOrderResult(null)
          return null
        }

        let detail = null
        try {
          detail = await fetchOrderDetail(lookup.orderId)
        } catch (detailError) {
          if (!isPermissionDeniedError(detailError)) {
            throw detailError
          }
          console.info('orders コレクションの参照権限がないため orderLookup の情報を利用します。', detailError)
        }
        const summary = createSummaryFromDetail(detail ?? lookup)

        const payload = await buildOrderResultPayload(summary)
        setOrderResult(payload)
        return summary
      } catch (error) {
        console.error('チケット番号から注文を取得できませんでした', error)
        throw error
      }
    },
    [buildOrderResultPayload],
  )

  const activeTicket = orderResult?.summary.ticket ?? ''

  useEffect(() => {
    if (!activeTicket) {
      return
    }

    const unsubscribe = subscribeOrderLookup(activeTicket, (lookup) => {
      if (!lookup) {
        setOrderResult(null)
        return
      }

      setOrderResult((prev) => {
        if (!prev) {
          return prev
        }

        const nextSummary = createSummaryFromDetail(lookup)
        const prevSummary = prev.summary

        const hasChanges =
          prevSummary.progress !== nextSummary.progress ||
          prevSummary.payment !== nextSummary.payment ||
          prevSummary.callNumber !== nextSummary.callNumber ||
          prevSummary.total !== nextSummary.total ||
          prevSummary.orderId !== nextSummary.orderId

        if (!hasChanges) {
          return prev
        }

        return {
          ...prev,
          summary: nextSummary,
        }
      })
    })

    return () => {
      unsubscribe()
    }
  }, [activeTicket])

  const value = useMemo<OrderFlowContextValue>(
    () => ({
      items,
      updateQuantity,
      resetItems,
      cartItems,
      total,
      hasItems,
      loading,
      error,
      setError,
      confirmOrder,
      orderResult,
      clearOrderResult,
      startNewOrder,
      refreshOrderResult,
      loadOrderByTicket,
    }),
    [
      items,
      updateQuantity,
      resetItems,
      cartItems,
      total,
      hasItems,
      loading,
      error,
      confirmOrder,
      orderResult,
      clearOrderResult,
      startNewOrder,
      refreshOrderResult,
      loadOrderByTicket,
    ],
  )

  return <OrderFlowContext.Provider value={value}>{children}</OrderFlowContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrderFlow() {
  const context = useContext(OrderFlowContext)
  if (!context) {
    throw new Error('useOrderFlow must be used within an OrderFlowProvider')
  }
  return context
}

