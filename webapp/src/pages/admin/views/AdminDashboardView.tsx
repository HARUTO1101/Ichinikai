import { useMemo, useState } from 'react'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'
import { useMenuConfig } from '../../../hooks/useMenuConfig'
import { getAdminMenuLabel, type MenuItemKey, type OrderDetail } from '../../../types/order'

type DashboardMode = 'default' | 'export'
type TimeRangeOption = 'today' | 'yesterday' | '7days'

type MenuCategory = 'soup' | 'friedBread' | 'smore' | 'drink'

const MENU_CATEGORY_LABELS: Record<MenuCategory, string> = {
  soup: 'スープ',
  friedBread: '揚げパン',
  smore: 'スモア',
  drink: 'ドリンク',
}

const MENU_CATEGORY_ORDER: ReadonlyArray<MenuCategory> = ['soup', 'friedBread', 'smore', 'drink']

const MENU_CATEGORY_BY_KEY: Record<MenuItemKey, MenuCategory> = {
  potaufeu: 'soup',
  minestrone: 'soup',
  plain: 'friedBread',
  cocoa: 'friedBread',
  kinako: 'friedBread',
  garlic: 'friedBread',
  strawberry: 'smore',
  blueberry: 'smore',
  chocolate: 'smore',
  honey: 'smore',
  drink_hojicha: 'drink',
  drink_cocoa: 'drink',
  drink_coffee: 'drink',
  drink_milkcoffee: 'drink',
}

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

interface TotalsSummary {
  totalOrders: number
  paidOrders: number
  totalRevenue: number
  averageOrderValue: number
}

export function AdminDashboardView({ mode = 'default' }: AdminDashboardViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('today')
  const { menuItems } = useMenuConfig()

  const { start, end } = useMemo(() => resolveTimeRange(timeRange), [timeRange])
  const subscriptionOptions = useMemo(() => {
    const autoStopWhen =
      timeRange === 'today'
        ? undefined
        : (orders: OrderDetail[]) => orders.length > 0

    return { start, end, autoStopWhen }
  }, [end, start, timeRange])

  const { orders: activeOrders, loading, error } = useOrdersSubscription(subscriptionOptions)

  const hourlySeries = useMemo<HourlySeriesEntry[]>(() => {
    const buckets: HourlySeriesEntry[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orderCount: 0,
      revenue: 0,
      cumulativeRevenue: 0,
    }))

    if (activeOrders.length === 0) {
      return buckets
    }

    const entries = activeOrders
      .map((order) => ({ order, timestamp: getOrderTimestamp(order) }))
      .filter((item): item is { order: OrderDetail; timestamp: Date } => item.timestamp != null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    entries.forEach(({ order, timestamp }) => {
      if (order.payment === 'キャンセル') return
      const hour = timestamp.getHours()
      if (hour < 0 || hour >= buckets.length) return
      const total = Number.isFinite(order.total) ? order.total : 0
      buckets[hour].orderCount += 1
      buckets[hour].revenue += total
    })

    let cumulative = 0
    buckets.forEach((bucket) => {
      cumulative += bucket.revenue
      bucket.cumulativeRevenue = cumulative
    })

    return buckets
  }, [activeOrders])

  const totals = useMemo<TotalsSummary>(() => {
    if (activeOrders.length === 0) {
      return {
        totalOrders: 0,
        paidOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
      }
    }

    let totalOrders = 0
    let paidOrders = 0
    let totalRevenue = 0

    activeOrders.forEach((order) => {
      if (order.payment === 'キャンセル') return
      totalOrders += 1
      if (order.payment === '支払い済み') {
        paidOrders += 1
      }
      const orderTotal = Number.isFinite(order.total) ? order.total : 0
      totalRevenue += orderTotal
    })

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return {
      totalOrders,
      paidOrders,
      totalRevenue,
      averageOrderValue,
    }
  }, [activeOrders])

  const peakHourlyRevenue = useMemo(
    () => hourlySeries.reduce((max, entry) => Math.max(max, entry.revenue), 0),
    [hourlySeries],
  )

  const productStats = useMemo<ProductStat[]>(() => {
    return menuItems.map((item) => {
      const adminLabel = getAdminMenuLabel(item.key, item.label)
      const hourly = Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 }))
      let totalCount = 0
      let totalRevenue = 0

      activeOrders.forEach((order) => {
        if (order.payment === 'キャンセル') return
        const timestamp = getOrderTimestamp(order)
        if (!timestamp) return
        const quantity = order.items[item.key] ?? 0
        if (quantity <= 0) return

        const hourIndex = timestamp.getHours()
        if (hourIndex < 0 || hourIndex >= hourly.length) return
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
        label: adminLabel,
        totalCount,
        totalRevenue,
        peakHour: peak.count > 0 ? peak.hour : null,
        hourlyBreakdown,
      }
    })
  }, [activeOrders, menuItems])

  const menuItemMap = useMemo(() => {
    return new Map(menuItems.map((item) => [item.key, item]))
  }, [menuItems])

  const productSalesSeries = useMemo(() => {
    return Array.from({ length: 24 }, (_, hour) => {
      const segments = menuItems.map(({ key }) => {
        const product = productStats.find((stat) => stat.key === key)
        const match = product?.hourlyBreakdown.find((entry) => entry.hour === hour)
        return {
          key,
          count: match?.count ?? 0,
        }
      })

      const total = segments.reduce((sum, segment) => sum + segment.count, 0)
      return { hour, total, segments }
    })
  }, [menuItems, productStats])

  const productSalesSeriesWithData = useMemo(
    () => productSalesSeries.filter((entry) => entry.total > 0),
    [productSalesSeries],
  )

  const productSalesByHour = useMemo(() => {
    return new Map(productSalesSeries.map((entry) => [entry.hour, entry]))
  }, [productSalesSeries])

  const peakHourlyOrders = useMemo(
    () => productSalesSeries.reduce((max, entry) => Math.max(max, entry.total), 0),
    [productSalesSeries],
  )

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
                  {hourlySeries.map((entry) => {
                    const productEntry = productSalesByHour.get(entry.hour)
                    const segments = productEntry?.segments ?? []
                    const categoryTotals: Record<MenuCategory, number> = {
                      soup: 0,
                      friedBread: 0,
                      smore: 0,
                      drink: 0,
                    }

                    segments.forEach((segment) => {
                      if (!segment || segment.count === 0) return
                      const category = MENU_CATEGORY_BY_KEY[segment.key]
                      categoryTotals[category] += segment.count
                    })
                    return (
                      <tr key={entry.hour}>
                        <td>{formatHourRange(entry.hour)}</td>
                        <td>
                          <div className="admin-hourly-volume">
                            <span className="admin-hourly-volume-count">
                              {numberFormatter.format(entry.orderCount)} 件
                            </span>
                            <div
                              className="admin-hourly-volume-bar"
                              aria-hidden={entry.orderCount === 0}
                            >
                              {segments.map((segment) => {
                                if (!segment || segment.count === 0) return null
                                const fraction =
                                  peakHourlyOrders > 0
                                    ? (segment.count / peakHourlyOrders) * 100
                                    : 0
                                if (fraction <= 0) return null
                                const minWidth = fraction < 4 ? '6px' : undefined
                                const isCompactSegment = fraction < 8
                                const menuItem = menuItemMap.get(segment.key)
                                return (
                                  <span
                                    key={segment.key}
                                    className={`admin-product-sales-segment menu-item-${segment.key}`}
                                    style={{
                                      width: `${fraction}%`,
                                      flexBasis: `${fraction}%`,
                                      minWidth,
                                    }}
                                    data-compact={isCompactSegment ? 'true' : undefined}
                                    title={`${getAdminMenuLabel(segment.key, menuItem?.label ?? segment.key)}: ${numberFormatter.format(segment.count)}個`}
                                  >
                                    <span className="admin-product-sales-count">{segment.count}</span>
                                  </span>
                                )
                              })}
                            </div>
                            <div className="admin-hourly-volume-category" aria-hidden={entry.orderCount === 0}>
                              {MENU_CATEGORY_ORDER.map((category) => {
                                const count = categoryTotals[category]
                                return (
                                  <span
                                    key={category}
                                    data-muted={count === 0 ? 'true' : undefined}
                                  >
                                    {MENU_CATEGORY_LABELS[category]} {numberFormatter.format(count)} 個
                                  </span>
                                )
                              })}
                            </div>
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
                  )
                })}
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
                      <tr key={product.key} className={`menu-item-${product.key}`}>
                        <td className="admin-product-name">{product.label}</td>
                        <td>{numberFormatter.format(product.totalCount)} 個</td>
                        <td>{currencyFormatter.format(product.totalRevenue)}</td>
                        <td>{product.peakHour != null ? formatHourRange(product.peakHour) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {productSalesSeriesWithData.length > 0 && (
                  <div className="admin-product-sales-chart" role="img" aria-label="時間帯別の商品別販売数">
                    <div className="admin-product-sales-header">
                      <h4>時間帯別 販売個数の内訳</h4>
                      <div className="admin-product-sales-legend" aria-hidden="true">
                        {menuItems.map((item) => (
                          <span
                            key={item.key}
                            className={`admin-product-sales-legend-item menu-item-${item.key}`}
                          >
                            <span className="admin-product-sales-legend-swatch" />
                            {getAdminMenuLabel(item.key, item.label)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="admin-product-sales-rows">
                      {productSalesSeriesWithData.map((entry) => (
                        <div key={entry.hour} className="admin-product-sales-row">
                          <div className="admin-product-sales-hour">{formatHourRange(entry.hour)}</div>
                          <div className="admin-product-sales-bar" aria-hidden={entry.total === 0}>
                            {entry.segments.map((segment) => {
                              if (segment.count === 0) return null
                              const percentage = (segment.count / entry.total) * 100
                              const minWidth = percentage < 6 ? '6px' : undefined
                              const menuItem = menuItemMap.get(segment.key)
                              return (
                                <span
                                  key={segment.key}
                                  className={`admin-product-sales-segment menu-item-${segment.key}`}
                                  style={{ width: `${percentage}%`, flexBasis: `${percentage}%`, minWidth }}
                                  title={`${getAdminMenuLabel(segment.key, menuItem?.label ?? segment.key)}: ${numberFormatter.format(segment.count)}個`}
                                >
                                  <span className="admin-product-sales-count">{segment.count}</span>
                                </span>
                              )
                            })}
                          </div>
                          <div className="admin-product-sales-total">{numberFormatter.format(entry.total)} 個</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-product-breakdown">
                  {productStats.every((stat) => stat.hourlyBreakdown.length === 0) ? (
                    <p className="admin-empty-inline">商品別の販売データがありません。</p>
                  ) : (
                    productStats
                      .filter((stat) => stat.hourlyBreakdown.length > 0)
                      .map((stat) => (
                        <details
                          key={stat.key}
                          className={`admin-product-breakdown-item menu-item-${stat.key}`}
                        >
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
