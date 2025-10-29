import { useMemo, useState } from 'react'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'
import { useMenuConfig } from '../../../hooks/useMenuConfig'
import type { MenuItemKey, OrderDetail } from '../../../types/order'

type DashboardMode = 'default' | 'export'
type TimeRangeOption = 'today' | 'yesterday' | '7days'

interface AdminDashboardViewProps {
  mode?: DashboardMode
}

const timeRangeOptions: Array<{ value: TimeRangeOption; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'yesterday', label: '昨日' },
  { value: '7days', label: '直近7日間' },
]

const exportTips: string[] = [
  '最新 24 時間の注文を CSV 形式でダウンロードできます。',
  'Google スプレッドシートにインポートすると集計や共有が容易になります。',
  'エクスポートにはデータ量に応じて最大 10 秒ほどかかる場合があります。',
]

const currencyFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

interface HourlySeriesEntry {
  hour: number
  orderCount: number
  revenue: number
  cumulativeRevenue: number
}

interface ProductStat {
  key: MenuItemKey
  label: string
  totalCount: number
  totalRevenue: number
  peakHour: number | null
  hourlyBreakdown: Array<{ hour: number; count: number; revenue: number }>
}

export function AdminDashboardView({ mode = 'default' }: AdminDashboardViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('today')
  const { orders, loading, error } = useOrdersSubscription()
  const { menuItems } = useMenuConfig()

  const { start, end } = useMemo(() => resolveTimeRange(timeRange), [timeRange])

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const timestamp = getOrderTimestamp(order)
        if (!timestamp) return false
        return timestamp >= start && timestamp < end
      }),
    [orders, start, end],
  )

  const activeOrders = useMemo(
    () => filteredOrders.filter((order) => order.payment !== 'キャンセル'),
    [filteredOrders],
  )

  const totals = useMemo(() => {
    const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.total ?? 0), 0)
    const totalOrders = activeOrders.length
    const paidOrders = activeOrders.filter((order) => order.payment === '支払い済み').length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      paidOrders,
    }
  }, [activeOrders])

  const hourlySeries = useMemo<HourlySeriesEntry[]>(() => {
    const base = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: 0,
      revenue: 0,
      cumulativeRevenue: 0,
    }))

    activeOrders.forEach((order) => {
      const timestamp = getOrderTimestamp(order)
      if (!timestamp) return
      const hourIndex = timestamp.getHours()
      const bucket = base[hourIndex]
      bucket.orderCount += 1
      bucket.revenue += order.total ?? 0
    })

    let runningRevenue = 0
    return base.map((bucket) => {
      runningRevenue += bucket.revenue
      return {
        ...bucket,
        cumulativeRevenue: runningRevenue,
      }
    })
  }, [activeOrders])

  const peakHourlyOrders = useMemo(
    () => hourlySeries.reduce((max, entry) => Math.max(max, entry.orderCount), 0),
    [hourlySeries],
  )
  const peakHourlyRevenue = useMemo(
    () => hourlySeries.reduce((max, entry) => Math.max(max, entry.revenue), 0),
    [hourlySeries],
  )

  const productStats = useMemo<ProductStat[]>(() => {
    return menuItems.map((item) => {
      const hourly = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }))
      let totalCount = 0
      let totalRevenue = 0

      activeOrders.forEach((order) => {
        const timestamp = getOrderTimestamp(order)
        if (!timestamp) return
        const quantity = order.items[item.key] ?? 0
        if (quantity <= 0) return

        const hourIndex = timestamp.getHours()
        const revenue = quantity * item.price
        hourly[hourIndex].count += quantity
        hourly[hourIndex].revenue += revenue
        totalCount += quantity
        totalRevenue += revenue
      })

      const peak = hourly.reduce(
        (acc, entry, hourIndex) => {
          if (entry.count > acc.count) {
            return { count: entry.count, hour: hourIndex }
          }
          return acc
        },
        { count: 0, hour: -1 },
      )

      const hourlyBreakdown = hourly
        .map((entry, hourIndex) => ({ hour: hourIndex, count: entry.count, revenue: entry.revenue }))
        .filter((entry) => entry.count > 0)

      return {
        key: item.key,
        label: item.label,
        totalCount,
        totalRevenue,
        peakHour: peak.count > 0 ? peak.hour : null,
        hourlyBreakdown,
      }
    })
  }, [activeOrders, menuItems])

  const hasData = activeOrders.length > 0
  const rangeLabel = useMemo(() => formatRangeLabel(start, end), [start, end])

  if (mode === 'export') {
    return (
      <div className="admin-grid" style={{ gap: '28px' }}>
        <section className="admin-card">
          <h3>データエクスポート</h3>
          <p>
            注文データを CSV として出力します。期間や対象を選択してから「エクスポートを開始」ボタンを押してください。
          </p>
          <div className="admin-toolbar">
            <div className="field">
              <label htmlFor="export-range">対象期間</label>
              <select id="export-range" defaultValue="today">
                <option value="today">本日</option>
                <option value="yesterday">昨日</option>
                <option value="week">直近 7 日</option>
                <option value="custom">カスタム期間</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="export-status">進捗ステータス</label>
              <select id="export-status" defaultValue="all">
                <option value="all">すべて</option>
                <option value="open">調理済みまで</option>
                <option value="ready">調理済みのみ</option>
                <option value="closed">クローズ済み</option>
              </select>
            </div>
          </div>
          <button type="button" className="admin-primary-button" style={{ width: 'fit-content' }}>
            エクスポートを開始
          </button>
        </section>
        <section className="admin-card">
          <h3>エクスポートのヒント</h3>
          <ul className="admin-list">
            {exportTips.map((tip: string) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <div className="admin-grid" style={{ gap: '28px' }}>
      <section className="admin-card admin-dashboard-controls">
        <div>
          <p className="admin-content-overline">集計期間</p>
          <h3>{rangeLabel}</h3>
        </div>
        <div className="admin-toolbar" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="dashboard-range">期間を選択</label>
            <select
              id="dashboard-range"
              value={timeRange}
              onChange={(event) => setTimeRange(event.target.value as TimeRangeOption)}
            >
              {timeRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="admin-card admin-empty-state">
          <p>注文データを読み込んでいます…</p>
        </section>
      ) : error ? (
        <section className="admin-card admin-empty-state">
          <p>注文データの取得に失敗しました。</p>
          <small>{error.message}</small>
        </section>
      ) : (
        <>
          <div className="admin-grid admin-metric-cards">
            <article className="admin-card admin-metric-card">
              <p className="admin-content-overline">総売上</p>
              <h3 className="admin-metric-card-value">
                {currencyFormatter.format(totals.totalRevenue)}
              </h3>
              <p className="admin-metric-card-helper">キャンセルを除く注文の合計金額</p>
            </article>
            <article className="admin-card admin-metric-card">
              <p className="admin-content-overline">注文件数</p>
              <h3 className="admin-metric-card-value">{numberFormatter.format(totals.totalOrders)} 件</h3>
              <p className="admin-metric-card-helper">
                支払い済み {numberFormatter.format(totals.paidOrders)} 件
              </p>
            </article>
            <article className="admin-card admin-metric-card">
              <p className="admin-content-overline">平均単価</p>
              <h3 className="admin-metric-card-value">
                {currencyFormatter.format(totals.averageOrderValue || 0)}
              </h3>
              <p className="admin-metric-card-helper">キャンセルを除く注文から算出</p>
            </article>
          </div>

          <section className="admin-card">
            <header className="admin-card-header">
              <div>
                <h3>時間帯別の推移</h3>
                <p>売上と件数を 1 時間ごとに集計しています。</p>
              </div>
            </header>
            {hasData ? (
              <table className="admin-table admin-hourly-table">
                <thead>
                  <tr>
                    <th scope="col">時間帯</th>
                    <th scope="col">件数</th>
                    <th scope="col">売上</th>
                    <th scope="col">累積売上</th>
                  </tr>
                </thead>
                <tbody>
                  {hourlySeries.map((entry) => (
                    <tr key={entry.hour}>
                      <td>{formatHourRange(entry.hour)}</td>
                      <td>
                        {numberFormatter.format(entry.orderCount)}
                        <div className="admin-trend-bar orders">
                          <span
                            style={{
                              width: `${peakHourlyOrders > 0 ? (entry.orderCount / peakHourlyOrders) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>
                        {currencyFormatter.format(entry.revenue)}
                        <div className="admin-trend-bar revenue">
                          <span
                            style={{
                              width: `${peakHourlyRevenue > 0 ? (entry.revenue / peakHourlyRevenue) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td>{currencyFormatter.format(entry.cumulativeRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="admin-empty-inline">指定期間の注文はありません。</p>
            )}
          </section>

          <section className="admin-card">
            <header className="admin-card-header">
              <div>
                <h3>商品別の売上・数量</h3>
                <p>時間帯ごとの傾向も確認できます。</p>
              </div>
            </header>
            {hasData ? (
              <>
                <table className="admin-table admin-product-table">
                  <thead>
                    <tr>
                      <th scope="col">商品</th>
                      <th scope="col">数量</th>
                      <th scope="col">売上</th>
                      <th scope="col">ピーク時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productStats.map((product) => (
                      <tr key={product.key}>
                        <td>{product.label}</td>
                        <td>{numberFormatter.format(product.totalCount)} 個</td>
                        <td>{currencyFormatter.format(product.totalRevenue)}</td>
                        <td>{product.peakHour != null ? formatHourRange(product.peakHour) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="admin-product-breakdown">
                  {productStats.every((stat) => stat.hourlyBreakdown.length === 0) ? (
                    <p className="admin-empty-inline">商品別の販売データがありません。</p>
                  ) : (
                    productStats
                      .filter((stat) => stat.hourlyBreakdown.length > 0)
                      .map((stat) => (
                        <details key={stat.key} className="admin-product-breakdown-item">
                          <summary>{stat.label} の時間帯別内訳</summary>
                          <table>
                            <thead>
                              <tr>
                                <th scope="col">時間帯</th>
                                <th scope="col">数量</th>
                                <th scope="col">売上</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stat.hourlyBreakdown.map((entry) => (
                                <tr key={`${stat.key}-${entry.hour}`}>
                                  <td>{formatHourRange(entry.hour)}</td>
                                  <td>{numberFormatter.format(entry.count)} 個</td>
                                  <td>{currencyFormatter.format(entry.revenue)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </details>
                      ))
                  )}
                </div>
              </>
            ) : (
              <p className="admin-empty-inline">商品別の集計はデータがあるときに表示されます。</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function resolveTimeRange(option: TimeRangeOption): { start: Date; end: Date } {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (option === 'today') {
    return { start: startOfToday, end: addDays(startOfToday, 1) }
  }

  if (option === 'yesterday') {
    const start = addDays(startOfToday, -1)
    return { start, end: startOfToday }
  }

  const start = addDays(startOfToday, -6)
  return { start, end: addDays(startOfToday, 1) }
}

function addDays(base: Date, amount: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + amount)
  return next
}

function getOrderTimestamp(order: OrderDetail): Date | null {
  const created = order.createdAt
  const updated = order.updatedAt
  if (created instanceof Date) return created
  if (typeof created === 'string') return new Date(created)
  if (updated instanceof Date) return updated
  if (typeof updated === 'string') return new Date(updated)
  return null
}

function formatHourRange(hour: number): string {
  const start = `${hour.toString().padStart(2, '0')}:00`
  const endHour = hour === 23 ? '23:59' : `${(hour + 1).toString().padStart(2, '0')}:00`
  return `${start} - ${endHour}`
}

function formatRangeLabel(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const startLabel = formatter.format(start)
  const inclusiveEnd = new Date(end.getTime() - 1)
  const endLabel = formatter.format(inclusiveEnd)
  return `${startLabel} 〜 ${endLabel}`
}
