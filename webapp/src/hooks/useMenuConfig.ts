import { useMemo, useSyncExternalStore } from 'react'
import {
  getMenuSnapshot,
  subscribeMenuConfig,
  updateMenuItem,
  resetMenuItem,
  resetAllMenuItems,
  getMenuBaseMap,
  getMenuOverrides,
} from '../store/menuConfigStore'
import type { MenuItem, MenuItemKey } from '../types/order'

interface UseMenuConfigResult {
  menuItems: MenuItem[]
  menuItemMap: Record<MenuItemKey, MenuItem>
  baseMenuItemMap: Record<MenuItemKey, MenuItem>
  overrides: ReturnType<typeof getMenuOverrides>
  updateMenuItem: typeof updateMenuItem
  resetMenuItem: (key: MenuItemKey) => Promise<void>
  resetAllMenuItems: () => Promise<void>
}

export function useMenuConfig(): UseMenuConfigResult {
  const snapshot = useSyncExternalStore(subscribeMenuConfig, getMenuSnapshot)

  return useMemo<UseMenuConfigResult>(
    () => ({
      menuItems: snapshot.list,
      menuItemMap: snapshot.map,
      baseMenuItemMap: getMenuBaseMap(),
      overrides: getMenuOverrides(),
      updateMenuItem,
      resetMenuItem,
      resetAllMenuItems,
    }),
    [snapshot],
  )
}
