import { memo } from 'react'
import { useOrderToasts, type OrderToast } from '../context/OrderToastContext'
import './OrderToastViewport.css'

const DEFAULT_SOURCE_TITLES: Record<OrderToast['source'], string> = {
  'new-order': '新しい注文が入りました',
  test: 'テスト通知',
  custom: 'お知らせ',
}

const timeFormatOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
}

export interface OrderToastViewportProps {
  /** 配置に合わせた追加クラス。*/
  className?: string
  /** トーストごとの見出しテキストを上書きします。*/
  titleBySource?: Partial<Record<OrderToast['source'], string>>
  /** true の場合、トーストが存在しないときに何も描画しません。*/
  hideWhenEmpty?: boolean
  /** コンテナーの aria-label。*/
  ariaLabel?: string
  /** ビジュアルスタイルのバリエーション。*/
  variant?: 'dark' | 'light'
}

function formatCreatedAt(createdAt?: Date) {
  if (!createdAt) return ''
  return createdAt.toLocaleTimeString([], timeFormatOptions)
}

function normalizeDate(date?: Date | string) {
  if (!date) return undefined
  if (date instanceof Date) return date
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function getCallNumberLabel(callNumber: number | undefined) {
  if (callNumber && callNumber > 0) {
    return `呼出番号 ${callNumber}`
  }
  return '呼出番号は準備中です'
}

export const OrderToastViewport = memo(
  ({
    ariaLabel = '新規注文通知',
    className,
    hideWhenEmpty = true,
    titleBySource,
    variant = 'dark',
  }: OrderToastViewportProps) => {
    const { toasts, removeToast } = useOrderToasts()

    if (hideWhenEmpty && toasts.length === 0) {
      return null
    }

    const containerClassName = ['order-toast-container', className].filter(Boolean).join(' ')

    return (
      <div
        className={containerClassName}
        role="status"
        aria-live="polite"
        aria-label={ariaLabel}
      >
        {toasts.map((toast) => {
          const heading = titleBySource?.[toast.source] ?? DEFAULT_SOURCE_TITLES[toast.source]
          const createdAt = normalizeDate(toast.createdAt)
          const createdAtLabel = formatCreatedAt(createdAt)
          const callNumberLabel = getCallNumberLabel(toast.callNumber)
          const variantClass = variant === 'light' ? 'order-toast--light' : ''

          return (
            <div key={toast.id} className={`order-toast ${variantClass}`}>
              <button
                type="button"
                className="order-toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="通知を閉じる"
              >
                ×
              </button>
              <div className="order-toast-content">
                <p className="order-toast-title">{heading}</p>
                <p className="order-toast-meta">
                  {callNumberLabel} ・ 合計 ¥{toast.total.toLocaleString()}
                </p>
                <p className="order-toast-message">{toast.itemSummary}</p>
                {createdAtLabel && (
                  <p className="order-toast-meta">受注 {createdAtLabel}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  },
)

OrderToastViewport.displayName = 'OrderToastViewport'
