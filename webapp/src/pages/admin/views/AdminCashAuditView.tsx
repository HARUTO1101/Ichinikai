import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useOrdersSubscription } from '../../../hooks/useOrdersSubscription'

import {
  type AuditShift,
  SHIFT_OPTIONS,
  SHIFT_LABELS,
  VOUCHER_FACE_VALUE,
  VOUCHER_USAGE_EVENT,
  getVoucherUsageStorageKey,
  getVoucherUsageTotal,
  loadVoucherPresets,
  saveVoucherPresets,
} from './cashAuditStorage'

const BILL_DENOMINATIONS = [
  { value: 10000, label: '10,000円札', kind: 'bill' },
  { value: 5000, label: '5,000円札', kind: 'bill' },
  { value: 2000, label: '2,000円札', kind: 'bill' },
  { value: 1000, label: '1,000円札', kind: 'bill' },
] as const

const COIN_DENOMINATIONS = [
  { value: 500, label: '500円玉', kind: 'coin' },
  { value: 100, label: '100円玉', kind: 'coin' },
  { value: 50, label: '50円玉', kind: 'coin' },
  { value: 10, label: '10円玉', kind: 'coin' },
  { value: 5, label: '5円玉', kind: 'coin' },
  { value: 1, label: '1円玉', kind: 'coin' },
] as const

const ALL_DENOMINATIONS = [...BILL_DENOMINATIONS, ...COIN_DENOMINATIONS] as const

type VoucherPresetSource = Record<AuditShift, 'auto' | 'manual'>

const AUTO_FILL_SHIFTS: ReadonlyArray<AuditShift> = ['middle', 'close']

type Denomination = (typeof ALL_DENOMINATIONS)[number]
type DenominationValue = Denomination['value']
type CashCounts = Record<DenominationValue, number>

const currencyFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY',
  maximumFractionDigits: 0,
})

const numberFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function createInitialCounts(): CashCounts {
  return ALL_DENOMINATIONS.reduce((accumulator, denomination) => {
    accumulator[denomination.value] = 0
    return accumulator
  }, {} as CashCounts)
}

type BreakdownRow = Denomination & { count: number; subtotal: number }

type Breakdown = {
  billItems: BreakdownRow[]
  coinItems: BreakdownRow[]
  billTotal: number
  coinTotal: number
  grandTotal: number
  totalBills: number
  totalCoins: number
  totalPieces: number
}

export function AdminCashAuditView() {
  const [currentDate] = useState(() => new Date())

  const buildInitialConfiguration = useCallback(() => {
    const basePresets = loadVoucherPresets(currentDate)
    const usageTotal = getVoucherUsageTotal(currentDate)
    const presets: Record<AuditShift, number> = { ...basePresets }
    const source: VoucherPresetSource = {
      open: 'manual',
      middle: 'manual',
      close: 'manual',
    }
    let shouldPersist = false

    if (usageTotal > 0) {
      AUTO_FILL_SHIFTS.forEach((shift) => {
        if (presets[shift] <= 0) {
          presets[shift] = usageTotal
          source[shift] = 'auto'
          shouldPersist = true
        }
      })
    }

    return { presets, source, shouldPersist, usageTotal }
  }, [currentDate])

  const initialConfiguration = useMemo(() => buildInitialConfiguration(), [buildInitialConfiguration])

  const [counts, setCounts] = useState<CashCounts>(() => createInitialCounts())
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [auditShift, setAuditShift] = useState<AuditShift>('open')
  const [voucherPresets, setVoucherPresets] = useState<Record<AuditShift, number>>(
    () => initialConfiguration.presets,
  )
  const [voucherPresetSource, setVoucherPresetSource] = useState<VoucherPresetSource>(
    () => initialConfiguration.source,
  )
  const [voucherUsed, setVoucherUsed] = useState<number>(() => initialConfiguration.presets.open)
  const [voucherUsageTotal, setVoucherUsageTotal] = useState<number>(() => initialConfiguration.usageTotal)
  const reportRef = useRef<HTMLDivElement | null>(null)
  const voucherPresetSourceRef = useRef(voucherPresetSource)

  const startOfDay = useMemo(() => {
    const start = new Date(currentDate)
    start.setHours(0, 0, 0, 0)
    return start
  }, [currentDate])

  const endOfDay = useMemo(() => {
    const end = new Date(startOfDay)
    end.setDate(end.getDate() + 1)
    return end
  }, [startOfDay])

  const subscriptionOptions = useMemo(
    () => ({ start: startOfDay, end: endOfDay }),
    [startOfDay, endOfDay],
  )
  const { orders: orderDetails } = useOrdersSubscription(subscriptionOptions)

  const shiftsTotals = useMemo(() => {
    const startTime = startOfDay.getTime()
    const endTime = endOfDay.getTime()

    return orderDetails.reduce(
      (accumulator, order) => {
        const reference = order.createdAt ?? order.updatedAt
        if (!reference) return accumulator
        const time = reference.getTime()
        if (time < startTime || time >= endTime) return accumulator

        if (order.payment === '支払い済み') {
          accumulator.paidTotal += order.total
          accumulator.paidCount += 1
        } else if (order.payment === '未払い') {
          accumulator.unpaidTotal += order.total
          accumulator.unpaidCount += 1
        }
        return accumulator
      },
      { paidTotal: 0, unpaidTotal: 0, paidCount: 0, unpaidCount: 0 },
    )
  }, [orderDetails, startOfDay, endOfDay])

  useEffect(() => {
    voucherPresetSourceRef.current = voucherPresetSource
  }, [voucherPresetSource])

  useEffect(() => {
    if (!initialConfiguration.shouldPersist) return
    saveVoucherPresets(initialConfiguration.presets, currentDate)
    setVoucherUsageTotal(initialConfiguration.usageTotal)
  }, [currentDate, initialConfiguration])

  const persistVoucherState = useCallback(
    (next: Record<AuditShift, number>) => {
      saveVoucherPresets(next, currentDate)
    },
    [currentDate],
  )

  const updateVoucherPreset = useCallback(
    (shift: AuditShift, value: number, source: 'auto' | 'manual' = 'manual') => {
      setVoucherPresets((previous) => {
        if (previous[shift] === value) return previous
        const next = { ...previous, [shift]: value }
        persistVoucherState(next)
        return next
      })
      setVoucherPresetSource((previous) => {
        if (previous[shift] === source) return previous
        return { ...previous, [shift]: source }
      })
    },
    [persistVoucherState],
  )

  useEffect(() => {
    setVoucherUsed(voucherPresets[auditShift])
  }, [auditShift, voucherPresets])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleUsageChange = () => {
      const usageTotal = getVoucherUsageTotal(currentDate)
      setVoucherUsageTotal(usageTotal)
      setVoucherPresets((previous) => {
        const source = voucherPresetSourceRef.current
        let next = previous
        let mutated = false
        AUTO_FILL_SHIFTS.forEach((shift) => {
          if (source[shift] === 'auto' && previous[shift] !== usageTotal) {
            if (!mutated) {
              next = { ...previous }
              mutated = true
            }
            next[shift] = usageTotal
          }
        })
        if (mutated) {
          persistVoucherState(next)
          return next
        }
        return previous
      })
    }

    const usageStorageKey = getVoucherUsageStorageKey(currentDate)

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== usageStorageKey) return
      handleUsageChange()
    }

    window.addEventListener(VOUCHER_USAGE_EVENT, handleUsageChange)
    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener(VOUCHER_USAGE_EVENT, handleUsageChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [currentDate, persistVoucherState])

  const breakdown = useMemo<Breakdown>(() => {
    const rows: BreakdownRow[] = ALL_DENOMINATIONS.map((denomination) => {
      const count = counts[denomination.value] ?? 0
      const subtotal = denomination.value * count
      return { ...denomination, count, subtotal }
    })

    const billItems = rows.filter((row) => row.kind === 'bill')
    const coinItems = rows.filter((row) => row.kind === 'coin')
    const billTotal = billItems.reduce((sum, row) => sum + row.subtotal, 0)
    const coinTotal = coinItems.reduce((sum, row) => sum + row.subtotal, 0)
    const totalBills = billItems.reduce((sum, row) => sum + row.count, 0)
    const totalCoins = coinItems.reduce((sum, row) => sum + row.count, 0)

    return {
      billItems,
      coinItems,
      billTotal,
      coinTotal,
      grandTotal: billTotal + coinTotal,
      totalBills,
      totalCoins,
      totalPieces: totalBills + totalCoins,
    }
  }, [counts])

  const shiftLabel = SHIFT_LABELS[auditShift]

  const voucherAmount = useMemo(
    () => voucherUsed * VOUCHER_FACE_VALUE,
    [voucherUsed],
  )

  const snapshotTimestamp = useMemo(
    () => new Date(),
    [counts, note, auditShift, voucherUsed],
  )

  const handleCountChange = (value: DenominationValue) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.valueAsNumber
    setCounts((previous) => ({
      ...previous,
      [value]: Number.isNaN(nextValue) || nextValue < 0 ? 0 : Math.floor(nextValue),
    }))
  }

  const handleShiftChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextShift = event.currentTarget.value as AuditShift
    setAuditShift(nextShift)
    setVoucherUsed(voucherPresets[nextShift] ?? 0)
  }

  const handleVoucherChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.currentTarget.valueAsNumber
    const sanitized = Number.isNaN(nextValue) || nextValue < 0 ? 0 : Math.floor(nextValue)
    setVoucherUsed(sanitized)
    updateVoucherPreset(auditShift, sanitized, 'manual')
  }

  const handleReset = () => {
    setCounts(createInitialCounts())
    setSaveError(null)
    const refreshed = buildInitialConfiguration()
    setVoucherPresets(refreshed.presets)
    setVoucherPresetSource(refreshed.source)
    const nextUsed = refreshed.presets[auditShift]
    setVoucherUsed(nextUsed)
    setVoucherUsageTotal(refreshed.usageTotal)
    persistVoucherState(refreshed.presets)
  }

  const handleSaveImage = async () => {
    if (!reportRef.current) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })
      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.download = `cash-audit-${timestamp}.png`
      link.href = dataUrl
      link.click()
      setLastSavedAt(new Date())
    } catch (error) {
      console.error('Failed to save cash audit as image', error)
      setSaveError('画像の書き出しに失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="admin-grid admin-cash-audit-layout">
      <div className="admin-cash-audit-input-column">
        <section className="admin-card admin-cash-audit-config">
          <header className="admin-card-header">
            <div>
              <h3>点検設定</h3>
              <p>点検タイミングと使用済み金券を確認できます。</p>
            </div>
          </header>
          <fieldset className="admin-cash-audit-shift-group">
            <legend>点検タイミング</legend>
            <div className="admin-cash-audit-shift-options">
              {SHIFT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`admin-cash-audit-shift-option${auditShift === option.value ? ' is-active' : ''}`}
                >
                  <input
                    type="radio"
                    name="cash-audit-shift"
                    value={option.value}
                    checked={auditShift === option.value}
                    onChange={handleShiftChange}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="admin-cash-audit-voucher-field">
            <label htmlFor="cash-audit-voucher-count">使用された金券</label>
            <div className="admin-cash-audit-count-input">
              <input
                id="cash-audit-voucher-count"
                className="admin-input admin-input--compact"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                pattern="[0-9]*"
                value={voucherUsed}
                onChange={handleVoucherChange}
              />
              <span className="admin-cash-audit-count-suffix">枚</span>
            </div>
            <p className="admin-cash-audit-helper">支払いフローで使用した金券枚数が記録され、中間点検と閉店時に自動入力されます。</p>
            <div className="admin-cash-audit-voucher-total">
              <span>金券金額（1枚あたり{numberFormatter.format(VOUCHER_FACE_VALUE)}円）</span>
              <strong>{currencyFormatter.format(voucherAmount)}</strong>
            </div>
            <div className="admin-cash-audit-voucher-usage">
              <span>本日の金券使用枚数</span>
              <strong>{numberFormatter.format(voucherUsageTotal)} 枚</strong>
              <span className="admin-cash-audit-voucher-usage-amount">
                合計 {currencyFormatter.format(voucherUsageTotal * VOUCHER_FACE_VALUE)}
              </span>
            </div>
          </div>

          {(auditShift === 'middle' || auditShift === 'close') && (
            <div className="admin-cash-audit-shift-summary">
              <div>
                <span className="admin-cash-audit-summary-label">会計済み合計</span>
                <strong>{currencyFormatter.format(shiftsTotals.paidTotal)}</strong>
                <span className="admin-cash-audit-summary-meta">{numberFormatter.format(shiftsTotals.paidCount)} 件</span>
              </div>
              <div>
                <span className="admin-cash-audit-summary-label">未会計合計</span>
                <strong>{currencyFormatter.format(shiftsTotals.unpaidTotal)}</strong>
                <span className="admin-cash-audit-summary-meta">{numberFormatter.format(shiftsTotals.unpaidCount)} 件</span>
              </div>
            </div>
          )}
        </section>

        <section className="admin-card">
          <header className="admin-card-header">
            <div>
              <h3>紙幣</h3>
              <p>手元の紙幣枚数を入力してください。</p>
            </div>
            <dl className="admin-cash-audit-group-summary">
              <div>
                <dt>枚数</dt>
                <dd>{numberFormatter.format(breakdown.totalBills)} 枚</dd>
              </div>
              <div>
                <dt>小計</dt>
                <dd>{currencyFormatter.format(breakdown.billTotal)}</dd>
              </div>
            </dl>
          </header>
          <table className="admin-table admin-cash-audit-table">
            <thead>
              <tr>
                <th scope="col">金種</th>
                <th scope="col">枚数</th>
                <th scope="col">小計</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.billItems.map((row) => (
                <tr key={`bill-${row.value}`}>
                  <th scope="row">{row.label}</th>
                  <td>
                    <label className="sr-only" htmlFor={`denomination-${row.value}`}>
                      {row.label}の枚数
                    </label>
                    <div className="admin-cash-audit-count-input">
                      <input
                        id={`denomination-${row.value}`}
                        className="admin-input admin-input--compact"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.count}
                        onChange={handleCountChange(row.value)}
                      />
                      <span className="admin-cash-audit-count-suffix">枚</span>
                    </div>
                  </td>
                  <td className="admin-text-right admin-cash-audit-value">
                    {currencyFormatter.format(row.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">紙幣小計</th>
                <td>
                  <span className="admin-cash-audit-total-chip">
                    {numberFormatter.format(breakdown.totalBills)} 枚
                  </span>
                </td>
                <td className="admin-text-right admin-cash-audit-value">
                  {currencyFormatter.format(breakdown.billTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="admin-card">
          <header className="admin-card-header">
            <div>
              <h3>硬貨</h3>
              <p>硬貨の枚数も同じように入力できます。</p>
            </div>
            <dl className="admin-cash-audit-group-summary">
              <div>
                <dt>枚数</dt>
                <dd>{numberFormatter.format(breakdown.totalCoins)} 枚</dd>
              </div>
              <div>
                <dt>小計</dt>
                <dd>{currencyFormatter.format(breakdown.coinTotal)}</dd>
              </div>
            </dl>
          </header>
          <table className="admin-table admin-cash-audit-table">
            <thead>
              <tr>
                <th scope="col">金種</th>
                <th scope="col">枚数</th>
                <th scope="col">小計</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.coinItems.map((row) => (
                <tr key={`coin-${row.value}`}>
                  <th scope="row">{row.label}</th>
                  <td>
                    <label className="sr-only" htmlFor={`denomination-${row.value}`}>
                      {row.label}の枚数
                    </label>
                    <div className="admin-cash-audit-count-input">
                      <input
                        id={`denomination-${row.value}`}
                        className="admin-input admin-input--compact"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.count}
                        onChange={handleCountChange(row.value)}
                      />
                      <span className="admin-cash-audit-count-suffix">枚</span>
                    </div>
                  </td>
                  <td className="admin-text-right admin-cash-audit-value">
                    {currencyFormatter.format(row.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">硬貨小計</th>
                <td>
                  <span className="admin-cash-audit-total-chip">
                    {numberFormatter.format(breakdown.totalCoins)} 枚
                  </span>
                </td>
                <td className="admin-text-right admin-cash-audit-value">
                  {currencyFormatter.format(breakdown.coinTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="admin-card admin-cash-audit-actions">
          <header className="admin-card-header">
            <div>
              <h3>記録メモ</h3>
              <p>確定時刻や担当者、釣銭調整のメモを残せます。</p>
            </div>
          </header>
          <div className="admin-cash-audit-note-field">
            <label htmlFor="cash-audit-note">メモ</label>
            <textarea
              id="cash-audit-note"
              className="admin-textarea"
              value={note}
              maxLength={400}
              placeholder="例: 15:30 時点。担当: 佐藤。釣銭 100円玉を追加予定。"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <div className="admin-cash-audit-buttons">
            <button type="button" className="admin-secondary-button" onClick={handleReset}>
              すべてリセット
            </button>
            <button
              type="button"
              className="admin-primary-button"
              onClick={handleSaveImage}
              disabled={isSaving}
            >
              {isSaving ? '画像を生成中…' : '画像として保存'}
            </button>
          </div>
          <div className="admin-cash-audit-feedback">
            <span>
              合計 {currencyFormatter.format(breakdown.grandTotal)} / {breakdown.totalPieces} 枚
            </span>
            <span className="admin-cash-audit-feedback-muted">
              金券 {numberFormatter.format(voucherUsed)} 枚（{currencyFormatter.format(voucherAmount)}）
            </span>
            <span className="admin-cash-audit-feedback-muted">点検区分 {shiftLabel}</span>
            {lastSavedAt && (
              <span className="admin-cash-audit-feedback-muted">
                最終保存: {dateTimeFormatter.format(lastSavedAt)}
              </span>
            )}
          </div>
          {saveError && <p className="admin-cash-audit-error">{saveError}</p>}
        </section>
      </div>

      <section className="admin-card admin-cash-audit-report" ref={reportRef}>
        <header className="admin-cash-audit-report-header">
          <p className="admin-content-overline">会計点検レポート</p>
          <h3>{currencyFormatter.format(breakdown.grandTotal)}</h3>
          <div className="admin-cash-audit-report-meta">
            <span>紙幣 {currencyFormatter.format(breakdown.billTotal)}</span>
            <span>硬貨 {currencyFormatter.format(breakdown.coinTotal)}</span>
            <span>
              金券 {numberFormatter.format(voucherUsed)} 枚（{currencyFormatter.format(voucherAmount)}）
            </span>
            <span>総枚数 {numberFormatter.format(breakdown.totalPieces)} 枚</span>
            <span>
              本日の金券使用 {numberFormatter.format(voucherUsageTotal)} 枚（
              {currencyFormatter.format(voucherUsageTotal * VOUCHER_FACE_VALUE)}）
            </span>
          </div>
          <p className="admin-cash-audit-timestamp">作成日時: {dateTimeFormatter.format(snapshotTimestamp)}</p>
          <p className="admin-cash-audit-shift-label">点検区分: {shiftLabel}</p>
        </header>
        <div className="admin-cash-audit-report-grid">
          <article>
            <h4>紙幣内訳</h4>
            <table>
              <thead>
                <tr>
                  <th scope="col">金種</th>
                  <th scope="col">枚数</th>
                  <th scope="col">小計</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.billItems.map((item) => (
                  <tr key={`report-bill-${item.value}`}>
                    <td>{item.label}</td>
                    <td>{numberFormatter.format(item.count)} 枚</td>
                    <td>{currencyFormatter.format(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article>
            <h4>硬貨内訳</h4>
            <table>
              <thead>
                <tr>
                  <th scope="col">金種</th>
                  <th scope="col">枚数</th>
                  <th scope="col">小計</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.coinItems.map((item) => (
                  <tr key={`report-coin-${item.value}`}>
                    <td>{item.label}</td>
                    <td>{numberFormatter.format(item.count)} 枚</td>
                    <td>{currencyFormatter.format(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
          <article>
            <h4>金券内訳</h4>
            <table>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">枚数</th>
                  <th scope="col">小計</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>金券</td>
                  <td>{numberFormatter.format(voucherUsed)} 枚</td>
                  <td>{currencyFormatter.format(voucherAmount)}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
        <div className="admin-cash-audit-note-preview">
          <h4>メモ</h4>
          <p>{note ? note : '記録されたメモはありません。'}</p>
        </div>
      </section>
    </div>
  )
}
