import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { useOrderFlow } from '../context/OrderFlowContext'

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
      navigate(`/order/complete/${result.ticket}`, { replace: true })
    }
  }

  return (
    <div className="content-container">
      <section className="content-card">
        <h1 className="section-title">注文内容を確認</h1>
        <p className="section-description">
          数量と合計金額を確認し、問題なければ注文を確定してください。
          変更が必要な場合は戻って数量を調整できます。
        </p>

        {!ready && !authError && <p>匿名ログイン中です…</p>}
        {authError && (
          <p className="error-message">匿名認証に失敗しました。時間をおいてお試しください。</p>
        )}

        <div className="receipt-card">
          <div className="receipt-header">
            <span>商品</span>
            <span>数量</span>
            <span>小計</span>
          </div>
          <div className="receipt-divider" aria-hidden="true" />
          <div className="receipt-items">
            {cartItems.map(({ item, quantity, subtotal }) => (
              <div key={item.key} className="receipt-row">
                <span className="receipt-item-name">{item.label}</span>
                <span className="receipt-item-qty">×{quantity}</span>
                <span className="receipt-item-subtotal">¥{subtotal.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="receipt-divider" aria-hidden="true" />
          <div className="receipt-total">
            <span>合計</span>
            <span>¥{total.toLocaleString()}</span>
          </div>
        </div>

        {error && <p style={{ color: '#dc2626', marginTop: 0 }}>{error}</p>}

        <div className="button-row">
          <button
            type="button"
            className="button primary"
            onClick={handleConfirm}
            disabled={!ready || loading}
          >
            {loading ? '確定中…' : 'この内容で注文する'}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate('/order')}
            disabled={loading}
          >
            数量を変更する
          </button>
        </div>
      </section>
    </div>
  )
}
