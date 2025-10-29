# 学園祭キッチンカー注文システム 要件定義書

## 1. 背景・目的
- 学園祭の短期イベントで、来場者がスマホから商品を注文し、支払い・進捗を確認できる仕組みを提供する。
- Google アカウント不要・クロスブラウザ対応を満たすため、GASは使わず **Firebase（Firestore／Auth）＋GitHub Pages（静的フロント）**で構築する。
- 運営は管理画面から、**QRコード読取**または**チケット番号入力**で対象注文を特定し、**準備状況（progress）**と**支払い状況（payment）**を更新できる。

## 2. スコープ
- **対象**：注文作成、注文進捗の閲覧、運営による進捗・支払い更新、最低限の管理・運用。
- **非対象**：オンライン決済の導入、在庫・厨房オペレーション最適化、分析ダッシュボード。

## 3. 利用者・ユースケース

### 来場者
- 商品と数量を選択し注文する。
- 注文完了時に**注文番号**と**チケット（ランダム16桁）**を受け取り控える。
- チケットで**支払い状況**と**準備状況**を照会。

### 運営
- 管理者ログイン（Firebase Auth）。
- QRコードまたはチケット番号で注文を検索。
- **payment**（未払い／支払い済み）と **progress**（受注済み／調理中／受取可／クローズ）を変更し保存。
- 必要に応じて注文CSVをエクスポート。

## 4. 非機能要件
- **可用性**：学園祭期間（数日）、同時数十アクセス程度。
- **性能**：フォーム操作後 1〜2 秒程度で応答。
- **互換性**：iOS/Android/PC主要ブラウザ対応。
- **セキュリティ**：来場者は匿名利用、ticketは十分長い乱数。管理更新は admin クレーム保有者のみ。
- **コスト**：Firestore 無料枠内で運用想定。

## 5. システム構成
- **フロント（GitHub Pages）**
  - 注文ページ（数量変更で合計金額自動計算）
  - 進捗照会ページ
  - 管理ページ（ログイン、QR読取、状態更新）
- **Firebase**
  - Auth：匿名認証（利用者）、メール／パスワード（運営）
  - Firestore：注文情報保存・公開ミラー
  - （任意）Cloud Functions：金額再計算・入力検証

## 6. データモデル

### `orders/{orderId}`
| フィールド | 型 | 説明 |
|---|---|---|
| orderId | string | 例：`ORD-YYYYMMDDhhmmss-ABCD` |
| createdBy | string | 匿名UID |
| items | map<number> | `{plain, cocoa, kinako, garlic, potaufeu}` |
| total | number | 合計金額 |
| payment | string | `"未払い"`／`"支払い済み"` |
| progress | string | `"受注済み"`／`"調理中"`／`"受取可"`／`"クローズ"` |
| ticket | string | 16桁ランダム |
| createdAt | timestamp | 作成時刻 |
| updatedAt | timestamp | 更新時刻 |

### `orderLookup/{ticket}`
| フィールド | 型 | 説明 |
|---|---|---|
| orderId | string | 紐付く注文ID |
| items | map<number> | 公開に必要な最小限 |
| total | number | 合計金額 |
| payment | string | 支払い状態 |
| progress | string | 準備状況 |
| updatedAt | timestamp | 更新時刻 |

> `orders` と `orderLookup` は同時作成・同時更新。

## 7. 画面要件

### 注文ページ
- 商品数量を変更すると**リアルタイムに合計金額を計算表示**。
- 注文成功時に**注文番号とticket**を表示、QRコードも生成。
- ticketはユーザーが保存し、後で照会に使用。

### 進捗照会
- ticket入力フォーム（任意でQRスキャンも可）。
- Firestoreから該当注文を取得し、payment・progressを表示。

### 管理画面
- Firebase Authログイン（管理権限ユーザーのみ）。
- QRコード読取またはticket入力で検索。
- 状態変更UI（支払い／進捗）と保存ボタン。
- 保存は`orders`と`orderLookup`を同時更新。

## 8. 状態遷移
受注済み → 調理中 → 受取可 → クローズ
└─> クローズ（中止・完了）

### pgsql
コードをコピーする
支払い状態：`未払い` ↔ `支払い済み`

## 9. Firestore セキュリティルール（要点）
```ruby
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /orderLookup/{ticket} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth.token.admin == true || request.auth.token.staff == true;
      allow delete: if request.auth.token.admin == true;
    }

    match /orders/{orderId} {
      allow create: if request.auth != null;
      allow update: if request.auth.token.admin == true || request.auth.token.staff == true;
      allow read: if false;
      allow delete: if request.auth.token.admin == true;
    }

    match /metadata/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && docId == 'counters';
    }
  }
}

## 10. エラー処理・例外
ticket不正時：「該当なし」表示。

カメラ拒否時：手入力にフォールバック。

更新失敗時：エラーを管理者に表示し再試行可能に。

ネットワーク不良時：ユーザーに再実行案内。

## 11. 運用・管理
管理者権限付与：初回のみ Firebase Admin SDK や Functions を用いて admin: true 付与。

学園祭終了後、Firestore から CSV エクスポートしてバックアップ。

メニュー差替え：`VITE_MENU_VARIANT=day12` (1-2日目) / `VITE_MENU_VARIANT=day34` (3-4日目) を `.env` やビルドコマンドに指定してデプロイする。

## 12. 将来拡張
Cloud Functions による金額再計算・注文作成バリデーション。

Stripe等によるオンライン決済連携。

Looker Studio 等による集計・可視化。