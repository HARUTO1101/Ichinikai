import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { StatusPage } from './pages/StatusPage'
import { OrderFlowProvider } from './context/OrderFlowContext'
import { OrderToastProvider } from './context/OrderToastContext'
import { OrderInputPage } from './pages/OrderInputPage'
import { OrderReviewPage } from './pages/OrderReviewPage'
import { OrderCompletePage } from './pages/OrderCompletePage'
import { OrderProgressPage } from './pages/OrderProgressPage'
import { TicketNotFoundPage } from './pages/TicketNotFoundPage'
import { KitchenDashboardPage } from './pages/KitchenDashboardPage'
import { OrderToastViewport } from './components/OrderToastViewport'
import { RoleGuard } from './components/auth/RoleGuard'
import './App.css'

const navItems = [
  { to: '/admin', label: '管理者ページ' },
  { to: '/kitchen', label: 'キッチン用' },
]

const actionItems = (
  [
    { to: '/order', label: '注文する', variant: 'primary' },
  ] as const
)

function NotFound() {
  return (
    <div className="not-found">
      <h1>ページが見つかりません</h1>
      <p>URLをご確認のうえ、ナビゲーションから移動してください。</p>
    </div>
  )
}

function App() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isKitchenRoute = location.pathname.startsWith('/kitchen')
  const shouldShowToasts = isAdminRoute || isKitchenRoute
  const shellClassName = ['app-shell', isAdminRoute ? 'app-shell--wide' : '']
    .filter(Boolean)
    .join(' ')
  const toastVariant = isAdminRoute ? 'light' : 'dark'

  return (
    <OrderToastProvider>
      <OrderFlowProvider>
        <div className={shellClassName}>
          <header className="app-header">
          <div className="brand">
            <span aria-hidden="true" className="brand-icon">
              🧇
            </span>
            <div className="brand-text">
              <span className="brand-title">学園祭キッチンカー</span>
              <span className="brand-subtitle">モバイル注文システム</span>
            </div>
          </div>
          <div className="header-right">
            {navItems.length > 0 && (
              <nav className="main-nav" aria-label="主要メニュー">
                <ul>
                  {navItems.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        className={({ isActive }) =>
                          isActive ? 'nav-link active' : 'nav-link'
                        }
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className="header-actions" role="group" aria-label="注文操作">
              {actionItems.map((action) => (
                <NavLink
                  key={action.to}
                  to={action.to}
                  className={({ isActive }) =>
                    [
                      'button',
                      'header-action',
                      action.variant,
                      isActive ? 'active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                >
                  {action.label}
                </NavLink>
              ))}
            </div>
          </div>
        </header>
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Navigate to="/order" replace />} />
              <Route path="/order" element={<OrderInputPage />} />
              <Route path="/order/review" element={<OrderReviewPage />} />
              <Route path="/order/complete" element={<OrderCompletePage />} />
              <Route path="/order/complete/:ticket" element={<OrderCompletePage />} />
              <Route path="/order/not-found" element={<TicketNotFoundPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/progress" element={<OrderProgressPage />} />
              <Route path="/progress/:ticket" element={<OrderProgressPage />} />
              <Route
                path="/kitchen"
                element={
                  <RoleGuard
                    required="kitchen"
                    title="キッチン専用ページ"
                    description="調理チームメンバーのアカウントでサインインしてください。"
                  >
                    <KitchenDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <RoleGuard
                    required={["admin", "staff"]}
                    title="管理画面へのアクセス"
                    description="管理者またはスタッフ権限を持つアカウントでサインインしてください。"
                  >
                    <AdminPage />
                  </RoleGuard>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <footer className="app-footer">
            <p>
              &copy; {new Date().getFullYear()} 学園祭キッチンカー実行委員会. All rights
              reserved.
            </p>
          </footer>
        </div>
        {shouldShowToasts && (
          <OrderToastViewport variant={toastVariant} ariaLabel="新着通知" />
        )}
      </OrderFlowProvider>
    </OrderToastProvider>
  )
}

export default App
