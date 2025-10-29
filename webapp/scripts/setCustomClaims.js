#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const KNOWN_ROLES = ['admin', 'kitchen', 'staff']

function printUsage() {
  console.log(`Usage:
  node scripts/setCustomClaims.js --uid <UID> [--set <role>]... [--unset <role>]...
  node scripts/setCustomClaims.js --uid <UID> --clear
  node scripts/setCustomClaims.js --uid <UID> --show

Options:
  --uid <UID>          必須。対象ユーザーのUID
  --set <role>         指定したロールを付与（複数指定可）
  --unset <role>       指定したロールを削除（複数指定可）
  --clear              すべてのカスタムクレームを削除
  --show               現在のカスタムクレームを表示
  --help               このヘルプを表示

Service Account:
  FIREBASE_SERVICE_ACCOUNT_PATH 環境変数で秘密鍵JSONのパスを指定できます。
  未指定の場合は ./tools/serviceAccount.json を探します。

例:
  node scripts/setCustomClaims.js --uid "ABC123" --set admin --unset kitchen
  FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/key.json node scripts/setCustomClaims.js --uid "DEF456" --show
`)
}

function resolveServiceAccountPath() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (fromEnv) {
    return resolve(process.cwd(), fromEnv)
  }
  return resolve(__dirname, '../tools/serviceAccount.json')
}

function loadServiceAccount() {
  const path = resolveServiceAccountPath()
  try {
    const json = readFileSync(path, 'utf8')
    return { data: JSON.parse(json), path }
  } catch (error) {
    throw new Error(
      `サービスアカウントJSONを読み込めませんでした。"${path}" を確認するか、FIREBASE_SERVICE_ACCOUNT_PATH を設定してください。\n元のエラー: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function parseArgs(argv) {
  const options = {
    uid: undefined,
    set: [],
    unset: [],
    clear: false,
    show: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--uid': {
        options.uid = argv[++index]
        break
      }
      case '--set': {
        const role = argv[++index]
        if (!role) throw new Error('--set の直後にロール名を指定してください')
        options.set.push(role)
        break
      }
      case '--unset': {
        const role = argv[++index]
        if (!role) throw new Error('--unset の直後にロール名を指定してください')
        options.unset.push(role)
        break
      }
      case '--clear': {
        options.clear = true
        break
      }
      case '--show': {
        options.show = true
        break
      }
      case '--help':
      case '-h': {
        options.help = true
        break
      }
      default: {
        throw new Error(`不明な引数: ${arg}`)
      }
    }
  }

  return options
}

function validateRoles(roles) {
  for (const role of roles) {
    if (!KNOWN_ROLES.includes(role)) {
      throw new Error(`不明なロール "${role}" が指定されました。利用可能: ${KNOWN_ROLES.join(', ')}`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help || (!options.uid && !options.help)) {
    if (!options.uid) {
      console.error('エラー: --uid は必須です。')
    }
    printUsage()
    process.exit(options.help ? 0 : 1)
    return
  }

  validateRoles(options.set)
  validateRoles(options.unset)

  const { data: serviceAccount, path: serviceAccountPath } = loadServiceAccount()

  initializeApp({
    credential: cert(serviceAccount),
  })

  const auth = getAuth()

  const user = await auth.getUser(options.uid)
  const currentClaims = user.customClaims ?? {}

  if (options.show && !options.clear && options.set.length === 0 && options.unset.length === 0) {
    console.log(JSON.stringify(currentClaims, null, 2))
    return
  }

  let nextClaims = { ...currentClaims }

  if (options.clear) {
    nextClaims = {}
  } else {
    for (const role of options.set) {
      nextClaims[role] = true
    }
    for (const role of options.unset) {
      delete nextClaims[role]
    }
  }

  await auth.setCustomUserClaims(options.uid, nextClaims)

  const updatedUser = await auth.getUser(options.uid)
  console.log(`サービスアカウント: ${serviceAccountPath}`)
  console.log(`更新されたクレーム (${options.uid}):`)
  console.log(JSON.stringify(updatedUser.customClaims ?? {}, null, 2))
  console.log('完了しました。反映にはユーザーの再ログインまたは getIdToken(true) が必要です。')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})
