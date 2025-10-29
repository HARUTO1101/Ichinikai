import {
  createOrderFirebase,
  exportOrdersCsvFirebase,
  fetchOrderByTicketFirebase,
  fetchOrderDetailFirebase,
  fetchKitchenOrdersFirebase,
  subscribeNewOrdersFirebase,
  subscribeOrdersFirebase,
  subscribeOrderLookupFirebase,
  searchOrderByTicketOrIdFirebase,
  updateOrderStatusFirebase,
  updateOrderPlatingFirebase,
} from './orders/firebase'
import {
  createOrderMock,
  exportOrdersCsvMock,
  fetchOrderByTicketMock,
  fetchOrderDetailMock,
  fetchKitchenOrdersMock,
  subscribeNewOrdersMock,
  subscribeOrdersMock,
  subscribeOrderLookupMock,
  getMockOrders,
  resetMockData,
  searchOrderByTicketOrIdMock,
  seedMockOrders,
  updateOrderStatusMock,
  updateOrderPlatingMock,
} from './orders/mock'

const firebaseConfigValues = [
  import.meta.env.VITE_FIREBASE_API_KEY,
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  import.meta.env.VITE_FIREBASE_APP_ID,
]

const missingFirebaseConfig = firebaseConfigValues.some(
  (value) => !value || value === 'undefined',
)

const useMock = import.meta.env.VITE_USE_MOCK_DATA === 'true' || missingFirebaseConfig

const createOrderImpl = useMock ? createOrderMock : createOrderFirebase
const fetchOrderByTicketImpl = useMock
  ? fetchOrderByTicketMock
  : fetchOrderByTicketFirebase
const fetchOrderDetailImpl = useMock
  ? fetchOrderDetailMock
  : fetchOrderDetailFirebase
const updateOrderStatusImpl = useMock
  ? updateOrderStatusMock
  : updateOrderStatusFirebase
const updateOrderPlatingImpl = useMock
  ? updateOrderPlatingMock
  : updateOrderPlatingFirebase
const searchOrderByTicketOrIdImpl = useMock
  ? searchOrderByTicketOrIdMock
  : searchOrderByTicketOrIdFirebase
const exportOrdersCsvImpl = useMock ? exportOrdersCsvMock : exportOrdersCsvFirebase
const fetchKitchenOrdersImpl = useMock
  ? fetchKitchenOrdersMock
  : fetchKitchenOrdersFirebase
const subscribeNewOrdersImpl = useMock
  ? subscribeNewOrdersMock
  : subscribeNewOrdersFirebase
const subscribeOrdersImpl = useMock ? subscribeOrdersMock : subscribeOrdersFirebase
const subscribeOrderLookupImpl = useMock
  ? subscribeOrderLookupMock
  : subscribeOrderLookupFirebase

export const isMockDataEnabled = useMock

export const mockControls = useMock
  ? {
      reset: resetMockData,
      list: getMockOrders,
      seed: seedMockOrders,
    }
  : null

export const createOrder = createOrderImpl

export const fetchOrderByTicket = fetchOrderByTicketImpl

export const fetchOrderDetail = fetchOrderDetailImpl

export const updateOrderStatus = updateOrderStatusImpl
export const updateOrderPlating = updateOrderPlatingImpl

export const searchOrderByTicketOrId = searchOrderByTicketOrIdImpl

export const exportOrdersCsv = exportOrdersCsvImpl

export const fetchKitchenOrders = fetchKitchenOrdersImpl

export const subscribeNewOrders = subscribeNewOrdersImpl

export const subscribeOrders = subscribeOrdersImpl

export const subscribeOrderLookup = subscribeOrderLookupImpl
