import { useCallback, useMemo, useState } from 'react'
import { exportOrdersCsv, updateOrderStatus } from '../../../services/orders'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'
import {
  mapOrderDetailToRow,
  nextProgressStatus,
  previousProgressStatus,
  progressStages,
  type OrderRow,
} from './adminOrdersData'
import { PAYMENT_STATUSES, type PaymentStatus, type ProgressStatus } from '../../../types/order'

type ProgressFilter = 'すべて' | ProgressStatus
type PaymentFilter = 'すべて' | PaymentStatus

export function AdminOrdersView() {
  const { orders: rawOrders, loading, error } = useOrdersSubscription()
  const rows = useMemo(() => rawOrders.map(mapOrderDetailToRow), [rawOrders])

  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('すべて')
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('すべて')
  const [keyword, setKeyword] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filteredOrders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    const progressWeights = new Map(progressStages.map((status, index) => [status, index]))

    return rows
      .filter((order) => (progressFilter === 'すべて' ? true : order.progress === progressFilter))
      .filter((order) => (paymentFilter === 'すべて' ? true : order.payment === paymentFilter))
      .filter((order) => {
        if (!normalized) return true
        const target = `${order.id} ${order.ticket} ${order.callNumber} ${order.items}`.toLowerCase()
        return target.includes(normalized)
      })
      .sort((a, b) => {
        const progressDiff =
          (progressWeights.get(a.progress) ?? 0) - (progressWeights.get(b.progress) ?? 0)
        if (progressDiff !== 0) return progressDiff
        const aTime = a.createdAtDate?.getTime() ?? 0
        const bTime = b.createdAtDate?.getTime() ?? 0
        return bTime - aTime
      })
  }, [keyword, paymentFilter, progressFilter, rows])

  const handleAdvance = useCallback(
    async (order: OrderRow) => {
      const next = nextProgressStatus(order.progress)
      if (!next) return
      setUpdatingId(order.id)
      setActionError(null)
      try {
        await updateOrderStatus(order.id, order.ticket, {
          payment: order.payment,
          progress: next,
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

  const handleRevert = useCallback(
    async (order: OrderRow) => {
      const previous = previousProgressStatus(order.progress)
      if (!previous) return
      setUpdatingId(order.id)
      setActionError(null)
      try {
        await updateOrderStatus(order.id, order.ticket, {
          payment: order.payment,
          progress: previous,
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
    <div>
      <div className="admin-toolbar" role="region" aria-label="フィルタ">
        <div className="field">
          <label htmlFor="order-progress">進捗</label>
          <select
            id="order-progress"
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}
          >
            <option value="すべて">すべて</option>
            {progressStages.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="order-payment">支払い</label>
          <select
            id="order-payment"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
          >
            <option value="すべて">すべて</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 240px' }}>
          <label htmlFor="order-search">検索</label>
          <input
            id="order-search"
            type="search"
            placeholder="呼出番号・確認コード・注文番号"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="admin-secondary-button"
          disabled={filteredOrders.length === 0}
          onClick={() => {
            const target = filteredOrders[0]
            if (target) {
              handleAdvance(target).catch(() => {})
            }
          }}
        >
          選択行を進捗更新
        </button>
        <button type="button" className="admin-primary-button" onClick={() => void handleExportCsv()} disabled={rows.length === 0}>
          CSV 出力
        </button>
      </div>

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

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">時刻</th>
              <th scope="col">注文番号</th>
              <th scope="col">呼出番号</th>
              <th scope="col">進捗確認コード</th>
              <th scope="col">品目</th>
              <th scope="col">合計</th>
              <th scope="col">支払い</th>
              <th scope="col">進捗</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.createdAt}</td>
                <td>{order.id}</td>
                <td>{order.callNumber}</td>
                <td>{order.ticket}</td>
                <td>{order.items}</td>
                <td>{order.total.toLocaleString()} 円</td>
                <td>
                  <span
                    className={
                      order.payment === '支払い済み'
                        ? 'admin-status-badge success'
                        : order.payment === '未払い'
                          ? 'admin-status-badge warning'
                          : 'admin-status-badge neutral'
                    }
                  >
                    {order.payment}
                  </span>
                </td>
                <td>
                  <span className="admin-status-badge">{order.progress}</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() => handleAdvance(order)}
                      disabled={updatingId === order.id || nextProgressStatus(order.progress) === null}
                    >
                      次のステータスへ
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() => handleRevert(order)}
                      disabled={updatingId === order.id || previousProgressStatus(order.progress) === null}
                    >
                      戻す
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredOrders.length === 0 && (
        <p style={{ marginTop: 18, color: '#64748b' }}>該当する注文はありません。</p>
      )}
      <p style={{ marginTop: 18, color: '#64748b' }}>
        Firestore の注文データをリアルタイムに表示しています。操作すると全スタッフに即時反映されます。
      </p>
    </div>
  )
}
