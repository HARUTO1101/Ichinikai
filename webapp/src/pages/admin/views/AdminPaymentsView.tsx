import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { getInitialOrders, type OrderRow } from './adminOrdersData'

type ReaderControls = Awaited<ReturnType<BrowserQRCodeReader['decodeFromVideoDevice']>>

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

export function AdminPaymentsView() {
  const [orders, setOrders] = useState<OrderRow[]>(getInitialOrders())
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<ReaderControls | null>(null)

  const unpaidOrders = useMemo(
    () =>
      orders
        .filter((order) => order.payment === '未払い')
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [orders],
  )

  const filteredQueue = useMemo(() => {
    if (!keyword.trim()) return unpaidOrders
    const lower = keyword.trim().toLowerCase()
    return unpaidOrders.filter((order) =>
      `${order.ticket} ${order.id} ${order.items}`.toLowerCase().includes(lower),
    )
  }, [keyword, unpaidOrders])

  const selectedOrder = useMemo(
    () => filteredQueue.find((order) => order.id === selectedId) ?? filteredQueue[0] ?? null,
    [filteredQueue, selectedId],
  )

  useEffect(() => {
    if (!selectedOrder && filteredQueue.length > 0) {
      setSelectedId(filteredQueue[0].id)
    }
  }, [filteredQueue, selectedOrder])

  const recentSettled = useMemo(
    () =>
      orders
        .filter((order) => order.payment === '支払い済み')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 6),
    [orders],
  )

  const summary = useMemo(
    () => ({
      waiting: unpaidOrders.length,
      totalDue: unpaidOrders.reduce((sum, order) => sum + order.total, 0),
      settledToday: recentSettled.length,
    }),
    [unpaidOrders, recentSettled.length],
  )

  const selectOrder = useCallback(
    (order: OrderRow | null) => {
      if (!order) return false
      setSelectedId(order.id)
      setKeyword('')
      return true
    },
    [setKeyword, setSelectedId],
  )

  const markPaid = useCallback(
    (id: string) => {
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? { ...order, payment: '支払い済み' } : order)),
      )
      if (selectedId === id) {
        setScanMessage('決済ステータスを更新しました。')
      }
    },
    [selectedId, setOrders, setScanMessage],
  )

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current) {
      const stream = videoRef.current.srcObject
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
  }, [controlsRef, setIsScanning, videoRef])

  useEffect(() => () => stopScanner(), [stopScanner])

  const locateOrderFromCode = useCallback(
    (raw: string): OrderRow | null => {
    const trimmed = raw.trim()
    if (!trimmed) return null

    const normalized = trimmed.toLowerCase()

    const ticketMatch = normalized.match(/t[-_ ]?(\d{3,})/)
    const idMatch = normalized.match(/#(\d{3,})/)

    const ticketCandidate = ticketMatch ? `T-${ticketMatch[1]}` : null
    const idCandidate = idMatch ? `#${idMatch[1]}` : null

    if (ticketCandidate) {
      const match = orders.find(
        (order) => order.ticket.toLowerCase() === ticketCandidate.toLowerCase(),
      )
      if (match) return match
    }

    if (idCandidate) {
      const match = orders.find((order) => order.id.toLowerCase() === idCandidate.toLowerCase())
      if (match) return match
    }

    return (
      orders.find((order) => order.ticket.toLowerCase() === normalized) ??
      orders.find((order) => order.id.toLowerCase() === normalized) ??
      null
    )
  }, [orders])

  const handleSuccessfulRead = useCallback(
    (text: string) => {
    const order = locateOrderFromCode(text)
    if (order) {
      selectOrder(order)
      setScanMessage(`チケット ${order.ticket} を読み取りました。`)
      setScanError(null)
      setManualCode('')
      setScannerOpen(false)
    } else {
      setScanMessage(`QR内の「${text}」に対応する注文は見つかりませんでした。`)
      setScanError('別のコードを読み取るか手入力を試してください。')
      }
    },
    [
      locateOrderFromCode,
      selectOrder,
      setManualCode,
      setScanError,
      setScanMessage,
      setScannerOpen,
    ],
  )

  useEffect(() => {
    if (!scannerOpen) {
      stopScanner()
      return
    }

    let cancelled = false

    const start = async () => {
      if (!videoRef.current) return
      setIsScanning(true)
      setScanError(null)
      setScanMessage('カメラを準備しています…')

      try {
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 200,
        })

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, error, controlsInstance) => {
            if (cancelled) {
              controlsInstance.stop()
              return
            }
            if (result) {
              handleSuccessfulRead(result.getText())
              controlsInstance.stop()
            } else if (error && !(error instanceof NotFoundException)) {
              setScanError(error.message)
            }
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }

        controlsRef.current = controls
        setScanMessage('QRコードにカメラを向けてください。')
      } catch (error) {
        if (cancelled) return
        console.error(error)
        setScanError(error instanceof Error ? error.message : 'カメラを開始できませんでした。')
        setScannerOpen(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      stopScanner()
    }
  }, [handleSuccessfulRead, scannerOpen, stopScanner])

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!manualCode.trim()) return

    const order = locateOrderFromCode(manualCode)
    if (order) {
      selectOrder(order)
      setScanMessage(`チケット ${order.ticket} を手入力で選択しました。`)
      setScanError(null)
      setManualCode('')
      setScannerOpen(false)
    } else {
      setScanError(`「${manualCode}」に一致する注文が見つかりません。`)
    }
  }

  return (
    <div className="admin-payment-page">
      <section className="admin-payment-summary" aria-label="支払い状況サマリー">
        <div className="admin-payment-summary-card">
          <p className="admin-payment-summary-title">未決済</p>
          <p className="admin-payment-summary-value">{summary.waiting}件</p>
        </div>
        <div className="admin-payment-summary-card">
          <p className="admin-payment-summary-title">未回収金額</p>
          <p className="admin-payment-summary-value">{formatCurrency(summary.totalDue)}</p>
        </div>
        <div className="admin-payment-summary-card">
          <p className="admin-payment-summary-title">本日決済</p>
          <p className="admin-payment-summary-value">{summary.settledToday}件</p>
        </div>
      </section>

      <div className="admin-payment-layout">
        <section className="admin-payment-queue" aria-label="未払いの注文一覧">
          <header className="admin-payment-queue-header">
            <h2>支払い待ち</h2>
            <div className="field">
              <label htmlFor="payment-search">検索</label>
              <input
                id="payment-search"
                type="search"
                placeholder="チケット・注文番号"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
          </header>

          <div className="admin-payment-tools" aria-label="チケット呼び出し">
            <div className="admin-payment-tool-bar">
              <button
                type="button"
                className={`admin-payment-qr-button${scannerOpen ? ' active' : ''}`}
                onClick={() => setScannerOpen((prev) => !prev)}
              >
                {scannerOpen ? 'カメラを停止' : 'QRコードを読み取る'}
              </button>
              <p className="admin-payment-tool-hint">
                スマホでは左上のハンバーガーでメニューを閉じると画面が広く使えます。
              </p>
            </div>

            {scannerOpen && (
              <div className="admin-payment-scanner">
                <video
                  ref={videoRef}
                  className="admin-payment-video"
                  autoPlay
                  muted
                  playsInline
                />
                <div className="admin-payment-scanner-footer">
                  <span className="admin-payment-scan-status">
                    {isScanning ? scanMessage ?? '読み取り中…' : scanMessage ?? '停止しました。'}
                  </span>
                  <button
                    type="button"
                    className="admin-payment-stop"
                    onClick={() => setScannerOpen(false)}
                  >
                    停止する
                  </button>
                </div>
                {scanError && (
                  <p className="admin-payment-scan-error" role="alert">
                    {scanError}
                  </p>
                )}
              </div>
            )}

            {!scannerOpen && scanMessage && (
              <p className="admin-payment-scan-message">{scanMessage}</p>
            )}

            {!scannerOpen && scanError && (
              <p className="admin-payment-scan-error" role="alert">
                {scanError}
              </p>
            )}

            <form className="admin-payment-manual" onSubmit={handleManualSubmit}>
              <label htmlFor="manual-ticket">チケット番号を手入力</label>
              <div className="admin-payment-manual-controls">
                <input
                  id="manual-ticket"
                  type="text"
                  placeholder="例: T-1248 または #1083"
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value)}
                />
                <button type="submit" className="admin-payment-manual-submit">
                  呼び出す
                </button>
              </div>
            </form>
          </div>

          <div className="admin-payment-queue-list">
            {filteredQueue.map((order) => (
              <button
                key={order.id}
                type="button"
                className={`admin-payment-queue-item${selectedOrder?.id === order.id ? ' active' : ''}`}
                onClick={() => setSelectedId(order.id)}
              >
                <div>
                  <p className="admin-payment-ticket">
                    <span aria-hidden>🎟️</span>
                    {order.ticket}
                  </p>
                  <p className="admin-payment-items">{order.items}</p>
                </div>
                <div className="admin-payment-queue-meta">
                  <span className="admin-payment-total">{formatCurrency(order.total)}</span>
                  <time dateTime={order.createdAt} className="admin-payment-time">
                    {order.createdAt}
                  </time>
                </div>
              </button>
            ))}
            {filteredQueue.length === 0 && (
              <p className="admin-payment-empty">未払いの注文はありません。</p>
            )}
          </div>
        </section>

        <section className="admin-payment-detail" aria-live="polite">
          {selectedOrder ? (
            <div className="admin-payment-detail-card">
              <header>
                <p className="admin-payment-ticket large">
                  <span aria-hidden>🔔</span>
                  {selectedOrder.ticket}
                </p>
                <p className="admin-payment-order">注文番号 {selectedOrder.id}</p>
              </header>
              <p className="admin-payment-items">{selectedOrder.items}</p>
              <dl className="admin-payment-breakdown">
                <div>
                  <dt>合計</dt>
                  <dd>{formatCurrency(selectedOrder.total)}</dd>
                </div>
                <div>
                  <dt>支払いステータス</dt>
                  <dd>
                    <span className="admin-payment-chip warning">未払い</span>
                  </dd>
                </div>
                {selectedOrder.customer && (
                  <div>
                    <dt>お客様</dt>
                    <dd>{selectedOrder.customer} 様</dd>
                  </div>
                )}
                {selectedOrder.note && (
                  <div>
                    <dt>メモ</dt>
                    <dd>{selectedOrder.note}</dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                className="admin-payment-action"
                onClick={() => markPaid(selectedOrder.id)}
              >
                支払い済みにする
              </button>
              <p className="admin-payment-hint">
                レジで金額を確認し、決済完了後にボタンを押してください。
              </p>
            </div>
          ) : (
            <div className="admin-payment-detail-card empty">
              <p className="admin-payment-empty">未払いの注文を選択してください。</p>
            </div>
          )}

          <section className="admin-payment-recent" aria-label="最近決済した注文">
            <header>
              <h3>最近の決済</h3>
            </header>
            <ul>
              {recentSettled.map((order) => (
                <li key={order.id}>
                  <span>{order.ticket}</span>
                  <span>{formatCurrency(order.total)}</span>
                  <span className="admin-payment-time">{order.createdAt}</span>
                </li>
              ))}
              {recentSettled.length === 0 && (
                <li className="admin-payment-empty">決済済みの注文はまだありません。</li>
              )}
            </ul>
          </section>
        </section>
      </div>
    </div>
  )
}
