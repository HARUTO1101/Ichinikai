import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'
import { updateOrderStatus } from '../../../services/orders'
import { type PaymentStatus } from '../../../types/order'
import { getOrderConfirmationCode, mapOrderDetailToRow, type OrderRow } from './adminOrdersData'
import { buildOrderItemEntries, OrderItemsInline } from './adminOrderItems'
import {
  getVoucherUsageForOrder,
  recordVoucherUsage,
  removeVoucherUsage,
  VOUCHER_FACE_VALUE,
} from './cashAuditStorage'

type ReaderControls = Awaited<ReturnType<BrowserQRCodeReader['decodeFromVideoDevice']>>

function formatCurrency(value: number) {
  return `¥${value.toLocaleString()}`
}

const paymentStatusHistoryText: Record<PaymentStatus, string> = {
  未払い: '未払いに戻しました',
  支払い済み: '支払い済みに更新',
  キャンセル: '注文をキャンセルしました',
}

const paymentStatusChipTone: Record<PaymentStatus, 'warning' | 'success' | 'neutral'> = {
  未払い: 'warning',
  支払い済み: 'success',
  キャンセル: 'neutral',
}

export function AdminPaymentsView() {
  const { orders: rawOrders, loading, error } = useOrdersSubscription()
  const orders = useMemo(() => rawOrders.map(mapOrderDetailToRow), [rawOrders])
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [historyLog, setHistoryLog] = useState<Record<string, Array<{ status: PaymentStatus; time: string }>>>({})
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [voucherCount, setVoucherCount] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<ReaderControls | null>(null)
  const queueItemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const unpaidOrders = useMemo(
    () =>
      orders
        .filter((order) => order.payment === '未払い')
        .sort((a, b) => {
          const aTime = a.createdAtDate?.getTime() ?? 0
          const bTime = b.createdAtDate?.getTime() ?? 0
          return aTime - bTime
        }),
    [orders],
  )

  const filteredQueue = useMemo(() => {
    if (!keyword.trim()) return unpaidOrders
    const lower = keyword.trim().toLowerCase()
    return unpaidOrders.filter((order) =>
      `${order.ticket} ${order.id} ${order.callNumber} ${order.items} ${getOrderConfirmationCode(order.id)}`
        .toLowerCase()
        .includes(lower),
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

  const selectedOrderEntries = useMemo(
    () => (selectedOrder ? buildOrderItemEntries(selectedOrder) : []),
    [selectedOrder],
  )


  const selectedOrderConfirmationCode = useMemo(
    () => (selectedOrder ? getOrderConfirmationCode(selectedOrder.id) : '----'),
    [selectedOrder],
  )

  useEffect(() => {
    if (!selectedOrder && filteredQueue.length > 0) {
      setSelectedId(filteredQueue[0].id)
    }
  }, [filteredQueue, selectedOrder])

  useEffect(() => {
    if (!selectedOrder) return
    const element = queueItemRefs.current[selectedOrder.id]
    if (!element) return
    element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedOrder])

  const maxVoucherCount = useMemo(
    () => (selectedOrder ? Math.floor(selectedOrder.total / VOUCHER_FACE_VALUE) : 0),
    [selectedOrder],
  )

  useEffect(() => {
    if (!selectedOrder) {
      setVoucherCount(0)
      return
    }
    const recordedUsage = getVoucherUsageForOrder(selectedOrder.id)
    const clamped = Math.min(Math.max(0, recordedUsage), maxVoucherCount)
    setVoucherCount(clamped)
  }, [selectedOrder, maxVoucherCount])

  const voucherAmount = useMemo(
    () => voucherCount * VOUCHER_FACE_VALUE,
    [voucherCount],
  )

  const cashDue = useMemo(
    () => (selectedOrder ? Math.max(selectedOrder.total - voucherAmount, 0) : 0),
    [selectedOrder, voucherAmount],
  )

  const adjustVoucherCount = useCallback(
    (delta: number) => {
      setVoucherCount((previous) => {
        const next = previous + delta
        const clamped = Math.min(Math.max(0, next), maxVoucherCount)
        return clamped
      })
    },
    [maxVoucherCount],
  )

  const recentSettled = useMemo(
    () =>
      orders
        .filter((order) => order.payment === '支払い済み')
        .sort((a, b) => {
          const aTime = a.createdAtDate?.getTime() ?? 0
          const bTime = b.createdAtDate?.getTime() ?? 0
          return bTime - aTime
        })
        .slice(0, 6),
    [orders],
  )

  const summary = useMemo(
    () => ({
      waiting: unpaidOrders.length,
      totalDue: unpaidOrders.reduce((sum, order) => sum + order.total, 0),
      settledToday: recentSettled.length,
    }),
    [unpaidOrders, recentSettled],
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

  const appendHistory = useCallback((id: string, status: PaymentStatus) => {
    setHistoryLog((prev) => {
      const nextEntries = [...(prev[id] ?? []), { status, time: new Date().toISOString() }]
      return { ...prev, [id]: nextEntries }
    })
  }, [])

  const mutatePaymentStatus = useCallback(
    async (order: OrderRow, status: PaymentStatus) => {
      setMutatingId(order.id)
      setActionError(null)
      try {
        await updateOrderStatus(order.id, order.ticket, {
          payment: status,
          progress: order.progress,
        })
        appendHistory(order.id, status)
      } catch (err) {
        console.error('支払いステータスを更新できませんでした', err)
        setActionError('支払いステータスの更新に失敗しました。通信環境をご確認ください。')
        throw err
      } finally {
        setMutatingId(null)
      }
    },
    [appendHistory],
  )

  const markPaid = useCallback(
    async (order: OrderRow) => {
      try {
        await mutatePaymentStatus(order, '支払い済み')
        const appliedVoucherCount =
          selectedOrder?.id === order.id ? voucherCount : getVoucherUsageForOrder(order.id)
        const maxForOrder = Math.max(0, Math.floor(order.total / VOUCHER_FACE_VALUE))
        const normalizedVoucherCount = Math.min(Math.max(0, appliedVoucherCount), maxForOrder)
        recordVoucherUsage(order.id, normalizedVoucherCount)
        if (selectedId === order.id) {
          setScanMessage('支払い済みにしました。')
          setSelectedId(null)
        }
      } catch {
        // already handled in mutatePaymentStatus
      }
    },
    [mutatePaymentStatus, selectedId, selectedOrder?.id, voucherCount],
  )

  const cancelOrder = useCallback(
    async (order: OrderRow) => {
      const label = `呼出番号 ${order.callNumber}`
      const confirmed = window.confirm(
        `${label} をキャンセルしますか？\nキャンセルすると未払い一覧から除外されます。（あとで未払いに戻せます）`,
      )
      if (!confirmed) return

      try {
        await mutatePaymentStatus(order, 'キャンセル')
        removeVoucherUsage(order.id)
        if (selectedId === order.id) {
          setVoucherCount(0)
          setScanMessage('注文をキャンセルしました。')
          setSelectedId(null)
        }
      } catch {
        // handled above
      }
    },
    [mutatePaymentStatus, selectedId],
  )

  const revertPayment = useCallback(
    async (order: OrderRow) => {
      try {
        await mutatePaymentStatus(order, '未払い')
        removeVoucherUsage(order.id)
        if (selectedId === order.id) {
          setVoucherCount(0)
        }
        setSelectedId(order.id)
        setScanMessage('支払いステータスを未払いに戻しました。')
      } catch {
        // handled above
      }
    },
    [mutatePaymentStatus, selectedId],
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

      const confirmationMatch = orders.find(
        (order) => getOrderConfirmationCode(order.id).toLowerCase() === normalized,
      )
      if (confirmationMatch) return confirmationMatch

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
        setScanMessage(
          `進捗確認コード ${order.ticket} を読み取り、呼出番号 ${order.callNumber}（確認コード ${getOrderConfirmationCode(order.id)}）を選択しました。`,
        )
        setScanError(null)
        setScannerOpen(false)
      } else {
        setScanMessage(`QR内の「${text}」に対応する注文は見つかりませんでした。`)
        setScanError('別のコードを読み取るか手入力を試してください。')
      }
    },
    [locateOrderFromCode, selectOrder],
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

  if (loading) {
    return <p>注文データを読み込み中です…</p>
  }

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

      {error && (
        <p className="admin-error" role="alert">
          注文データの取得に失敗しました。ページを再読み込みしてください。
        </p>
      )}
      {actionError && (
        <p className="admin-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="admin-payment-shell">
        <aside className="admin-payment-sidebar" aria-label="呼出番号一覧">
          <div className="admin-payment-sidebar-header">
            <h2>呼出番号一覧</h2>
            <div className="field">
              <label htmlFor="payment-search">検索</label>
              <input
                id="payment-search"
                type="search"
                placeholder="呼出番号・確認コード（注文番号末尾）・注文番号"
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
            {filteredQueue.map((order) => {
              return (
                <button
                  key={order.id}
                  type="button"
                  className={`admin-payment-list-item${selectedOrder?.id === order.id ? ' active' : ''}`}
                  onClick={() => setSelectedId(order.id)}
                  ref={(element) => {
                    queueItemRefs.current[order.id] = element
                  }}
                  aria-pressed={selectedOrder?.id === order.id}
                >
                  <p className="admin-payment-ticket" aria-label={`呼出番号 ${order.callNumber}`}>
                    {order.callNumber}
                  </p>
                </button>
              )
            })}
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
                  <p className="admin-payment-order">確認コード {selectedOrderConfirmationCode}</p>
                  <p className="admin-payment-order subtle">注文番号 {selectedOrder.id}</p>
                  <p className="admin-payment-order subtle">進捗コード {selectedOrder.ticket}</p>
                </div>
                <div className="admin-payment-total-box">
                  <section className="admin-payment-breakdown-panel" aria-label="支払い内訳">
                    <div className="admin-payment-breakdown-row prominent">
                      <p className="admin-payment-breakdown-label">現金</p>
                      <p className="admin-payment-cash-due" aria-live="polite">
                        {selectedOrder ? formatCurrency(cashDue) : '¥0'}
                      </p>
                    </div>
                    <div className="admin-payment-breakdown-row">
                      <p className="admin-payment-breakdown-label">金券</p>
                      <div className="admin-payment-voucher-control" aria-label="金券の枚数">
                        <button
                          type="button"
                          className="admin-payment-adjust"
                          onClick={() => adjustVoucherCount(-1)}
                          disabled={voucherCount === 0}
                          aria-label="金券を1枚減らす"
                        >
                          -
                        </button>
                        <span className="admin-payment-voucher-count" aria-live="polite">
                          {voucherCount} 枚（{formatCurrency(voucherAmount)}）
                        </span>
                        <button
                          type="button"
                          className="admin-payment-adjust"
                          onClick={() => adjustVoucherCount(1)}
                          disabled={voucherCount >= maxVoucherCount}
                          aria-label="金券を1枚増やす"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <hr className="admin-payment-breakdown-divider" />
                    <p className="admin-payment-breakdown-total" aria-live="polite">
                      合計 {selectedOrder ? formatCurrency(selectedOrder.total) : '¥0'}
                    </p>
                  </section>
                  <div className="admin-payment-voucher-summary" aria-live="polite">
                    <p className="admin-payment-voucher-summary-label">金券枚数</p>
                    <p className="admin-payment-voucher-summary-value">
                      {voucherCount} 枚
                      <span className="admin-payment-voucher-summary-amount">
                        （{formatCurrency(voucherAmount)}）
                      </span>
                    </p>
                  </div>
                  <div className="admin-payment-actions">
                    {selectedOrder.payment === '未払い' && (
                      <>
                        <button
                          type="button"
                          className="admin-payment-action"
                          onClick={() => markPaid(selectedOrder)}
                          disabled={mutatingId === selectedOrder.id}
                        >
                          支払い済みにする
                        </button>
                        <button
                          type="button"
                          className="admin-payment-inline-button"
                          onClick={() => cancelOrder(selectedOrder)}
                          disabled={mutatingId === selectedOrder.id}
                        >
                          キャンセルにする
                        </button>
                      </>
                    )}
                    {(selectedOrder.payment === '支払い済み' || selectedOrder.payment === 'キャンセル') && (
                      <button
                        type="button"
                        className="admin-payment-action admin-payment-action--ghost"
                        onClick={() => revertPayment(selectedOrder)}
                        disabled={mutatingId === selectedOrder.id}
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
                  {selectedOrderEntries.length > 0 ? (
                    <OrderItemsInline
                      entries={selectedOrderEntries}
                      totalAriaLabel="商品点数"
                      variant="compact"
                      className="admin-payment-items-inline"
                    />
                  ) : (
                    <p className="admin-payment-detail-placeholder">商品情報を取得できませんでした。</p>
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
                      <dd>{selectedOrderConfirmationCode}</dd>
                    </div>
                    <div>
                      <dt>進捗コード</dt>
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
            <header className="admin-payment-recent-header">
              <h3>最近の決済</h3>
              <p className="admin-payment-recent-sub">直近で決済した注文の概要です。</p>
            </header>
            <ul>
              {recentSettled.map((order) => {
                const confirmationCode = getOrderConfirmationCode(order.id)
                const itemSummary = order.items.replace(/／/g, '・')
                return (
                  <li key={order.id}>
                    <article className="admin-payment-recent-card">
                      <div className="admin-payment-recent-top">
                        <span className="admin-payment-recent-ticket" aria-label={`呼出番号 ${order.callNumber}`}>
                          呼出 {order.callNumber}
                        </span>
                        <div className="admin-payment-recent-meta">
                          <span className="admin-payment-recent-total">{formatCurrency(order.total)}</span>
                          <time dateTime={order.createdAt} className="admin-payment-time">
                            {order.createdAt}
                          </time>
                        </div>
                      </div>
                      <p className="admin-payment-recent-items" aria-label="注文内容の要約">
                        {itemSummary}
                      </p>
                      <dl className="admin-payment-recent-identifiers">
                        <div>
                          <dt>確認コード</dt>
                          <dd>{confirmationCode}</dd>
                        </div>
                        <div>
                          <dt>注文番号</dt>
                          <dd>{order.id}</dd>
                        </div>
                        <div>
                          <dt>進捗コード</dt>
                          <dd>{order.ticket}</dd>
                        </div>
                      </dl>
                      <div className="admin-payment-recent-actions">
                        <button
                          type="button"
                          className="admin-payment-revert"
                          onClick={() => revertPayment(order)}
                          disabled={mutatingId === order.id}
                        >
                          未払いに戻す
                        </button>
                      </div>
                    </article>
                  </li>
                )
              })}
              {recentSettled.length === 0 && (
                <li className="admin-payment-recent-empty">決済済みの注文はまだありません。</li>
              )}
            </ul>
          </section>
        </section>
      </div>
    </div>
  )
}
