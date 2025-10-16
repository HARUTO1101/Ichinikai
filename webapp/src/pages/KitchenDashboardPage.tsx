import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { MENU_ITEM_LIST, type MenuItemKey, type OrderDetail } from '../types/order'
import { fetchKitchenOrders } from '../services/orders'
import { computeHourlyMenuSales, summarizeActiveOrders } from '../utils/kitchen'
import { useOrderToasts } from '../context/OrderToastContext'
import './KitchenDashboardPage.css'

const REFRESH_INTERVAL_MS = 60_000

const formatDateInputValue = (date: Date) => date.toISOString().slice(0, 10)

const formatTimeWithSeconds = (date: Date) => {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const createEndOfDay = (start: Date) => {
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return end
}

export function KitchenDashboardPage() {
  const [dateInput, setDateInput] = useState(() => formatDateInputValue(new Date()))
  const [orders, setOrders] = useState<OrderDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { registerListener } = useOrderToasts()

  const selectedDate = useMemo(() => {
    const date = new Date(`${dateInput}T00:00:00`)
    date.setHours(0, 0, 0, 0)
    return date
  }, [dateInput])

  const endOfDay = useMemo(() => createEndOfDay(selectedDate), [selectedDate])

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) return
      setLoading(true)
      setError(null)
      try {
        const result = await fetchKitchenOrders({ start: selectedDate, end: endOfDay })
        if (signal?.aborted) return
        setOrders(result)
        setLastUpdated(new Date())
      } catch (err) {
        if (signal?.aborted) return
        console.error(err)
        const message = err instanceof Error ? err.message : 'データの取得に失敗しました。'
        setError(message)
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [selectedDate, endOfDay],
  )

  const fetchDataRef = useRef(fetchData)

  useEffect(() => {
    fetchDataRef.current = fetchData
  }, [fetchData])

  useEffect(() => {
    const controller = new AbortController()
    fetchData(controller.signal)
    return () => controller.abort()
  }, [fetchData])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      void fetchData(controller.signal)
    }, REFRESH_INTERVAL_MS)

    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [fetchData])

  useEffect(() => {
    const unregister = registerListener((event) => {
      if (event.type === 'new-order') {
        void fetchDataRef.current()
      }
    })

    return () => {
      unregister()
    }
  }, [registerListener])

  const hourlyRows = useMemo(
    () => computeHourlyMenuSales(orders, selectedDate, 24),
    [orders, selectedDate],
  )

  const activeSummary = useMemo(() => summarizeActiveOrders(orders), [orders])

  const hourlyRowsWithData = useMemo(
    () => hourlyRows.filter((row) => row.totalItems > 0),
    [hourlyRows],
  )

  const dayTotals = useMemo(() => {
    const totals = MENU_ITEM_LIST.reduce((acc, item) => {
      acc[item.key] = hourlyRows.reduce((sum, row) => sum + (row.totals[item.key] ?? 0), 0)
      return acc
    }, {} as Record<MenuItemKey, number>)
    const totalItems = Object.values(totals).reduce((sum, value) => sum + value, 0)
    const totalOrders = hourlyRows.reduce((sum, row) => sum + row.orderCount, 0)
    return { totals, totalItems, totalOrders }
  }, [hourlyRows])

  const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDateInput(event.target.value)
  }

  const handleManualRefresh = () => {
    setLastUpdated(null)
    void fetchData()
  }

  return (
    <div className="kitchen-page">
        <header className="kitchen-header">
        <div>
          <p className="kitchen-overline">キッチン向けビュー</p>
          <h1>調理チームダッシュボード</h1>
          <p className="kitchen-description">
            仕込みの目安となる販売数と、現在オーダー中のメニュー数をまとめています。
          </p>
        </div>
        <div className="kitchen-controls" role="group" aria-label="表示期間の設定">
          <label className="kitchen-date-control">
            <span>表示日</span>
            <input
              type="date"
              value={dateInput}
              onChange={handleDateChange}
              max={formatDateInputValue(new Date())}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={handleManualRefresh}
            disabled={loading}
          >
            今すぐ再読み込み
          </button>
          <p className="kitchen-last-updated">
            最終更新: {lastUpdated ? formatTimeWithSeconds(lastUpdated) : '更新待ち'}
          </p>
        </div>
      </header>

      {error && <div className="kitchen-alert error">{error}</div>}

      {loading && <p className="kitchen-loading">集計中です…</p>}

      <section className="kitchen-section" aria-labelledby="kitchen-current-orders">
        <div className="kitchen-section-header">
          <h2 id="kitchen-current-orders">現在のオーダー数</h2>
          <p>受注済み〜調理済みまでの進行中オーダーを合計しています。</p>
        </div>
        <div className="kitchen-summary-grid">
          {MENU_ITEM_LIST.map((item) => (
            <article key={item.key} className="kitchen-summary-card">
              <h3>{item.label}</h3>
              <p className="kitchen-summary-count">{activeSummary.totals[item.key]}個</p>
            </article>
          ))}
        </div>
        <div className="kitchen-status-chips" role="list">
          <span role="listitem" className="kitchen-status-chip">
            受注済み {activeSummary.statusCounts['受注済み']}件
          </span>
          <span role="listitem" className="kitchen-status-chip highlight">
            調理済み {activeSummary.statusCounts['調理済み']}件
          </span>
          <span role="listitem" className="kitchen-status-chip muted">
            受け渡し済み {activeSummary.statusCounts['クローズ']}件
          </span>
          <span role="listitem" className="kitchen-status-chip total">
            進行中合計 {activeSummary.orderCount}件
          </span>
        </div>
      </section>

      <section className="kitchen-section" aria-labelledby="kitchen-hourly-sales">
        <div className="kitchen-section-header">
          <h2 id="kitchen-hourly-sales">1時間ごとの販売数</h2>
          <p>選択日の注文データを時間帯別に集計しています（自動更新: 60秒ごと）。</p>
        </div>
        {hourlyRowsWithData.length === 0 ? (
          <p className="kitchen-empty">該当データがありません。</p>
        ) : (
          <div className="kitchen-table-wrapper">
            <table className="kitchen-table">
              <thead>
                <tr>
                  <th scope="col">時間帯</th>
                  {MENU_ITEM_LIST.map((item) => (
                    <th scope="col" key={item.key}>
                      {item.label}
                    </th>
                  ))}
                  <th scope="col">合計個数</th>
                  <th scope="col">注文数</th>
                </tr>
              </thead>
              <tbody>
                {hourlyRowsWithData.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {MENU_ITEM_LIST.map((item) => (
                      <td key={item.key}>
                        {row.totals[item.key] > 0 ? row.totals[item.key] : '—'}
                      </td>
                    ))}
                    <td>{row.totalItems > 0 ? row.totalItems : '—'}</td>
                    <td>{row.orderCount > 0 ? row.orderCount : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">合計</th>
                  {MENU_ITEM_LIST.map((item) => (
                    <td key={item.key}>{dayTotals.totals[item.key] || '—'}</td>
                  ))}
                  <td>{dayTotals.totalItems || '—'}</td>
                  <td>{dayTotals.totalOrders || '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default KitchenDashboardPage
