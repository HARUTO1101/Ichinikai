import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth, isMockMode } from '../lib/firebase'

export function useEnsureAnonymousAuth() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setError('匿名認証に失敗しました。時間をおいて再度お試しください。')
      }
    })

    return () => unsubscribe()
  }, [])

  return { ready, error }
}
