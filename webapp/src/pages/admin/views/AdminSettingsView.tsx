import { useEffect, useState } from 'react'
import { triggerKitchenToastTest } from '../../../events/kitchenToastTest'
import { useMenuConfig } from '../../../hooks/useMenuConfig'
import { type MenuItemKey } from '../../../types/order'

const themes = [
  { id: 'system', label: 'システム設定に追従' },
  { id: 'light', label: 'ライトモード' },
  { id: 'dark', label: 'ダークモード' },
]

const roles = [
  { id: 'admin', label: '管理者', enabled: true },
  { id: 'kitchen', label: 'キッチン', enabled: true },
  { id: 'staff', label: 'スタッフ', enabled: false },
]

interface MenuDraft {
  label: string
  price: string
}

interface FeedbackMessage {
  type: 'success' | 'error'
  message: string
}

export function AdminSettingsView() {
  const [selectedTheme, setSelectedTheme] = useState('system')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const {
    menuItems,
    baseMenuItemMap,
    overrides,
    updateMenuItem,
    resetMenuItem,
    resetAllMenuItems,
  } = useMenuConfig()
  const [drafts, setDrafts] = useState<Record<MenuItemKey, MenuDraft>>({})
  const [itemFeedback, setItemFeedback] = useState<Record<MenuItemKey, FeedbackMessage | null>>({})
  const [globalFeedback, setGlobalFeedback] = useState<FeedbackMessage | null>(null)

  useEffect(() => {
    setDrafts(
      menuItems.reduce((acc, item) => {
        acc[item.key] = { label: item.label, price: String(item.price) }
        return acc
      }, {} as Record<MenuItemKey, MenuDraft>),
    )
  }, [menuItems])

  const handleDraftChange = (key: MenuItemKey, field: keyof MenuDraft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }))
    setItemFeedback((prev) => ({
      ...prev,
      [key]: null,
    }))
    setGlobalFeedback(null)
  }

  const handleSave = async (key: MenuItemKey) => {
    const draft = drafts[key]
    if (!draft) return

    const label = draft.label.trim()
    if (!label) {
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'error', message: '商品名を入力してください。' },
      }))
      return
    }
    if (label.length > 40) {
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'error', message: '商品名は40文字以内で入力してください。' },
      }))
      return
    }

    const priceValue = Number(draft.price)
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'error', message: '価格には0以上の数値を入力してください。' },
      }))
      return
    }

    const normalizedPrice = Math.round(priceValue)

    try {
      await updateMenuItem(key, { label, price: normalizedPrice })
      setDrafts((prev) => ({
        ...prev,
        [key]: { label, price: String(normalizedPrice) },
      }))
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'success', message: '保存しました。' },
      }))
      setGlobalFeedback(null)
    } catch (error) {
      console.error('メニュー設定の保存に失敗しました', error)
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'error', message: '保存に失敗しました。もう一度お試しください。' },
      }))
    }
  }

  const handleResetItem = async (key: MenuItemKey) => {
    setGlobalFeedback(null)
    const hasOverride = Boolean(overrides[key])
    if (!hasOverride) {
      const current = menuItems.find((item) => item.key === key)
      if (!current) return
      setDrafts((prev) => ({
        ...prev,
        [key]: { label: current.label, price: String(current.price) },
      }))
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'success', message: '変更を取り消しました。' },
      }))
      return
    }

    try {
      await resetMenuItem(key)
      const base = baseMenuItemMap[key]
      setDrafts((prev) => ({
        ...prev,
        [key]: { label: base.label, price: String(base.price) },
      }))
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'success', message: '初期設定に戻しました。' },
      }))
    } catch (error) {
      console.error('メニュー設定のリセットに失敗しました', error)
      setItemFeedback((prev) => ({
        ...prev,
        [key]: { type: 'error', message: '初期設定に戻せませんでした。' },
      }))
    }
  }

  const handleResetAll = async () => {
    setGlobalFeedback(null)
    const hasAnyOverride = Object.keys(overrides).length > 0
    if (!hasAnyOverride) {
      setGlobalFeedback({ type: 'success', message: '現在、変更はありません。' })
      return
    }

    try {
      await resetAllMenuItems()
      setDrafts(
        Object.entries(baseMenuItemMap).reduce((acc, [key, item]) => {
          acc[key as MenuItemKey] = { label: item.label, price: String(item.price) }
          return acc
        }, {} as Record<MenuItemKey, MenuDraft>),
      )
  setItemFeedback(() => ({} as Record<MenuItemKey, FeedbackMessage | null>))
      setGlobalFeedback({ type: 'success', message: '全てのメニューを初期設定に戻しました。' })
    } catch (error) {
      console.error('メニュー設定の全リセットに失敗しました', error)
      setGlobalFeedback({ type: 'error', message: 'リセットに失敗しました。もう一度お試しください。' })
    }
  }

  return (
    <div className="admin-grid" style={{ gap: '24px', maxWidth: 720 }}>
      <section className="admin-card">
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>メニュー設定</h3>
            <p style={{ margin: '4px 0 0', color: '#475569' }}>
              商品名と価格を編集すると、注文画面やダッシュボードに即時反映されます。
            </p>
          </div>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => {
              void handleResetAll()
            }}
          >
            すべて初期設定に戻す
          </button>
        </header>
        {globalFeedback && (
          <p
            role="status"
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: globalFeedback.type === 'success' ? '#ecfdf5' : '#fee2e2',
              color: globalFeedback.type === 'success' ? '#047857' : '#b91c1c',
            }}
          >
            {globalFeedback.message}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {menuItems.map((item) => {
            const draft = drafts[item.key]
            const base = baseMenuItemMap[item.key]
            const feedbackMessage = itemFeedback[item.key]
            const savedPrice = String(item.price)
            const isDirty = draft
              ? draft.label !== item.label || draft.price !== savedPrice
              : false
            const hasOverride = Boolean(overrides[item.key])

            return (
              <article
                key={item.key}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0 }}>{item.label}</h4>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>ID: {item.key}</p>
                  </div>
                  {hasOverride && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '4px 10px',
                        borderRadius: 999,
                        backgroundColor: '#1e40af',
                        color: '#eff6ff',
                        fontSize: '0.85rem',
                      }}
                    >
                      カスタム適用中
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>商品名</span>
                    <input
                      type="text"
                      value={draft?.label ?? ''}
                      onChange={(event) => handleDraftChange(item.key, 'label', event.target.value)}
                      placeholder={base.label}
                      style={{
                        borderRadius: 8,
                        border: '1px solid #cbd5f5',
                        padding: '10px 12px',
                        fontSize: '1rem',
                      }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontWeight: 600 }}>税込価格 (円)</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={draft?.price ?? ''}
                      onChange={(event) => handleDraftChange(item.key, 'price', event.target.value)}
                      style={{
                        borderRadius: 8,
                        border: '1px solid #cbd5f5',
                        padding: '10px 12px',
                        fontSize: '1rem',
                      }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    type="button"
                    className="admin-primary-button"
                    onClick={() => {
                      void handleSave(item.key)
                    }}
                    disabled={!isDirty}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => {
                      void handleResetItem(item.key)
                    }}
                  >
                    {hasOverride ? '初期設定に戻す' : '変更を取り消す'}
                  </button>
                  <span style={{ color: '#64748b', alignSelf: 'center', fontSize: '0.9rem' }}>
                    初期設定: {base.label}（¥{base.price.toLocaleString()}）
                  </span>
                </div>
                {feedbackMessage && (
                  <p
                    role="status"
                    style={{
                      margin: 0,
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor:
                        feedbackMessage.type === 'success' ? '#ecfdf5' : '#fee2e2',
                      color: feedbackMessage.type === 'success' ? '#047857' : '#b91c1c',
                    }}
                  >
                    {feedbackMessage.message}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      </section>
      <section className="admin-card">
        <h3>表示設定</h3>
        <p>夜間の屋外運用でも見やすいテーマを選択できます。</p>
        <div className="admin-list">
          {themes.map((theme) => (
            <label key={theme.id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                type="radio"
                name="theme"
                value={theme.id}
                checked={selectedTheme === theme.id}
                onChange={() => setSelectedTheme(theme.id)}
              />
              {theme.label}
            </label>
          ))}
        </div>
      </section>

      <section className="admin-card">
        <h3>通知</h3>
        <div className="admin-list">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => setNotificationsEnabled(event.target.checked)}
            />
            新規注文をブラウザ通知で受け取る
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            新規注文時にサウンドを鳴らす
          </label>
          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => triggerKitchenToastTest()}
          >
            トースト通知をテスト表示
          </button>
        </div>
      </section>

      <section className="admin-card">
        <h3>ロールと権限</h3>
        <p>サイドバーに表示するロールの可視化設定です。Firestore のカスタムクレームと同期されます。</p>
        <ul className="admin-list" style={{ margin: 0 }}>
          {roles.map((role) => (
            <li key={role.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0 }}>{role.label}</p>
                <small style={{ color: '#64748b' }}>ID: {role.id}</small>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" defaultChecked={role.enabled} /> 表示
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
