import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, type AuthRole } from '../../context/AuthContext'
import { AdminDashboardView } from './views/AdminDashboardView'
import { AdminOrdersView } from './views/AdminOrdersView'
import { AdminProductionView } from './views/AdminProductionView'
import { AdminPaymentsView } from './views/AdminPaymentsView'
import { AdminReceptionView } from './views/AdminReceptionView'
import { AdminServingView } from './views/AdminServingView'
import { AdminSettingsView } from './views/AdminSettingsView'
import { AdminCashAuditView } from './views/AdminCashAuditView'
import './AdminPage.css'

const menuItems = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    path: '/admin/dashboard',
    icon: '📊',
    allowedRoles: ['admin'],
  },
  {
    id: 'orders',
    label: '注文一覧',
    path: '/admin/orders',
    icon: '🗂️',
    allowedRoles: ['admin'],
  },
  {
    id: 'production',
    label: '盛り付け',
    path: '/admin/production',
    icon: '🥞',
    allowedRoles: ['admin', 'staff'],
  },
  {
    id: 'serving',
    label: '提供フロー',
    path: '/admin/serving',
    icon: '🍽️',
    allowedRoles: ['admin', 'staff'],
  },
  {
    id: 'payments',
    label: '支払いフロー',
    path: '/admin/payments',
    icon: '💳',
    allowedRoles: ['admin', 'staff'],
  },
  {
    id: 'cash-audit',
    label: '会計点検',
    path: '/admin/cash-audit',
    icon: '💴',
    allowedRoles: ['admin'],
  },
  {
    id: 'reception',
    label: '受付設定',
    path: '/admin/reception',
    icon: '🎫',
    allowedRoles: ['admin'],
  },
  {
    id: 'export',
    label: 'エクスポート',
    path: '/admin/export',
    icon: '📤',
    allowedRoles: ['admin'],
  },
  {
    id: 'settings',
    label: '設定',
    path: '/admin/settings',
    icon: '⚙️',
    allowedRoles: ['admin'],
  },
] as const

export function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()
  const { roles, signOut } = useAuth()

  const hasAnyRole = useCallback(
    (allowedRoles: ReadonlyArray<AuthRole>) =>
      allowedRoles.some((role) => roles.includes(role)),
    [roles],
  )

  const accessibleMenuItems = useMemo(
    () => menuItems.filter((item) => hasAnyRole(item.allowedRoles)),
    [hasAnyRole],
  )

  const fallbackPath = accessibleMenuItems[0]?.path ?? '/admin'

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const activeItem = useMemo(() => {
    const matchedAccessible = accessibleMenuItems.find((item) =>
      location.pathname.startsWith(item.path),
    )
    if (matchedAccessible) return matchedAccessible
    return menuItems.find((item) => location.pathname.startsWith(item.path)) ?? null
  }, [accessibleMenuItems, location.pathname])

  useEffect(() => {
    if (!activeItem) return
    if (!hasAnyRole(activeItem.allowedRoles) && accessibleMenuItems.length > 0) {
      navigate(accessibleMenuItems[0].path, { replace: true })
    }
  }, [activeItem, accessibleMenuItems, hasAnyRole, navigate])

  const isSidebarVisible = sidebarPinned || sidebarOpen

  const handleToggleSidebarPinned = () => {
    setSidebarPinned((prev) => !prev)
    setSidebarOpen(false)
  }

  const handleSignOut = () => {
    void signOut()
  }

  const orderedRoles: AuthRole[] = ['admin', 'kitchen', 'staff']

  const shellClassName = [
    'admin-shell',
    sidebarPinned ? 'sidebar-pinned' : '',
    sidebarOpen ? 'sidebar-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClassName}>
      <button
        type="button"
        className="admin-hamburger"
        aria-controls="admin-sidebar"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((prev) => !prev)}
      >
        <span className="admin-hamburger-bar" />
        <span className="admin-hamburger-bar" />
        <span className="admin-hamburger-bar" />
        <span className="sr-only">メニューを開閉</span>
      </button>
      <aside
        id="admin-sidebar"
        className={`admin-sidebar${isSidebarVisible ? ' open' : ''}${sidebarPinned ? ' pinned' : ''}`}
      >
        <div className="admin-sidebar-header">
          <div>
            <p className="admin-sidebar-title">管理メニュー</p>
            <p className="admin-sidebar-subtitle">
              本番運用向けの監視・更新ツールです。
            </p>
          </div>
        </div>
        <nav aria-label="管理メニュー" className="admin-sidebar-nav">
          <ul>
            {accessibleMenuItems.map((item) => {
              const isActive = activeItem?.id === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`admin-nav-button${isActive ? ' active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <span aria-hidden className="admin-nav-icon">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" className="admin-logout-button" onClick={handleSignOut}>
            <span aria-hidden className="admin-nav-icon">🚪</span>
            <span>ログアウト</span>
          </button>
          <p className="admin-roles">
            ロール:{' '}
            {orderedRoles.map((role) => {
              const isActive = roles.includes(role)
              return (
                <span
                  key={role}
                  className={`admin-badge${isActive ? '' : ' muted'}`}
                >
                  {role}
                </span>
              )
            })}
          </p>
        </div>
      </aside>
      <div className="admin-content">
        <header className="admin-content-header">
          <div>
            <p className="admin-content-overline">{activeItem?.label ?? '管理'}モード</p>
            <h1>{activeItem?.label ?? '管理画面'}</h1>
          </div>
          <div className="admin-header-actions">
            <button
              type="button"
              className={`admin-sidebar-toggle${sidebarPinned ? '' : ' is-collapsed'}`}
              onClick={handleToggleSidebarPinned}
            >
              <span className="dot" aria-hidden />
              {sidebarPinned ? 'メニューを隠す' : 'メニューを固定'}
            </button>
          </div>
        </header>
        <section className="admin-content-main">
          <Routes>
            <Route index element={<Navigate to={fallbackPath} replace />} />
            <Route
              path="dashboard"
              element={
                hasAnyRole(['admin']) ? <AdminDashboardView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="orders"
              element={
                hasAnyRole(['admin']) ? <AdminOrdersView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="production"
              element={
                hasAnyRole(['admin', 'staff']) ? (
                  <AdminProductionView />
                ) : (
                  <Navigate to={fallbackPath} replace />
                )
              }
            />
            <Route
              path="serving"
              element={
                hasAnyRole(['admin', 'staff']) ? <AdminServingView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="payments"
              element={
                hasAnyRole(['admin', 'staff']) ? <AdminPaymentsView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="cash-audit"
              element={
                hasAnyRole(['admin']) ? <AdminCashAuditView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="reception"
              element={
                hasAnyRole(['admin']) ? <AdminReceptionView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route
              path="export"
              element={
                hasAnyRole(['admin']) ? (
                  <AdminDashboardView mode="export" />
                ) : (
                  <Navigate to={fallbackPath} replace />
                )
              }
            />
            <Route
              path="settings"
              element={
                hasAnyRole(['admin']) ? <AdminSettingsView /> : <Navigate to={fallbackPath} replace />
              }
            />
            <Route path="*" element={<Navigate to={fallbackPath} replace />} />
          </Routes>
        </section>
      </div>
    </div>
  )
}
