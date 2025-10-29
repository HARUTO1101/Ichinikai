import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEnsureAnonymousAuth } from '../hooks/useEnsureAnonymousAuth'
import { useOrderFlow } from '../context/OrderFlowContext'
import { useMenuConfig } from '../hooks/useMenuConfig'
import { useLanguage } from '../context/LanguageContext'
import {
  ORDER_TEXT,
  getMenuItemLabel,
  getPaymentLabel,
  getProgressLabel,
  getProgressStepLabel,
  type ProgressStepKey,
} from '../i18n/order'
import { type MenuItemKey, type ProgressStatus } from '../types/order'
import { extractTicketFromInput } from '../utils/ticket'

const CUSTOMER_PROGRESS_STEPS: ReadonlyArray<{
  key: ProgressStepKey
  matches: ProgressStatus[]
}> = [
  { key: 'received', matches: ['受注済み'] },
  { key: 'ready', matches: ['調理済み'] },
  { key: 'completed', matches: ['クローズ'] },
]

type RefreshErrorKey = 'refreshFailed' | null
type TicketLoadErrorKey = 'loadFailed' | null
type TicketSearchErrorKey = 'required' | null

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
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language]
  const orderTexts = texts.orderComplete
  const authTexts = texts.auth
  const copyTexts = texts.copy
  const { orderResult, startNewOrder, refreshOrderResult, loadOrderByTicket } = useOrderFlow()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<RefreshErrorKey>(null)
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const refreshCooldownMs = 5000
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [ticketLoadError, setTicketLoadError] = useState<TicketLoadErrorKey>(null)
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketSearchError, setTicketSearchError] = useState<TicketSearchErrorKey>(null)

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
    ? orderTexts.readyInstructionWithCallNumber(readyBannerCallNumber)
    : orderTexts.readyInstructionWait

  // TODO: Remove preview toggle once ready banner design is approved

  const paymentState = useMemo(() => {
    if (!summary) {
      return { label: '', tone: 'unpaid' as const }
    }
    if (summary.progress === 'クローズ') {
      return { label: orderTexts.paymentState.complete, tone: 'complete' as const }
    }
    if (summary.payment === '支払い済み') {
      return { label: orderTexts.paymentState.paid, tone: 'paid' as const }
    }
    return { label: orderTexts.paymentState.unpaid, tone: 'unpaid' as const }
  }, [orderTexts, summary])

  const orderDateInfo = useMemo(() => {
    if (!summary?.createdAt) {
      return { display: '', iso: '' }
    }
    const createdAt = new Date(summary.createdAt)
    if (Number.isNaN(createdAt.getTime())) {
      return { display: '', iso: '' }
    }
    const formatter = new Intl.DateTimeFormat(language === 'ja' ? 'ja-JP' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
    return { display: formatter.format(createdAt), iso: createdAt.toISOString() }
  }, [language, summary?.createdAt])

  const displayProgress = useMemo(
    () => getProgressLabel(currentProgress, language),
    [currentProgress, language],
  )

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
        setTicketLoadError('loadFailed')
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
      setTicketSearchError('required')
      return
    }
    setTicketSearchError(null)
    setTicketSearch(normalized)
    navigate(`${ticketPathBase}/${normalized}`)
  }

  const ticketSearchForm = enableTicketSearch ? (
    <section className="content-card" aria-label={orderTexts.ticketSearch.regionLabel}>
      <h2 className="section-title">{orderTexts.ticketSearch.title}</h2>
      <p className="section-description">{orderTexts.ticketSearch.description}</p>
      <form className="form-grid" onSubmit={handleTicketSearchSubmit}>
        <div className="field">
          <label htmlFor="progress-ticket">{orderTexts.ticketSearch.label}</label>
          <input
            id="progress-ticket"
            type="text"
            inputMode="text"
            value={ticketSearch}
            onChange={(event) => setTicketSearch(event.target.value.toUpperCase())}
            placeholder={orderTexts.ticketSearch.placeholder}
            maxLength={24}
          />
        </div>
        <div className="button-row">
          <button type="submit" className="button primary">
            {orderTexts.ticketSearch.button}
          </button>
        </div>
      </form>
      {ticketSearchError && <p className="error-message">{orderTexts.ticketSearch.error}</p>}
    </section>
  ) : null

  if (!summary) {
    if (loadingTicket) {
      return (
        <div className="content-container">
          {ticketSearchForm}
          <section className="content-card order-complete-card" aria-live="polite">
            <h1 className="section-title">{orderTexts.loadingTitle}</h1>
            <p className="section-description">{orderTexts.loadingDescription}</p>
          </section>
        </div>
      )
    }

    if (ticketLoadError) {
      return (
        <div className="content-container">
          {ticketSearchForm}
          <section className="content-card order-complete-card" aria-live="polite">
            <h1 className="section-title">{orderTexts.loadErrorTitle}</h1>
            <p className="section-description">{orderTexts.loadErrorDescription}</p>
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate(fallbackPath)}
              >
                {orderTexts.loadErrorAction}
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
            <h1 className="section-title">{orderTexts.inviteTitle}</h1>
            <p className="section-description">{orderTexts.inviteDescription}</p>
          </section>
        </div>
      )
    }

    return null
  }

  const viewTitle = titleOverride ?? orderTexts.title
  const viewDescription =
    descriptionOverride ??
    (showProgressIdentifiers
      ? orderTexts.description.progressOnly
      : orderTexts.description.default)

  const handleRefreshStatus = async () => {
    if (refreshing || Date.now() < cooldownUntil || cooldownRemaining > 0) return
    setRefreshing(true)
    setRefreshError(null)

    try {
      const result = await refreshOrderResult()
      if (!result) {
        setRefreshError('refreshFailed')
      }
    } catch (err) {
      console.error(err)
      setRefreshError('refreshFailed')
    } finally {
      setRefreshing(false)
      setCooldownUntil(Date.now() + refreshCooldownMs)
    }
  }

  const handleCopyProgressLink = async () => {
    try {
      await navigator.clipboard.writeText(summary.ticket)
      alert(copyTexts.progressCodeSuccess)
    } catch (err) {
      console.error(err)
      alert(copyTexts.progressCodeFailure)
    }
  }

  const handleCopyCallNumber = async () => {
    try {
      await navigator.clipboard.writeText(progressUrl)
      alert(copyTexts.progressLinkSuccess)
    } catch (err) {
      console.error(err)
      alert(copyTexts.progressLinkFailure)
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

        {!ready && !authError && <p>{authTexts.signingIn}</p>}
        {authError && <p className="error-message">{authTexts.error}</p>}

        <div className="completion-order-info">
          <div className="completion-status-card">
            <div className="completion-call-number-block" aria-live="polite">
              <span className="completion-label">{orderTexts.callNumberLabel}</span>
              <span className="completion-call-number">
                {summary.callNumber > 0 ? summary.callNumber : orderTexts.callNumberPending}
              </span>
            </div>
            <div className="payment-state">
              <span className={`payment-state-badge ${paymentState.tone}`}>
                {paymentState.label}
              </span>
            </div>
            <div className="completion-status-header">
              <span className="completion-label">{orderTexts.statusHeading}</span>
              <button
                type="button"
                className="button secondary completion-refresh-button"
                onClick={handleRefreshStatus}
                disabled={refreshing || cooldownRemaining > 0}
              >
                {refreshing
                  ? orderTexts.refresh.refreshing
                  : cooldownRemaining > 0
                    ? orderTexts.refresh.cooldown(cooldownRemaining)
                    : orderTexts.refresh.action}
              </button>
            </div>
            {refreshError && (
              <p className="completion-refresh-error">{orderTexts.refresh.error}</p>
            )}
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
                  <div key={step.key} className={stepClass} role="listitem">
                    <div className="completion-progress-node" aria-hidden="true" />
                    <span className="completion-progress-label">
                      {getProgressStepLabel(step.key, language)}
                    </span>
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
                  <p className="completion-ready-title">{orderTexts.readyTitle}</p>
                  <p className="completion-ready-message">{readyBannerInstruction}</p>
                  {readyPreviewEnabled && !isReadyState && (
                    <span className="completion-ready-preview-tag">
                      {orderTexts.readyPreviewTag}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="completion-meta">
            <h2 className="completion-subheading">{orderTexts.metaHeading}</h2>
            <dl className="completion-meta-list">
              <div>
                <dt>{orderTexts.meta.total}</dt>
                <dd>¥{summary.total.toLocaleString()}</dd>
              </div>
              <div>
                <dt>{orderTexts.meta.payment}</dt>
                <dd>{getPaymentLabel(summary.payment, language)}</dd>
              </div>
              <div>
                <dt>{orderTexts.meta.progress}</dt>
                <dd>{displayProgress}</dd>
              </div>
              <div>
                <dt>{orderTexts.meta.orderedAt}</dt>
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
            <img src={qrCode} alt={orderTexts.qrAlt} />
            <span className="completion-qr-caption">{orderTexts.qrCaption}</span>
          </div>
        )}

        <div className="completion-identifiers">
          <div className="completion-order-id completion-identifier-card">
            <span className="completion-label">{orderTexts.identifiers.orderId}</span>
            <span className="completion-order-id-value">{summary.orderId}</span>
          </div>
          {showProgressIdentifiers && (
            <div className="completion-order-id completion-identifier-card">
              <span className="completion-label">{orderTexts.identifiers.ticket}</span>
              <span className="completion-order-id-value" style={{ wordBreak: 'break-all' }}>
                {summary.ticket}
              </span>
            </div>
          )}
        </div>

        <div className="completion-items">
          <h2 className="completion-subheading">{orderTexts.itemsHeading}</h2>
          <table className="completion-items-table">
            <thead>
              <tr>
                <th scope="col">{orderTexts.itemsTable.item}</th>
                <th scope="col">{orderTexts.itemsTable.quantity}</th>
                <th scope="col">{orderTexts.itemsTable.price}</th>
                <th scope="col">{orderTexts.itemsTable.subtotal}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary.items).map(([key, quantity]) => {
                const menu = menuItemMap[key as MenuItemKey]
                if (!menu) return null
                return (
                  <tr key={key}>
                    <td>{getMenuItemLabel(menu, language)}</td>
                    <td className="numeric">{quantity}</td>
                    <td className="numeric">¥{menu.price.toLocaleString()}</td>
                    <td className="numeric">¥{(menu.price * quantity).toLocaleString()}</td>
                  </tr>
                )
              })}
              <tr className="completion-items-total">
                <td colSpan={3}>{orderTexts.itemsTable.total}</td>
                <td className="numeric">¥{summary.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="button-row completion-actions">
          <button type="button" className="button primary" onClick={handleCopyCallNumber}>
            {orderTexts.actions.copyLink}
          </button>
          {showProgressIdentifiers && progressUrl && (
            <button type="button" className="button secondary" onClick={handleCopyProgressLink}>
              {orderTexts.actions.copyCode}
            </button>
          )}
          <button type="button" className="button secondary" onClick={handleCreateAnother}>
            {orderTexts.actions.startNew}
          </button>
        </div>
      </section>
    </div>
  )
}
