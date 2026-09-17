/**
 * 複数レシート一括読み込み：結果カード1枚の「状態」の正本。
 *
 * 状態は全部で9つです。設計図の 3-3「カードの状態」の表をそのままここへ写しました。
 * 資料によって8つと書かれていた時期がありますが（`reading` を数えていなかったため）、
 * 数え方の食い違いはこのファイルで解消します。**状態を増やす・減らす・名前を変える
 * ときは、必ずここを直してから他を直してください。**
 *
 * 使う側の約束
 * - カード（子コンポーネント）は `state` を受け取るだけで、自分では書き換えません。
 * - 「編集できるか・除外できるか・戻せるか」は、この表から引きます。
 *   カードの中に if を並べて書かないでください（表とずれる原因になります）。
 * - 「登録の対象かどうか」は親（一括シート）の判断材料です。カードは使いません。
 */

/**
 * 状態の並び順（画面に一覧で出すときは、この順に並べます）。
 * 読み取り → 確認 → 保存 → 除外、という時間の流れの順です。
 * @type {readonly string[]}
 */
export const BATCH_CARD_STATE_ORDER = Object.freeze([
  'reading',
  'ready',
  'warn',
  'readFailed',
  'saving',
  'saved',
  'saveFailed',
  'unknown',
  'excluded',
])

/**
 * 1つの状態が持つ情報。
 * @typedef {Object} BatchCardStateSpec
 * @property {string} label          画面に出す表示名（日本語）
 * @property {string} meaning        その状態が何を指すのか（説明用。画面に出しても良い）
 * @property {boolean} canEditAmount 金額を編集できるか
 * @property {boolean} canExclude    除外できるか（除外ボタンを出すか）
 * @property {boolean} canRestore    除外から戻せるか（戻すボタンを出すか）
 * @property {boolean} isSubmitTarget まとめて登録の対象に数えるか（**親が使う値**）
 * @property {'neutral'|'ok'|'warn'|'danger'|'busy'|'done'|'muted'} tone 色の系統
 */

/**
 * 状態の表（正本）。
 * @type {Readonly<Record<string, BatchCardStateSpec>>}
 */
export const BATCH_CARD_STATES = Object.freeze({
  /** 読み取り中。まだ結果が返っていない。除外すると、返ってきた結果は捨てる。 */
  reading: Object.freeze({
    label: '読み取り中',
    meaning: '画像を送って、結果を待っているところです。',
    canEditAmount: false,
    canExclude: true,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'busy',
  }),

  /** 読み取れて、そのまま登録できる。一括登録の対象になる唯一の状態。 */
  ready: Object.freeze({
    label: '登録できます',
    meaning: '読み取れていて、このまま登録できます。',
    canEditAmount: true,
    canExclude: true,
    canRestore: false,
    isSubmitTarget: true,
    tone: 'ok',
  }),

  /** 要確認。外貨・金額0・日付が読めない等。金額が入れば ready へ上がる（親が判定）。 */
  warn: Object.freeze({
    label: '要確認',
    meaning: '金額や日付が確かめられません。直すまで登録しません。',
    canEditAmount: true,
    canExclude: true,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'warn',
  }),

  /** 読み取りに失敗（通信・例外・時間切れ）。手で金額を入れれば進める。 */
  readFailed: Object.freeze({
    label: '読み取れませんでした',
    meaning: '通信や時間切れで読み取れませんでした。金額を手で入れれば進めます。',
    canEditAmount: true,
    canExclude: true,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'danger',
  }),

  /** 保存中。触れない。 */
  saving: Object.freeze({
    label: '保存中',
    meaning: '登録の送信中です。この間は編集も除外もできません。',
    canEditAmount: false,
    canExclude: false,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'busy',
  }),

  /** 保存できた。もう触れない。 */
  saved: Object.freeze({
    label: '保存しました',
    meaning: '登録が終わりました。ここから先は直せません。',
    canEditAmount: false,
    canExclude: false,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'done',
  }),

  /** 保存に失敗（保存されていないことが確認できた）。親のボタンから再送する。 */
  saveFailed: Object.freeze({
    label: '保存できませんでした',
    meaning: '保存されていないことが確認できました。もう一度送れます。',
    canEditAmount: false,
    canExclude: false,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'danger',
  }),

  /** 保存できたか分からない（応答が返らなかった）。親のボタンから再確認・再送する。 */
  unknown: Object.freeze({
    label: '保存を確認できません',
    meaning: '保存できたか分かりません。同じ登録情報を保持し、保存結果を確認してください。',
    canEditAmount: false,
    canExclude: false,
    canRestore: false,
    isSubmitTarget: false,
    tone: 'warn',
  }),

  /** 除外。登録しない。戻すと元の状態へ復帰する（元の状態を覚えておくのは親の仕事）。 */
  excluded: Object.freeze({
    label: '除外',
    meaning: 'このレシートは登録しません。戻すこともできます。',
    canEditAmount: false,
    canExclude: false,
    canRestore: true,
    isSubmitTarget: false,
    tone: 'muted',
  }),
})

/**
 * 状態の一覧を、表示順の配列で返す（画面に表を出すとき用）。
 * @returns {Array<BatchCardStateSpec & { state: string }>}
 */
export function listBatchCardStates() {
  return BATCH_CARD_STATE_ORDER.map((state) => ({ state, ...BATCH_CARD_STATES[state] }))
}

/**
 * 知っている状態かどうか。
 * @param {string} state
 * @returns {boolean}
 */
export function isBatchCardState(state) {
  return Object.prototype.hasOwnProperty.call(BATCH_CARD_STATES, state)
}

/**
 * 状態の情報を引く。知らない状態が来たら操作を止めて、
 * 画面が壊れないようにします。
 * @param {string} state
 * @returns {BatchCardStateSpec}
 */
export function getBatchCardState(state) {
  return isBatchCardState(state) ? BATCH_CARD_STATES[state] : { ...BATCH_CARD_STATES.unknown, label: '状態を確認できません' }
}

/**
 * 表示名。
 * @param {string} state
 * @returns {string}
 */
export function stateLabel(state) {
  return getBatchCardState(state).label
}

/**
 * 金額を編集できるか。
 * @param {string} state
 * @returns {boolean}
 */
export function canEditAmount(state) {
  return getBatchCardState(state).canEditAmount
}

/**
 * 除外できるか。
 * @param {string} state
 * @returns {boolean}
 */
export function canExclude(state) {
  return getBatchCardState(state).canExclude
}

/**
 * 除外から戻せるか。
 * @param {string} state
 * @returns {boolean}
 */
export function canRestore(state) {
  return getBatchCardState(state).canRestore
}

/**
 * まとめて登録の対象に数えるか（親が使う）。
 * @param {string} state
 * @returns {boolean}
 */
export function isSubmitTarget(state) {
  return getBatchCardState(state).isSubmitTarget
}
