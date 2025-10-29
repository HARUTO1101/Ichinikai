import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type QueryConstraint,
} from 'firebase/firestore'
import { auth, db, ensureAnonymousUser } from '../../lib/firebase'
import {
  type MenuItemKey,
  type OrderLookupResult,
  type OrderSummary,
  type OrderDetail,
  type PaymentStatus,
  type ProgressStatus,
  type KitchenOrdersQuery,
  type OrdersQueryOptions,
  type PlatingProgress,
} from '../../types/order'
import { getMenuSnapshot } from '../../store/menuConfigStore'
import { createInitialPlatingProgress, ensurePlatingProgress } from '../../utils/plating'

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
  const { map: menuMap } = getMenuSnapshot()
  return Object.entries(items).reduce((sum, [key, quantity]) => {
    const menu = menuMap[key as MenuItemKey]
    const price = menu?.price ?? 0
    return sum + price * quantity
  }, 0)
}

function toDate(timestamp?: Timestamp) {
  return timestamp ? timestamp.toDate() : undefined
}

interface SubscribeBaseOptions {
  onError?: (error: unknown) => void
}

export interface SubscribeOrdersOptions extends SubscribeBaseOptions, OrdersQueryOptions {}

const NEW_ORDER_QUERY_LIMIT = 20

export async function createOrderFirebase(
  rawItems: Record<MenuItemKey, number>,
): Promise<OrderSummary> {
  await ensureAnonymousUser()
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
  const plating = createInitialPlatingProgress(items)
  const orderRef = doc(db, 'orders', orderId)
  const lookupRef = doc(db, 'orderLookup', ticket)
  const countersRef = doc(db, 'metadata', 'counters')

  const callNumber = await runTransaction(db, async (tx) => {
    const countersSnap = await tx.get(countersRef)
    const lastCallNumber = (countersSnap.data()?.lastCallNumber as number | undefined) ?? 0
    const nextCallNumber = lastCallNumber + 1

    tx.set(
      countersRef,
      {
        lastCallNumber: nextCallNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    const timestamp = serverTimestamp()
    tx.set(orderRef, {
      orderId,
      ticket,
      callNumber: nextCallNumber,
      createdBy: auth.currentUser?.uid ?? null,
      items,
      total,
      payment,
      progress,
      plating,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    tx.set(lookupRef, {
      orderId,
      ticket,
      callNumber: nextCallNumber,
      items,
      total,
      payment,
      progress,
      plating,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    return nextCallNumber
  })

  return {
    orderId,
    ticket,
    callNumber,
    total,
    items,
    payment,
    progress,
    plating,
    createdAt: now,
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
  const items = (data.items as Record<MenuItemKey, number>) ?? {}
  const plating = ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined)

  return {
    orderId: data.orderId,
    ticket: trimmed,
    callNumber: (data.callNumber as number | undefined) ?? 0,
    total: data.total,
    items,
    payment: data.payment,
    progress: data.progress,
    plating,
    updatedAt: toDate(data.updatedAt as Timestamp | undefined),
    createdAt: toDate(data.createdAt as Timestamp | undefined),
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
  const items = (data.items as Record<MenuItemKey, number>) ?? {}
  return {
    orderId: data.orderId as string,
    ticket: data.ticket as string,
    callNumber: (data.callNumber as number | undefined) ?? 0,
    items,
    total: data.total as number,
    payment: data.payment as PaymentStatus,
    progress: data.progress as ProgressStatus,
    plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
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

export async function updateOrderPlatingFirebase(
  orderId: string,
  ticket: string,
  updates: Partial<PlatingProgress>,
) {
  const entries = Object.entries(updates).filter(([, value]) => typeof value === 'boolean')
  if (entries.length === 0) return

  const batch = writeBatch(db)
  const orderRef = doc(db, 'orders', orderId)
  const lookupRef = doc(db, 'orderLookup', ticket)

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  entries.forEach(([key, value]) => {
    payload[`plating.${key}`] = value
  })

  batch.update(orderRef, payload)
  batch.update(lookupRef, payload)

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
  const items = (data.items as Record<MenuItemKey, number>) ?? {}

  return {
    orderId: data.orderId as string,
    ticket: data.ticket as string,
    callNumber: (data.callNumber as number | undefined) ?? 0,
    items,
    total: data.total as number,
    payment: data.payment as PaymentStatus,
    progress: data.progress as ProgressStatus,
    plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
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
    const items = (data.items as Record<MenuItemKey, number>) ?? {}
    return {
      orderId: data.orderId as string,
      ticket: data.ticket as string,
      callNumber: (data.callNumber as number | undefined) ?? 0,
      items,
      total: data.total as number,
      payment: data.payment as PaymentStatus,
      progress: data.progress as ProgressStatus,
      plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
      createdAt: toDate(data.createdAt as Timestamp | undefined),
      updatedAt: toDate(data.updatedAt as Timestamp | undefined),
      createdBy: (data.createdBy as string | null | undefined) ?? null,
    }
  })
}

export function subscribeNewOrdersFirebase(
  onAdded: (order: OrderDetail) => void,
  options: SubscribeBaseOptions = {},
): () => void {
  const ordersRef = collection(db, 'orders')
  const snapshotQuery = query(ordersRef, orderBy('createdAt', 'desc'), limit(NEW_ORDER_QUERY_LIMIT))
  const seenIds = new Set<string>()
  let initialized = false

  const unsubscribe = onSnapshot(
    snapshotQuery,
    (snapshot) => {
      if (!initialized) {
        snapshot.docs.forEach((docSnap) => seenIds.add(docSnap.id))
        initialized = true
        return
      }

      snapshot
        .docChanges()
        .filter((change) => change.type === 'added')
        .forEach((change) => {
          const docId = change.doc.id
          if (seenIds.has(docId)) return
          seenIds.add(docId)

          const data = change.doc.data()
          const items = (data.items as Record<MenuItemKey, number>) ?? {}

          onAdded({
            orderId: data.orderId as string,
            ticket: data.ticket as string,
            callNumber: (data.callNumber as number | undefined) ?? 0,
            items,
            total: data.total as number,
            payment: data.payment as PaymentStatus,
            progress: data.progress as ProgressStatus,
            plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
            createdAt: toDate(data.createdAt as Timestamp | undefined),
            updatedAt: toDate(data.updatedAt as Timestamp | undefined),
            createdBy: (data.createdBy as string | null | undefined) ?? null,
          })
        })
    },
    (error) => {
      console.error('Failed to subscribe new orders', error)
      options.onError?.(error)
    },
  )

  return unsubscribe
}

export function subscribeOrdersFirebase(
  onChange: (orders: OrderDetail[]) => void,
  options: SubscribeOrdersOptions = {},
): () => void {
  const ordersRef = collection(db, 'orders')
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]

  const startDate = options.start
  if (startDate && !Number.isNaN(startDate.getTime())) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(startDate)))
  }

  const endDate = options.end
  if (endDate && !Number.isNaN(endDate.getTime())) {
    constraints.push(where('createdAt', '<', Timestamp.fromDate(endDate)))
  }

  const limitValue = options.limit
  if (typeof limitValue === 'number' && Number.isFinite(limitValue) && limitValue > 0) {
    constraints.push(limit(Math.floor(limitValue)))
  }

  const snapshotQuery = query(ordersRef, ...constraints)

  const unsubscribe = onSnapshot(
    snapshotQuery,
    (snapshot) => {
      const orders = snapshot.docs.map((docSnap) => {
        const data = docSnap.data()
        const items = (data.items as Record<MenuItemKey, number>) ?? {}
        return {
          orderId: (data.orderId as string) ?? docSnap.id,
          ticket: data.ticket as string,
          callNumber: (data.callNumber as number | undefined) ?? 0,
          items,
          total: data.total as number,
          payment: data.payment as PaymentStatus,
          progress: data.progress as ProgressStatus,
          plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
          createdAt: toDate(data.createdAt as Timestamp | undefined),
          updatedAt: toDate(data.updatedAt as Timestamp | undefined),
          createdBy: (data.createdBy as string | null | undefined) ?? null,
        }
      })
      onChange(orders)
    },
    (error) => {
      console.error('Failed to subscribe orders collection', error)
      options.onError?.(error)
    },
  )

  return unsubscribe
}

export function subscribeOrderLookupFirebase(
  ticket: string,
  onChange: (order: OrderLookupResult | null) => void,
  options: SubscribeBaseOptions = {},
): () => void {
  const trimmed = ticket.trim().toUpperCase()
  if (!trimmed) {
    onChange(null)
    return () => {}
  }

  const lookupRef = doc(db, 'orderLookup', trimmed)

  const unsubscribe = onSnapshot(
    lookupRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null)
        return
      }

      const data = snapshot.data()
      const items = (data.items as Record<MenuItemKey, number>) ?? {}
      onChange({
        orderId: (data.orderId as string) ?? trimmed,
        ticket: trimmed,
        callNumber: (data.callNumber as number | undefined) ?? 0,
        total: data.total as number,
        items,
        payment: data.payment as PaymentStatus,
        progress: data.progress as ProgressStatus,
        plating: ensurePlatingProgress(items, data.plating as Partial<PlatingProgress> | undefined),
        updatedAt: toDate(data.updatedAt as Timestamp | undefined),
        createdAt: toDate(data.createdAt as Timestamp | undefined),
      })
    },
    (error) => {
      console.error('Failed to subscribe order lookup', error)
      options.onError?.(error)
    },
  )

  return unsubscribe
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
    'callNumber',
    'ticket',
    'total',
    'payment',
    'progress',
    'items',
    'createdAt',
    'updatedAt',
  ]

  const { map: menuMap } = getMenuSnapshot()
  const rows = snapshot.docs.map((docSnap) => {
    const data = docSnap.data()
    const items = data.items as Record<MenuItemKey, number>
    const itemSummary = Object.entries(items)
      .map(([key, quantity]) => {
        const menu = menuMap[key as MenuItemKey]
        const label = menu?.label ?? key
        return `${label}:${quantity}`
      })
      .join(' | ')

    return [
      data.orderId,
      data.callNumber ?? '',
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
