export const KITCHEN_TOAST_TEST_EVENT = 'app:kitchen-toast-test'

export interface KitchenToastTestDetail {
  orderId?: string
  callNumber?: number
  total?: number
  itemSummary?: string
  createdAt?: string
}

export type KitchenToastTestListener = (detail: KitchenToastTestDetail) => void

export function triggerKitchenToastTest(detail: KitchenToastTestDetail = {}) {
  if (typeof window === 'undefined') return
  const payload: KitchenToastTestDetail = {
    orderId: detail.orderId ?? 'TEST-ORDER',
    callNumber: detail.callNumber ?? Math.floor(Math.random() * 900 + 100),
    total: detail.total ?? 1500,
    itemSummary:
      detail.itemSummary ?? 'テスト注文: プレーンチュロス ×1 / ガーリックソルトポテト ×1',
    createdAt: detail.createdAt ?? new Date().toISOString(),
  }

  const event = new CustomEvent<KitchenToastTestDetail>(KITCHEN_TOAST_TEST_EVENT, {
    detail: payload,
  })
  window.dispatchEvent(event)
}

export function subscribeKitchenToastTest(listener: KitchenToastTestListener) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<KitchenToastTestDetail>
    listener(customEvent.detail)
  }

  window.addEventListener(KITCHEN_TOAST_TEST_EVENT, handler as EventListener)

  return () => {
    window.removeEventListener(KITCHEN_TOAST_TEST_EVENT, handler as EventListener)
  }
}
