import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth, type AuthRole } from '../../context/AuthContext'
import './RoleGuard.css'

interface RoleGuardProps {
  children: ReactNode
  required: AuthRole | AuthRole[]
  title?: string
  description?: string
}

export function RoleGuard({ children, required, title, description }: RoleGuardProps) {
  const { status, error, signIn, signOut, hasRole } = useAuth()
  const requiredRoles = useMemo(() => (Array.isArray(required) ? required : [required]), [required])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const roleLabelMap: Record<AuthRole, string> = useMemo(
    () => ({
      admin: '管理者',
      kitchen: 'キッチン',
      staff: 'スタッフ',
    }),
    [],
  )

  const requiredLabel = useMemo(
    () => requiredRoles.map((role) => roleLabelMap[role]).join(', '),
    [requiredRoles, roleLabelMap],
  )

  useEffect(() => {
    if (status === 'signed-out') {
      setEmail('')
      setPassword('')
      setSubmitting(false)
      setFormError(null)
    }
  }, [status])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password) {
      setFormError('メールアドレスとパスワードを入力してください')
      return
    }

    setFormError(null)
    setSubmitting(true)
    try {
      await signIn({ email, password })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'サインインに失敗しました。もう一度お試しください。'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const isAuthorized = useMemo(() => hasRole(requiredRoles), [hasRole, requiredRoles])

  if (status === 'loading') {
    return (
      <div className="role-guard">
        <div className="role-guard-card">
          <p className="role-guard-status">認証情報を確認しています…</p>
        </div>
      </div>
    )
  }

  if (status === 'signed-out') {
    return (
      <div className="role-guard">
        <div className="role-guard-card">
          <h1>{title ?? 'ログインが必要です'}</h1>
          <p className="role-guard-description">
            {description ?? `このページにアクセスするには ${requiredLabel} 権限が必要です。`}
          </p>
          <form className="role-guard-form" onSubmit={handleSubmit}>
            <label className="role-guard-field">
              <span>メールアドレス</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="admin@example.com"
              />
            </label>
            <label className="role-guard-field">
              <span>パスワード</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="パスワード"
              />
            </label>
            {(formError || error) && (
              <p className="role-guard-error">{formError ?? error}</p>
            )}
            <button type="submit" className="button primary" disabled={submitting}>
              {submitting ? 'サインイン中…' : 'サインイン'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="role-guard">
        <div className="role-guard-card">
          <h1>アクセス権限がありません</h1>
          <p className="role-guard-description">
            {requiredLabel} 権限を持つアカウントでサインインしてください。
          </p>
          {(formError || error) && <p className="role-guard-error">{formError ?? error}</p>}
          <button type="button" className="button secondary" onClick={() => signOut()}>
            サインアウトして別のアカウントでログイン
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
