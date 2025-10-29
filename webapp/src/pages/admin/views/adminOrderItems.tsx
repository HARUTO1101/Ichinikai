import { getMenuSnapshot } from '../../../store/menuConfigStore'
import { type MenuItemKey } from '../../../types/order'
import { getPlatingCategoryByMenuItem } from '../../../utils/plating'
import { type OrderRow } from './adminOrdersData'

const MENU_ITEM_SHORT_LABELS: Partial<Record<MenuItemKey, string>> = {
  potaufeu: 'ポトフ',
  plain: 'プレーン',
  cocoa: 'ココア',
  kinako: 'きなこ',
  garlic: 'ガーリック',
}

export type OrderItemEntry = {
  key: string
  label: string
  quantity: number
  stateClass: 'is-zero' | 'is-complete' | 'is-pending'
}

type ItemStatus = 'pending' | 'ready'

function getQuantityClassName(quantity: number, status: ItemStatus): OrderItemEntry['stateClass'] {
  if (quantity === 0) return 'is-zero'
  if (status === 'ready') return 'is-complete'
  return 'is-pending'
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildOrderItemEntries(order: OrderRow): OrderItemEntry[] {
  const items = order.raw.items ?? {}
  const { list: menuItems, map: menuMap } = getMenuSnapshot()
  return menuItems.map<OrderItemEntry>((menuItem) => {
    const quantity = items[menuItem.key] ?? 0
    const categoryKey = getPlatingCategoryByMenuItem(menuItem.key)
    const status: ItemStatus = categoryKey ? order.platingStatus[categoryKey] ?? 'ready' : 'ready'
    const stateClass = getQuantityClassName(quantity, status)
    return {
      key: menuItem.key,
      label: MENU_ITEM_SHORT_LABELS[menuItem.key] ?? menuMap[menuItem.key].label,
      quantity,
      stateClass,
    }
  })
}

interface OrderItemsInlineProps {
  entries: OrderItemEntry[]
  showTotal?: boolean
  totalAriaLabel?: string
  variant?: 'default' | 'compact'
  className?: string
}

export function OrderItemsInline({
  entries,
  showTotal = true,
  totalAriaLabel = '合計数量',
  variant = 'default',
  className,
}: OrderItemsInlineProps) {
  const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0)
  const wrapperClassName = [
    'admin-order-items-inline',
    variant === 'compact' ? 'compact' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClassName}>
      <div className="admin-production-items-card" role="presentation">
        <div className="admin-production-items-grid">
          {entries.map((entry) => (
            <div key={entry.key} className="admin-production-item-cell">
              <span className="admin-production-item-label">{entry.label}</span>
              <span className={`admin-production-quantity ${entry.stateClass}`}>
                {entry.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>
      {showTotal && (
        <div className="admin-production-total-quantity" aria-label={totalAriaLabel}>
          {totalQuantity}
        </div>
      )}
    </div>
  )
}
