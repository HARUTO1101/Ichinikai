import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { getInitialOrders, type OrderPayment, type OrderRow } from './adminOrdersData'

type ReaderControls = Awaited<ReturnType<BrowserQRCodeReader['decodeFromVideoDevice']>>

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

const paymentStatusHistoryText: Record<OrderPayment, string> = {
  未払い: '未払いに戻しました',
  支払い済み: '支払い済みに更新',
  キャンセル: '注文をキャンセルしました',
}

const paymentStatusChipTone: Record<OrderPayment, 'warning' | 'success' | 'neutral'> = {
  未払い: 'warning',
  支払い済み: 'success',
  キャンセル: 'neutral',
}

export function AdminPaymentsView() {
  const [orders, setOrders] = useState<OrderRow[]>(getInitialOrders())
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [historyLog, setHistoryLog] = useState<Record<string, Array<{ status: OrderPayment; time: string }>>>({})

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
      `${order.ticket} ${order.id} ${order.callNumber} ${order.items}`.toLowerCase().includes(lower),
    )
  }, [keyword, unpaidOrders])

  const selectedOrder = useMemo(
    () => filteredQueue.find((order) => order.id === selectedId) ?? filteredQueue[0] ?? null,
    [filteredQueue, selectedId],
  )

  const selectedOrderHistory = useMemo(() => {
    if (!selectedId) return []
    const entries = historyLog[selectedId] ?? []
    return [...entries].reverse()
  }, [historyLog, selectedId])

  const selectedOrderItems = useMemo(() => {
    if (!selectedOrder) return []
    return selectedOrder.items.split('／').map((item) => item.trim()).filter(Boolean)
  }, [selectedOrder])

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

  const appendHistory = useCallback((id: string, status: OrderPayment) => {
    setHistoryLog((prev) => {
      const nextEntries = [...(prev[id] ?? []), { status, time: new Date().toISOString() }]
      return { ...prev, [id]: nextEntries }
    })
  }, [])

  const updateOrderStatus = useCallback(
    (id: string, status: OrderPayment) => {
      setOrders((prev) =>
        prev.map((order) => (order.id === id ? { ...order, payment: status } : order)),
      )
      appendHistory(id, status)
    },
    [appendHistory],
  )

  const markPaid = useCallback(
    (id: string) => {
      updateOrderStatus(id, '支払い済み')
      if (selectedId === id) {
        setScanMessage('支払い済みにしました。')
        setSelectedId(null)
      }
    },
    [selectedId, updateOrderStatus],
  )

  const cancelOrder = useCallback(
    (id: string) => {
      const targetOrder = orders.find((order) => order.id === id)
      const label = targetOrder ? `呼出番号 ${targetOrder.callNumber}` : '対象の注文'
      const confirmed = window.confirm(
        `${label} をキャンセルしますか？\nキャンセルすると未払い一覧から除外されます。（あとで未払いに戻せます）`,
      )
      if (!confirmed) return

      updateOrderStatus(id, 'キャンセル')
      if (selectedId === id) {
        setScanMessage('注文をキャンセルしました。')
        setSelectedId(null)
      }
    },
    [orders, selectedId, updateOrderStatus],
  )

  const revertPayment = useCallback(
    (id: string) => {
      updateOrderStatus(id, '未払い')
      setSelectedId(id)
      setScanMessage('支払いステータスを未払いに戻しました。')
    },
    [updateOrderStatus],
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

      const ticketMatch = normalized.match(/t[-_ ]?(\w{3,})/)
      const idMatch = normalized.match(/#(\d{3,})/)
      const callNumberMatch = normalized.match(/(?:no\.?|call|呼出|#)?\s*(\d{1,4})$/)

      const ticketCandidate = ticketMatch ? `T-${ticketMatch[1]}` : null
      const idCandidate = idMatch ? `#${idMatch[1]}` : null
      const callNumberCandidate = callNumberMatch ? Number.parseInt(callNumberMatch[1], 10) : null

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

      if (callNumberCandidate) {
        const match = orders.find((order) => order.callNumber === callNumberCandidate)
        if (match) return match
      }

      return (
        orders.find((order) => order.ticket.toLowerCase() === normalized) ??
        orders.find((order) => order.id.toLowerCase() === normalized) ??
        orders.find((order) => order.callNumber.toString() === normalized) ??
        null
      )
    },
    [orders],
  )

  const handleSuccessfulRead = useCallback(
    (text: string) => {
    const order = locateOrderFromCode(text)
    if (order) {
      selectOrder(order)
  setScanMessage(`進捗確認コード ${order.ticket} を読み取り、呼出番号 ${order.callNumber} を選択しました。`)
      setScanError(null)
      setScannerOpen(false)
    } else {
      setScanMessage(`QR内の「${text}」に対応する注文は見つかりませんでした。`)
      setScanError('別のコードを読み取るか手入力を試してください。')
      }
    },
    [locateOrderFromCode, selectOrder, setScanError, setScanMessage, setScannerOpen],
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

  const handleOpenScanner = useCallback(() => {
    setScanError(null)
    setScanMessage(null)
    setScannerOpen(true)
  }, [])

  const handleCloseScanner = useCallback(() => {
    setScannerOpen(false)
    stopScanner()
  }, [stopScanner])

  return (
    <div className="admin-payment-page">
      {scannerOpen && (
        <div className="admin-payment-scanner-overlay" role="dialog" aria-modal="true">
          <div className="admin-payment-scanner-dialog">
            <header className="admin-payment-scanner-header">
              <h2>QRコードを読み取る</h2>
              <button type="button" className="admin-payment-scanner-close" onClick={handleCloseScanner}>
                閉じる
              </button>
            </header>
            <video ref={videoRef} className="admin-payment-scanner-video" autoPlay muted playsInline />
            <footer className="admin-payment-scanner-footer">
              <span className="admin-payment-scan-status">
                {isScanning ? scanMessage ?? '読み取り中…' : scanMessage ?? '停止しました。'}
              </span>
              <div className="admin-payment-scanner-actions">
                {scanError && (
                  <p className="admin-payment-scan-error" role="alert">
                    {scanError}
                  </p>
                )}
                <button type="button" className="admin-payment-stop" onClick={handleCloseScanner}>
                  停止する
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

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

      <div className="admin-payment-shell">
        <aside className="admin-payment-sidebar" aria-label="呼出番号一覧">
          <div className="admin-payment-sidebar-header">
            <h2>呼出番号一覧</h2>
            <div className="field">
              <label htmlFor="payment-search">検索</label>
              <input
                id="payment-search"
                type="search"
                placeholder="呼出番号・確認コード・注文番号"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <button type="button" className="admin-payment-qr-button" onClick={handleOpenScanner}>
              QRコードを読み取る
            </button>
          </div>

          {scanMessage && !scannerOpen && (
            <p className="admin-payment-scan-message">{scanMessage}</p>
          )}
          {scanError && !scannerOpen && (
            <p className="admin-payment-scan-error" role="alert">
              {scanError}
            </p>
          )}

          <div className="admin-payment-list">
            {filteredQueue.map((order) => (
              <button
                key={order.id}
                type="button"
                className={`admin-payment-list-item${selectedOrder?.id === order.id ? ' active' : ''}`}
                onClick={() => setSelectedId(order.id)}
              >
                <p className="admin-payment-ticket" aria-label={`呼出番号 ${order.callNumber}`}>
                  {order.callNumber}
                </p>
                <div className="admin-payment-list-info">
                  <p className="admin-payment-code">確認コード {order.ticket}</p>
                  <p className="admin-payment-items">{order.items}</p>
                </div>
                <div className="admin-payment-list-meta">
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
        </aside>

        <section className="admin-payment-main" aria-live="polite">
          {selectedOrder ? (
            <article className="admin-payment-detail-card">
              <div className="admin-payment-detail-header">
                <div className="admin-payment-identifiers">
                  <p
                    className="admin-payment-ticket large"
                    aria-label={`呼出番号 ${selectedOrder.callNumber}`}
                  >
                    {selectedOrder.callNumber}
                  </p>
                  <p className="admin-payment-order">確認コード {selectedOrder.ticket}</p>
                  <p className="admin-payment-order subtle">注文番号 {selectedOrder.id}</p>
                </div>
                <div className="admin-payment-total-box">
                  <span>合計金額</span>
                  <strong>{formatCurrency(selectedOrder.total)}</strong>
                  <div className="admin-payment-actions">
                    {selectedOrder.payment === '未払い' && (
                      <>
                        <button
                          type="button"
                          className="admin-payment-action"
                          onClick={() => markPaid(selectedOrder.id)}
                        >
                          支払い済みにする
                        </button>
                        <button
                          type="button"
                          className="admin-payment-inline-button"
                          onClick={() => cancelOrder(selectedOrder.id)}
                        >
                          キャンセルにする
                        </button>
                      </>
                    )}
                    {(selectedOrder.payment === '支払い済み' || selectedOrder.payment === 'キャンセル') && (
                      <button
                        type="button"
                        className="admin-payment-action admin-payment-action--ghost"
                        onClick={() => revertPayment(selectedOrder.id)}
                      >
                        未払いに戻す
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-payment-detail-body">
                <section className="admin-payment-detail-items">
                  <h3>注文内容</h3>
                  {selectedOrderItems.length > 0 ? (
                    <ul>
                      {selectedOrderItems.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="admin-payment-detail-placeholder">商品情報を取得できませんでした。</p>
                  )}
                  {selectedOrder.customer && (
                    <p className="admin-payment-detail-note">お客様: {selectedOrder.customer} 様</p>
                  )}
                  {selectedOrder.note && (
                    <p className="admin-payment-detail-note subtle">メモ: {selectedOrder.note}</p>
                  )}
                </section>
                <section className="admin-payment-detail-meta">
                  <dl>
                    <div>
                      <dt>ステータス</dt>
                      <dd>
                        <span className={`admin-payment-chip ${paymentStatusChipTone[selectedOrder.payment]}`}>
                          {selectedOrder.payment}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>注文受付</dt>
                      <dd>{selectedOrder.createdAt}</dd>
                    </div>
                    <div>
                      <dt>確認コード</dt>
                      <dd>{selectedOrder.ticket}</dd>
                    </div>
                  </dl>
                  <p className="admin-payment-hint">レジで内容と金額を確認してから決済操作を行ってください。</p>
                </section>
              </div>
            </article>
          ) : (
            <div className="admin-payment-detail-placeholder">
              <p className="admin-payment-empty">左の一覧から注文を選択すると詳細が表示されます。</p>
            </div>
          )}

          <section className="admin-payment-history" aria-label="ステータス履歴">
            <header>
              <h3>ステータス履歴</h3>
            </header>
            {selectedOrder ? (
              selectedOrderHistory.length > 0 ? (
                <ul>
                  {selectedOrderHistory.map((entry, index) => (
                    <li key={`${entry.time}-${index}`}>
                      <span>{new Date(entry.time).toLocaleString()}</span>
                          <span>{paymentStatusHistoryText[entry.status]}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="admin-payment-history-empty">操作履歴はまだありません。</p>
              )
            ) : (
              <p className="admin-payment-history-empty">注文を選択すると履歴が表示されます。</p>
            )}
          </section>

          <section className="admin-payment-recent" aria-label="最近決済した注文">
            <header>
              <h3>最近の決済</h3>
            </header>
            <ul>
              {recentSettled.map((order) => (
                <li key={order.id}>
                  <div className="admin-payment-recent-info">
                    <span>呼出番号 {order.callNumber}</span>
                    <small>確認コード {order.ticket}</small>
                  </div>
                  <span>{formatCurrency(order.total)}</span>
                  <span className="admin-payment-time">{order.createdAt}</span>
                  <button type="button" className="admin-payment-revert" onClick={() => revertPayment(order.id)}>
                    未払いに戻す
                  </button>
                </li>
              ))}
              {recentSettled.length === 0 && (
                <li className="admin-payment-history-empty">決済済みの注文はまだありません。</li>
              )}
            </ul>
          </section>
        </section>
      </div>
    </div>
  )
}
