import type {
  AllergenKey,
  MenuItem,
  MenuItemKey,
  PaymentStatus,
  ProgressStatus,
} from '../types/order'
import type { SupportedLanguage } from '../context/LanguageContext'

export type OrderErrorKey = 'EMPTY_CART' | 'ORDER_FAILED'
export type AuthErrorKey = 'ANON_SIGNIN_FAILED'
export type ProgressStepKey = 'received' | 'ready' | 'completed'

const MENU_ITEM_TEXT_EN: Record<MenuItemKey, { label: string; description: string }> = {
  potaufeu: {
    label: 'Pot-au-feu',
    description: 'A hearty vegetable stew served warm.',
  },
  plain: {
    label: 'Fried Bread (Plain)',
    description: 'Freshly fried bread coated with sugar.',
  },
  cocoa: {
    label: 'Fried Bread (Cocoa)',
    description: 'Rich cocoa powder finished with chocolate sauce.',
  },
  kinako: {
    label: 'Fried Bread (Kinako)',
    description: 'Roasted soybean flour with sweet kuromitsu syrup.',
  },
  garlic: {
    label: 'Fried Bread (Garlic)',
    description: 'Crispy fried bread seasoned with garlic salt.',
  },
  drink_hojicha: {
    label: 'Roasted Green Tea (Hot)',
    description: 'Fragrant hojicha to warm you up.',
  },
  drink_cocoa: {
    label: 'Hot Cocoa',
    description: 'Sweet and velvety cocoa.',
  },
  drink_coffee: {
    label: 'Hot Coffee',
    description: 'Aromatic freshly brewed coffee.',
  },
  drink_milkcoffee: {
    label: 'Iced Coffee Milk',
    description: 'Creamy coffee with plenty of milk, served cold.',
  },
  minestrone: {
    label: 'Minestrone',
    description: 'Tomato-based soup packed with vegetables.',
  },
  strawberry: {
    label: "S'more (Strawberry Jam)",
    description: 'Toasted marshmallow with tangy strawberry jam.',
  },
  blueberry: {
    label: "S'more (Blueberry Jam)",
    description: 'Blueberry jam paired with toasted marshmallow.',
  },
  chocolate: {
    label: "S'more (Chocolate)",
    description: 'Rich chocolate sauce with marshmallow.',
  },
  honey: {
    label: "S'more (Honey)",
    description: 'Toasted marshmallow finished with golden honey.',
  },
}

const ALLERGEN_LABELS: Record<SupportedLanguage, Record<AllergenKey, string>> = {
  ja: {
    wheat: '小麦',
    egg: '卵',
    soy: '大豆',
  },
  en: {
    wheat: 'Wheat',
    egg: 'Egg',
    soy: 'Soy',
  },
}

const PAYMENT_LABELS: Record<SupportedLanguage, Record<PaymentStatus, string>> = {
  ja: {
    未払い: '未払い',
    支払い済み: 'お支払い済み',
    キャンセル: 'キャンセル',
  },
  en: {
    未払い: 'Unpaid',
    支払い済み: 'Paid',
    キャンセル: 'Cancelled',
  },
}

const PROGRESS_LABELS: Record<SupportedLanguage, Record<ProgressStatus, string>> = {
  ja: {
    受注済み: '受注済み',
    調理済み: '調理済み\n（お受け取りOK）',
    クローズ: '受け渡し済み',
  },
  en: {
    受注済み: 'Order received',
    調理済み: 'Ready for pickup',
    クローズ: 'Picked up',
  },
}

const PROGRESS_STEP_LABELS: Record<SupportedLanguage, Record<ProgressStepKey, string>> = {
  ja: {
    received: '受注済み',
    ready: '調理済み\n（お受け取りOK）',
    completed: '受け渡し済み',
  },
  en: {
    received: 'Order received',
    ready: 'Ready for pickup',
    completed: 'Picked up',
  },
}

export const ORDER_TEXT = {
  ja: {
    languageToggle: {
      label: '言語切替',
      japanese: '日本語',
      english: 'English',
      buttonText: '日本語 / English',
      buttonAria: (nextLanguage: SupportedLanguage) =>
        `言語を${nextLanguage === 'ja' ? '日本語' : 'English'}に切り替える`,
    },
    header: {
      orderAction: '注文する',
      orderActionAria: '注文操作',
      characterAlt: 'キャラクターのイラスト',
      titleAlt: 'ヘッダーのタイトルイラスト',
    },
    auth: {
      signingIn: '匿名ログイン中です…',
      error: '匿名認証に失敗しました。時間をおいて再度お試しください。',
    },
    errors: {
      EMPTY_CART: '商品を1点以上ご注文ください。',
      ORDER_FAILED: '注文処理に失敗しました。通信環境をご確認ください。',
    },
    orderInput: {
      title: '注文する',
      descriptionLead:
        '各商品の数量はボタンで調整し、「注文内容を確認する」を押すとカート画面へ進みます。',
      descriptionFollow: '内容を確かめてから注文を確定しましょう。',
      totalLabel: '合計金額',
      totalNote: '税込・当日お支払いです。',
      reviewButton: '注文内容を確認する',
      resetButton: '入力をリセット',
    },
    quantityStepper: {
      decrease: '数量を1減らす',
      increase: '数量を1増やす',
    },
    menu: {
      imageAlt: (label: string) => `${label}のイメージ`,
      allergensLabel: (label: string) => `${label}に含まれる特定原材料表示`,
      quantityLabel: (label: string) => `${label}の数量`,
    },
    orderReview: {
      title: '注文内容を確認',
      descriptionLead: '数量と合計金額を確認し、問題なければ注文を確定してください。',
      descriptionFollow: '変更が必要な場合は戻って数量を調整できます。',
      tableHeaders: {
        item: '商品',
        quantity: '数量',
        subtotal: '小計',
      },
      totalLabel: '合計',
      confirmButton: 'この内容で注文する',
      changeButton: '数量を変更する',
      confirming: '確定中…',
    },
    wasteGuide: {
      title: 'ごみ分別のお願い',
      description:
        'こちらは仮の説明です。実際の分別ルールや回収場所の画像・文章を後ほど差し替えてください。',
      placeholder: '分別案内の画像をここに配置してください',
      confirm: '分別ルールを確認した',
    },
    orderComplete: {
      title: '注文が完了しました！',
      description: {
        default:
          '受け取り時は呼出番号と下のQRコードを提示してください。受け取りまで保管をお願いします。',
        progressOnly:
          '受け取り時は呼出番号または下のQRコードを提示してください。受け取りまで保管をお願いします。',
      },
      readyTitle: 'お渡しの準備が整いました',
      readyPreviewTag: 'テスト表示中（後で削除）',
      readyInstructionWithCallNumber: (callNumber: number) =>
        `呼出番号 ${callNumber} を確認のうえ、スタッフの案内にしたがってお受け取りください。`,
      readyInstructionWait: 'スタッフから呼び出しがあるまでその場でお待ちください。',
      statusHeading: '現在の状況',
      metaHeading: '注文情報',
      meta: {
        total: '合計金額',
        payment: 'お支払い',
        progress: '準備状況',
        orderedAt: '注文日時',
      },
      qrAlt: '進捗確認用QRコード',
      qrCaption:
        'このQRコードを読み取ると進捗確認ページが開きます。レジまたは状況確認時に提示してください。',
      identifiers: {
        orderId: '注文番号',
        ticket: '進捗確認コード',
      },
      itemsHeading: '注文内容',
      itemsTable: {
        item: '商品',
        quantity: '数量',
        price: '単価',
        subtotal: '小計',
        total: '合計',
      },
      actions: {
        copyLink: '進捗確認リンクをコピー',
        copyCode: '進捗確認コードをコピー',
        startNew: '新しく注文する',
      },
      ticketSearch: {
        regionLabel: '進捗確認コード検索',
        title: '進捗確認コードで表示',
        description:
          'お客様用の進捗確認コードを入力するとこの画面で進捗を確認できます。',
        label: '進捗確認コード',
        placeholder: '例: AB12CD34EF56GH78',
        button: '進捗を表示',
        error: 'チケット番号を入力してください。',
      },
      loadingTitle: '注文情報を読み込んでいます…',
      loadingDescription: '少々お待ちください。',
      loadErrorTitle: '注文情報を取得できませんでした',
      loadErrorDescription: '注文情報を取得できませんでした。時間をおいて再度お試しください。',
      loadErrorAction: 'チケット番号を再入力する',
      inviteTitle: '進捗確認コードを入力してください',
      inviteDescription: '進捗確認コードを入力するとすぐに進捗を確認できます。',
      paymentState: {
        complete: '受取済み',
        paid: 'お支払い済み',
        unpaid: '未払い',
      },
      progressSteps: PROGRESS_STEP_LABELS.ja,
      refresh: {
        refreshing: '更新中…',
        cooldown: (seconds: number) => `再取得まで ${seconds} 秒`,
        action: '最新情報に更新',
        error: '最新の注文情報を取得できませんでした。',
      },
      callNumberLabel: '呼出番号',
      callNumberPending: '準備中',
    },
    orderProgress: {
      title: '注文の進捗を表示しています',
      description:
        '進捗確認コードでアクセスした注文の状況と受け取りまでの流れをここで確認できます。',
    },
    status: {
      title: '注文状況の確認について',
      descriptionLead:
        'お客様には呼出番号のみをお伝えしています。スタッフからの案内があるまで、注文完了画面に表示された呼出番号をお控えください。',
      descriptionFollow:
        '進捗の詳細確認や調整はスタッフが内部ツールで対応します。状況に変化があった場合は店頭でお知らせいたします。',
      historyTitle: 'この端末の注文履歴',
      historyClear: '履歴をクリア',
      historyDescription:
        '直近にこの端末から確定した注文を表示しています。呼出番号と注文番号を控えておくと店頭での確認がスムーズです。',
      historyCallNumberLabel: '呼出番号',
      historyOrderIdLabel: '注文番号',
      historyTotalLabel: '合計',
      historyPendingCallNumber: '準備中 / 未設定',
      historyClearConfirm: 'この端末に保存されている注文履歴をすべて削除しますか？',
    },
    ticketNotFound: {
      title: '注文が見つかりません',
      descriptionKnown: (ticket: string) =>
        `進捗確認コード「${ticket}」の注文は登録されていないようです。コードを再度ご確認のうえ、もう一度お試しください。`,
      descriptionUnknown:
        '指定された進捗確認コードの注文は確認できませんでした。コードを再度ご確認のうえ、もう一度お試しください。',
      retry: '進捗確認コードを入力し直す',
      newOrder: '新しく注文する',
    },
    notFound: {
      title: 'ページが見つかりません',
      description: 'URLをご確認のうえ、ナビゲーションから移動してください。',
    },
    copy: {
      progressCodeSuccess: '進捗確認コードをコピーしました。',
      progressCodeFailure: 'コピーに失敗しました。手動で控えてください。',
      progressLinkSuccess: '進捗確認用リンクをコピーしました。',
      progressLinkFailure: 'コピーに失敗しました。手動で控えてください。',
    },
  },
  en: {
    languageToggle: {
      label: 'Language',
      japanese: '日本語',
      english: 'English',
      buttonText: '日本語 / English',
      buttonAria: (nextLanguage: SupportedLanguage) =>
        `Change language to ${nextLanguage === 'ja' ? 'Japanese' : 'English'}`,
    },
    header: {
      orderAction: 'Order now',
      orderActionAria: 'Order actions',
      characterAlt: 'Character illustration',
      titleAlt: 'Header title illustration',
    },
    auth: {
      signingIn: 'Signing in anonymously...',
      error: 'Anonymous sign-in failed. Please try again later.',
    },
    errors: {
      EMPTY_CART: 'Please add at least one item to your order.',
      ORDER_FAILED: 'We could not process your order. Please check your connection and try again.',
    },
    orderInput: {
      title: 'Place your order',
      descriptionLead:
        'Use the buttons to adjust each quantity, then press "Review order" to continue.',
      descriptionFollow: 'Make sure everything looks right before you confirm.',
      totalLabel: 'Total',
      totalNote: 'Tax included. Please pay at pickup.',
      reviewButton: 'Review order',
      resetButton: 'Reset selections',
    },
    quantityStepper: {
      decrease: 'Decrease quantity by 1',
      increase: 'Increase quantity by 1',
    },
    menu: {
      imageAlt: (label: string) => `Image of ${label}`,
      allergensLabel: (label: string) => `Allergen information for ${label}`,
      quantityLabel: (label: string) => `Quantity for ${label}`,
    },
    orderReview: {
      title: 'Review your order',
      descriptionLead: 'Check the quantities and total. When ready, place your order.',
      descriptionFollow: 'Need changes? Go back to adjust the items.',
      tableHeaders: {
        item: 'Item',
        quantity: 'Qty',
        subtotal: 'Subtotal',
      },
      totalLabel: 'Total',
      confirmButton: 'Place order',
      changeButton: 'Modify quantities',
      confirming: 'Submitting...',
    },
    wasteGuide: {
      title: 'Waste sorting reminder',
      description:
        'Replace this placeholder with the final sorting rules and drop-off locations when they are ready.',
      placeholder: 'Place the waste sorting guide image here.',
      confirm: 'I have read the sorting rules',
    },
    orderComplete: {
      title: 'Order confirmed!',
      description: {
        default:
          'Show the call number and QR code at pickup. Keep this screen until you receive your order.',
        progressOnly:
          'Show the call number or the QR code at pickup. Keep this screen handy until completion.',
      },
      readyTitle: 'Your order is ready',
      readyPreviewTag: 'Preview (remove later)',
      readyInstructionWithCallNumber: (callNumber: number) =>
        `Please check call number ${callNumber} and follow staff instructions to receive your order.`,
      readyInstructionWait: 'Please wait nearby until staff call your number.',
      statusHeading: 'Current status',
      metaHeading: 'Order details',
      meta: {
        total: 'Total',
        payment: 'Payment',
        progress: 'Status',
        orderedAt: 'Order time',
      },
      qrAlt: 'QR code for progress tracking',
      qrCaption:
        'Scan this code to open the progress page. Show it at the register or when staff ask.',
      identifiers: {
        orderId: 'Order ID',
        ticket: 'Progress code',
      },
      itemsHeading: 'Items',
      itemsTable: {
        item: 'Item',
        quantity: 'Qty',
        price: 'Unit price',
        subtotal: 'Subtotal',
        total: 'Total',
      },
      actions: {
        copyLink: 'Copy progress link',
        copyCode: 'Copy progress code',
        startNew: 'Start a new order',
      },
      ticketSearch: {
        regionLabel: 'Search by progress code',
        title: 'Show by progress code',
        description: 'Enter the customer progress code to view the status here.',
        label: 'Progress code',
        placeholder: 'e.g., AB12CD34EF56GH78',
        button: 'Show status',
        error: 'Enter a progress code.',
      },
      loadingTitle: 'Loading your order...',
      loadingDescription: 'Please wait a moment.',
      loadErrorTitle: 'We could not load the order',
      loadErrorDescription: 'We could not retrieve your order. Please try again later.',
      loadErrorAction: 'Enter the code again',
      inviteTitle: 'Enter a progress code',
      inviteDescription: 'Enter the progress code to check the latest status.',
      paymentState: {
        complete: 'Picked up',
        paid: 'Paid',
        unpaid: 'Unpaid',
      },
      progressSteps: PROGRESS_STEP_LABELS.en,
      refresh: {
        refreshing: 'Refreshing...',
        cooldown: (seconds: number) => `Try again in ${seconds} sec`,
        action: 'Refresh status',
        error: 'Failed to refresh the order. Please try again.',
      },
      callNumberLabel: 'Call number',
      callNumberPending: 'Pending',
    },
    orderProgress: {
      title: 'Tracking your order',
      description: 'Check the current status and pickup steps for the code you entered.',
    },
    status: {
      title: 'How to check your order status',
      descriptionLead:
        'We only share the call number with customers. Please keep the number shown on the completion screen until staff call you.',
      descriptionFollow:
        'Our staff track progress internally. If the situation changes, we will inform you at the booth.',
      historyTitle: 'Order history on this device',
      historyClear: 'Clear history',
      historyDescription:
        'Recent confirmed orders from this device appear here. Keeping the call number and order ID handy speeds up pickup.',
      historyCallNumberLabel: 'Call number',
      historyOrderIdLabel: 'Order ID',
      historyTotalLabel: 'Total',
      historyPendingCallNumber: 'Pending / Not assigned',
      historyClearConfirm: 'Remove all saved orders from this device?',
    },
    ticketNotFound: {
      title: 'Order not found',
      descriptionKnown: (ticket: string) =>
        `We could not find an order for progress code "${ticket}". Please check the code and try again.`,
      descriptionUnknown:
        'We could not confirm an order for the provided progress code. Please check the code and try again.',
      retry: 'Re-enter progress code',
      newOrder: 'Start a new order',
    },
    notFound: {
      title: 'Page not found',
      description: 'Please check the URL and use the navigation links.',
    },
    copy: {
      progressCodeSuccess: 'Progress code copied to clipboard.',
      progressCodeFailure: 'Copy failed. Please note it manually.',
      progressLinkSuccess: 'Progress link copied to clipboard.',
      progressLinkFailure: 'Copy failed. Please note it manually.',
    },
  },
} as const

export function getMenuItemLabel(item: MenuItem, language: SupportedLanguage): string {
  if (language === 'en') {
    return MENU_ITEM_TEXT_EN[item.key]?.label ?? item.label
  }
  return item.label
}

export function getMenuItemDescription(item: MenuItem, language: SupportedLanguage): string {
  if (language === 'en') {
    return MENU_ITEM_TEXT_EN[item.key]?.description ?? item.description
  }
  return item.description
}

export function getAllergenLabel(key: AllergenKey, language: SupportedLanguage): string {
  return ALLERGEN_LABELS[language][key]
}

export function getPaymentLabel(status: PaymentStatus, language: SupportedLanguage): string {
  return PAYMENT_LABELS[language][status]
}

export function getProgressLabel(status: ProgressStatus, language: SupportedLanguage): string {
  return PROGRESS_LABELS[language][status]
}

export function getProgressStepLabel(key: ProgressStepKey, language: SupportedLanguage): string {
  return PROGRESS_STEP_LABELS[language][key]
}