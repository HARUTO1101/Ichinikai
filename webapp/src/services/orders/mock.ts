import {
  MENU_ITEMS,
  MENU_ITEM_LIST,
  type MenuItemKey,
  type OrderDetail,
  type OrderLookupResult,
  type OrderSummary,
  type PaymentStatus,
  type ProgressStatus,
  type KitchenOrdersQuery,
} from '../../types/order'

interface StoredOrder extends OrderDetail {
  createdAt?: Date
  updatedAt?: Date
}

interface MockState {
  orders: StoredOrder[]
  lastCallNumber: number
}

const STORAGE_KEY = 'mock-orders-state-v1'

const newOrderListeners = new Set<(order: OrderDetail) => void>()

function emitNewOrder(order: StoredOrder) {
  newOrderListeners.forEach((listener) => {
    try {
      listener({ ...order })
    } catch (error) {
      console.error('モック新規注文通知でエラーが発生しました', error)
    }
  })
}

function reviveState(raw: unknown): MockState {
  if (!raw || typeof raw !== 'object') return fallbackState
  const parsed = raw as {
    orders?: Array<Record<string, unknown>>
    lastCallNumber?: number
  }
  const orders = (parsed.orders ?? []).map((order) => {
    const createdAt = order.createdAt ? new Date(order.createdAt as string) : undefined
    const updatedAt = order.updatedAt ? new Date(order.updatedAt as string) : undefined
    return {
      ...order,
      createdAt,
      updatedAt,
    } as StoredOrder
  })
  if (orders.length === 0) {
    return fallbackState
  }
  const lastCallNumber = Number.isFinite(parsed.lastCallNumber)
    ? Number(parsed.lastCallNumber)
    : Math.max(0, ...orders.map((order) => order.callNumber ?? 0))
  return { orders, lastCallNumber }
}

function loadState(): MockState {
  if (typeof window === 'undefined') {
    return fallbackState
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallbackState
    return reviveState(JSON.parse(raw))
  } catch (error) {
    console.warn('モックデータの読み込みに失敗しました。初期データを使用します。', error)
    return fallbackState
  }
}

function persistState(state: MockState) {
  if (typeof window === 'undefined') return
  try {
    const serializable = {
      orders: state.orders.map((order) => ({
        ...order,
        createdAt: order.createdAt?.toISOString() ?? null,
        updatedAt: order.updatedAt?.toISOString() ?? null,
      })),
      lastCallNumber: state.lastCallNumber,
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch (error) {
    console.warn('モックデータの保存に失敗しました。', error)
  }
}

function sanitizeItems(rawItems: Partial<Record<MenuItemKey, number>>) {
  return Object.entries(rawItems).reduce((acc, [key, value]) => {
    const quantity = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
    if (quantity > 0) {
      acc[key as MenuItemKey] = quantity
    }
    return acc
  }, {} as Record<MenuItemKey, number>)
}

function calculateTotal(items: Record<MenuItemKey, number>) {
  return Object.entries(items).reduce((sum, [key, quantity]) => {
    const menu = MENU_ITEMS[key as MenuItemKey]
    return sum + menu.price * quantity
  }, 0)
}

function generateOrderId(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const hh = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  const random = Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('')

  return `ORD-${y}${m}${d}${hh}${mm}${ss}-${random}`
}

function generateTicket(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 16 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join('')
}

const fallbackOrderItems = sanitizeItems({ plain: 2, cocoa: 1 })

const fallbackState: MockState = {
  orders: [
    {
      orderId: 'ORD-20251009090000-DEMO',
      ticket: 'MOCKTICKET123456',
      callNumber: 1,
      items: fallbackOrderItems,
      total: calculateTotal(fallbackOrderItems),
      payment: '未払い',
      progress: '受注済み',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'mock-user',
    },
  ],
  lastCallNumber: 1,
}

let state = loadState()

function updateState(mutator: (draft: MockState) => void) {
  const draft: MockState = {
    orders: state.orders.map((order) => ({ ...order })),
    lastCallNumber: state.lastCallNumber,
  }
  mutator(draft)
  state = draft
  persistState(state)
}

function findOrderByTicket(ticket: string) {
  const trimmed = ticket.trim().toUpperCase()
  if (!trimmed) return null
  return state.orders.find((order) => order.ticket === trimmed) ?? null
}

export async function createOrderMock(
  rawItems: Record<MenuItemKey, number>,
): Promise<OrderSummary> {
  const items = sanitizeItems(rawItems)
  const hasItems = Object.values(items).some((quantity) => quantity > 0)

  if (!hasItems) {
    throw new Error('商品を1点以上ご注文ください。')
  }

  const now = new Date()
  const orderId = generateOrderId(now)
  const ticket = generateTicket()
  const total = calculateTotal(items)
  const payment: PaymentStatus = '未払い'
  const progress: ProgressStatus = '受注済み'
  const callNumber = state.lastCallNumber + 1

  const order: StoredOrder = {
    orderId,
    ticket,
    callNumber,
    items,
    total,
    payment,
    progress,
    createdAt: now,
    updatedAt: now,
    createdBy: 'mock-user',
  }

  updateState((draft) => {
    draft.orders.push(order)
    draft.lastCallNumber = callNumber
  })

  emitNewOrder(order)

  return {
    orderId,
    ticket,
    callNumber,
    total,
    items,
    payment,
    progress,
  }
}

export async function fetchOrderByTicketMock(
  ticket: string,
): Promise<OrderLookupResult | null> {
  const order = findOrderByTicket(ticket)
  if (!order) return null
  return {
    orderId: order.orderId,
    ticket: order.ticket,
    callNumber: order.callNumber,
    items: order.items,
    total: order.total,
    payment: order.payment,
    progress: order.progress,
    updatedAt: order.updatedAt,
  }
}

export async function fetchOrderDetailMock(orderId: string): Promise<OrderDetail | null> {
  const trimmed = orderId.trim().toUpperCase()
  if (!trimmed) return null
  const order = state.orders.find((item) => item.orderId === trimmed)
  if (!order) return null
  return { ...order }
}

export async function updateOrderStatusMock(
  orderId: string,
  ticket: string,
  updates: { payment: PaymentStatus; progress: ProgressStatus },
) {
  updateState((draft) => {
    draft.orders = draft.orders.map((order) => {
      if (order.orderId !== orderId && order.ticket !== ticket) return order
      return {
        ...order,
        payment: updates.payment,
        progress: updates.progress,
        updatedAt: new Date(),
      }
    })
  })
}

export async function searchOrderByTicketOrIdMock(
  value: string,
): Promise<OrderDetail | null> {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return null

  const byTicket = findOrderByTicket(trimmed)
  if (byTicket) return { ...byTicket }

  const byId = state.orders.find((order) => order.orderId === trimmed)
  return byId ? { ...byId } : null
}

export async function fetchKitchenOrdersMock(
  options: KitchenOrdersQuery = {},
): Promise<OrderDetail[]> {
  const { start, end } = options
  const startMs = start?.getTime()
  const endMs = end?.getTime()

  return state.orders
    .filter((order) => {
      const reference = order.createdAt ?? order.updatedAt
      if (!reference) {
        return !startMs && !endMs
      }
      const time = reference.getTime()
      if (typeof startMs === 'number' && time < startMs) return false
      if (typeof endMs === 'number' && time >= endMs) return false
      return true
    })
    .sort((a, b) => {
      const aTime = (a.createdAt ?? a.updatedAt ?? new Date(0)).getTime()
      const bTime = (b.createdAt ?? b.updatedAt ?? new Date(0)).getTime()
      return aTime - bTime
    })
    .map((order) => ({ ...order }))
}

export async function exportOrdersCsvMock() {
  const headers = [
    'orderId',
    'callNumber',
    'ticket',
    'total',
    'payment',
    'progress',
    'items',
    'createdAt',
    'updatedAt',
  ]

  const csvRows = state.orders.map((order) => {
    const itemSummary = Object.entries(order.items)
      .map(([key, quantity]) => `${MENU_ITEMS[key as MenuItemKey].label}:${quantity}`)
      .join(' | ')

    return [
      order.orderId,
      order.callNumber ?? '',
      order.ticket,
      order.total,
      order.payment,
      order.progress,
      itemSummary,
      order.createdAt?.toISOString() ?? '',
      order.updatedAt?.toISOString() ?? '',
    ]
      .map((value) => {
        const stringified = String(value)
        if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
          return `"${stringified.replace(/"/g, '""')}"`
        }
        return stringified
      })
      .join(',')
  })

  const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `orders-mock-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function resetMockData() {
  state = {
    orders: fallbackState.orders.map((order) => ({ ...order })),
    lastCallNumber: fallbackState.lastCallNumber,
  }
  persistState(state)
}

export function getMockOrders() {
  return state.orders.map((order) => ({ ...order }))
}

export function seedMockOrders(orders: StoredOrder[]) {
  updateState((draft) => {
    draft.orders = orders.map((order) => ({ ...order }))
    draft.lastCallNumber = Math.max(
      draft.lastCallNumber,
      ...draft.orders.map((order) => order.callNumber ?? 0),
    )
  })
}

export const mockMenu = MENU_ITEM_LIST

export function subscribeNewOrdersMock(onAdded: (order: OrderDetail) => void) {
  newOrderListeners.add(onAdded)
  return () => {
    newOrderListeners.delete(onAdded)
  }
}
