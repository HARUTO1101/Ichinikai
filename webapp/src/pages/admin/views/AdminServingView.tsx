import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { getInitialOrders, type OrderRow } from './adminOrdersData'

export function AdminServingView() {
  const [orders, setOrders] = useState<OrderRow[]>(getInitialOrders())
  const [searchQuery, setSearchQuery] = useState('')
  const [isScannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredOrders = useMemo(
    () =>
      normalizedQuery
        ? orders.filter((order) => {
            const haystacks = [
              order.callNumber.toString(),
              order.ticket,
              order.id,
              order.items,
              order.progress,
              order.payment,
            ]

            return haystacks
              .filter((value): value is string => typeof value === 'string')
              .some((value) => value.toLowerCase().includes(normalizedQuery))
          })
        : orders,
    [orders, normalizedQuery],
  )

  const readyList = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.progress === '調理済み')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [filteredOrders],
  )

  const deliveredList = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.progress === 'クローズ')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [filteredOrders],
  )

  const upcomingList = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.progress === '受注済み')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [filteredOrders],
  )

  const summary = useMemo(
    () => ({
      ready: readyList.length,
      delivered: deliveredList.length,
      upcoming: upcomingList.length,
    }),
    [readyList.length, deliveredList.length, upcomingList.length],
  )

  const markAsDelivered = (id: string) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, progress: 'クローズ' } : order)))
  }

  const revertToReady = (id: string) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, progress: '調理済み' } : order)))
  }

  useEffect(() => {
    if (!normalizedQuery) {
      setHighlightedId(null)
      return
    }

    const match = filteredOrders[0]
    setHighlightedId(match?.id ?? null)
  }, [filteredOrders, normalizedQuery])

  useEffect(() => {
    if (!highlightedId || typeof document === 'undefined') return

    const element = document.querySelector<HTMLElement>(`[data-order-id="${highlightedId}"]`)
    if (!element) return

    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightedId, readyList.length, deliveredList.length, upcomingList.length])

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value)
    setScannerError(null)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setHighlightedId(null)
    setScannerError(null)
  }

  const handleScanDetected = (value: string) => {
    const text = value.trim()
    if (!text) return

    const match = orders.find(
      (order) =>
        order.ticket.toLowerCase() === text.toLowerCase() ||
        order.id.toLowerCase() === text.toLowerCase() ||
        order.callNumber.toString() === text,
    )

    setSearchQuery(text)
    setHighlightedId(match?.id ?? null)
    setScannerError(
      match
        ? null
        : `読み取ったコード「${text}」に一致する注文が見つかりませんでした。`,
    )
    setScannerOpen(false)
  }

  return (
    <div className="admin-serving-page">
      <section className="admin-serving-controls" aria-label="注文検索">
        <div className="admin-serving-search">
          <label htmlFor="serving-search-input">検索</label>
          <div className="admin-serving-search-input">
            <input
              id="serving-search-input"
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="呼出番号・確認コード・メニューなどで検索"
              aria-describedby="serving-search-hint"
            />
            {searchQuery && (
              <button type="button" className="admin-serving-search-clear" onClick={handleClearSearch}>
                クリア
              </button>
            )}
          </div>
          <p id="serving-search-hint" className="admin-serving-search-hint">
            複数列にまたがる注文を横断的に絞り込めます。
          </p>
        </div>
        <div className="admin-serving-controls-actions">
          <button
            type="button"
            className="admin-serving-button ghost"
            onClick={() => {
              setScannerError(null)
              setScannerOpen(true)
            }}
          >
            QR読み取り
          </button>
          {scannerError && <p className="admin-serving-scanner-error">{scannerError}</p>}
        </div>
      </section>

      <section className="admin-serving-summary" aria-label="提供状況サマリー">
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">お渡し待ち</p>
          <p className="admin-serving-summary-value">{summary.ready}件</p>
        </div>
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">準備中</p>
          <p className="admin-serving-summary-value">{summary.upcoming}件</p>
        </div>
        <div className="admin-serving-summary-card">
          <p className="admin-serving-summary-title">受け渡し済み</p>
          <p className="admin-serving-summary-value">{summary.delivered}件</p>
        </div>
      </section>

      {searchQuery && filteredOrders.length === 0 && (
        <p className="admin-serving-search-empty" role="status">
          「{searchQuery}」に一致する注文は見つかりませんでした。
        </p>
      )}

      <div className="admin-serving-columns">
        <section className="admin-serving-section" aria-label="お渡し待ち">
          <header className="admin-serving-section-header">
            <h2>お渡し待ち</h2>
            <p>調理済みの注文です。呼び出して番号札と照合してください。</p>
          </header>
          <div className="admin-serving-list">
            {readyList.map((order) => (
              <article
                key={order.id}
                className={`admin-serving-card${order.id === highlightedId ? ' highlight' : ''}`}
                data-order-id={order.id}
              >
                <header>
                  <div>
                    <p
                      className="admin-serving-ticket"
                      aria-label={`呼出番号 ${order.callNumber}`}
                    >
                      <span className="admin-payment-ticket badge">{order.callNumber}</span>
                    </p>
                    <p className="admin-serving-code">確認コード {order.ticket}</p>
                  </div>
                  <span className="admin-serving-time">{order.createdAt}</span>
                </header>
                <p className="admin-serving-items">{order.items}</p>
                <footer>
                  <div className="admin-serving-meta">
                    <span className={`admin-serving-payment ${order.payment === '支払い済み' ? 'paid' : 'unpaid'}`}>
                      {order.payment}
                    </span>
                    <span className="admin-serving-total">¥{order.total.toLocaleString()}</span>
                  </div>
                  <div className="admin-serving-actions">
                    <button type="button" className="admin-serving-button primary" onClick={() => markAsDelivered(order.id)}>
                      受け渡し完了
                    </button>
                  </div>
                </footer>
              </article>
            ))}
            {readyList.length === 0 && (
              <p className="admin-serving-empty">お渡し待ちの注文はありません。</p>
            )}
          </div>
        </section>

        <aside className="admin-serving-side">
          <section className="admin-serving-section" aria-label="準備中">
            <header className="admin-serving-section-header">
              <h2>準備中</h2>
              <p>受注済みの注文です。進捗に合わせて盛り付けラインへ共有しましょう。</p>
            </header>
            <div className="admin-serving-list compact">
              {upcomingList.map((order) => (
                <article
                  key={order.id}
                  className={`admin-serving-mini-card${order.id === highlightedId ? ' highlight' : ''}`}
                  data-order-id={order.id}
                >
                  <div>
                    <p
                      className="admin-serving-ticket"
                      aria-label={`呼出番号 ${order.callNumber}`}
                    >
                      <span className="admin-payment-ticket badge small">{order.callNumber}</span>
                    </p>
                    <p className="admin-serving-code">確認コード {order.ticket}</p>
                  </div>
                  <p className="admin-serving-items">{order.items}</p>
                  <span className="admin-serving-time">{order.createdAt}</span>
                  <div className="admin-serving-mini-actions">
                    <button
                      type="button"
                      className="admin-serving-button primary small"
                      onClick={() => markAsDelivered(order.id)}
                    >
                      受け渡し完了
                    </button>
                  </div>
                </article>
              ))}
              {upcomingList.length === 0 && (
                <p className="admin-serving-empty">受注済みの注文はありません。</p>
              )}
            </div>
          </section>

          <section className="admin-serving-section" aria-label="受け渡し済み">
            <header className="admin-serving-section-header">
              <h2>受け渡し済み</h2>
              <p>最近の受け渡し履歴です。</p>
            </header>
            <div className="admin-serving-list compact">
              {deliveredList.map((order) => (
                <article
                  key={order.id}
                  className={`admin-serving-mini-card${order.id === highlightedId ? ' highlight' : ''}`}
                  data-order-id={order.id}
                >
                  <div>
                    <p
                      className="admin-serving-ticket"
                      aria-label={`呼出番号 ${order.callNumber}`}
                    >
                      <span className="admin-payment-ticket badge small">{order.callNumber}</span>
                    </p>
                    <p className="admin-serving-code">確認コード {order.ticket}</p>
                  </div>
                  <span className="admin-serving-time">{order.createdAt}</span>
                  <button
                    type="button"
                    className="admin-serving-button ghost"
                    onClick={() => revertToReady(order.id)}
                  >
                    戻す
                  </button>
                </article>
              ))}
              {deliveredList.length === 0 && (
                <p className="admin-serving-empty">受け渡し済みの記録はありません。</p>
              )}
            </div>
          </section>
        </aside>
      </div>

      {isScannerOpen && (
        <QrScannerDialog
          onDetected={handleScanDetected}
          onCancel={() => {
            setScannerOpen(false)
            setScannerError(null)
          }}
          onCameraError={(message) => setScannerError(message)}
        />
      )}
    </div>
  )
}

interface QrScannerDialogProps {
  onDetected: (value: string) => void
  onCancel: () => void
  onCameraError: (message: string) => void
}

function QrScannerDialog({ onDetected, onCancel, onCameraError }: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const hasDetectedRef = useRef(false)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let cleanupControls: IScannerControls | undefined

    hasDetectedRef.current = false

    const start = async () => {
      const videoElement = videoRef.current ?? undefined
      if (!videoElement) {
        const message = 'カメラビューの初期化に失敗しました。ページを再読み込みしてください。'
        setLocalError(message)
        onCameraError(message)
        return
      }

      try {
        cleanupControls = await reader.decodeFromVideoDevice(
          undefined,
          videoElement,
          (result, error, controls) => {
            if (result && !hasDetectedRef.current) {
              hasDetectedRef.current = true
              controls.stop()
              onDetected(result.getText())
            }

            if (error && !(error instanceof Error && error.name === 'NotFoundException')) {
              const message = error instanceof Error ? error.message : String(error)
              setLocalError(message)
            }
          },
        )
        setIsInitializing(false)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'カメラの初期化に失敗しました。設定を確認してください。'
        setLocalError(message)
        onCameraError(message)
      }
    }

    start()

    return () => {
      cleanupControls?.stop()
    }
  }, [onDetected, onCameraError])

  useEffect(() => {
    if (!localError) return
    onCameraError(localError)
  }, [localError, onCameraError])

  return (
    <div className="admin-serving-scanner-overlay" role="dialog" aria-modal="true" aria-label="QRコード読み取り">
      <div className="admin-serving-scanner-dialog">
        <header className="admin-serving-scanner-header">
          <h2>QRコード読み取り</h2>
          <button type="button" className="admin-serving-button ghost" onClick={onCancel}>
            閉じる
          </button>
        </header>
        <p className="admin-serving-scanner-hint">QRコードをカメラにかざして注文を特定します。</p>
        <div className="admin-serving-scanner-video-wrap">
          <video ref={videoRef} className="admin-serving-scanner-video" autoPlay muted playsInline />
          {isInitializing && <span className="admin-serving-scanner-status">カメラを初期化しています…</span>}
        </div>
        {localError && <p className="admin-serving-scanner-error">{localError}</p>}
      </div>
    </div>
  )
}
