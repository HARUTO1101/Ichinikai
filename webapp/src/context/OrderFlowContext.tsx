import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import QRCode from 'qrcode'
import { createOrder, fetchOrderByTicket, fetchOrderDetail } from '../services/orders'
import { addOrderHistory } from '../services/orderHistory'
import { MENU_ITEM_LIST, type MenuItem, type MenuItemKey, type OrderSummary } from '../types/order'
import { buildTicketUrl, extractTicketFromInput } from '../utils/ticket'

interface CartItemView {
  item: MenuItem
  quantity: number
  subtotal: number
}

interface OrderResultPayload {
  summary: OrderSummary
  qrCode: string
}

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
  MENU_ITEM_LIST.reduce(
    (acc, item) => {
      acc[item.key] = 0
      return acc
    },
    {} as Record<MenuItemKey, number>,
  )

export function OrderFlowProvider({ children }: { children: ReactNode }) {
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
      MENU_ITEM_LIST.map((item) => ({
        item,
        quantity: items[item.key],
        subtotal: items[item.key] * item.price,
      })).filter(({ quantity }) => quantity > 0),
    [items],
  )

  const total = useMemo(
    () => cartItems.reduce((sum, entry) => sum + entry.subtotal, 0),
    [cartItems],
  )

  const hasItems = cartItems.length > 0

  const buildOrderResultPayload = useCallback(async (summary: OrderSummary) => {
    const ticketUrl = buildTicketUrl(summary.ticket)
    const qrCode = await QRCode.toDataURL(ticketUrl, { width: 256, margin: 1 })
    return { summary, qrCode }
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
      const summary = await createOrder(items)
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
      const detail = await fetchOrderDetail(orderResult.summary.orderId)
      if (!detail) {
        return null
      }

      const nextSummary: OrderSummary = {
        orderId: detail.orderId,
        ticket: detail.ticket,
        total: detail.total,
        items: detail.items,
        payment: detail.payment,
        progress: detail.progress,
      }

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
        const detail = await fetchOrderByTicket(normalized)
        if (!detail) {
          setOrderResult(null)
          return null
        }

        const summary: OrderSummary = {
          orderId: detail.orderId,
          ticket: detail.ticket,
          total: detail.total,
          items: detail.items,
          payment: detail.payment,
          progress: detail.progress,
        }

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

