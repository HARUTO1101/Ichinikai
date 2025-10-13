import { useState } from 'react'

export function AdminReceptionView() {
  const [acceptingOrders, setAcceptingOrders] = useState(true)
  const [memo, setMemo] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date())

  const handleToggle = () => {
    setAcceptingOrders((prev) => {
      const next = !prev
      setLastUpdated(new Date())
      return next
    })
  }

  const handleSave = () => {
    setLastUpdated(new Date())
  }

  return (
    <div className="admin-grid" style={{ gap: '24px', maxWidth: 720 }}>
      <section className="admin-card">
        <h3>注文受付の制御</h3>
        <p>
          混雑状況や材料状況に応じて受付の可否を切り替えられます。トグル変更後は、訪問者側の注文画面に即時反映されます。
        </p>
        <div className="admin-toggle" role="switch" aria-checked={acceptingOrders}>
          <input type="checkbox" checked={acceptingOrders} onChange={handleToggle} />
          <span>{acceptingOrders ? '受け付け中' : '一時停止中'}</span>
        </div>
        <p style={{ color: '#64748b' }}>
          {acceptingOrders
            ? 'お客様は引き続き注文を行えます。'
            : '受付停止中：注文ページでは理由が表示され、新規注文は行えません。'}
        </p>
        <div className="admin-divider" />
        <div className="admin-list">
          <label htmlFor="reception-memo">停止理由メモ</label>
          <textarea
            id="reception-memo"
            rows={4}
            style={{
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              padding: '12px 16px',
              fontSize: '1rem',
              resize: 'vertical',
            }}
            placeholder="例: 材料補充のため 30 分ほど停止します。"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
          <button type="button" className="admin-primary-button" onClick={handleSave}>
            受付状態を保存
          </button>
          {lastUpdated && (
            <small style={{ color: '#64748b' }}>
              最終更新: {lastUpdated.toLocaleString('ja-JP')}
            </small>
          )}
        </div>
      </section>

      <section className="admin-card">
        <h3>通知設定</h3>
        <p>
          受付が停止された際に Slack / LINE WORKS へ自動投稿することができます。Webhook URL を設定すると連携が有効になります。
        </p>
        <div className="admin-list">
          <label htmlFor="reception-webhook">Webhook URL</label>
          <input
            id="reception-webhook"
            placeholder="https://hooks.slack.com/..."
            style={{
              borderRadius: 12,
              border: '1px solid #cbd5f5',
              padding: '10px 14px',
              fontSize: '1rem',
            }}
          />
          <button type="button" className="admin-secondary-button">
            テスト送信
          </button>
        </div>
      </section>
    </div>
  )
}
