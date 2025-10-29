const SHIFT_OPTIONS = [
  { value: 'open', label: '開店時' },
  { value: 'middle', label: '中間点検' },
  { value: 'close', label: '閉店時' },
] as const

export type AuditShift = (typeof SHIFT_OPTIONS)[number]['value']

export const SHIFT_LABELS: Record<AuditShift, string> = SHIFT_OPTIONS.reduce(
  (accumulator, option) => {
    accumulator[option.value] = option.label
    return accumulator
  },
  {} as Record<AuditShift, string>,
)

export const VOUCHER_FACE_VALUE = 100

const PRESET_KEY_PREFIX = 'admin-cash-audit-vouchers-'
const USAGE_KEY_PREFIX = 'admin-cash-audit-voucher-usage-'

export const VOUCHER_USAGE_EVENT = 'admin-cash-audit:voucher-usage-updated'

type VoucherPresets = Record<AuditShift, number>

const DEFAULT_PRESETS: VoucherPresets = {
  open: 0,
  middle: 0,
  close: 0,
}

interface VoucherUsageStore {
  entries: Record<string, number>
}

function buildDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sanitizeCount(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0
  }
  return Math.floor(numeric)
}

function getPresetKey(date?: Date): string {
  const baseDate = date ?? new Date()
  return `${PRESET_KEY_PREFIX}${buildDateKey(baseDate)}`
}

function getUsageKey(date?: Date): string {
  const baseDate = date ?? new Date()
  return `${USAGE_KEY_PREFIX}${buildDateKey(baseDate)}`
}

function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch (error) {
    console.warn('ローカルストレージの読み込みに失敗しました', error)
    return null
  }
}

function writeLocalStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch (error) {
    console.warn('ローカルストレージへの書き込みに失敗しました', error)
  }
}

export function loadVoucherPresets(date?: Date): VoucherPresets {
  const raw = readLocalStorage(getPresetKey(date))
  if (!raw) {
    return { ...DEFAULT_PRESETS }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Record<AuditShift, unknown>>
    return SHIFT_OPTIONS.reduce<VoucherPresets>((accumulator, option) => {
      accumulator[option.value] = sanitizeCount(parsed?.[option.value])
      return accumulator
    }, { ...DEFAULT_PRESETS })
  } catch (error) {
    console.warn('点検プリセットを復元できませんでした', error)
    return { ...DEFAULT_PRESETS }
  }
}

export function saveVoucherPresets(presets: VoucherPresets, date?: Date) {
  const payload = SHIFT_OPTIONS.reduce<Record<AuditShift, number>>((accumulator, option) => {
    accumulator[option.value] = sanitizeCount(presets?.[option.value])
    return accumulator
  }, { ...DEFAULT_PRESETS })

  writeLocalStorage(getPresetKey(date), JSON.stringify(payload))
}

function loadUsageMap(date?: Date): Record<string, number> {
  const raw = readLocalStorage(getUsageKey(date))
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Partial<VoucherUsageStore>
    const entries = parsed?.entries ?? {}
    return Object.entries(entries).reduce<Record<string, number>>((accumulator, [orderId, value]) => {
      const count = sanitizeCount(value)
      if (count > 0) {
        accumulator[orderId] = count
      }
      return accumulator
    }, {})
  } catch (error) {
    console.warn('金券使用履歴を復元できませんでした', error)
    return {}
  }
}

function saveUsageMap(map: Record<string, number>, date?: Date) {
  const sanitized = Object.entries(map).reduce<Record<string, number>>((accumulator, [orderId, value]) => {
    const count = sanitizeCount(value)
    if (count > 0) {
      accumulator[orderId] = count
    }
    return accumulator
  }, {})

  if (Object.keys(sanitized).length === 0) {
    writeLocalStorage(getUsageKey(date), null)
  } else {
    const payload: VoucherUsageStore = { entries: sanitized }
    writeLocalStorage(getUsageKey(date), JSON.stringify(payload))
  }
}

function dispatchVoucherUsageEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(VOUCHER_USAGE_EVENT))
}

export function getVoucherUsageTotal(date?: Date): number {
  const map = loadUsageMap(date)
  return Object.values(map).reduce((sum, count) => sum + count, 0)
}

export function getVoucherUsageForOrder(orderId: string, date?: Date): number {
  if (!orderId) return 0
  const map = loadUsageMap(date)
  return map[orderId] ?? 0
}

export function recordVoucherUsage(orderId: string, count: number, date?: Date) {
  if (!orderId) return
  const sanitized = sanitizeCount(count)
  const map = loadUsageMap(date)

  if (sanitized === 0) {
    if (orderId in map) {
      delete map[orderId]
      saveUsageMap(map, date)
      dispatchVoucherUsageEvent()
    }
    return
  }

  if (map[orderId] === sanitized) {
    return
  }

  map[orderId] = sanitized
  saveUsageMap(map, date)
  dispatchVoucherUsageEvent()
}

export function removeVoucherUsage(orderId: string, date?: Date) {
  if (!orderId) return
  const map = loadUsageMap(date)
  if (!(orderId in map)) {
    return
  }

  delete map[orderId]
  saveUsageMap(map, date)
  dispatchVoucherUsageEvent()
}

export function getVoucherUsageStorageKey(date?: Date): string {
  return getUsageKey(date)
}

export { SHIFT_OPTIONS }
