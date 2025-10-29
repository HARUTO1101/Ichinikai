import { useEffect, useState } from 'react'
import { subscribeOrders } from '../services/orders'
import type { OrderDetail } from '../types/order'

interface OrdersSubscriptionState {
  orders: OrderDetail[]
  loading: boolean
  error: Error | null
}

export function useOrdersSubscription(): OrdersSubscriptionState {
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true

    const unsubscribe = subscribeOrders(
      (next) => {
        if (!active) return
        setOrders(next)
        setLoading(false)
      },
      {
        onError: (err) => {
          if (!active) return
          console.error('注文データの購読に失敗しました', err)
          setError(err instanceof Error ? err : new Error('注文データの購読に失敗しました'))
          setLoading(false)
        },
      },
    )

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  return { orders, loading, error }
}
