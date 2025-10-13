import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import {
  MENU_ITEMS,
  type MenuItemKey,
  type OrderLookupResult,
  type OrderSummary,
  type OrderDetail,
  type PaymentStatus,
  type ProgressStatus,
  type KitchenOrdersQuery,
} from '../../types/order'

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

function toDate(timestamp?: Timestamp) {
  return timestamp ? timestamp.toDate() : undefined
}

export async function createOrderFirebase(
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

  const batch = writeBatch(db)

  const orderRef = doc(db, 'orders', orderId)
  const lookupRef = doc(db, 'orderLookup', ticket)

  batch.set(orderRef, {
    orderId,
    createdBy: auth.currentUser?.uid ?? null,
    items,
    total,
    payment,
    progress,
    ticket,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  batch.set(lookupRef, {
    orderId,
    items,
    total,
    payment,
    progress,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()

  return {
    orderId,
    ticket,
    total,
    items,
    payment,
    progress,
  }
}

export async function fetchOrderByTicketFirebase(
  ticket: string,
): Promise<OrderLookupResult | null> {
  const trimmed = ticket.trim().toUpperCase()
  if (!trimmed) return null

  const lookupRef = doc(db, 'orderLookup', trimmed)
  const snapshot = await getDoc(lookupRef)
  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data()

  return {
    orderId: data.orderId,
    ticket: trimmed,
    total: data.total,
    items: data.items,
    payment: data.payment,
    progress: data.progress,
    updatedAt: toDate(data.updatedAt as Timestamp | undefined),
  }
}

export async function fetchOrderDetailFirebase(
  orderId: string,
): Promise<OrderDetail | null> {
  const orderRef = doc(db, 'orders', orderId)
  const snapshot = await getDoc(orderRef)
  if (!snapshot.exists()) {
    return null
  }
  const data = snapshot.data()
  return {
    orderId: data.orderId as string,
    ticket: data.ticket as string,
    items: data.items as Record<MenuItemKey, number>,
    total: data.total as number,
    payment: data.payment as PaymentStatus,
    progress: data.progress as ProgressStatus,
    createdAt: toDate(data.createdAt as Timestamp | undefined),
    updatedAt: toDate(data.updatedAt as Timestamp | undefined),
    createdBy: (data.createdBy as string | null | undefined) ?? null,
  }
}

export async function updateOrderStatusFirebase(
  orderId: string,
  ticket: string,
  updates: { payment: PaymentStatus; progress: ProgressStatus },
) {
  const batch = writeBatch(db)
  const orderRef = doc(db, 'orders', orderId)
  const lookupRef = doc(db, 'orderLookup', ticket)

  batch.update(orderRef, {
    payment: updates.payment,
    progress: updates.progress,
    updatedAt: serverTimestamp(),
  })

  batch.update(lookupRef, {
    payment: updates.payment,
    progress: updates.progress,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function searchOrderByTicketOrIdFirebase(
  value: string,
): Promise<OrderDetail | null> {
  const trimmed = value.trim().toUpperCase()
  if (!trimmed) return null

  const byTicket = await fetchOrderByTicketFirebase(trimmed)
  if (byTicket) {
    const detail = await fetchOrderDetailFirebase(byTicket.orderId)
    return (
      detail ?? {
        ...byTicket,
        createdAt: undefined,
        createdBy: null,
      }
    )
  }

  const ordersRef = collection(db, 'orders')
  const ordersQuery = query(ordersRef, where('orderId', '==', trimmed))
  const snapshot = await getDocs(ordersQuery)
  if (snapshot.empty) return null

  const docSnap = snapshot.docs[0]
  const data = docSnap.data()

  return {
    orderId: data.orderId as string,
    ticket: data.ticket as string,
    items: data.items as Record<MenuItemKey, number>,
    total: data.total as number,
    payment: data.payment as PaymentStatus,
    progress: data.progress as ProgressStatus,
    updatedAt: toDate(data.updatedAt as Timestamp | undefined),
    createdAt: toDate(data.createdAt as Timestamp | undefined),
    createdBy: (data.createdBy as string | null | undefined) ?? null,
  }
}

export async function fetchKitchenOrdersFirebase(
  options: KitchenOrdersQuery = {},
): Promise<OrderDetail[]> {
  const { start, end } = options
  const ordersRef = collection(db, 'orders')
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'asc')]

  if (start) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(start)))
  }

  if (end) {
    constraints.push(where('createdAt', '<', Timestamp.fromDate(end)))
  }

  const snapshot = await getDocs(query(ordersRef, ...constraints))

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      orderId: data.orderId as string,
      ticket: data.ticket as string,
      items: data.items as Record<MenuItemKey, number>,
      total: data.total as number,
      payment: data.payment as PaymentStatus,
      progress: data.progress as ProgressStatus,
      createdAt: toDate(data.createdAt as Timestamp | undefined),
      updatedAt: toDate(data.updatedAt as Timestamp | undefined),
      createdBy: (data.createdBy as string | null | undefined) ?? null,
    }
  })
}

function escapeCsv(value: string | number | null | undefined) {
  if (value === null || typeof value === 'undefined') return ''
  const stringified = String(value)
  if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
    return `"${stringified.replace(/"/g, '""')}"`
  }
  return stringified
}

export async function exportOrdersCsvFirebase() {
  const ordersRef = collection(db, 'orders')
  const snapshot = await getDocs(query(ordersRef, orderBy('createdAt', 'asc')))

  const headers = [
    'orderId',
    'ticket',
    'total',
    'payment',
    'progress',
    'items',
    'createdAt',
    'updatedAt',
  ]

  const rows = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    const items = data.items as Record<MenuItemKey, number>
    const itemSummary = Object.entries(items)
      .map(([key, quantity]) => `${MENU_ITEMS[key as MenuItemKey].label}:${quantity}`)
      .join(' | ')

    return [
      data.orderId,
      data.ticket,
      data.total,
      data.payment,
      data.progress,
      itemSummary,
      (data.createdAt as Timestamp | undefined)?.toDate()?.toISOString() ?? '',
      (data.updatedAt as Timestamp | undefined)?.toDate()?.toISOString() ?? '',
    ]
      .map(escapeCsv)
      .join(',')
  })

  const csvContent = [headers.join(','), ...rows].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
