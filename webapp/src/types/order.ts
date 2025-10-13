export type MenuItemKey =
  | 'plain'
  | 'cocoa'
  | 'kinako'
  | 'garlic'
  | 'potaufeu'

export type PaymentStatus = '未払い' | '支払い済み'
export type ProgressStatus = '受注済み' | '調理中' | '受取可' | 'クローズ'

export interface MenuItem {
  key: MenuItemKey
  label: string
  description: string
  price: number
  image: string
}

export const MENU_ITEMS: Record<MenuItemKey, MenuItem> = {
  plain: {
    key: 'plain',
    label: 'プレーンチュロス',
    description: 'シナモンシュガーをまぶした定番の一品',
    price: 350,
    image: '/menu_photo/1.png',
  },
  cocoa: {
    key: 'cocoa',
    label: '濃厚ココアチュロス',
    description: 'ビターなココアパウダーとチョコソース',
    price: 380,
    image: '/menu_photo/2.png',
  },
  kinako: {
    key: 'kinako',
    label: '黒蜜きなこチュロス',
    description: '国産きなこと黒蜜の和風仕立て',
    price: 400,
    image: '/menu_photo/3.png',
  },
  garlic: {
    key: 'garlic',
    label: 'ガーリックソルトポテト',
    description: '揚げたてポテトにガーリックソルトを効かせました',
    price: 450,
    image: '/menu_photo/4.png',
  },
  potaufeu: {
    key: 'potaufeu',
    label: '具だくさんポトフ',
    description: '野菜たっぷりの温かいスープでほっと一息',
    price: 500,
    image: '/menu_photo/5.png',
  },
}

export const MENU_ITEM_LIST: MenuItem[] = Object.values(MENU_ITEMS)

export const PAYMENT_STATUSES: PaymentStatus[] = ['未払い', '支払い済み']

export const PROGRESS_STATUSES: ProgressStatus[] = ['受注済み', '調理中', '受取可']

export interface OrderInputValues {
  items: Record<MenuItemKey, number>
}

export interface OrderSummary {
  orderId: string
  ticket: string
  total: number
  items: Record<MenuItemKey, number>
  payment: PaymentStatus
  progress: ProgressStatus
}

export interface OrderLookupResult {
  orderId: string
  ticket: string
  total: number
  items: Record<MenuItemKey, number>
  payment: PaymentStatus
  progress: ProgressStatus
  updatedAt?: Date
}

export interface OrderDetail extends OrderLookupResult {
  createdAt?: Date
  createdBy?: string | null
}

export interface KitchenOrdersQuery {
  start?: Date
  end?: Date
}
