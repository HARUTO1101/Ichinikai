import { Link, useSearchParams } from 'react-router-dom'
import { extractTicketFromInput } from '../utils/ticket'

export function TicketNotFoundPage() {
  const [searchParams] = useSearchParams()
  const rawTicket = searchParams.get('ticket') ?? ''
  const normalizedTicket = extractTicketFromInput(rawTicket)

  return (
    <div className="content-container">
      <section className="content-card order-complete-card" aria-live="polite">
        <h1 className="section-title">注文が見つかりません</h1>
        <p className="section-description">
          {normalizedTicket
            ? `進捗確認コード「${normalizedTicket}」の注文は登録されていないようです。コードを再度ご確認のうえ、もう一度お試しください。`
            : '指定された進捗確認コードの注文は確認できませんでした。コードを再度ご確認のうえ、もう一度お試しください。'}
        </p>
        <div className="button-row">
          <Link className="button primary" to="/status">
            進捗確認コードを入力し直す
          </Link>
          <Link className="button secondary" to="/order">
            新しく注文する
          </Link>
        </div>
      </section>
    </div>
  )
}
