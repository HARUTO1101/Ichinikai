import { useMemo } from 'react'

const sampleOrders = [
  {
    id: '#1083',
    callNumber: 208,
    ticket: 'T-1248',
    total: 3200,
    status: '調理済み',
    payment: '未払い',
    createdAt: '10:24',
  },
  {
    id: '#1082',
    callNumber: 207,
    ticket: 'T-1247',
    total: 1800,
    status: '調理済み',
    payment: '支払い済み',
    createdAt: '10:20',
  },
  {
    id: '#1081',
    callNumber: 206,
    ticket: 'T-1246',
    total: 2400,
    status: '受注済み',
    payment: '未払い',
    createdAt: '10:18',
  },
]

const summaryDefinitions = [
  { label: '本日の注文', key: 'orders', unit: '件' },
  { label: '進行中', key: 'inProgress', unit: '件' },
  { label: '売上見込み', key: 'revenue', unit: '円' },
]

const mockMetrics = {
  orders: 128,
  inProgress: 12,
  revenue: 184_600,
}

const activities = [
  { id: 1, time: '10:25', message: '呼出番号 208 のステータスが「調理済み」に更新されました。' },
  { id: 2, time: '10:18', message: '受付状態が「受け付け中」に変更されました。' },
  { id: 3, time: '10:12', message: '新規注文の呼出番号 205 を発番しました。' },
  { id: 4, time: '09:58', message: '呼出番号 201 の支払いが完了しました。' },
]

const exportTips = [
  '最新 24 時間の注文を CSV 形式でダウンロードできます。',
  'Google スプレッドシートにインポートすると集計・共有が容易です。',
  'エクスポートにはデータ量に応じて最大 10 秒程度かかる場合があります。',
]

interface AdminDashboardViewProps {
  mode?: 'default' | 'export'
}

export function AdminDashboardView({ mode = 'default' }: AdminDashboardViewProps) {
  const summaryCards = useMemo(
    () =>
      summaryDefinitions.map((definition) => ({
        ...definition,
        value: mockMetrics[definition.key as keyof typeof mockMetrics],
      })),
    [],
  )

  if (mode === 'export') {
    return (
      <div className="admin-grid" style={{ gap: '28px' }}>
        <section className="admin-card">
          <h3>データエクスポート</h3>
          <p>
            注文データを CSV として出力します。期間や対象を選択してから「エクスポートを開始」ボタンを押してください。
          </p>
          <div className="admin-toolbar">
            <div className="field">
              <label htmlFor="export-range">対象期間</label>
              <select id="export-range" defaultValue="today">
                <option value="today">本日</option>
                <option value="yesterday">昨日</option>
                <option value="week">直近 7 日</option>
                <option value="custom">カスタム期間</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="export-status">進捗ステータス</label>
              <select id="export-status" defaultValue="all">
                <option value="all">すべて</option>
                <option value="open">調理済みまで</option>
                <option value="ready">調理済みのみ</option>
                <option value="closed">クローズ済み</option>
              </select>
            </div>
          </div>
          <button type="button" className="admin-primary-button" style={{ width: 'fit-content' }}>
            エクスポートを開始
          </button>
        </section>
        <section className="admin-card">
          <h3>エクスポートのヒント</h3>
          <ul className="admin-list">
            {exportTips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-grid" style={{ gap: '28px' }}>
      <div className="admin-grid columns-3">
        {summaryCards.map((card) => (
          <article key={card.label} className="admin-card">
            <p className="admin-content-overline" style={{ marginBottom: 6 }}>
              {card.label}
            </p>
            <h3>
              {card.value.toLocaleString()} {card.unit}
            </h3>
            <p>前日比 +8%</p>
          </article>
        ))}
      </div>

      <section className="admin-card">
        <header>
          <h3>最新の注文</h3>
          <p>リアルタイムで更新されます（デモデータ）。</p>
        </header>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">時刻</th>
              <th scope="col">注文番号</th>
              <th scope="col">呼出番号</th>
              <th scope="col">進捗確認コード</th>
              <th scope="col">合計</th>
              <th scope="col">支払い</th>
              <th scope="col">進捗</th>
            </tr>
          </thead>
          <tbody>
            {sampleOrders.map((order) => (
              <tr key={order.id}>
                <td>{order.createdAt}</td>
                <td>{order.id}</td>
                <td>{order.callNumber}</td>
                <td>{order.ticket}</td>
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
                  <span className="admin-status-badge">{order.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3>アクティビティ</h3>
        <ul className="admin-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <p style={{ margin: 0, color: '#1f2937' }}>{activity.message}</p>
              <small style={{ color: '#64748b' }}>{activity.time}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
