import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type IdTokenResult,
  type User,
} from 'firebase/auth'
import { auth, isMockMode } from '../lib/firebase'

export type AuthRole = 'admin' | 'kitchen' | 'staff'

interface AuthContextValue {
  status: 'loading' | 'signed-out' | 'signed-in'
  user: User | null
  roles: ReadonlyArray<AuthRole>
  error: string | null
  signIn: (params: { email: string; password: string }) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (required: AuthRole | AuthRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const ALL_ROLES: AuthRole[] = ['admin', 'kitchen', 'staff']

function extractRolesFromClaims(claims: IdTokenResult['claims']): AuthRole[] {
  const roles: AuthRole[] = []
  if (claims.admin) roles.push('admin')
  if (claims.kitchen) roles.push('kitchen')
  if (claims.staff) roles.push('staff')
  return roles
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'signed-in'>(() =>
    isMockMode ? 'signed-in' : 'loading',
  )
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<ReadonlyArray<AuthRole>>(() =>
    isMockMode ? ALL_ROLES : [],
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isMockMode) {
      setStatus('signed-in')
      setUser(null)
      setRoles(ALL_ROLES)
      setError(null)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null)
        setRoles([])
        setStatus('signed-out')
        return
      }

      try {
        const tokenResult = await nextUser.getIdTokenResult(true)
        const nextRoles = extractRolesFromClaims(tokenResult.claims)
        setUser(nextUser)
        setRoles(nextRoles)
        setStatus('signed-in')
        setError(null)
      } catch (tokenError) {
        console.error('Failed to refresh token claims', tokenError)
        setUser(nextUser)
        setRoles([])
        setStatus('signed-in')
        setError('ロール情報の取得に失敗しました。再読み込みしてください。')
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    setError(null)
    if (isMockMode) {
      setStatus('signed-in')
      setUser(null)
      setRoles(ALL_ROLES)
      return
    }

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      console.error('Failed to sign in', err)
      const message = err instanceof Error ? err.message : 'サインインに失敗しました。'
      setError(message)
      throw err
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    if (isMockMode) {
      setStatus('signed-out')
      setUser(null)
      setRoles([])
      return
    }

    await firebaseSignOut(auth)
  }, [])

  const hasRole = useCallback(
    (required: AuthRole | AuthRole[]) => {
      const requiredRoles = Array.isArray(required) ? required : [required]
      if (requiredRoles.length === 0) return true
      if (isMockMode) return true
      return requiredRoles.some((role) => roles.includes(role))
    },
    [roles],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, roles, error, signIn, signOut, hasRole }),
    [error, hasRole, roles, signIn, signOut, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
