import { clearOrderHistory } from '../services/orderHistory'
import { useOrderHistory } from '../hooks/useOrderHistory'
import { useLanguage } from '../context/LanguageContext'
import { ORDER_TEXT } from '../i18n/order'

export function StatusPage() {
  const orderHistory = useOrderHistory()
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language].status

  const handleClearHistory = () => {
    if (
      typeof window === 'undefined' ||
      window.confirm(texts.historyClearConfirm)
    ) {
      clearOrderHistory()
    }
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">{texts.title}</h1>
        <p className="section-description">{texts.descriptionLead}</p>
        <p className="section-description">{texts.descriptionFollow}</p>
      </section>

      {orderHistory.length > 0 && (
        <section className="content-card history-card" aria-live="polite">
          <div className="history-header">
            <h2 className="section-title">{texts.historyTitle}</h2>
            <button type="button" className="history-clear" onClick={handleClearHistory}>
              {texts.historyClear}
            </button>
          </div>
          <p className="history-description">{texts.historyDescription}</p>
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
                    {texts.historyCallNumberLabel}:{' '}
                    {entry.callNumber > 0 ? entry.callNumber : texts.historyPendingCallNumber}
                  </span>
                  <span>
                    {texts.historyOrderIdLabel}: {entry.orderId}
                  </span>
                </div>
                <div className="order-history-row meta">
                  <span>
                    {texts.historyTotalLabel}: ¥{entry.total.toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
