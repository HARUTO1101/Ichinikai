import { getMenuSnapshot } from '../store/menuConfigStore'
import { type MenuItemKey, type OrderDetail, type ProgressStatus } from '../types/order'

type MenuTotals = Record<MenuItemKey, number>

export interface HourlySalesRow {
  slotStart: Date
  slotEnd: Date
  label: string
  totals: MenuTotals
  orderCount: number
  totalItems: number
}

export interface ActiveOrderSummary {
  orderCount: number
  totals: MenuTotals
  statusCounts: Record<ProgressStatus, number>
}

const HOUR_IN_MS = 60 * 60 * 1000

const createEmptyMenuTotals = (): MenuTotals => {
  const { list } = getMenuSnapshot()
  return list.reduce((acc, item) => {
    acc[item.key] = 0
    return acc
  }, {} as MenuTotals)
}

const formatHourLabel = (date: Date) => `${date.getHours().toString().padStart(2, '0')}:00`

const getReferenceDate = (order: OrderDetail) => order.createdAt ?? order.updatedAt

export function computeHourlyMenuSales(
  orders: OrderDetail[],
  start: Date,
  hours = 24,
): HourlySalesRow[] {
  const baseTime = start.getTime()
  const rows = Array.from({ length: hours }, (_, index) => {
    const slotStart = new Date(baseTime + index * HOUR_IN_MS)
    const slotEnd = new Date(slotStart.getTime() + HOUR_IN_MS)
    return {
      slotStart,
      slotEnd,
      label: `${formatHourLabel(slotStart)} - ${formatHourLabel(slotEnd)}`,
      totals: createEmptyMenuTotals(),
      orderCount: 0,
      totalItems: 0,
    }
  })

  orders.forEach((order) => {
    const reference = getReferenceDate(order)
    if (!reference) return
    const diff = reference.getTime() - baseTime
    if (diff < 0) return
    const hourIndex = Math.floor(diff / HOUR_IN_MS)
    if (hourIndex < 0 || hourIndex >= hours) return

    const row = rows[hourIndex]
    let hasItems = false

    Object.entries(order.items).forEach(([key, quantity]) => {
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) return
      const menuKey = key as MenuItemKey
      row.totals[menuKey] = (row.totals[menuKey] ?? 0) + qty
      row.totalItems += qty
      hasItems = true
    })

    if (hasItems) {
      row.orderCount += 1
    }
  })

  return rows
}

export function summarizeActiveOrders(orders: OrderDetail[]): ActiveOrderSummary {
  const totals = createEmptyMenuTotals()
  const statusCounts = {
    受注済み: 0,
    調理済み: 0,
    クローズ: 0,
  } as Record<ProgressStatus, number>

  let orderCount = 0

  orders.forEach((order) => {
    statusCounts[order.progress] = (statusCounts[order.progress] ?? 0) + 1

    if (order.progress === 'クローズ') return

    orderCount += 1

    Object.entries(order.items).forEach(([key, quantity]) => {
      const qty = Number(quantity)
      if (!Number.isFinite(qty) || qty <= 0) return
      const menuKey = key as MenuItemKey
      totals[menuKey] = (totals[menuKey] ?? 0) + qty
    })
  })

  return { orderCount, totals, statusCounts }
}
