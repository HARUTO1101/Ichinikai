import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { useOrderFlow } from '../context/OrderFlowContext'
import { useMenuConfig } from '../hooks/useMenuConfig'
import { type MenuItemKey, type ProgressStatus } from '../types/order'
import { extractTicketFromInput } from '../utils/ticket'

const CUSTOMER_PROGRESS_STEPS: ReadonlyArray<{ label: string; matches: ProgressStatus[] }> = [
  { label: '受注済み', matches: ['受注済み'] },
  { label: '調理済み\n（お受け取りOK）', matches: ['調理済み'] },
  { label: '受け渡し済み', matches: ['クローズ'] },
]

interface OrderCompletePageProps {
  enableTicketSearch?: boolean
  ticketNavigationBase?: string
  fallbackPath?: string
  titleOverride?: string
  descriptionOverride?: string
}

export function OrderCompletePage(props: OrderCompletePageProps = {}) {
  const {
    enableTicketSearch = false,
    ticketNavigationBase = '/order/complete',
    fallbackPath = '/status',
    titleOverride,
    descriptionOverride,
  } = props
  const navigate = useNavigate()
  const { ticket: ticketParam } = useParams<{ ticket?: string }>()
  const [searchParams] = useSearchParams()
  const fallbackTicketParam = searchParams.get('ticket')
  const readyPreviewFlag = searchParams.get('previewReady')
  const normalizedTicket = useMemo(() => {
    if (ticketParam) return extractTicketFromInput(ticketParam)
    if (fallbackTicketParam) return extractTicketFromInput(fallbackTicketParam)
    return ''
  }, [fallbackTicketParam, ticketParam])

  const ticketPathBase = useMemo(() => {
    const base = ticketNavigationBase || '/order/complete'
    return base.endsWith('/') ? base.slice(0, -1) : base
  }, [ticketNavigationBase])

  const { ready, error: authError } = useEnsureAnonymousAuth()
  const { orderResult, startNewOrder, refreshOrderResult, loadOrderByTicket } = useOrderFlow()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const refreshCooldownMs = 5000
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [ticketLoadError, setTicketLoadError] = useState<string | null>(null)
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketSearchError, setTicketSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (!enableTicketSearch) return
    setTicketSearch(normalizedTicket)
    setTicketSearchError(null)
  }, [enableTicketSearch, normalizedTicket])

  const contextTicket = orderResult?.summary.ticket.toUpperCase()
  const resolvedOrderResult =
    orderResult && (!normalizedTicket || contextTicket === normalizedTicket)
      ? orderResult
      : null

  const summary = resolvedOrderResult?.summary
  const showProgressIdentifiers = enableTicketSearch
  const qrCode = resolvedOrderResult?.qrCode ?? ''
  const progressUrl = resolvedOrderResult?.progressUrl ?? ''
  const currentProgress: ProgressStatus = summary?.progress ?? '受注済み'
  const readyPreviewEnabled = useMemo(
    () => readyPreviewFlag === '1' || readyPreviewFlag === 'true',
    [readyPreviewFlag],
  )
  const isReadyState = currentProgress === '調理済み'
  const showReadyBanner = Boolean(summary && (isReadyState || readyPreviewEnabled))
  const { menuItemMap } = useMenuConfig()
  const readyBannerCallNumber = summary?.callNumber && summary.callNumber > 0 ? summary.callNumber : null
  const readyBannerInstruction = readyBannerCallNumber
    ? `呼出番号 ${readyBannerCallNumber} を確認のうえ、スタッフの案内にしたがってお受け取りください。`
    : 'スタッフから呼び出しがあるまでその場でお待ちください。'

  // TODO: Remove preview toggle once ready banner design is approved

  const paymentState = useMemo(() => {
    if (!summary) {
      return { label: '', tone: 'unpaid' as const }
    }
    if (summary.progress === 'クローズ') {
      return { label: '受取済み', tone: 'complete' as const }
    }
    if (summary.payment === '支払い済み') {
      return { label: 'お支払い済み', tone: 'paid' as const }
    }
    return { label: '未払い', tone: 'unpaid' as const }
  }, [summary])

  const orderDateInfo = useMemo(() => {
    if (!summary?.createdAt) {
      return { display: '', iso: '' }
    }
    const createdAt = new Date(summary.createdAt)
    if (Number.isNaN(createdAt.getTime())) {
      return { display: '', iso: '' }
    }
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return { display: formatter.format(createdAt), iso: createdAt.toISOString() }
  }, [summary?.createdAt])

  const displayProgress = useMemo(() => {
    if (currentProgress === '調理済み') {
      return '調理済み\n（お受け取りOK）'
    }
    if (currentProgress === 'クローズ') {
      return '受け渡し済み'
    }
    return '受注済み'
  }, [currentProgress])

  const progressIndex = useMemo(() => {
    const index = CUSTOMER_PROGRESS_STEPS.findIndex((step) => step.matches.includes(currentProgress))
    return index >= 0 ? index : 0
  }, [currentProgress])

  useEffect(() => {
    if (resolvedOrderResult) {
      setTicketLoadError(null)
    }
  }, [resolvedOrderResult])

  useEffect(() => {
    if (!normalizedTicket) {
      if (!orderResult && !enableTicketSearch) {
        navigate(fallbackPath, { replace: true })
      }
      return
    }

    if (orderResult && contextTicket === normalizedTicket) {
      return
    }

    let active = true
    setLoadingTicket(true)
    setTicketLoadError(null)

    loadOrderByTicket(normalizedTicket)
      .then((summary) => {
        if (!active) return
        if (!summary) {
          navigate(
            `/order/not-found?ticket=${encodeURIComponent(normalizedTicket)}`,
            { replace: true },
          )
        }
      })
      .catch((error) => {
        console.error(error)
        if (!active) return
        setTicketLoadError('注文情報を取得できませんでした。時間をおいて再度お試しください。')
      })
      .finally(() => {
        if (active) {
          setLoadingTicket(false)
        }
      })

    return () => {
      active = false
    }
  }, [
    contextTicket,
    enableTicketSearch,
    fallbackPath,
    loadOrderByTicket,
    navigate,
    normalizedTicket,
    orderResult,
  ])

  useEffect(() => {
    if (!resolvedOrderResult && !loadingTicket && !normalizedTicket && orderResult) {
      navigate(`${ticketPathBase}/${orderResult.summary.ticket}`, { replace: true })
    }
  }, [loadingTicket, navigate, normalizedTicket, orderResult, resolvedOrderResult, ticketPathBase])

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemaining(0)
      return
    }

    const updateRemaining = () => {
      const diff = cooldownUntil - Date.now()
      setCooldownRemaining(diff > 0 ? Math.ceil(diff / 1000) : 0)
    }

    updateRemaining()
    const id = window.setInterval(updateRemaining, 500)
    return () => window.clearInterval(id)
  }, [cooldownUntil])

  const handleTicketSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = extractTicketFromInput(ticketSearch)
    if (!normalized) {
      setTicketSearchError('チケット番号を入力してください。')
      return
    }
    setTicketSearchError(null)
    setTicketSearch(normalized)
    navigate(`${ticketPathBase}/${normalized}`)
  }

  const ticketSearchForm = enableTicketSearch ? (
    <section className="content-card" aria-label="進捗確認コード検索">
      <h2 className="section-title">進捗確認コードで表示</h2>
      <p className="section-description">
        お客様用の進捗確認コードを入力するとこの画面で進捗を確認できます。
      </p>
      <form className="form-grid" onSubmit={handleTicketSearchSubmit}>
        <div className="field">
          <label htmlFor="progress-ticket">進捗確認コード</label>
          <input
            id="progress-ticket"
            type="text"
            inputMode="text"
            value={ticketSearch}
            onChange={(event) => setTicketSearch(event.target.value.toUpperCase())}
            placeholder="例: AB12CD34EF56GH78"
            maxLength={24}
          />
        </div>
        <div className="button-row">
          <button type="submit" className="button primary">
            進捗を表示
          </button>
        </div>
      </form>
      {ticketSearchError && <p className="error-message">{ticketSearchError}</p>}
    </section>
  ) : null

  if (!summary) {
    if (loadingTicket) {
      return (
        <div className="content-container">
          {ticketSearchForm}
          <section className="content-card order-complete-card" aria-live="polite">
            <h1 className="section-title">注文情報を読み込んでいます…</h1>
            <p className="section-description">少々お待ちください。</p>
          </section>
        </div>
      )
    }

    if (ticketLoadError) {
      return (
        <div className="content-container">
          {ticketSearchForm}
          <section className="content-card order-complete-card" aria-live="polite">
            <h1 className="section-title">注文情報を取得できませんでした</h1>
            <p className="section-description">{ticketLoadError}</p>
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate(fallbackPath)}
              >
                チケット番号を再入力する
              </button>
            </div>
          </section>
        </div>
      )
    }

    if (enableTicketSearch) {
      return (
        <div className="content-container">
          {ticketSearchForm}
          <section className="content-card order-complete-card" aria-live="polite">
            <h1 className="section-title">進捗確認コードを入力してください</h1>
            <p className="section-description">
              進捗確認コードを入力するとすぐに進捗を確認できます。
            </p>
          </section>
        </div>
      )
    }

    return null
  }

  const viewTitle = titleOverride ?? '注文が完了しました！'
  const viewDescription =
    descriptionOverride ??
    (showProgressIdentifiers
      ? '受け取り時は呼出番号または下のQRコードを提示してください。受け取りまで保管をお願いします。'
      : '受け取り時は呼出番号と下のQRコードを提示してください。受け取りまで保管をお願いします。')

  const handleRefreshStatus = async () => {
    if (refreshing || Date.now() < cooldownUntil || cooldownRemaining > 0) return
    setRefreshing(true)
    setRefreshError(null)

    try {
      const result = await refreshOrderResult()
      if (!result) {
        setRefreshError('最新の注文情報を取得できませんでした。')
      }
    } catch (err) {
      console.error(err)
      setRefreshError('最新の注文情報を取得できませんでした。')
    } finally {
      setRefreshing(false)
      setCooldownUntil(Date.now() + refreshCooldownMs)
    }
  }

  const handleCopyProgressLink = async () => {
    try {
      await navigator.clipboard.writeText(summary.ticket)
      alert('進捗確認コードをコピーしました。')
    } catch (err) {
      console.error(err)
      alert('コピーに失敗しました。手動で控えてください。')
    }
  }

  const handleCopyCallNumber = async () => {
    try {
      await navigator.clipboard.writeText(progressUrl)
      alert('進捗確認用リンクをコピーしました。')
    } catch (err) {
      console.error(err)
      alert('コピーに失敗しました。手動で控えてください。')
    }
  }

  const handleCreateAnother = () => {
    startNewOrder()
    navigate('/order')
  }

  return (
    <div className="content-container">
      {ticketSearchForm}
      <section className="content-card order-complete-card" aria-live="polite">
        <h1 className="section-title">{viewTitle}</h1>
        <p className="section-description">{viewDescription}</p>

        {!ready && !authError && <p>匿名ログイン中です…</p>}
        {authError && (
          <p className="error-message">匿名認証に失敗しました。時間をおいてお試しください。</p>
        )}

        <div className="completion-order-info">
          <div className="completion-status-card">
            <div className="completion-call-number-block" aria-live="polite">
              <span className="completion-label">呼出番号</span>
              <span className="completion-call-number">
                {summary.callNumber > 0 ? summary.callNumber : '準備中'}
              </span>
            </div>
            <div className="payment-state">
              <span className={`payment-state-badge ${paymentState.tone}`}>
                {paymentState.label}
              </span>
            </div>
            <div className="completion-status-header">
              <span className="completion-label">現在の状況</span>
              <button
                type="button"
                className="button secondary completion-refresh-button"
                onClick={handleRefreshStatus}
                disabled={refreshing || cooldownRemaining > 0}
              >
                {refreshing
                  ? '更新中…'
                  : cooldownRemaining > 0
                    ? `再取得まで ${cooldownRemaining} 秒`
                    : '最新情報に更新'}
              </button>
            </div>
            {refreshError && <p className="completion-refresh-error">{refreshError}</p>}
            <div className="completion-progress" role="list">
              {CUSTOMER_PROGRESS_STEPS.map((step, index) => {
                const stepClass = [
                  'completion-progress-step',
                  index < progressIndex ? 'done' : '',
                  index === progressIndex ? 'current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div key={step.label} className={stepClass} role="listitem">
                    <div className="completion-progress-node" aria-hidden="true" />
                    <span className="completion-progress-label">{step.label}</span>
                  </div>
                )
              })}
            </div>
            {showReadyBanner && summary && (
              <div
                className={`completion-ready-notice${
                  readyPreviewEnabled && !isReadyState ? ' preview' : ''
                }`}
                role="status"
                aria-live="assertive"
              >
                <div className="completion-ready-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                    <path
                      d="M9.5 16.25 5.75 12.5l1.5-1.5 2.25 2.25 6-6 1.5 1.5-7.5 7.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="completion-ready-copy">
                  <p className="completion-ready-title">お渡しの準備が整いました</p>
                  <p className="completion-ready-message">{readyBannerInstruction}</p>
                  {readyPreviewEnabled && !isReadyState && (
                    <span className="completion-ready-preview-tag">テスト表示中（後で削除）</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="completion-meta">
            <h2 className="completion-subheading">注文情報</h2>
            <dl className="completion-meta-list">
              <div>
                <dt>合計金額</dt>
                <dd>¥{summary.total.toLocaleString()}</dd>
              </div>
              <div>
                <dt>お支払い</dt>
                <dd>{summary.payment}</dd>
              </div>
              <div>
                <dt>準備状況</dt>
                <dd>{displayProgress}</dd>
              </div>
              <div>
                <dt>注文日時</dt>
                <dd>
                  {orderDateInfo.display ? (
                    <time dateTime={orderDateInfo.iso}>{orderDateInfo.display}</time>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {qrCode && (
          <div className="completion-qr-block">
            <img src={qrCode} alt="進捗確認用QRコード" />
            <span className="completion-qr-caption">このQRコードを読み取ると進捗確認ページが開きます。レジまたは状況確認時に提示してください。</span>
          </div>
        )}

        <div className="completion-identifiers">
          <div className="completion-order-id completion-identifier-card">
            <span className="completion-label">注文番号</span>
            <span className="completion-order-id-value">{summary.orderId}</span>
          </div>
          {showProgressIdentifiers && (
            <div className="completion-order-id completion-identifier-card">
              <span className="completion-label">進捗確認コード</span>
              <span className="completion-order-id-value" style={{ wordBreak: 'break-all' }}>
                {summary.ticket}
              </span>
            </div>
          )}
        </div>

        <div className="completion-items">
          <h2 className="completion-subheading">注文内容</h2>
          <table className="completion-items-table">
            <thead>
              <tr>
                <th scope="col">商品</th>
                <th scope="col">数量</th>
                <th scope="col">単価</th>
                <th scope="col">小計</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.items).map(([key, quantity]) => {
                const menu = menuItemMap[key as MenuItemKey]
                if (!menu) return null
                return (
                  <tr key={key}>
                    <td>{menu.label}</td>
                    <td className="numeric">{quantity}</td>
                    <td className="numeric">¥{menu.price.toLocaleString()}</td>
                    <td className="numeric">¥{(menu.price * quantity).toLocaleString()}</td>
                  </tr>
                )
              })}
              <tr className="completion-items-total">
                <td colSpan={3}>合計</td>
                <td className="numeric">¥{summary.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="button-row completion-actions">
          <button type="button" className="button primary" onClick={handleCopyCallNumber}>
            進捗確認リンクをコピー
          </button>
          {showProgressIdentifiers && progressUrl && (
            <button type="button" className="button secondary" onClick={handleCopyProgressLink}>
              進捗確認コードをコピー
            </button>
          )}
          <button type="button" className="button secondary" onClick={handleCreateAnother}>
            新しく注文する
          </button>
        </div>
      </section>
    </div>
  )
}
