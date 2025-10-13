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
            ? `チケット番号「${normalizedTicket}」の注文は登録されていないようです。番号を再度ご確認のうえ、もう一度お試しください。`
            : '指定されたチケット番号の注文は確認できませんでした。番号を再度ご確認のうえ、もう一度お試しください。'}
        </p>
        <div className="button-row">
          <Link className="button primary" to="/status">
            チケット番号を入力し直す
          </Link>
          <Link className="button secondary" to="/order">
            新しく注文する
          </Link>
        </div>
      </section>
    </div>
  )
}
