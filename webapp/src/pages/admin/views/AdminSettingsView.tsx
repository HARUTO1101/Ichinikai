import { useState } from 'react'

const themes = [
  { id: 'system', label: 'システム設定に追従' },
  { id: 'light', label: 'ライトモード' },
  { id: 'dark', label: 'ダークモード' },
]

const roles = [
  { id: 'admin', label: '管理者', enabled: true },
  { id: 'kitchen', label: 'キッチン', enabled: true },
  { id: 'cashier', label: 'キャッシャー', enabled: false },
]

export function AdminSettingsView() {
  const [selectedTheme, setSelectedTheme] = useState('system')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)

  return (
    <div className="admin-grid" style={{ gap: '24px', maxWidth: 720 }}>
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
