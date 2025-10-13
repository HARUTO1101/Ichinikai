import { useMemo, useState } from 'react'
import { getInitialOrders, type OrderRow } from './adminOrdersData'

export function AdminServingView() {
  const [orders, setOrders] = useState<OrderRow[]>(getInitialOrders())

  const readyList = useMemo(
    () =>
      orders
        .filter((order) => order.progress === '受取可')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [orders],
  )

  const deliveredList = useMemo(
    () =>
      orders
        .filter((order) => order.progress === 'クローズ')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [orders],
  )

  const upcomingList = useMemo(
    () =>
      orders
        .filter((order) => order.progress === '調理中')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [orders],
  )

  const summary = useMemo(
    () => ({
      ready: readyList.length,
      delivered: deliveredList.length,
      upcoming: upcomingList.length,
    }),
    [readyList.length, deliveredList.length, upcomingList.length],
  )

  const markAsDelivered = (id: string) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, progress: 'クローズ' } : order)))
  }

  const revertToReady = (id: string) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, progress: '受取可' } : order)))
  }

  return (
    <div className="admin-serving-page">
      <section className="admin-serving-summary" aria-label="提供状況サマリー">
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">呼び出し待ち</p>
          <p className="admin-serving-summary-value">{summary.ready}件</p>
        </div>
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">まもなく完成</p>
          <p className="admin-serving-summary-value">{summary.upcoming}件</p>
        </div>
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">受け渡し済み</p>
          <p className="admin-serving-summary-value">{summary.delivered}件</p>
        </div>
      </section>

      <div className="admin-serving-columns">
        <section className="admin-serving-section" aria-label="呼び出し待ち">
          <header className="admin-serving-section-header">
            <h2>呼び出し待ち</h2>
            <p>呼び出して番号札と照合してください。</p>
          </header>
          <div className="admin-serving-list">
            {readyList.map((order) => (
              <article key={order.id} className="admin-serving-card">
                <header>
                  <p className="admin-serving-ticket">
                    <span aria-hidden>🎫</span>
                    {order.ticket}
                  </p>
                  <span className="admin-serving-time">{order.createdAt}</span>
                </header>
                <p className="admin-serving-items">{order.items}</p>
                <footer>
                  <div className="admin-serving-meta">
                    <span className={`admin-serving-payment ${order.payment === '支払い済み' ? 'paid' : 'unpaid'}`}>
                      {order.payment}
                    </span>
                    <span className="admin-serving-total">¥{order.total.toLocaleString()}</span>
                  </div>
                  <div className="admin-serving-actions">
                    <button type="button" className="admin-serving-button primary" onClick={() => markAsDelivered(order.id)}>
                      受け渡し完了
                    </button>
                    <button type="button" className="admin-serving-button ghost" onClick={() => revertToReady(order.id)}>
                      再呼び出し
                    </button>
                  </div>
                  {order.customer && <p className="admin-serving-note">{order.customer} 様</p>}
                  {order.note && <p className="admin-serving-note subtle">メモ: {order.note}</p>}
                </footer>
              </article>
            ))}
            {readyList.length === 0 && (
              <p className="admin-serving-empty">呼び出し待ちの注文はありません。</p>
            )}
          </div>
        </section>

        <aside className="admin-serving-side">
          <section className="admin-serving-section" aria-label="まもなく完成">
            <header className="admin-serving-section-header">
              <h2>まもなく完成</h2>
              <p>調理中の注文を確認しましょう。</p>
            </header>
            <div className="admin-serving-list compact">
              {upcomingList.map((order) => (
                <article key={order.id} className="admin-serving-mini-card">
                  <p className="admin-serving-ticket">
                    <span aria-hidden>⏱️</span>
                    {order.ticket}
                  </p>
                  <p className="admin-serving-items">{order.items}</p>
                  <span className="admin-serving-time">{order.createdAt}</span>
                </article>
              ))}
              {upcomingList.length === 0 && (
                <p className="admin-serving-empty">調理中の注文はありません。</p>
              )}
            </div>
          </section>

          <section className="admin-serving-section" aria-label="受け渡し済み">
            <header className="admin-serving-section-header">
              <h2>受け渡し済み</h2>
              <p>最近の受け渡し履歴です。</p>
            </header>
            <div className="admin-serving-list compact">
              {deliveredList.map((order) => (
                <article key={order.id} className="admin-serving-mini-card">
                  <p className="admin-serving-ticket">
                    <span aria-hidden>✅</span>
                    {order.ticket}
                  </p>
                  <span className="admin-serving-time">{order.createdAt}</span>
                  <button
                    type="button"
                    className="admin-serving-button ghost"
                    onClick={() => revertToReady(order.id)}
                  >
                    戻す
                  </button>
                </article>
              ))}
              {deliveredList.length === 0 && (
                <p className="admin-serving-empty">受け渡し済みの記録はありません。</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
