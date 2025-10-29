import { useEffect, useState } from 'react'
import { subscribeOrders } from '../services/orders'
import type { SubscribeOrdersOptions } from '../services/orders'
import type { OrderDetail, OrdersSubscriptionOptions } from '../types/order'

interface OrdersSubscriptionState {
  orders: OrderDetail[]
  loading: boolean
  error: Error | null
}

export function useOrdersSubscription(options: OrdersSubscriptionOptions = {}): OrdersSubscriptionState {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const { autoStopWhen, ...queryOptions } = options

  const startMs = queryOptions.start?.getTime()
  const startKey = typeof startMs === 'number' && !Number.isNaN(startMs) ? startMs : null
  const endMs = queryOptions.end?.getTime()
  const endKey = typeof endMs === 'number' && !Number.isNaN(endMs) ? endMs : null
  const limitKey =
    typeof queryOptions.limit === 'number' && Number.isFinite(queryOptions.limit) && queryOptions.limit > 0
      ? Math.floor(queryOptions.limit)
      : null

  useEffect(() => {
    let active = true
    let stopped = false
    let unsubscribeRef: (() => void) | null = null

    const cleanup = () => {
      if (unsubscribeRef) {
        unsubscribeRef()
        unsubscribeRef = null
      }
    }

    setLoading(true)
    setError(null)

    const subscribeOptions: SubscribeOrdersOptions = {
      ...(startKey != null && queryOptions.start ? { start: queryOptions.start } : {}),
      ...(endKey != null && queryOptions.end ? { end: queryOptions.end } : {}),
      ...(limitKey != null ? { limit: limitKey } : {}),
      onError: (err) => {
        if (!active) return
        console.error('注文データの購読に失敗しました', err)
        setError(err instanceof Error ? err : new Error('注文データの購読に失敗しました'))
        setLoading(false)
      },
    }

    unsubscribeRef = subscribeOrders(
      (next) => {
        if (!active) return
        setOrders(next)
        setLoading(false)

        if (!stopped && autoStopWhen?.(next)) {
          stopped = true
          active = false
          cleanup()
        }
      },
      subscribeOptions,
    )

    return () => {
      active = false
      cleanup()
    }
  }, [autoStopWhen, endKey, limitKey, startKey])

  return { orders, loading, error }
}
