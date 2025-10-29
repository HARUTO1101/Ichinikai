# 管理用サービスアカウントの配置について

1. Firebaseコンソールでサービスアカウントの秘密鍵（JSON）を生成します。
2. この `tools/` ディレクトリに `serviceAccount.json` という名前で保存するか、
   `FIREBASE_SERVICE_ACCOUNT_PATH` 環境変数で任意の場所を指定してください。
3. このファイルは機密情報のため **Git にコミットしないでください**。`.gitignore` により除外されます。


node scripts/setCustomClaims.js --uid "<UID>" --set admin --unset kitchen
node scripts/setCustomClaims.js --uid "<UID>" --show