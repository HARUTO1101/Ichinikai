export type MenuItemKey =
  | 'potaufeu'
  | 'plain'
  | 'cocoa'
  | 'kinako'
  | 'garlic'

export type PaymentStatus = '未払い' | '支払い済み' | 'キャンセル'
export type ProgressStatus = '受注済み' | '調理済み' | 'クローズ'

export type PlatingCategoryKey = 'potaufeu' | 'friedBread'

export interface PlatingProgress {
  potaufeu: boolean
  friedBread: boolean
}

export type PlatingStatus = 'pending' | 'ready'
export type PlatingStatusMap = Record<PlatingCategoryKey, PlatingStatus>

export type AllergenKey = 'wheat' | 'egg' | 'soy'

export interface AllergenMeta {
  key: AllergenKey
  label: string
  icon: string
}

export const ALLERGENS: Record<AllergenKey, AllergenMeta> = {
  wheat: {
    key: 'wheat',
    label: '小麦',
    icon: '/allergy_icon/Wheat.png',
  },
  egg: {
    key: 'egg',
    label: '卵',
    icon: '/allergy_icon/Egg.png',
  },
  soy: {
    key: 'soy',
    label: '大豆',
    icon: '/allergy_icon/Soy.png',
  },
}

export const ALLERGEN_LIST: ReadonlyArray<AllergenMeta> = Object.values(ALLERGENS)

export interface MenuItem {
  key: MenuItemKey
  label: string
  description: string
  price: number
  image: string
  allergens: ReadonlyArray<AllergenKey>
}

export const MENU_ITEMS: Record<MenuItemKey, MenuItem> = {
  potaufeu: {
    key: 'potaufeu',
    label: 'ポトフ',
    description: '野菜たっぷりの温かいスープでほっと一息',
    price: 250,
    image: '/menu_photo/5.png',
    allergens: ['soy'],
  },
  plain: {
    key: 'plain',
    label: '揚げパン(プレーン)',
    description: 'あつあつの揚げパンに砂糖をまぶしました',
    price: 250,
    image: '/menu_photo/1.png',
    allergens: ['wheat', 'egg'],
  },
  cocoa: {
    key: 'cocoa',
    label: '揚げパン(ココア)',
    description: 'ビターなココアパウダーとチョコソース',
    price: 250,
    image: '/menu_photo/2.png',
    allergens: ['wheat', 'egg', 'soy'],
  },
  kinako: {
    key: 'kinako',
    label: '揚げパン(きなこ)',
    description: '国産きなこと黒蜜の和風仕立て',
    price: 250,
    image: '/menu_photo/3.png',
    allergens: ['wheat', 'soy'],
  },
  garlic: {
    key: 'garlic',
    label: '揚げパン(ガーリック)',
    description: '揚げたてポテトにガーリックソルトを効かせました',
    price: 250,
    image: '/menu_photo/4.png',
    allergens: ['wheat'],
  },
}

export const MENU_ITEM_LIST: MenuItem[] = Object.values(MENU_ITEMS)

export const PAYMENT_STATUSES: PaymentStatus[] = ['未払い', '支払い済み', 'キャンセル']

export const PROGRESS_STATUSES: ProgressStatus[] = ['受注済み', '調理済み', 'クローズ']

export interface OrderInputValues {
  items: Record<MenuItemKey, number>
}

export interface OrderSummary {
  orderId: string
  ticket: string
  callNumber: number
  total: number
  items: Record<MenuItemKey, number>
  payment: PaymentStatus
  progress: ProgressStatus
  plating: PlatingProgress
  createdAt?: Date
}

export interface OrderLookupResult {
  orderId: string
  ticket: string
  callNumber: number
  total: number
  items: Record<MenuItemKey, number>
  payment: PaymentStatus
  progress: ProgressStatus
  plating: PlatingProgress
  updatedAt?: Date
  createdAt?: Date
}

export interface OrderDetail extends OrderLookupResult {
  createdBy?: string | null
}

export interface KitchenOrdersQuery {
  start?: Date
  end?: Date
}
