import { getMenuSnapshot } from '../../../store/menuConfigStore'
import {
  type MenuItemKey,
  type OrderDetail,
  type PaymentStatus,
  type ProgressStatus,
  type PlatingStatusMap,
} from '../../../types/order'
import { derivePlatingStatus } from '../../../utils/plating'

const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
})

export interface OrderRow {
  id: string
  callNumber: number
  ticket: string
  items: string
  total: number
  payment: PaymentStatus
  progress: ProgressStatus
  createdAt: string
  createdAtDate: Date | null
  updatedAtDate: Date | null
  confirmationCode: string
  raw: OrderDetail
  platingStatus: PlatingStatusMap
}

export const progressStages: ReadonlyArray<ProgressStatus> = ['受注済み', '調理済み', 'クローズ'] as const

function formatOrderItems(items: Record<MenuItemKey, number>): string {
  const { map: menuMap } = getMenuSnapshot()
  const parts = Object.entries(items)
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => {
      const menu = menuMap[key as MenuItemKey]
      const label = menu?.label ?? key
      return `${label}（${quantity}）`
    })
  return parts.join('／') || '—'
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return '--:--'
  return timeFormatter.format(date)
}

export function mapOrderDetailToRow(order: OrderDetail): OrderRow {
  const createdAtDate = order.createdAt ?? order.updatedAt ?? null
  const updatedAtDate = order.updatedAt ?? null

  return {
    id: order.orderId,
    callNumber: order.callNumber ?? 0,
    ticket: order.ticket,
    items: formatOrderItems(order.items ?? {}),
    total: order.total,
    payment: order.payment,
    progress: order.progress,
    createdAt: formatTime(createdAtDate),
    createdAtDate,
    updatedAtDate,
    confirmationCode: getOrderConfirmationCode(order.orderId),
    raw: order,
    platingStatus: derivePlatingStatus(order.items ?? {}, order.plating),
  }
}

export function getOrderConfirmationCode(orderId: string): string {
  if (!orderId) return '----'
  const lettersOnly = (orderId.match(/[A-Za-z]/g) ?? []).map((char) => char.toUpperCase())
  if (lettersOnly.length === 0) {
    return '----'
  }

  if (lettersOnly.length >= 4) {
    return lettersOnly.slice(-4).join('')
  }

  const repeated = lettersOnly.join('').repeat(Math.ceil(4 / lettersOnly.length))
  return repeated.slice(-4)
}

export function nextProgressStatus(current: ProgressStatus): ProgressStatus | null {
  if (current === '受注済み') return '調理済み'
  if (current === '調理済み') return 'クローズ'
  return null
}

export function previousProgressStatus(current: ProgressStatus): ProgressStatus | null {
  if (current === 'クローズ') return '調理済み'
  if (current === '調理済み') return '受注済み'
  return null
}
