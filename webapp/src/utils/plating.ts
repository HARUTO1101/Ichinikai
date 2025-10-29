import {
  type MenuItemKey,
  type PlatingCategoryKey,
  type PlatingProgress,
  type PlatingStatusMap,
} from '../types/order'

export interface PlatingCategoryMeta {
  key: PlatingCategoryKey
  label: string
  icon: string
  itemKeys: ReadonlyArray<MenuItemKey>
}

export const PLATING_CATEGORY_LIST: ReadonlyArray<PlatingCategoryMeta> = [
  {
    key: 'potaufeu',
    label: 'ポトフ',
    icon: '🥘',
    itemKeys: ['potaufeu'],
  },
  {
    key: 'friedBread',
    label: '揚げパン',
    icon: '🍞',
    itemKeys: ['plain', 'cocoa', 'kinako', 'garlic'],
  },
]

const menuKeyToCategory = new Map<MenuItemKey, PlatingCategoryKey>(
  PLATING_CATEGORY_LIST.flatMap((category) =>
    category.itemKeys.map((menuKey) => [menuKey, category.key] as const),
  ),
)

export function getPlatingCategoryByMenuItem(menuKey: MenuItemKey): PlatingCategoryKey | null {
  return menuKeyToCategory.get(menuKey) ?? null
}

export function calculatePlatingQuantities(
  items: Record<MenuItemKey, number>,
): Record<PlatingCategoryKey, number> {
  return PLATING_CATEGORY_LIST.reduce<Record<PlatingCategoryKey, number>>(
    (acc, category) => {
      acc[category.key] = category.itemKeys.reduce((sum, itemKey) => sum + (items[itemKey] ?? 0), 0)
      return acc
    },
    {
      potaufeu: 0,
      friedBread: 0,
    },
  )
}

export function ensurePlatingProgress(
  items: Record<MenuItemKey, number>,
  raw: Partial<PlatingProgress> | null | undefined,
): PlatingProgress {
  const quantities = calculatePlatingQuantities(items)
  return {
    potaufeu: raw?.potaufeu ?? quantities.potaufeu === 0,
    friedBread: raw?.friedBread ?? quantities.friedBread === 0,
  }
}

export function createInitialPlatingProgress(items: Record<MenuItemKey, number>): PlatingProgress {
  return ensurePlatingProgress(items, null)
}

export function derivePlatingStatus(
  items: Record<MenuItemKey, number>,
  raw: Partial<PlatingProgress> | null | undefined,
): PlatingStatusMap {
  const progress = ensurePlatingProgress(items, raw)
  return {
    potaufeu: progress.potaufeu ? 'ready' : 'pending',
    friedBread: progress.friedBread ? 'ready' : 'pending',
  }
}

export function hasCategoryItems(
  items: Record<MenuItemKey, number>,
  category: PlatingCategoryKey,
): boolean {
  const entry = PLATING_CATEGORY_LIST.find((meta) => meta.key === category)
  return entry ? entry.itemKeys.some((key) => (items[key] ?? 0) > 0) : false
}

export function getCategoryQuantity(
  items: Record<MenuItemKey, number>,
  category: PlatingCategoryKey,
): number {
  const entry = PLATING_CATEGORY_LIST.find((meta) => meta.key === category)
  return entry ? entry.itemKeys.reduce((sum, key) => sum + (items[key] ?? 0), 0) : 0
}

export function getCategoryLabel(category: PlatingCategoryKey): string {
  return PLATING_CATEGORY_LIST.find((entry) => entry.key === category)?.label ?? category
}

export function isOrderPlatingComplete(
  items: Record<MenuItemKey, number>,
  statusMap: PlatingStatusMap,
): boolean {
  return PLATING_CATEGORY_LIST.every((category) => {
    const quantity = category.itemKeys.reduce((sum, key) => sum + (items[key] ?? 0), 0)
    if (quantity === 0) {
      return true
    }
    return statusMap[category.key] === 'ready'
  })
}
