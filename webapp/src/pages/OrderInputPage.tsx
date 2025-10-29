import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALLERGENS } from '../types/order'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { QuantityStepper } from '../components/QuantityStepper'
import { useOrderFlow } from '../context/OrderFlowContext'
import { useMenuConfig } from '../hooks/useMenuConfig'
import { useLanguage } from '../context/LanguageContext'
import {
  ORDER_TEXT,
  getAllergenLabel,
  getMenuItemDescription,
  getMenuItemLabel,
  type OrderErrorKey,
} from '../i18n/order'

export function OrderInputPage() {
  const navigate = useNavigate()
  const { ready, error: authError } = useEnsureAnonymousAuth()
  const { menuItems } = useMenuConfig()
  const {
    items,
    updateQuantity,
    resetItems,
    total,
    hasItems,
    clearOrderResult,
    setError,
  } = useOrderFlow()
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language]
  const [formError, setFormError] = useState<OrderErrorKey | null>(null)

  useEffect(() => {
    clearOrderResult()
    setError(null)
  }, [clearOrderResult, setError])

  const handleProceed = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!ready) return

    if (!hasItems) {
      setFormError('EMPTY_CART')
      return
    }

    navigate('/order/review')
  }

  const handleReset = () => {
    resetItems()
    setFormError(null)
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">{texts.orderInput.title}</h1>
        <p className="section-description">
          {texts.orderInput.descriptionLead}
          <br />
          {texts.orderInput.descriptionFollow}
        </p>

        {!ready && !authError && <p>{texts.auth.signingIn}</p>}
        {authError && <p className="error-message">{texts.auth.error}</p>}

        <form className="form-grid" onSubmit={handleProceed}>
          {menuItems.map((item) => {
            const displayLabel = getMenuItemLabel(item, language)
            const displayDescription = getMenuItemDescription(item, language)

            return (
              <article key={item.key} className="menu-card">
                <div className="menu-card-media">
                  <img
                    src={item.image}
                    alt={texts.menu.imageAlt(displayLabel)}
                    loading="lazy"
                    decoding="async"
                    width={320}
                    height={220}
                  />
                </div>
                <div className="menu-card-body">
                  <header className="menu-card-header">
                    <h2 className="menu-card-title">{displayLabel}</h2>
                    <span className="menu-card-price">¥{item.price.toLocaleString()}</span>
                  </header>
                  <p className="menu-card-description">{displayDescription}</p>
                  {item.allergens.length > 0 && (
                    <ul
                      className="menu-card-allergens"
                      aria-label={texts.menu.allergensLabel(displayLabel)}
                    >
                      {item.allergens.map((allergenKey) => {
                        const allergen = ALLERGENS[allergenKey]
                        const allergenLabel = getAllergenLabel(allergen.key, language)
                        return (
                          <li
                            key={allergen.key}
                            className="menu-card-allergen"
                            title={allergenLabel}
                            aria-label={allergenLabel}
                          >
                            <span className="menu-card-allergen-icon" aria-hidden="true">
                              <img
                                src={allergen.icon}
                                alt={allergenLabel}
                                loading="lazy"
                                decoding="async"
                                width={48}
                                height={48}
                              />
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <div className="menu-card-footer">
                    <QuantityStepper
                      value={items[item.key]}
                      onChange={(next) => {
                        updateQuantity(item.key, next)
                        if (formError) setFormError(null)
                      }}
                      ariaLabel={texts.menu.quantityLabel(displayLabel)}
                      decreaseLabel={texts.quantityStepper.decrease}
                      increaseLabel={texts.quantityStepper.increase}
                    />
                  </div>
                </div>
              </article>
            )
          })}

          <div className="summary-card" style={{ marginTop: '0.5rem' }}>
            <div className="content-card" style={{ boxShadow: 'none' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{texts.orderInput.totalLabel}</h2>
                  <p style={{ margin: 0, color: '#475569' }}>{texts.orderInput.totalNote}</p>
                </div>
                <strong style={{ fontSize: '1.8rem', color: 'var(--color-primary)' }}>
                  ¥{total.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {formError && (
            <p style={{ color: '#dc2626', margin: 0 }}>{texts.errors[formError]}</p>
          )}

          <div className="button-row">
            <button type="submit" className="button primary" disabled={!ready}>
              {texts.orderInput.reviewButton}
            </button>
            <button type="button" className="button secondary" onClick={handleReset}>
              {texts.orderInput.resetButton}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
