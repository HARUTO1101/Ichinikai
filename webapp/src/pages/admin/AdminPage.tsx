import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AdminDashboardView } from './views/AdminDashboardView'
import { AdminOrdersView } from './views/AdminOrdersView'
import { AdminProductionView } from './views/AdminProductionView'
import { AdminPaymentsView } from './views/AdminPaymentsView'
import { AdminReceptionView } from './views/AdminReceptionView'
import { AdminServingView } from './views/AdminServingView'
import { AdminSettingsView } from './views/AdminSettingsView'
import './AdminPage.css'

const menuItems = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    path: '/admin/dashboard',
    icon: '📊',
  },
  {
    id: 'orders',
    label: '注文一覧',
    path: '/admin/orders',
    icon: '🗂️',
  },
  {
    id: 'production',
    label: '制作フロー',
    path: '/admin/production',
    icon: '🥞',
  },
  {
    id: 'serving',
    label: '提供フロー',
    path: '/admin/serving',
    icon: '🍽️',
  },
  {
    id: 'payments',
    label: '支払いフロー',
    path: '/admin/payments',
    icon: '💳',
  },
  {
    id: 'reception',
    label: '受付設定',
    path: '/admin/reception',
    icon: '🎫',
  },
  {
    id: 'export',
    label: 'エクスポート',
    path: '/admin/export',
    icon: '📤',
  },
  {
    id: 'settings',
    label: '設定',
    path: '/admin/settings',
    icon: '⚙️',
  },
] as const

export function AdminPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarPinned, setSidebarPinned] = useState(true)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const activeItem = useMemo(
    () => menuItems.find((item) => location.pathname.startsWith(item.path)),
    [location.pathname],
  )

  const isSidebarVisible = sidebarPinned || sidebarOpen

  const handleToggleSidebarPinned = () => {
    setSidebarPinned((prev) => !prev)
    setSidebarOpen(false)
  }

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
            {menuItems.map((item) => {
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
          <button type="button" className="admin-logout-button">
            <span aria-hidden className="admin-nav-icon">🚪</span>
            <span>ログアウト</span>
          </button>
          <p className="admin-roles">
            ロール: <span className="admin-badge">admin</span>{' '}
            <span className="admin-badge muted">kitchen</span>{' '}
            <span className="admin-badge muted">cashier</span>
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
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardView />} />
            <Route path="orders" element={<AdminOrdersView />} />
            <Route path="production" element={<AdminProductionView />} />
            <Route path="serving" element={<AdminServingView />} />
            <Route path="payments" element={<AdminPaymentsView />} />
            <Route path="reception" element={<AdminReceptionView />} />
            <Route path="export" element={<AdminDashboardView mode="export" />} />
            <Route path="settings" element={<AdminSettingsView />} />
            <Route path="*" element={<AdminDashboardView />} />
          </Routes>
        </section>
      </div>
    </div>
  )
}
