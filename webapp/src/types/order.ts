import { withBase } from '../utils/assets'

export type MenuItemKey =
  | 'potaufeu'
  | 'plain'
  | 'cocoa'
  | 'kinako'
  | 'garlic'
  | 'drink_hojicha'
  | 'drink_cocoa'
  | 'drink_coffee'
  | 'drink_milkcoffee'
  | 'minestrone'
  | 'strawberry'
  | 'blueberry'
  | 'chocolate'
  | 'honey'
  

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
    icon: withBase('allergy_icon/Wheat.png'),
  },
  egg: {
    key: 'egg',
    label: '卵',
    icon: withBase('allergy_icon/Egg.png'),
  },
  soy: {
    key: 'soy',
    label: '大豆',
    icon: withBase('allergy_icon/Soy.png'),
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

export type MenuVariantKey = 'day12' | 'day34'

const MENU_ITEM_DEFINITIONS: Record<MenuItemKey, MenuItem> = {
  potaufeu: {
    key: 'potaufeu',
    label: 'ポトフ',
    description: '野菜たっぷりの温かいスープでほっと一息',
    price: 250,
    image: withBase('menu_photo/5.png'),
    allergens: ['soy'],
  },
  plain: {
    key: 'plain',
    label: '揚げパン(プレーン)',
    description: 'あつあつの揚げパンに砂糖をまぶしました',
    price: 250,
    image: withBase('menu_photo/1.png'),
    allergens: ['wheat', 'egg'],
  },
  cocoa: {
    key: 'cocoa',
    label: '揚げパン(ココア)',
    description: 'ビターなココアパウダーとチョコソース',
    price: 250,
    image: withBase('menu_photo/2.png'),
    allergens: ['wheat', 'egg', 'soy'],
  },
  kinako: {
    key: 'kinako',
    label: '揚げパン(きなこ)',
    description: '国産きなこと黒蜜の和風仕立て',
    price: 250,
    image: withBase('menu_photo/3.png'),
    allergens: ['wheat', 'soy'],
  },
  garlic: {
    key: 'garlic',
    label: '揚げパン(ガーリック)',
    description: '揚げたてポテトにガーリックソルトを効かせました',
    price: 250,
    image: withBase('menu_photo/4.png'),
    allergens: ['wheat'],
  },
  drink_hojicha: {
    key: 'drink_hojicha',
    label: 'ほうじ茶(温)',
    description: '香ばしいほうじ茶でほっと一息',
    price: 150,
    image: withBase('menu_photo/6.png'),
    allergens: [],
  },
  drink_cocoa: {
    key: 'drink_cocoa',
    label: 'ココア(温)',
    description: '甘くて濃厚なココアでほっと一息',
    price: 150,
    image: withBase('menu_photo/7.png'),
    allergens: [],
  },
  drink_coffee: {
    key: 'drink_coffee',
    label: 'コーヒー(温)',
    description: '香り高いホットコーヒーでリフレッシュ',
    price: 150,
    image: withBase('menu_photo/8.png'),
    allergens: [],
  },
  drink_milkcoffee: {
    key: 'drink_milkcoffee',
    label: 'コーヒー牛乳(冷)',
    description: 'ミルクたっぷりのまろやかなホットコーヒー',
    price: 150,
    image: withBase('menu_photo/9.png'),
    allergens: [],
  },
  minestrone: {
    key: 'minestrone',
    label: 'ミネストローネ',
    description: 'トマトベースの具だくさんスープで体ぽかぽか',
    price: 320,
    image: withBase('menu_photo/5.png'),
    allergens: ['soy'],
  },
  strawberry: {
    key: 'strawberry',
    label: 'スモア(いちごジャム味)',
    description: '甘酸っぱいいちごジャムとマシュマロのハーモニー',
    price: 250,
    image: withBase('menu_photo/1.png'),
    allergens: ['wheat', 'egg'],
  },
  blueberry: {
    key: 'blueberry',
    label: 'スモア(ブルーベリージャム味)',
    description: '甘酸っぱいブルーベリージャムとマシュマロのハーモニー',
    price: 250,
    image: withBase('menu_photo/2.png'),
    allergens: ['wheat', 'egg', 'soy'],
  },
  chocolate: {
    key: 'chocolate',
    label: 'スモア(チョコ味)',
    description: '濃厚チョコレートソースとマシュマロのハーモニー',
    price: 250,
    image: withBase('menu_photo/3.png'),
    allergens: ['wheat', 'soy'],
  },
  honey: {
    key: 'honey',
    label: 'スモア(はちみつ味)',
    description: '香ばしいはちみつとマシュマロのハーモニー',
    price: 250,
    image: withBase('menu_photo/4.png'),
    allergens: ['wheat'],
  },
}

export const MENU_ITEM_SHORT_LABELS: Partial<Record<MenuItemKey, string>> = {
  potaufeu: 'ポトフ',
  minestrone: 'ミネスト',
  plain: 'プレーン',
  cocoa: 'ココア',
  kinako: 'きなこ',
  garlic: 'ガーリック',
  strawberry: 'いちご',
  blueberry: 'ブルーベリー',
  chocolate: 'チョコ',
  honey: 'はちみつ',
  drink_hojicha: 'ほうじ茶',
  drink_cocoa: 'ココア(飲)',
  drink_coffee: 'コーヒー',
  drink_milkcoffee: 'コーヒー牛乳',
}

export const getAdminMenuLabel = (key: MenuItemKey, fallback: string): string =>
  MENU_ITEM_SHORT_LABELS[key] ?? fallback

const MENU_VARIANT_ITEM_KEYS: Record<MenuVariantKey, ReadonlyArray<MenuItemKey>> = {
  day12: [
    'potaufeu',
    'plain',
    'cocoa',
    'kinako',
    'garlic',
    'drink_hojicha',
    'drink_cocoa',
    'drink_coffee',
    'drink_milkcoffee',
  ],
  day34: [
    'minestrone',
    'strawberry',
    'blueberry',
    'chocolate',
    'honey',
    'drink_hojicha',
    'drink_cocoa',
    'drink_coffee',
    'drink_milkcoffee',
  ],
}

const FALLBACK_MENU_VARIANT: MenuVariantKey = 'day12'

const isMenuVariantKey = (value: string): value is MenuVariantKey =>
  value === 'day12' || value === 'day34'

const envMenuVariant = (import.meta.env.VITE_MENU_VARIANT as string | undefined)?.toLowerCase()

const resolvedMenuVariant: MenuVariantKey = envMenuVariant && isMenuVariantKey(envMenuVariant)
  ? envMenuVariant
  : FALLBACK_MENU_VARIANT

export const ACTIVE_MENU_VARIANT: MenuVariantKey = resolvedMenuVariant

export const ACTIVE_MENU_ITEM_KEYS: ReadonlyArray<MenuItemKey> = MENU_VARIANT_ITEM_KEYS[resolvedMenuVariant]

export const MENU_ITEMS: Record<MenuItemKey, MenuItem> = ACTIVE_MENU_ITEM_KEYS.reduce(
  (acc, key) => {
    acc[key] = MENU_ITEM_DEFINITIONS[key]
    return acc
  },
  {} as Record<MenuItemKey, MenuItem>,
)

export const MENU_ITEM_LIST: MenuItem[] = ACTIVE_MENU_ITEM_KEYS.map((key) => MENU_ITEM_DEFINITIONS[key])

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

export interface OrdersQueryOptions {
  start?: Date
  end?: Date
  limit?: number
}

export interface OrdersSubscriptionOptions extends OrdersQueryOptions {
  autoStopWhen?: (orders: OrderDetail[]) => boolean
}