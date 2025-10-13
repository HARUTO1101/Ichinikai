import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MENU_ITEM_LIST } from '../types/order'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { QuantityStepper } from '../components/QuantityStepper'
import { useOrderFlow } from '../context/OrderFlowContext'

export function OrderInputPage() {
  const navigate = useNavigate()
  const { ready, error: authError } = useEnsureAnonymousAuth()
  const {
    items,
    updateQuantity,
    resetItems,
    total,
    hasItems,
    clearOrderResult,
    setError,
  } = useOrderFlow()
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    clearOrderResult()
    setError(null)
  }, [clearOrderResult, setError])

  const handleProceed = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!ready) return

    if (!hasItems) {
      setFormError('商品を1点以上ご注文ください。')
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
        <h1 className="section-title">注文する</h1>
        <p className="section-description">
          各商品の数量はボタンで調整し、「注文内容を確認する」を押すとカート画面へ進みます。
          内容を確かめてから注文を確定しましょう。
        </p>

        {!ready && !authError && <p>匿名ログイン中です…</p>}
        {authError && (
          <p className="error-message">匿名認証に失敗しました。時間をおいてお試しください。</p>
        )}

        <form className="form-grid" onSubmit={handleProceed}>
          {MENU_ITEM_LIST.map((item) => (
            <article key={item.key} className="menu-card">
              <div className="menu-card-media">
                <img
                  src={item.image}
                  alt={`${item.label}のイメージ`}
                  loading="lazy"
                  decoding="async"
                  width={320}
                  height={220}
                />
              </div>
              <div className="menu-card-body">
                <header className="menu-card-header">
                  <h2 className="menu-card-title">{item.label}</h2>
                  <span className="menu-card-price">¥{item.price.toLocaleString()}</span>
                </header>
                <p className="menu-card-description">{item.description}</p>
                <div className="menu-card-footer">
                  <QuantityStepper
                    value={items[item.key]}
                    onChange={(next) => {
                      updateQuantity(item.key, next)
                      if (formError) setFormError(null)
                    }}
                    ariaLabel={`${item.label}の数量`}
                  />
                </div>
              </div>
            </article>
          ))}

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
                  <h2 style={{ margin: 0, fontSize: '1.4rem' }}>合計金額</h2>
                  <p style={{ margin: 0, color: '#475569' }}>税込・当日お支払いです。</p>
                </div>
                <strong style={{ fontSize: '1.8rem', color: 'var(--color-primary)' }}>
                  ¥{total.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>

          {formError && <p style={{ color: '#dc2626', margin: 0 }}>{formError}</p>}

          <div className="button-row">
            <button type="submit" className="button primary" disabled={!ready}>
              注文内容を確認する
            </button>
            <button type="button" className="button secondary" onClick={handleReset}>
              入力をリセット
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
