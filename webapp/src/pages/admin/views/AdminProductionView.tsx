import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'
import { exportOrdersCsv, updateOrderPlating, updateOrderStatus } from '../../../services/orders'
import {
  mapOrderDetailToRow,
  nextProgressStatus,
  previousProgressStatus,
  type OrderRow,
} from './adminOrdersData'
import { type MenuItemKey, type PlatingCategoryKey, type PlatingProgress } from '../../../types/order'
import {
  PLATING_CATEGORY_LIST,
  getCategoryQuantity,
  isOrderPlatingComplete,
  type PlatingCategoryMeta,
} from '../../../utils/plating'
import { buildOrderItemEntries } from './adminOrderItems'

type ProductionStageKey = 'ordered' | 'plating'

const productionColumns: Array<{
  key: ProductionStageKey
  label: string
  hint: string
  statuses: Array<OrderRow['progress']>
}> = [
  { key: 'ordered', label: '受注済み', hint: '受付済み・仕込み待ち', statuses: ['受注済み'] },
  { key: 'plating', label: '調理済み', hint: 'お渡し待ち', statuses: ['調理済み'] },
]

type ViewMode = 'summary' | PlatingCategoryKey

const VIEW_TABS: ReadonlyArray<{ key: ViewMode; label: string; icon: string }> = [
  { key: 'summary', label: '全体', icon: '📋' },
  ...PLATING_CATEGORY_LIST.map((category) => ({
    key: category.key,
    label: category.label,
    icon: category.icon,
  })),
]

function isPlatingCategoryKey(value: string | null): value is PlatingCategoryKey {
  if (!value) return false
  return PLATING_CATEGORY_LIST.some((category) => category.key === value)
}

const createPlatingBusyKey = (orderId: string, categoryKey: PlatingCategoryKey) =>
  `${orderId}:${categoryKey}`

interface CategoryOrderGroup {
  pending: OrderRow[]
  ready: OrderRow[]
}

type CategoryOrderMap = Record<PlatingCategoryKey, CategoryOrderGroup>

export function AdminProductionView() {
  const { orders: rawOrders, loading, error } = useOrdersSubscription()
  const rows = useMemo(() => rawOrders.map(mapOrderDetailToRow), [rawOrders])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [platingUpdatingKey, setPlatingUpdatingKey] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const viewParam = searchParams.get('view')
  const activeView: ViewMode =
    viewParam === 'summary'
      ? 'summary'
      : isPlatingCategoryKey(viewParam)
      ? viewParam
      : 'summary'

  const activeCategory =
    activeView === 'summary'
      ? null
      : PLATING_CATEGORY_LIST.find((category) => category.key === activeView) ?? null

  const handleSelectView = useCallback(
    (view: ViewMode) => {
      setActionError(null)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        if (view === 'summary') {
          next.delete('view')
        } else {
          next.set('view', view)
        }
        return next
      })
    },
    [setActionError, setSearchParams],
  )

  const columns = useMemo(
    () =>
      productionColumns.map((column) => ({
        ...column,
        orders: rows
          .filter((order) => column.statuses.includes(order.progress))
          .sort((a, b) => {
            const aTime = a.createdAtDate?.getTime() ?? 0
            const bTime = b.createdAtDate?.getTime() ?? 0
            return aTime - bTime
          }),
      })),
    [rows],
  )

  const summary = useMemo(
    () => ({
      ordered: columns.find((column) => column.key === 'ordered')?.orders.length ?? 0,
      plating: columns.find((column) => column.key === 'plating')?.orders.length ?? 0,
    }),
    [columns],
  )

  const categoryOrderMap = useMemo<CategoryOrderMap>(() => {
    const template: CategoryOrderMap = {
      potaufeu: { pending: [], ready: [] },
      friedBread: { pending: [], ready: [] },
    }

    rows.forEach((order) => {
      if (order.progress === 'クローズ') {
        return
      }
      const items = order.raw.items ?? {}
      PLATING_CATEGORY_LIST.forEach((category) => {
        const quantity = getCategoryQuantity(items, category.key)
        if (quantity === 0) return
        const status = order.platingStatus[category.key] ?? 'ready'
        const bucket = status === 'ready' ? 'ready' : 'pending'
        template[category.key][bucket].push(order)
      })
    })

    const sortByCreatedAt = (a: OrderRow, b: OrderRow) =>
      (a.createdAtDate?.getTime() ?? 0) - (b.createdAtDate?.getTime() ?? 0)

    PLATING_CATEGORY_LIST.forEach((category) => {
      template[category.key].pending.sort(sortByCreatedAt)
      template[category.key].ready.sort(sortByCreatedAt)
    })

    return template
  }, [rows])

  const handleForward = useCallback(
    async (order: OrderRow) => {
      const next = nextProgressStatus(order.progress)
      if (!next) return

      setUpdatingId(order.id)
      setActionError(null)
      try {
        if (order.progress === '受注済み') {
          const platingUpdates = buildSummaryPlatingUpdates(order, true)
          if (Object.keys(platingUpdates).length > 0) {
            await updateOrderPlating(order.id, order.ticket, platingUpdates)
          }
        }

        await updateOrderStatus(order.id, order.ticket, {
          progress: next,
          payment: order.payment,
        })
      } catch (err) {
        console.error('ステータス更新に失敗しました', err)
        setActionError('ステータスの更新に失敗しました。通信環境をご確認ください。')
      } finally {
        setUpdatingId(null)
      }
    },
    [],
  )

  const handleBack = useCallback(
    async (order: OrderRow) => {
      const previous = previousProgressStatus(order.progress)
      if (!previous) return
      setUpdatingId(order.id)
      setActionError(null)
      try {
        if (order.progress === '調理済み' && previous === '受注済み') {
          const platingUpdates = buildSummaryPlatingUpdates(order, false)
          if (Object.keys(platingUpdates).length > 0) {
            await updateOrderPlating(order.id, order.ticket, platingUpdates)
          }
        }

        await updateOrderStatus(order.id, order.ticket, {
          progress: previous,
          payment: order.payment,
        })
      } catch (err) {
        console.error('ステータスを戻せませんでした', err)
        setActionError('ステータスを戻せませんでした。もう一度お試しください。')
      } finally {
        setUpdatingId(null)
      }
    },
    [],
  )

  const handleUpdatePlating = useCallback(
    async (order: OrderRow, categoryKey: PlatingCategoryKey, ready: boolean) => {
      const busyKey = createPlatingBusyKey(order.id, categoryKey)
      setPlatingUpdatingKey(busyKey)
      setActionError(null)
      try {
        await updateOrderPlating(order.id, order.ticket, { [categoryKey]: ready })

        const items = order.raw.items ?? {}
        const statusMap = {
          ...order.platingStatus,
          [categoryKey]: ready ? 'ready' : 'pending',
        }
        const allComplete = isOrderPlatingComplete(items, statusMap)

        if (allComplete && order.progress === '受注済み') {
          await updateOrderStatus(order.id, order.ticket, {
            progress: '調理済み',
            payment: order.payment,
          })
        } else if (!ready && order.progress === '調理済み') {
          await updateOrderStatus(order.id, order.ticket, {
            progress: '受注済み',
            payment: order.payment,
          })
        }
      } catch (err) {
        console.error('盛り付け状況の更新に失敗しました', err)
        setActionError('盛り付け状況の更新に失敗しました。通信環境をご確認ください。')
      } finally {
        setPlatingUpdatingKey(null)
      }
    },
    [setActionError],
  )

  const handleExportCsv = useCallback(async () => {
    setActionError(null)
    try {
      await exportOrdersCsv()
    } catch (err) {
      console.error('CSV 出力に失敗しました', err)
      setActionError('CSV の出力に失敗しました。通信環境をご確認ください。')
    }
  }, [])

  if (loading) {
    return <p>注文データを読み込み中です…</p>
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

      <nav
        className="admin-production-view-tabs"
        role="tablist"
        aria-label="盛り付けビュー選択"
      >
        {VIEW_TABS.map((tab) => {
          const isActive = tab.key === activeView
          const isCategoryTab = tab.key !== 'summary'
          const pendingCount = isCategoryTab
            ? categoryOrderMap[tab.key as PlatingCategoryKey].pending.length
            : 0

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              className={`admin-production-view-tab${isActive ? ' is-active' : ''}`}
              aria-selected={isActive}
              onClick={() => handleSelectView(tab.key)}
            >
              <span className="admin-production-view-tab-label">
                <span className="admin-production-view-tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="admin-production-view-tab-text">{tab.label}</span>
              </span>
              {isCategoryTab && pendingCount > 0 && (
                <span className="admin-production-view-tab-count">
                  <span className="admin-production-badge">{pendingCount}</span>
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {activeView === 'summary' ? (
        <div className="admin-production-table" role="table" aria-label="全体の盛り付け状況">
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
              <section
                key={column.key}
                className="admin-production-table-column"
                aria-label={column.label}
                role="rowgroup"
              >
                <div className="admin-production-table-list">
                  {column.orders.map((order) => {
                    const allowForward = Boolean(nextProgressStatus(order.progress))
                    const allowBack = Boolean(previousProgressStatus(order.progress))
                    return (
                      <ProductionRow
                        key={order.id}
                        order={order}
                        onForward={() => {
                          void handleForward(order)
                        }}
                        onBack={() => {
                          void handleBack(order)
                        }}
                        allowForward={allowForward}
                        allowBack={allowBack}
                        busy={updatingId === order.id}
                      />
                    )
                  })}
                  {column.orders.length === 0 && (
                    <p className="admin-production-empty">対象の注文はありません。</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        activeCategory && (
          <PlatingCategoryView
            category={activeCategory}
            orders={categoryOrderMap[activeCategory.key]}
            busyKey={platingUpdatingKey}
            onUpdate={(order: OrderRow, ready: boolean) =>
              handleUpdatePlating(order, activeCategory.key, ready)
            }
          />
        )
      )}

      {error && (
        <p className="admin-error" role="alert">
          データの取得に失敗しました。ページを再読み込みしてください。
        </p>
      )}
      {actionError && (
        <p className="admin-error" role="alert">
          {actionError}
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => void handleExportCsv()}
          disabled={rows.length === 0}
        >
          CSV 出力
        </button>
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
  busy: boolean
}

function ProductionRow({ order, onForward, onBack, allowForward, allowBack, busy }: ProductionRowProps) {
  const isPlatedStage = order.progress === '調理済み' || order.progress === 'クローズ'

  if (isPlatedStage) {
    return (
      <article className="admin-production-row admin-production-row--compact">
        <div className="admin-production-row-main">
          <div className="admin-production-row-compact">
            <span
              className="admin-payment-ticket badge admin-production-ticket-compact"
              aria-label={`呼出番号 ${order.callNumber}`}
            >
              {order.callNumber}
            </span>
            <div className="admin-production-row-actions admin-production-row-actions--compact">
              <button
                type="button"
                className="admin-production-button ghost"
                onClick={onBack}
                disabled={!allowBack || busy}
              >
                ← 戻す
              </button>
              <button
                type="button"
                className="admin-production-button primary"
                onClick={onForward}
                disabled={!allowForward || busy}
              >
                進める →
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  const itemEntries = buildOrderItemEntries(order)
  const totalQuantity = itemEntries.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <article className="admin-production-row">
      <div className="admin-production-row-main">
        <div className="admin-production-row-inline">
          <div className="admin-production-ticket-block" aria-label={`呼出番号 ${order.callNumber}`}>
            <span className="admin-payment-ticket badge">{order.callNumber}</span>
          </div>
          <div className="admin-production-items-card" role="presentation">
            <div className="admin-production-items-grid">
              {itemEntries.map((item) => (
                <div key={item.key} className="admin-production-item-cell">
                  <span className="admin-production-item-label">{item.label}</span>
                  <span className={`admin-production-quantity ${item.stateClass}`}>
                    {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-production-total-quantity" aria-label="合計数量">
            {totalQuantity}
          </div>
          <div className="admin-production-row-actions">
            <button
              type="button"
              className="admin-production-button ghost"
              onClick={onBack}
              disabled={!allowBack || busy}
            >
              ← 戻す
            </button>
            <button
              type="button"
              className="admin-production-button primary"
              onClick={onForward}
              disabled={!allowForward || busy}
            >
              進める →
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

interface PlatingCategoryViewProps {
  category: PlatingCategoryMeta
  orders: CategoryOrderGroup
  busyKey: string | null
  onUpdate: (order: OrderRow, ready: boolean) => Promise<void>
}

function PlatingCategoryView({ category, orders, busyKey, onUpdate }: PlatingCategoryViewProps) {
  const pendingLabel = `${category.label}の盛り付け待ち`
  const readyLabel = `${category.label}の盛り付け完了`

  return (
    <div className="admin-production-table" role="table" aria-label={`${category.label}の盛り付け状況`}>
      <div className="admin-production-table-header" role="row">
        <div className="admin-production-table-header-cell" role="columnheader">
          <div>
            <h2>{pendingLabel}</h2>
            <p>キッチンから受け取った順に表示されます。</p>
          </div>
          <span className="admin-production-badge">{orders.pending.length}</span>
        </div>
        <div className="admin-production-table-header-cell" role="columnheader">
          <div>
            <h2>{readyLabel}</h2>
            <p>盛り付け済みで引き渡し待ちの注文です。</p>
          </div>
          <span className="admin-production-badge">{orders.ready.length}</span>
        </div>
      </div>
      <div className="admin-production-table-body">
        <section
          className="admin-production-table-column"
          aria-label={pendingLabel}
          role="rowgroup"
        >
          <div className="admin-production-table-list">
            {orders.pending.map((order) => (
              <PlatingCategoryRow
                key={order.id}
                order={order}
                category={category}
                status="pending"
                busyKey={busyKey}
                onUpdate={(ready: boolean) => onUpdate(order, ready)}
              />
            ))}
            {orders.pending.length === 0 && (
              <p className="admin-production-empty">盛り付け待ちの注文はありません。</p>
            )}
          </div>
        </section>
        <section
          className="admin-production-table-column"
          aria-label={readyLabel}
          role="rowgroup"
        >
          <div className="admin-production-table-list">
            {orders.ready.map((order) => (
              <PlatingCategoryRow
                key={order.id}
                order={order}
                category={category}
                status="ready"
                busyKey={busyKey}
                onUpdate={(ready: boolean) => onUpdate(order, ready)}
              />
            ))}
            {orders.ready.length === 0 && (
              <p className="admin-production-empty">盛り付け済みの注文はありません。</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

interface PlatingCategoryRowProps {
  order: OrderRow
  category: PlatingCategoryMeta
  status: 'pending' | 'ready'
  busyKey: string | null
  onUpdate: (ready: boolean) => Promise<void>
}

function PlatingCategoryRow({ order, category, status, busyKey, onUpdate }: PlatingCategoryRowProps) {
  const busy = busyKey === createPlatingBusyKey(order.id, category.key)

  if (status === 'ready') {
    return (
      <article className="admin-production-row admin-production-row--compact">
        <div className="admin-production-row-main">
          <div className="admin-production-row-compact">
            <span
              className="admin-payment-ticket badge admin-production-ticket-compact"
              aria-label={`呼出番号 ${order.callNumber}`}
            >
              {order.callNumber}
            </span>
            <div className="admin-production-row-actions admin-production-row-actions--compact">
              <button
                type="button"
                className="admin-production-button ghost"
                onClick={() => {
                  void onUpdate(false)
                }}
                disabled={busy}
              >
                ← 未完了に戻す
              </button>
            </div>
          </div>
        </div>
      </article>
    )
  }

  const itemEntries = buildOrderItemEntries(order).filter((entry) =>
    category.itemKeys.includes(entry.key as MenuItemKey),
  )
  const totalQuantity = itemEntries.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <article className="admin-production-row">
      <div className="admin-production-row-main">
        <div className="admin-production-row-inline">
          <div className="admin-production-ticket-block" aria-label={`呼出番号 ${order.callNumber}`}>
            <span className="admin-payment-ticket badge">{order.callNumber}</span>
          </div>
          <div className="admin-production-items-card" role="presentation">
            <div className="admin-production-items-grid">
              {itemEntries.map((item) => (
                <div key={item.key} className="admin-production-item-cell">
                  <span className="admin-production-item-label">{item.label}</span>
                  <span className={`admin-production-quantity ${item.stateClass}`}>
                    {item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-production-total-quantity" aria-label="対象数量">
            {totalQuantity}
          </div>
          <div className="admin-production-row-actions">
            <button
              type="button"
              className="admin-production-button primary"
              onClick={() => {
                void onUpdate(true)
              }}
              disabled={busy}
            >
              盛り付け完了 →
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function buildSummaryPlatingUpdates(order: OrderRow, ready: boolean): Partial<PlatingProgress> {
  const items = order.raw.items ?? {}
  const updates: Partial<PlatingProgress> = {}
  PLATING_CATEGORY_LIST.forEach((category) => {
    const quantity = getCategoryQuantity(items, category.key)
    if (quantity > 0) {
      updates[category.key] = ready
    }
  })
  return updates
}

