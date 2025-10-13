import { useMemo, useState } from 'react'
import { dummyOrders, progressStages, type OrderPayment, type OrderProgress } from './adminOrdersData'

export function AdminOrdersView() {
  const [progressFilter, setProgressFilter] = useState<'すべて' | OrderProgress>('すべて')
  const [paymentFilter, setPaymentFilter] = useState<'すべて' | OrderPayment>('すべて')
  const [keyword, setKeyword] = useState('')

  const filteredOrders = useMemo(() => {
    return dummyOrders
      .filter((order) =>
        progressFilter === 'すべて' ? true : order.progress === progressFilter,
      )
      .filter((order) => (paymentFilter === 'すべて' ? true : order.payment === paymentFilter))
      .filter((order) => {
        if (!keyword.trim()) return true
        const target = `${order.id} ${order.ticket} ${order.items}`.toLowerCase()
        return target.includes(keyword.trim().toLowerCase())
      })
      .sort(
        (a, b) => progressStages.indexOf(a.progress) - progressStages.indexOf(b.progress) || (a.createdAt < b.createdAt ? 1 : -1),
      )
  }, [keyword, paymentFilter, progressFilter])

  return (
    <div>
      <div className="admin-toolbar" role="region" aria-label="フィルタ">
        <div className="field">
          <label htmlFor="order-progress">進捗</label>
          <select
            id="order-progress"
            value={progressFilter}
            onChange={(event) => setProgressFilter(event.target.value as typeof progressFilter)}
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
            onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}
          >
            <option value="すべて">すべて</option>
            <option value="支払い済み">支払い済み</option>
            <option value="未払い">未払い</option>
          </select>
        </div>
        <div className="field" style={{ flex: '1 1 240px' }}>
          <label htmlFor="order-search">検索</label>
          <input
            id="order-search"
            type="search"
            placeholder="注文番号・チケット・品目"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <button type="button" className="admin-secondary-button">
          選択行を進捗更新
        </button>
        <button type="button" className="admin-primary-button">
          CSV 出力（50件）
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">時刻</th>
              <th scope="col">注文番号</th>
              <th scope="col">チケット</th>
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
                <td>{order.ticket}</td>
                <td>{order.items}</td>
                <td>{order.total.toLocaleString()} 円</td>
                <td>
                  <span
                    className={
                      order.payment === '支払い済み'
                        ? 'admin-status-badge success'
                        : 'admin-status-badge warning'
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
                    <button type="button" className="admin-secondary-button">
                      次のステータスへ
                    </button>
                    <button type="button" className="admin-secondary-button">
                      戻す
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 18, color: '#64748b' }}>
        デモ表示のため、データはローカルメモリ上でのみ更新されます。本番環境では Firestore の snapshot を利用して 2 秒以内に更新されます。
      </p>
    </div>
  )
}
