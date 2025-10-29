import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth, isMockMode } from '../lib/firebase'
import type { AuthErrorKey } from '../i18n/order'

export function useEnsureAnonymousAuth() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<AuthErrorKey | null>(null)

  useEffect(() => {
    if (isMockMode) {
      setReady(true)
      setError(null)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          await signInAnonymously(auth)
        }
        setReady(true)
      } catch (err) {
  console.error('匿名認証に失敗しました', err)
  setError('ANON_SIGNIN_FAILED')
      }
    })

    return () => unsubscribe()
  }, [])

  return { ready, error }
}
