/**
 * 複数レシート一括読み込み：`BatchReceiptModal.vue` の中身のうち、
 * Firebase に触れない「計算・判定・文言」だけを取り出したもの。
 *
 * ここを分けている理由は、お金にかかわる計算（表示している合計と、実際に保存する
 * 合計が1円もずれないこと）を、画面を描かずに手元で確かめられるようにするためです。
 * `tests/batchReceiptCalc.test.mjs` から素の node で実行できます。
 *
 * 金額・店名の上限は `batchPaymentSave.js` の定数をそのまま使います
 * （同じ値を2箇所に書くと、どちらかだけ直して食い違う事故が起きるため）。
 */

import { MAX_AMOUNT, MAX_ITEM_NAME_LENGTH, FALLBACK_ITEM_NAME } from './batchPaymentSave.js'
import { isSubmitTarget } from './batchStates.js'

/** 一括読み込みの最大枚数（設計図 2-3）。当日に下げるならここだけ直す。 */
export const MAX_IMAGES = 3

/** 1枚あたりの元ファイルの上限（設計図 4-4）。超えたら送らずに `readFailed` にする。 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** 読み取りの打ち切り（設計図 4-3）。実測最大18.5秒の約2倍＋余裕。将来の保証値ではない。 */
export const ANALYZE_TIMEOUT_MS = 60000

/** 1枚が失敗した直後、次の画像を送るまで空ける時間（設計図 4-2）。踏み続けないための間。 */
export const RETRY_GAP_MS = 2000

const DATE_PATTERN = /^\d{4}\/\d{1,2}\/\d{1,2}$/

const safeNum = (v, min, max, dflt) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt
}
const safeText = (v, len) => (typeof v === 'string' ? v.trim().slice(0, len) : '')

/**
 * 読み取り結果（Cloud Functions `analyzeReceipt` の戻り値）を、カードへ流し込める形にする。
 * `AddPaymentModal.vue` の processImage（502〜539行）と同じ考え方（推測しない）です。
 * 一括側は店名・日付を編集できない仕様（設計図 3-2）なので、ここで確定させます。
 *
 * @param {any} data
 * @returns {{ store: string, amount: string, date: string, notice: string }}
 *   amount は文字列。読めなければ空文字（0円と決めつけない）。date は `YYYY/MM/DD` か空文字。
 */
export function clampReceiptData(data) {
  const raw = data || {}
  const store = safeText(raw.storeName, MAX_ITEM_NAME_LENGTH) || FALLBACK_ITEM_NAME

  const currency = safeText(raw.currency, 8).toUpperCase()
  const isForeign = currency !== '' && currency !== 'JPY'
  const total = safeNum(raw.totalAmount, 0, MAX_AMOUNT, 0)

  let amount = ''
  const notices = []
  if (isForeign) {
    notices.push(`日本円以外のレシートの可能性があります（通貨: ${currency}）。金額は入れていません。`)
  } else if (total <= 0) {
    notices.push('金額を読み取れませんでした。手で入れてください。')
  } else {
    amount = String(total)
  }

  let date = ''
  if (typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
    date = raw.date.replace(/-/g, '/')
  } else {
    notices.push('日付を読み取れませんでした。')
  }

  // ポイント利用は登録の可否には関わらないが、事実として伝える（既存の1枚読み取りと同じ扱い）
  const points = safeNum(raw.pointsUsed, 0, MAX_AMOUNT, 0)
  if (points > 0) {
    notices.push(`ポイント利用 ¥${points.toLocaleString('ja-JP')}（合計はポイントを引く前の金額です）。`)
  }

  return { store, amount, date, notice: notices.join(' ') }
}

/**
 * 登録直前の再検証と同じ条件で、金額と日付が揃っているかを判定する（設計図 4-8）。
 * 一括側は日付を編集できないため、日付が読めていないカードは除外するほかない。
 *
 * @param {{ amount: string|number, date: string }} args
 * @returns {{ ready: boolean, reason: 'invalid-amount'|'invalid-date'|null }}
 */
export function evaluateCardReadiness({ amount, date }) {
  const amt = Number(amount)
  const amountOk = Number.isInteger(amt) && amt >= 1 && amt <= MAX_AMOUNT
  const dateOk = typeof date === 'string' && DATE_PATTERN.test(date)
  if (amountOk && dateOk) return { ready: true, reason: null }
  return { ready: false, reason: !dateOk ? 'invalid-date' : 'invalid-amount' }
}

/**
 * いま画面に出している「登録対象カードの合計」。まとめて登録ボタンの表示に使う。
 * 対象かどうかの判定は `batchStates.js` の `isSubmitTarget` だけを見る
 * （カード側の if を増やさない、という batchStates.js 自身の約束を親側でも守る）。
 * @param {{ state: string, amount: string }[]} cards
 * @returns {number}
 */
export function sumReadyAmounts(cards) {
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => c && isSubmitTarget(c.state))
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
}

/** `saveOnePayment` の `reason` を、利用者向けの日本語にする（設計図「失敗しても言葉で伝える」）。 */
const SAVE_FAILURE_TEXT = {
  ended: '終了済みのイベントです。',
  'no-participants': '参加者を読み込めませんでした。',
  'invalid-payer': '立替えた人を選び直してください。',
  'invalid-amount': '金額を確かめてください。',
  'invalid-date': '日付を確かめられません。このカードは除外してください。',
  'invalid-share': '割り勘の金額に誤りがあります。',
  'share-mismatch': '割り勘の合計が総額と一致しません。',
  'missing-ids': '保存の準備ができていません。もう一度お試しください。',
  'plan-mismatch': '参加者の顔ぶれが変わったため、いったん保存を中止しました。',
  'invalid-event': 'イベントの情報を読み込めませんでした。',
  timeout: '返事が届くのを待ちましたが、時間切れになりました。',
  'cache-only': '通信状況が確認できませんでした。',
  'no-firestore': 'データベースにつながりませんでした。',
}

/**
 * @param {string|null} reason `saveOnePayment` / `confirmSavedOnServer` の reason
 * @returns {string} 空文字なら表示するものが無いということ
 */
export function describeSaveFailure(reason) {
  if (!reason) return ''
  return SAVE_FAILURE_TEXT[reason] || `保存できませんでした（${reason}）。`
}

/**
 * 保存が全部終わったあとに、シートの中へ1回だけ出す文言を作る（設計図 3-4）。
 * トーストの連発はしない。成功件数を必ず先に言う（保存エラーだけが目に入る食い違いを避ける）。
 *
 * @param {{status: 'saved'|'already'|'failed'|'unknown', sideEffectFails?: string[]}[]} results
 */
export function summarizeBatchResults(results) {
  const list = Array.isArray(results) ? results : []
  const savedCount = list.filter((r) => r.status === 'saved' || r.status === 'already').length
  const failedCount = list.filter((r) => r.status === 'failed').length
  const unknownCount = list.filter((r) => r.status === 'unknown').length
  const sideEffectFails = [...new Set(list.flatMap((r) => r.sideEffectFails || []))]

  let message
  if (list.length === 0) {
    message = '登録できるカードがありませんでした。'
  } else if (savedCount === list.length) {
    message = `${savedCount}件を保存しました。`
  } else if (savedCount === 0) {
    message = '保存できませんでした。通信の状態を確認して、もう一度お試しください。'
  } else {
    message = `${savedCount}件を保存しました。${failedCount + unknownCount}件は保存できませんでした。残っているカードから、もう一度送れます。`
  }

  if (unknownCount > 0) {
    message += `（うち${unknownCount}件は保存できたかどうか確認できませんでした。もう一度送っても、二重には入りません。）`
  }
  if (sideEffectFails.length > 0) {
    message += ' 支払いは保存しましたが、チャットの反映ができなかったものがあります。'
  }

  return { message, savedCount, failedCount, unknownCount, sideEffectFails }
}
