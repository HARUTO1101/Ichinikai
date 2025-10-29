import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { type SupportedLanguage, useLanguage } from './context/LanguageContext'
import { ORDER_TEXT } from './i18n/order'
import './App.css'

function NotFound() {
  const { language } = useLanguage()
  const texts = ORDER_TEXT[language]
  return (
    <div className="not-found">
      <h1>{texts.notFound.title}</h1>
      <p>{texts.notFound.description}</p>
    </div>
  )
}

function App() {
  const location = useLocation()
  const { language, setLanguage } = useLanguage()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const isKitchenRoute = location.pathname.startsWith('/kitchen')
  const shouldShowToasts = isAdminRoute || isKitchenRoute
  const viewLanguage = isAdminRoute || isKitchenRoute ? 'ja' : language
  const texts = ORDER_TEXT[viewLanguage]
  const toggleTexts = ORDER_TEXT[language].languageToggle
  const shellClassName = ['app-shell', isAdminRoute ? 'app-shell--wide' : '']
    .filter(Boolean)
    .join(' ')
  const toastVariant = isAdminRoute ? 'light' : 'dark'
  const showLanguageToggle = !isAdminRoute && !isKitchenRoute
  const isPublicView = showLanguageToggle
  const brandSubtitle = viewLanguage === 'en' ? 'Mobile ordering system' : 'モバイル注文システム'
  const nextLanguage: SupportedLanguage = language === 'ja' ? 'en' : 'ja'
  const handleLanguageToggle = () => {
    setLanguage(nextLanguage)
  }

  return (
    <OrderToastProvider>
      <OrderFlowProvider>
        <div className={shellClassName}>
          <header
            className={[
              'app-header',
              isPublicView ? 'app-header--public' : 'app-header--internal',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {isPublicView ? (
              <div className="header-row">
                <div className="header-brand-group">
                  <img
                    className="header-brand-character"
                    src="/header/キャラクターイラスト.png"
                    alt={texts.header.characterAlt}
                  />
                  <div className="header-title-block">
                    <img
                      className="header-title-image"
                      src="/header/ヘッダータイトル.png"
                      alt={texts.header.titleAlt}
                    />
                    {showLanguageToggle && (
                      <button
                        type="button"
                        className="language-switch"
                        onClick={handleLanguageToggle}
                        aria-label={toggleTexts.buttonAria(nextLanguage)}
                      >
                        {toggleTexts.buttonText}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="header-internal">
                <div className="brand">
                  <span aria-hidden="true" className="brand-icon">
                    🧇
                  </span>
                  <div className="brand-text">
                    <span className="brand-title">学園祭キッチンカー</span>
                    <span className="brand-subtitle">{brandSubtitle}</span>
                  </div>
                </div>
              </div>
            )}
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
              &copy; {new Date().getFullYear()} Hakuto Tanaka and Haruto Otsuka. All rights
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
