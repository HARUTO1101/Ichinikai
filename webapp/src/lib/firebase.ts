import { initializeApp, type FirebaseApp, getApps } from 'firebase/app'
import {
  getAuth,
  type Auth,
  signInAnonymously,
  connectAuthEmulator,
} from 'firebase/auth'
import {
  getFirestore,
  type Firestore,
  connectFirestoreEmulator,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function assertConfig(config: Record<string, unknown>) {
  const missingKeys = Object.entries(config)
    .filter(([, value]) => typeof value === 'undefined')
    .map(([key]) => key)

  if (missingKeys.length > 0) {
    throw new Error(
      `Firebaseの設定値が不足しています: ${missingKeys.join(', ')}. Viteの.envファイルを確認してください。`,
    )
  }
}

const envWantsMock = import.meta.env.VITE_USE_MOCK_DATA === 'true'
const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value || value === 'undefined')
  .map(([key]) => key)
const shouldForceMock = missingConfigKeys.length > 0
const useMockData = envWantsMock || shouldForceMock
export const isMockMode = useMockData

let app: FirebaseApp | null = null
let authInstance: Auth
let dbInstance: Firestore

if (!useMockData) {
  assertConfig(firebaseConfig)
  app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  authInstance = getAuth(app)
  dbInstance = getFirestore(app)

  const shouldUseEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

  if (shouldUseEmulator) {
    connectAuthEmulator(authInstance, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(dbInstance, '127.0.0.1', 8080)
  }
} else {
  const reason = shouldForceMock
    ? `Firebase設定値が不足しているためモックモードに切り替えました（不足: ${missingConfigKeys.join(', ')}）`
    : 'モックモードが環境変数で有効化されています'
  console.info(`Firebase initialization skipped: ${reason}`)
  authInstance = {
    currentUser: null,
  } as unknown as Auth
  dbInstance = {} as Firestore
}

export const auth: Auth = authInstance
export const db: Firestore = dbInstance

export async function ensureAnonymousUser() {
  if (useMockData) return
  if (!auth.currentUser) {
    await signInAnonymously(auth)
  }
}
