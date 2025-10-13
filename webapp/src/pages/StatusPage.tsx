import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrScanner } from '../components/QrScanner'
import { clearOrderHistory, type OrderHistoryEntry } from '../services/orderHistory'
import { useOrderHistory } from '../hooks/useOrderHistory'
import { extractTicketFromInput } from '../utils/ticket'

export function StatusPage() {
  const navigate = useNavigate()
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const orderHistory = useOrderHistory()

  const redirectToTicket = (input: string) => {
    const normalized = extractTicketFromInput(input)
    setError(null)

    if (!normalized) {
      setError('チケット番号を入力してください。')
      return
    }

    setTicket(normalized)
    navigate(`/order/complete/${normalized}`)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    redirectToTicket(ticket)
  }

  const handleScannerResult = (value: string) => {
    const normalized = extractTicketFromInput(value)
    if (!normalized) {
      setError('有効なチケット番号を読み取れませんでした。')
      setScannerActive(false)
      return
    }
    setTicket(normalized)
    setScannerActive(false)
    navigate(`/order/complete/${normalized}`)
  }

  const handleHistorySelect = (entry: OrderHistoryEntry) => {
    setTicket(entry.ticket)
    setScannerActive(false)
    navigate(`/order/complete/${entry.ticket}`)
  }

  const handleClearHistory = () => {
    if (typeof window === 'undefined' || window.confirm('この端末に保存されている注文履歴をすべて削除しますか？')) {
      clearOrderHistory()
    }
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">注文の進捗を確認する</h1>
        <p className="section-description">
          チケット番号（16桁）を入力するか、QRコードを読み取って進捗を確認できます。
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="ticket">チケット番号</label>
            <input
              id="ticket"
              type="text"
              inputMode="text"
              value={ticket}
              onChange={(event) => setTicket(event.target.value.toUpperCase())}
              placeholder="例: AB12CD34EF56GH78"
              maxLength={20}
            />
          </div>

          <div className="button-row">
            <button type="submit" className="button primary">
              進捗を確認
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setScannerActive((prev) => !prev)}
            >
              {scannerActive ? 'カメラを閉じる' : 'QRコードを読み取る'}
            </button>
          </div>
        </form>

        {scannerActive && (
          <div className="content-card" style={{ marginTop: '1rem' }}>
            <QrScanner
              active={scannerActive}
              onResult={handleScannerResult}
              onError={(message) => setError(message)}
            />
            <p style={{ color: '#475569', marginTop: '0.75rem', fontSize: '0.9rem' }}>
              読み取りが完了したら自動的に停止します。明るい場所でご利用ください。
            </p>
          </div>
        )}

        {error && <p style={{ color: '#dc2626', marginTop: '1rem' }}>{error}</p>}
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
            直近にこの端末から確定した注文を表示しています。タップするとチケット番号を使って進捗を再検索できます。
          </p>
          <ul className="order-history-list">
            {orderHistory.map((entry) => (
              <li key={entry.orderId}>
                <button
                  type="button"
                  className="order-history-item"
                  onClick={() => handleHistorySelect(entry)}
                >
                  <div className="order-history-row">
                    <span className="order-history-ticket" aria-label="チケット番号">
                      {entry.ticket}
                    </span>
                    <span className="order-history-date">
                      {new Date(entry.savedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="order-history-row meta">
                    <span>注文番号: {entry.orderId}</span>
                    <span>合計: ¥{entry.total.toLocaleString()}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
