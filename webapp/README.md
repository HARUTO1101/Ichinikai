# 学園祭キッチンカー注文システム（フロントエンド）

学園祭のキッチンカーで利用する、スマートフォン向け注文／進捗管理アプリです。GitHub Pagesによる静的ホスティングを前提に、Firebase（Auth / Firestore）をバックエンドとして利用します。

## 主な機能

- **来場者向け注文ページ**：商品の数量調整とリアルタイム合計計算、注文送信、チケット・QRコード発行。
- **進捗照会ページ**：チケット番号またはQRコードから、支払い／準備ステータスを表示。
- **管理画面**：Firebase Authログイン、チケット検索（QR対応）、支払い／進捗の更新、CSVエクスポート。
- **Firebase連携**：Firestoreバッチ書き込みによる `orders` / `orderLookup` 同時更新、匿名認証の自動処理。

## 技術スタック

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) ビルドツール
- [Firebase Web SDK v9+](https://firebase.google.com/docs/reference/js)（Auth / Firestore）
- [@zxing/browser](https://github.com/zxing-js/library)（ブラウザ向けQRコードスキャナー）
- [qrcode](https://github.com/soldair/node-qrcode)（QRコード生成）

## セットアップ

### 1. 依存パッケージのインストール

```powershell
cd webapp
npm install
```

### 2. 環境変数の設定

`webapp/.env.local` を作成し、Firebaseプロジェクトの設定値を記入します。

```ini
VITE_FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxxxxxxxxxx

# エミュレータ利用時のみtrue
# VITE_USE_FIREBASE_EMULATORS=true
# UI検証用のモックデータを使う場合のみtrue
# VITE_USE_MOCK_DATA=true
```

### 3. 開発サーバーの起動

```powershell
npm run dev
```

ブラウザで `http://localhost:5173` を開くと動作確認ができます。

### 4. ビルド

```powershell
npm run build
```

`dist/` に静的ファイルが出力されます。そのままGitHub Pagesなどの静的ホスティングへ配置可能です。

## Firebase 設定メモ

- Auth：匿名認証を有効化し、運営者用のメール／パスワードユーザーに `admin: true` のカスタムクレームを付与してください。
- Firestore：`orders` / `orderLookup` コレクションを利用します。要件定義書に記載のセキュリティルールを適用してください。
- エミュレーター環境を利用する場合は、`.env.local` に `VITE_USE_FIREBASE_EMULATORS=true` を設定し、ローカルでAuth (9099) / Firestore (8080) を起動します。
- モックデータでUIを確認したい場合は、`.env.local`に`VITE_USE_MOCK_DATA=true`を設定してください。Firestoreへの書き込みは行われず、ローカルストレージに保存されるダミー注文が利用されます。

## ディレクトリ構成（抜粋）

```
src/
  components/        再利用可能な UI コンポーネント（QRスキャナ等）
  hooks/             カスタムフック（匿名認証処理）
  lib/               Firebase 初期化ロジック
  pages/             ルーティング単位のページ群
  services/          Firestore 書き込み／検索ロジック
  types/             型定義と定数
```

## デプロイ手順（例：GitHub Pages）

1. `npm run build` で `dist/` を生成。
2. GitHub Actionsなどで `dist/` を `gh-pages` ブランチへデプロイ。
3. GitHub Pagesにて `gh-pages` ブランチを公開対象に設定。

## 開発時のヒント

- 管理画面でのQR読み取りはHTTPS環境が必要です。ローカル開発ではChromeの「--unsafely-treat-insecure-origin-as-secure」フラグを利用するか、エミュレーター環境をhttps化してください。
- カスタムクレームはFirebase Admin SDKまたはCloud Functionsで付与します。初期設定後はクライアント側で`user.getIdTokenResult(true)`を呼び出して反映させています。
- Firestore同期の整合性担保のため、`orders`と`orderLookup`は常に同一バッチで更新しています。

## ライセンス

このプロジェクトは学園祭向け用途を想定したサンプル実装です。必要に応じて運用ポリシーに沿ったカスタマイズを行ってください。
