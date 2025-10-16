import { useMemo, useState } from 'react'
import { dummyOrders, type OrderRow } from './adminOrdersData'

type ProductionStageKey = 'ordered' | 'plating'

const productionColumns: Array<{
  key: ProductionStageKey
  label: string
  hint: string
  statuses: Array<OrderRow['progress']>
}> = [
  { key: 'ordered', label: '受注済み', hint: '受付済み・仕込み待ち', statuses: ['受注済み'] },
  { key: 'plating', label: '調理済み', hint: 'お渡し待ち／クローズ済み', statuses: ['調理済み', 'クローズ'] },
]

export function AdminProductionView() {
  const [orders, setOrders] = useState<OrderRow[]>(dummyOrders)

  const columns = useMemo(
    () =>
      productionColumns.map((column) => ({
        ...column,
        orders: orders
          .filter((order) => column.statuses.includes(order.progress))
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
      })),
    [orders],
  )

  const summary = useMemo(
    () => ({
      ordered: columns.find((column) => column.key === 'ordered')?.orders.length ?? 0,
      plating: columns.find((column) => column.key === 'plating')?.orders.length ?? 0,
    }),
    [columns],
  )

  const updateProgress = (id: string, direction: 'forward' | 'back') => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order

        if (direction === 'forward') {
          if (order.progress === '受注済み') return { ...order, progress: '調理済み' }
          if (order.progress === '調理済み') return { ...order, progress: 'クローズ' }
          return order
        }

        if (direction === 'back') {
          if (order.progress === '調理済み') return { ...order, progress: '受注済み' }
          if (order.progress === 'クローズ') return { ...order, progress: '調理済み' }
          return order
        }

        return order
      }),
    )
  }

  return (
    <div className="admin-production-page">
      <div className="admin-production-toolbar" role="region" aria-label="現在の注文サマリー">
        <div className="admin-production-summary">
          <p className="admin-production-summary-title">受注済み</p>
          <p className="admin-production-summary-count">{summary.ordered}件</p>
          <p className="admin-production-summary-hint">受付済み・仕込み待ち</p>
        </div>
        <div className="admin-production-summary">
          <p className="admin-production-summary-title">調理済み</p>
          <p className="admin-production-summary-count">{summary.plating}件</p>
          <p className="admin-production-summary-hint">お渡し待ち／クローズ済み</p>
        </div>
      </div>

      <div className="admin-production-table" role="table" aria-label="盛り付けライン一覧">
        <div className="admin-production-table-header" role="row">
          {columns.map((column) => (
            <div key={column.key} className="admin-production-table-header-cell" role="columnheader">
              <div>
                <h2>{column.label}</h2>
                <p>{column.hint}</p>
              </div>
              <span className="admin-production-badge">{column.orders.length}</span>
            </div>
          ))}
        </div>
        <div className="admin-production-table-body">
          {columns.map((column) => (
            <section key={column.key} className="admin-production-table-column" aria-label={column.label} role="rowgroup">
              <div className="admin-production-table-list">
                {column.orders.map((order) => (
                  <ProductionRow
                    key={order.id}
                    order={order}
                    onForward={() => updateProgress(order.id, 'forward')}
                    onBack={() => updateProgress(order.id, 'back')}
                    allowBack={column.key !== 'ordered'}
                    allowForward={!(order.progress === 'クローズ')}
                  />
                ))}
                {column.orders.length === 0 && (
                  <p className="admin-production-empty">該当する注文はありません。</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

interface ProductionRowProps {
  order: OrderRow
  onForward: () => void
  onBack: () => void
  allowForward: boolean
  allowBack: boolean
}

function ProductionRow({ order, onForward, onBack, allowForward, allowBack }: ProductionRowProps) {
  return (
    <article className="admin-production-row">
      <div className="admin-production-row-main">
        <p className="admin-production-ticket" aria-label={`呼出番号 ${order.callNumber}`}>
          <span className="admin-payment-ticket badge">{order.callNumber}</span>
        </p>
        <p className="admin-production-code">確認コード {order.ticket}</p>
        <p className="admin-production-items">{order.items}</p>
      </div>
      <div className="admin-production-row-meta">
        <span className="admin-production-time">{order.createdAt}</span>
        <span
          className={`admin-production-payment ${order.payment === '支払い済み' ? 'paid' : 'unpaid'}`}
        >
          {order.payment}
        </span>
        <span className={`admin-production-chip status-${order.progress}`}>{order.progress}</span>
        <span className="admin-production-total">¥{order.total.toLocaleString()}</span>
      </div>
      <div className="admin-production-row-actions">
        <button
          type="button"
          className="admin-production-button ghost"
          onClick={onBack}
          disabled={!allowBack}
        >
          戻す
        </button>
        <button
          type="button"
          className="admin-production-button primary"
          onClick={onForward}
          disabled={!allowForward}
        >
          進める
        </button>
      </div>
    </article>
  )
}
