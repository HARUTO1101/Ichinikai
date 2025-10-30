import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore'
import { auth, db, ensureAnonymousUser, isMockMode } from '../lib/firebase'
import { MENU_ITEMS, type MenuItem, type MenuItemKey } from '../types/order'

interface MenuOverride {
  label?: string
  price?: number
  soldOut?: boolean
}

export type MenuOverrides = Partial<Record<MenuItemKey, MenuOverride>>

export interface MenuSnapshot {
  map: Record<MenuItemKey, MenuItem>
  list: MenuItem[]
}

const STORAGE_KEY = 'order-app.menu-overrides.v1'
const MENU_CONFIG_COLLECTION = 'config'
const MENU_CONFIG_DOCUMENT = 'menuOverrides'
const useLocalPersistence = isMockMode

let overrides: MenuOverrides = {}

const listeners = new Set<() => void>()
let snapshot: MenuSnapshot

const isBrowser = typeof window !== 'undefined'
const menuConfigDocRef: DocumentReference<DocumentData> | null = !isMockMode
  ? doc(db, MENU_CONFIG_COLLECTION, MENU_CONFIG_DOCUMENT)
  : null

const sanitizeLabel = (value: string | undefined, baseLabel: string): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed === baseLabel) return undefined
  return trimmed
}

const sanitizePrice = (value: number | undefined, basePrice: number): number | undefined => {
  if (!Number.isFinite(value)) return undefined
  const normalized = Math.max(0, Math.round(value!))
  if (normalized === basePrice) return undefined
  return normalized
}

const sanitizeSoldOut = (value: unknown, baseSoldOut: boolean): boolean | undefined => {
  if (typeof value !== 'boolean') return undefined
  return value === baseSoldOut ? undefined : value
}

const sanitizeOverridesRecord = (raw: unknown): MenuOverrides => {
  if (!raw || typeof raw !== 'object') return {}

  return Object.entries(raw as Record<string, unknown>).reduce<MenuOverrides>(
    (acc, [key, value]) => {
      if (!isMenuItemKey(key) || !value || typeof value !== 'object') return acc

      const base = MENU_ITEMS[key]
      const label = sanitizeLabel((value as MenuOverride).label, base.label)
      const price = sanitizePrice((value as MenuOverride).price, base.price)
      const soldOut = sanitizeSoldOut((value as MenuOverride).soldOut, base.soldOut)

      if (!label && !Number.isFinite(price) && typeof soldOut !== 'boolean') return acc

      const override: MenuOverride = {}
      if (label) override.label = label
      if (Number.isFinite(price)) override.price = price
      if (typeof soldOut === 'boolean') override.soldOut = soldOut
      acc[key] = override
      return acc
    },
    {},
  )
}

const loadOverridesFromLocal = (): MenuOverrides => {
  if (!isBrowser) return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return sanitizeOverridesRecord(parsed)
  } catch (error) {
    console.warn('[menuConfigStore] Failed to load overrides', error)
    return {}
  }
}

const persistOverridesToLocal = (next: MenuOverrides) => {
  if (!isBrowser) return
  try {
    const serialized = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    console.warn('[menuConfigStore] Failed to persist overrides', error)
  }
}

const isMenuItemKey = (value: string): value is MenuItemKey => value in MENU_ITEMS

const buildSnapshot = (): MenuSnapshot => {
  const map = Object.entries(MENU_ITEMS).reduce<Record<MenuItemKey, MenuItem>>(
    (acc, [key, base]) => {
      const typedKey = key as MenuItemKey
      const override = overrides[typedKey] ?? {}
      const label = override.label ?? base.label
      const price = override.price ?? base.price
      const soldOut = override.soldOut ?? base.soldOut

      acc[typedKey] = {
        ...base,
        label,
        price,
        soldOut,
      }
      return acc
    },
    {} as Record<MenuItemKey, MenuItem>,
  )

  return {
    map,
    list: Object.values(map),
  }
}

const overridesEqual = (next: MenuOverrides, prev: MenuOverrides): boolean => {
  const keysA = Object.keys(next)
  const keysB = Object.keys(prev)
  if (keysA.length !== keysB.length) return false
  return keysA.every((key) => {
    if (!isMenuItemKey(key)) return false
    const nextValue = next[key]
    const prevValue = prev[key]
    if (!nextValue && !prevValue) return true
    if (!nextValue || !prevValue) return false
    return (
      nextValue.label === prevValue.label &&
      nextValue.price === prevValue.price &&
      nextValue.soldOut === prevValue.soldOut
    )
  })
}

const applyOverrides = (next: MenuOverrides, options: { persist?: boolean } = {}) => {
  const { persist = true } = options
  overrides = next
  snapshot = buildSnapshot()
  if (useLocalPersistence && persist) {
    persistOverridesToLocal(next)
  }
  listeners.forEach((listener) => listener())
}

const writeOverridesToRemote = async (next: MenuOverrides) => {
  if (!menuConfigDocRef) return
  await setDoc(
    menuConfigDocRef,
    {
      overrides: next,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid ?? null,
    },
    { merge: true },
  )
}

const commitOverrides = async (next: MenuOverrides) => {
  if (overridesEqual(next, overrides)) return

  const previous = overrides
  applyOverrides(next)

  if (menuConfigDocRef) {
    try {
      await writeOverridesToRemote(next)
    } catch (error) {
      console.error('[menuConfigStore] Failed to sync overrides to Firestore', error)
      applyOverrides(previous, { persist: false })
      throw error
    }
  }
}

const initializeRemoteSync = () => {
  if (!menuConfigDocRef) return

  void (async () => {
    try {
      await ensureAnonymousUser()
      const snapshot = await getDoc(menuConfigDocRef)
      if (!snapshot.exists()) {
        if (!overridesEqual(overrides, {})) {
          applyOverrides({}, { persist: false })
        }
        return
      }
      const data = snapshot.data()
      const remoteOverrides = sanitizeOverridesRecord(data?.overrides)
      if (!overridesEqual(remoteOverrides, overrides)) {
        applyOverrides(remoteOverrides, { persist: false })
      }
    } catch (error) {
      console.error('[menuConfigStore] Failed to load menu overrides from Firestore', error)
    }
  })()

  onSnapshot(
    menuConfigDocRef,
    (docSnap) => {
      if (docSnap.metadata.hasPendingWrites) return
      if (!docSnap.exists()) {
        if (!overridesEqual(overrides, {})) {
          applyOverrides({}, { persist: false })
        }
        return
      }
      const data = docSnap.data()
      const remoteOverrides = sanitizeOverridesRecord(data?.overrides)
      if (!overridesEqual(remoteOverrides, overrides)) {
        applyOverrides(remoteOverrides, { persist: false })
      }
    },
    (error) => {
      console.error('[menuConfigStore] Failed to subscribe to menu overrides', error)
    },
  )
}

export const getMenuSnapshot = (): MenuSnapshot => snapshot

export const subscribeMenuConfig = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const updateMenuItem = async (
  key: MenuItemKey,
  updates: { label?: string; price?: number; soldOut?: boolean },
): Promise<void> => {
  const base = MENU_ITEMS[key]
  if (!base) {
    throw new Error(`Unknown menu item key: ${key}`)
  }

  const current = overrides[key] ?? {}
  const nextOverride: MenuOverride = { ...current }
  let updated = false

  const hasLabelUpdate = Object.prototype.hasOwnProperty.call(updates, 'label')
  if (hasLabelUpdate) {
    const nextLabel = sanitizeLabel(updates.label, base.label)
    if (typeof nextLabel === 'string') {
      if (nextOverride.label !== nextLabel) {
        nextOverride.label = nextLabel
        updated = true
      }
    } else if (nextOverride.label !== undefined) {
      delete nextOverride.label
      updated = true
    }
  }

  const hasPriceUpdate = Object.prototype.hasOwnProperty.call(updates, 'price')
  if (hasPriceUpdate) {
    const nextPrice = sanitizePrice(updates.price, base.price)
    if (typeof nextPrice === 'number') {
      if (nextOverride.price !== nextPrice) {
        nextOverride.price = nextPrice
        updated = true
      }
    } else if (nextOverride.price !== undefined) {
      delete nextOverride.price
      updated = true
    }
  }

  const hasSoldOutUpdate = Object.prototype.hasOwnProperty.call(updates, 'soldOut')
  if (hasSoldOutUpdate) {
    const nextSoldOut = sanitizeSoldOut(updates.soldOut, base.soldOut)
    if (typeof nextSoldOut === 'boolean') {
      if (nextOverride.soldOut !== nextSoldOut) {
        nextOverride.soldOut = nextSoldOut
        updated = true
      }
    } else if (nextOverride.soldOut !== undefined) {
      delete nextOverride.soldOut
      updated = true
    }
  }

  if (!updated) {
    return
  }

  if (Object.keys(nextOverride).length === 0) {
    if (!overrides[key]) {
      return
    }
    const withoutCurrent = { ...overrides }
    delete withoutCurrent[key]
    await commitOverrides(withoutCurrent)
    return
  }

  const nextOverrides = {
    ...overrides,
    [key]: nextOverride,
  }

  await commitOverrides(nextOverrides)
}

export const resetMenuItem = async (key: MenuItemKey): Promise<void> => {
  if (!overrides[key]) return
  const nextOverrides = { ...overrides }
  delete nextOverrides[key]
  await commitOverrides(nextOverrides)
}

export const resetAllMenuItems = async (): Promise<void> => {
  if (Object.keys(overrides).length === 0) return
  await commitOverrides({})
}

export const getMenuBaseMap = (): Record<MenuItemKey, MenuItem> => MENU_ITEMS

export const getMenuOverrides = (): MenuOverrides => overrides

if (useLocalPersistence) {
  overrides = loadOverridesFromLocal()
} else {
  overrides = {}
  initializeRemoteSync()
}
snapshot = buildSnapshot()
