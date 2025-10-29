import { clearOrderHistory } from '../services/orderHistory'
import { useOrderHistory } from '../hooks/useOrderHistory'

export function StatusPage() {
  const orderHistory = useOrderHistory()

  const handleClearHistory = () => {
    if (typeof window === 'undefined' || window.confirm('この端末に保存されている注文履歴をすべて削除しますか？')) {
      clearOrderHistory()
    }
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">注文状況の確認について</h1>
        <p className="section-description">
          お客様には呼出番号のみをお伝えしています。スタッフからの案内があるまで、注文完了画面に表示された呼出番号をお控えください。
        </p>
        <p className="section-description">
          進捗の詳細確認や調整はスタッフが内部ツールで対応します。状況に変化があった場合は店頭でお知らせいたします。
        </p>
      </section>

      {orderHistory.length > 0 && (
        <section className="content-card history-card" aria-live="polite">
          <div className="history-header">
            <h2 className="section-title">この端末の注文履歴</h2>
            <button type="button" className="history-clear" onClick={handleClearHistory}>
              履歴をクリア
            </button>
          </div>
          <p className="history-description">
            直近にこの端末から確定した注文を表示しています。呼出番号と注文番号を控えておくと店頭での確認がスムーズです。
          </p>
          <ul className="order-history-list">
            {orderHistory.map((entry) => (
              <li key={entry.orderId} className="order-history-item" aria-live="polite">
                <div className="order-history-row">
                  <span className="order-history-date">
                    {new Date(entry.savedAt).toLocaleString()}
                  </span>
                </div>
                <div className="order-history-row meta">
                  <span>
                    呼出番号: {entry.callNumber > 0 ? entry.callNumber : '準備中 / 未設定'}
                  </span>
                  <span>注文番号: {entry.orderId}</span>
                </div>
                <div className="order-history-row meta">
                  <span>合計: ¥{entry.total.toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
