export type OrderProgress = '受注済み' | '調理済み' | 'クローズ'
export type OrderPayment = '未払い' | '支払い済み' | 'キャンセル'

export interface OrderRow {
  id: string
  callNumber: number
  ticket: string
  items: string
  total: number
  payment: OrderPayment
  progress: OrderProgress
  createdAt: string
  customer?: string
  note?: string
}

export const progressStages: ReadonlyArray<OrderProgress> = ['受注済み', '調理済み', 'クローズ'] as const

export const dummyOrders: OrderRow[] = [
  {
    id: '#1083',
    callNumber: 208,
    ticket: 'T-1248',
    items: 'ワッフル（2）／アイスコーヒー（1）',
    total: 3200,
    payment: '未払い',
    progress: '調理済み',
    createdAt: '10:24',
    customer: '山田',
    note: 'アイスコーヒーは氷少なめ',
  },
  {
    id: '#1082',
    callNumber: 207,
    ticket: 'T-1247',
    items: 'ホットサンド（1）',
    total: 900,
    payment: '支払い済み',
    progress: '調理済み',
    createdAt: '10:20',
    customer: '佐藤',
  },
  {
    id: '#1081',
    callNumber: 206,
    ticket: 'T-1246',
    items: 'ワッフル（1）／ジンジャーエール（2）',
    total: 2100,
    payment: '未払い',
    progress: '受注済み',
    createdAt: '10:18',
    customer: '田中',
  },
  {
    id: '#1079',
    callNumber: 205,
    ticket: 'T-1244',
    items: 'ワッフル（3）',
    total: 2700,
    payment: '支払い済み',
    progress: 'クローズ',
    createdAt: '10:10',
    customer: '森',
  },
  {
    id: '#1078',
    callNumber: 204,
    ticket: 'T-1243',
    items: '抹茶ラテ（2）／クロワッサン（2）',
    total: 2200,
    payment: '未払い',
    progress: '調理済み',
    createdAt: '10:06',
    customer: '高橋',
    note: 'クロワッサンは紙袋別添',
  },
  {
    id: '#1076',
    callNumber: 203,
    ticket: 'T-1241',
    items: 'チュロス（3）／ホットココア（2）',
    total: 2600,
    payment: '未払い',
    progress: '受注済み',
    createdAt: '09:58',
  },
]

export function getInitialOrders(): OrderRow[] {
  return dummyOrders.map((order) => ({ ...order }))
}
