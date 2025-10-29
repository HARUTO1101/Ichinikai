import { Link, useSearchParams } from 'react-router-dom'
import { extractTicketFromInput } from '../utils/ticket'
import { useLanguage } from '../context/LanguageContext'
import { ORDER_TEXT } from '../i18n/order'

export function TicketNotFoundPage() {
  const [searchParams] = useSearchParams()
  const rawTicket = searchParams.get('ticket') ?? ''
  const normalizedTicket = extractTicketFromInput(rawTicket)
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language].ticketNotFound

  return (
    <div className="content-container">
      <section className="content-card order-complete-card" aria-live="polite">
        <h1 className="section-title">{texts.title}</h1>
        <p className="section-description">
          {normalizedTicket ? texts.descriptionKnown(normalizedTicket) : texts.descriptionUnknown}
        </p>
        <div className="button-row">
          <Link className="button primary" to="/status">
            {texts.retry}
          </Link>
          <Link className="button secondary" to="/order">
            {texts.newOrder}
          </Link>
        </div>
      </section>
    </div>
  )
}
