import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { useOrderFlow } from '../context/OrderFlowContext'
import { useLanguage } from '../context/LanguageContext'
import { ORDER_TEXT, getMenuItemLabel } from '../i18n/order'

export function OrderReviewPage() {
  const navigate = useNavigate()
  const { ready, error: authError } = useEnsureAnonymousAuth()
  const {
    cartItems,
    total,
    hasItems,
    loading,
    error,
    setError,
    confirmOrder,
  } = useOrderFlow()
  const [pendingTicket, setPendingTicket] = useState<string | null>(null)
  const [isWasteGuideOpen, setWasteGuideOpen] = useState(false)
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language]

  useEffect(() => {
    if (!hasItems) {
      navigate('/order', { replace: true })
    }
  }, [hasItems, navigate])

  useEffect(() => {
    setError(null)
  }, [setError])

  const handleConfirm = async () => {
    const result = await confirmOrder()
    if (result) {
      setPendingTicket(result.ticket)
      setWasteGuideOpen(true)
    }
  }

  const handleWasteGuideConfirm = () => {
    if (!pendingTicket) {
      setWasteGuideOpen(false)
      return
    }
    navigate(`/order/complete/${pendingTicket}`, { replace: true })
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">{texts.orderReview.title}</h1>
        <p className="section-description">
          {texts.orderReview.descriptionLead}
          <br />
          {texts.orderReview.descriptionFollow}
        </p>

        {!ready && !authError && <p>{texts.auth.signingIn}</p>}
        {authError && <p className="error-message">{texts.auth.error}</p>}

        <div className="receipt-card">
          <div className="receipt-header">
            <span>{texts.orderReview.tableHeaders.item}</span>
            <span>{texts.orderReview.tableHeaders.quantity}</span>
            <span>{texts.orderReview.tableHeaders.subtotal}</span>
          </div>
          <div className="receipt-divider" aria-hidden="true" />
          <div className="receipt-items">
            {cartItems.map(({ item, quantity, subtotal }) => (
              <div key={item.key} className="receipt-row">
                <div className="receipt-item-info">
                  <span className="receipt-item-name">{getMenuItemLabel(item, language)}</span>
                </div>
                <span className="receipt-item-qty">×{quantity}</span>
                <span className="receipt-item-subtotal">¥{subtotal.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="receipt-divider" aria-hidden="true" />
          <div className="receipt-total">
            <span>{texts.orderReview.totalLabel}</span>
            <span>¥{total.toLocaleString()}</span>
          </div>

            {isWasteGuideOpen && (
              <div className="waste-guide-modal-backdrop" role="presentation">
                <div
                  className="waste-guide-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="waste-guide-title"
                  aria-describedby="waste-guide-description"
                >
                  <h2 id="waste-guide-title">{texts.wasteGuide.title}</h2>
                  <p id="waste-guide-description">{texts.wasteGuide.description}</p>
                  <div className="waste-guide-visual" aria-hidden="true">
                    {texts.wasteGuide.placeholder}
                  </div>
                  <div className="waste-guide-actions">
                    <button type="button" className="button primary" onClick={handleWasteGuideConfirm}>
                      {texts.wasteGuide.confirm}
                    </button>
                  </div>
                </div>
              </div>
            )}
        </div>

        {error && <p style={{ color: '#dc2626', marginTop: 0 }}>{texts.errors[error]}</p>}

        <div className="button-row">
          <button
            type="button"
            className="button primary"
            onClick={handleConfirm}
            disabled={!ready || loading}
          >
            {loading ? texts.orderReview.confirming : texts.orderReview.confirmButton}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate('/order')}
            disabled={loading}
          >
            {texts.orderReview.changeButton}
          </button>
        </div>
      </section>
    </div>
  )
}
