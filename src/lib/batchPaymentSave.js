/**
 * 複数レシート一括登録：レシート1枚ぶんの「保存」だけを受け持つモジュール。
 *
 * ここが一括機能でいちばん危ない場所です。守りたいことは一つだけで、
 * **同じレシートのお金が二重に登録されないこと**です。
 *
 * ## 方針（なぜこの作りなのか）
 *
 * 1. **IDは送る前に決める。**履歴IDと取引IDを先に採番し、カードはそれを持ち続けます。
 *    同じカードから何度送っても、書き込み先は毎回まったく同じ文書になります。
 *    `addDoc` を使うかぎりこの先決めはできないので、`doc(collection(...))` で
 *    通信せずにIDだけを作ります。
 *
 * 2. **「履歴があるか読む」から「取引・履歴・イベント合計の加算」までを1つの確定処理
 *    （`runTransaction`）に入れる。**`writeBatch` は書き込みをまとめるだけで、
 *    その前の存在確認までは一体にしません。同じIDの送信が competing すると、両方が
 *    「履歴なし」を読んで両方が `increment` を実行でき、**文書の数は同じでも合計だけが
 *    二重になります**。トランザクションなら、読んだ文書が途中で変わった場合はやり直され、
 *    「既にあるなら加算しない」がデータベース側の確定と一体になります。
 *
 * 3. **確定したかどうかを4つに分ける。**`saved` / `already` / `failed` / `unknown`。
 *    通信断・時間切れ・権限エラーを一括りに「失敗」と言わないための区別です。
 *    保存されたか分からない状態（`unknown`）を「保存されていない」と扱うと、
 *    利用者に新規登録をやり直させてしまい、二重登録の入口になります。
 *
 * 4. **確定の外では、キャッシュを確定と見なさない。**`getDoc` は通信できないときに
 *    ローカルのキャッシュを返すことがあり、未確定の書き込みでも文書は存在し得ます。
 *    トランザクションの外で存在を確かめるときは `getDocFromServer` を使い、
 *    `metadata.fromCache` と `metadata.hasPendingWrites` まで見ます。
 *
 * 5. **付随処理（チャット作成など）は確定の外。**トランザクションのコールバックは
 *    やり直しで**何度も実行され得る**ため、中に副作用を置いてはいけません。
 *    付随処理が転んでも金額の保存は成功のままにし、失敗した種別だけを
 *    `sideEffectFails` に積みます（既存の1枚登録と同じ考え方）。
 *
 * ## このモジュールがしないこと
 *
 * - 画面には一切触りません（トースト・モーダル・スクロールは呼び出し側の仕事）。
 * - 負担額の計算はしません。`shares` は**引数で受け取ります**（計算は呼び出し側の責任）。
 * - 既存の1枚登録（`EventDetails.vue` の `addHistory`）には手を触れていません。
 *   履歴の項目だけは `addHistory` の910〜927行と同じ並び・同じ既定値で書いています。
 *   ここがずれると、一括で登録した支払いを既存の編集画面で開いたときに壊れます。
 */

import { isSelfName } from './selfName.js'

/** 保存の返事を待つ上限（ミリ秒）。超えたら `unknown`。 */
export const SAVE_TIMEOUT_MS = 30000

/** 金額の上限（既存フォームの上限に合わせる）。 */
export const MAX_AMOUNT = 99999999

/** 店名の上限文字数と、空のときに入れる文字列（設計 4-8 の表）。 */
export const MAX_ITEM_NAME_LENGTH = 60
export const FALLBACK_ITEM_NAME = '不明な店舗'

/** 日付は `YYYY/MM/DD` に整形済みであること（当日で埋めない）。 */
export function isValidPaymentDate(value) {
  if (typeof value !== 'string' || !/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) return false
  const [year, month, day] = value.split('/').map(Number)
  if (year < 1000 || month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}
const validId = value => typeof value === 'string' && !!value.trim() && !value.includes('/')
const uniqueIds = values => values.every(validId) && new Set(values).size === values.length

function historyMatchesPlan(data, plan) {
  const { payment, creditorUid, shares, ids } = plan
  const signature = list => JSON.stringify(list.map(s => [s.uid, s.amount]).sort((a, b) => a[0].localeCompare(b[0])))
  return data.payerUid === creditorUid && data.amount === payment.amount && data.date === payment.date
    && data.itemName === normalizeItemName(payment.itemName)
    && Array.isArray(data.shares) && signature(data.shares) === signature(shares)
    && Array.isArray(data.transactionIds)
    && JSON.stringify([...data.transactionIds].sort()) === JSON.stringify(ids.transactions.map(t => t.id).sort())
}


/**
 * 「確実に保存されていない」と言い切れるエラー。これだけが `failed`（再送してよい）。
 * ここに無いもの（通信断・時間切れ・中断など）は、保存されたか分からないので `unknown`。
 */
const DEFINITELY_NOT_SAVED = new Set([
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'not-found',
  'already-exists',
  'failed-precondition',
  'out-of-range',
  'unimplemented',
])

// ---------------------------------------------------------------------------
// Firestore の差し替え口
// ---------------------------------------------------------------------------
// 本番では `@/firebase` と `firebase/firestore` を遅延読み込みします。
// 遅延にしている理由は2つあります。
//  - このモジュールは機能フラグの裏でしか使わないので、初期表示の邪魔をしない
//  - 手元の単体テストで、実際のFirestoreへ一切つながずに確かめられるようにする
//    （`setFirestoreBindings()` で偽物を差し込む。本番のコードからは呼びません）

let injectedBindings = null
let bindingsPromise = null

/**
 * Firestoreの呼び出し口を差し替える（単体テスト専用の入口）。
 * `null` を渡すと本番の読み込みに戻ります。
 * @param {Object|null} next
 */
export function setFirestoreBindings(next) {
  injectedBindings = next || null
  bindingsPromise = null
}

async function getBindings() {
  if (injectedBindings) return injectedBindings
  if (!bindingsPromise) {
    bindingsPromise = (async () => {
      const [firebase, firestore, thread] = await Promise.all([
        import('@/firebase'),
        import('firebase/firestore'),
        import('@/lib/thread'),
      ])
      return {
        db: firebase.db,
        doc: firestore.doc,
        collection: firestore.collection,
        runTransaction: firestore.runTransaction,
        getDocFromServer: firestore.getDocFromServer,
        serverTimestamp: firestore.serverTimestamp,
        increment: firestore.increment,
        ensurePaymentThread: thread.ensurePaymentThread,
        paymentThreadId: thread.paymentThreadId,
      }
    })()
  }
  return bindingsPromise
}

// ---------------------------------------------------------------------------
// 型の説明
// ---------------------------------------------------------------------------

/**
 * 1人ぶんの負担額。**合計は必ず総額（`payment.amount`）と1円もずれずに一致すること。**
 * 端数を誰に寄せるかは呼び出し側で決めます（このモジュールは計算しません）。
 * @typedef {Object} Share
 * @property {string} uid    参加者のUID
 * @property {string} name   表示名（既存の編集画面が名前で負担額を引くので、埋めてください）
 * @property {number} amount 負担額（0以上の整数）
 */

/**
 * 先に決めたID一式。カードはこれを持ち続け、再送でも同じものを渡します。
 * @typedef {Object} SaveIds
 * @property {string} historyId 履歴（events/{eventId}/history）のID
 * @property {{ uid: string, amount: number, id: string }[]} transactions 取引のID（債務者ごと）
 */

/**
 * 保存の結果。
 * @typedef {Object} SaveResult
 * @property {'saved'|'already'|'failed'|'unknown'} status
 *   - `saved`: サーバーでの確定を確認できた
 *   - `already`: 同じ履歴IDが既に確定済みだった（合計は増やしていない）
 *   - `failed`: 確定していないと確認できた（同じIDのまま再送してよい）
 *   - `unknown`: 確定したか分からない（**自動で再送しない**。再確認してから判断する）
 * @property {string|null} historyId
 * @property {string[]} sideEffectFails 反映できなかった付随処理の種別（例: 'チャット'）
 * @property {string|null} reason `failed` / `unknown` のときの理由
 */

// ---------------------------------------------------------------------------
// 1. IDを先に決める
// ---------------------------------------------------------------------------

/**
 * 送信前に、履歴IDと取引IDを採番します（通信はしません）。
 * 金額や負担者を直したら採番し直してください（保存中・保存済みのカードは編集できない
 * ので、通常は送信直前の1回だけ呼ばれます）。
 *
 * @param {Object} params
 * @param {string} params.eventId
 * @param {string} params.creditorUid 立替者（債権者）のUID
 * @param {Share[]} params.shares
 * @returns {Promise<SaveIds>}
 */
export async function prepareSaveIds({ eventId, creditorUid, shares }) {
  const { db, doc, collection } = await getBindings()
  const historyId = doc(collection(db, 'events', eventId, 'history')).id
  const transactions = debtorsOf(shares, creditorUid).map((s) => ({
    uid: s.uid,
    amount: s.amount,
    id: doc(collection(db, 'transactions')).id,
  }))
  return { historyId, transactions }
}

/** 立替者を除いた「実際に払う人」だけを取り出す（0円・未入力は作らない）。 */
function debtorsOf(shares, creditorUid) {
  return (Array.isArray(shares) ? shares : [])
    .filter((s) => s && s.uid && s.uid !== creditorUid && Number(s.amount) > 0)
    .map((s) => ({ uid: s.uid, name: s.name || '', amount: Number(s.amount) }))
}

// ---------------------------------------------------------------------------
// 2. 送る前の検証
// ---------------------------------------------------------------------------

/**
 * 登録直前の再検証（設計 4-8 の表）。保存の前に必ず通します。
 * 呼び出し側が事前にボタンの有効・無効を決めるためにも使えます。
 *
 * @param {Object} args `saveOnePayment` と同じ引数
 * @returns {{ ok: boolean, reason: string|null }}
 *   reason は 'ended' / 'no-participants' / 'invalid-payer' / 'invalid-amount' /
 *   'invalid-date' / 'invalid-share' / 'share-mismatch' / 'missing-ids' /
 *   'plan-mismatch' / 'invalid-event'
 */
export function validateSavePlan(args) {
  const {
    eventId,
    participantUids = [],
    creditorUid,
    payment = {},
    shares,
    ids,
    eventEnded = false,
  } = args || {}

  if (!validId(eventId)) return ng('invalid-event')
  if (eventEnded === true) return ng('ended')
  if (!Array.isArray(participantUids) || participantUids.length === 0) return ng('no-participants')
  if (!uniqueIds(participantUids)) return ng('invalid-participants')
  if (!creditorUid || !participantUids.includes(creditorUid)) return ng('invalid-payer')

  if (!payment || typeof payment !== 'object') return ng('invalid-amount')
  const total = payment.amount
  if (typeof total !== 'number' || !Number.isInteger(total) || total < 1 || total > MAX_AMOUNT) return ng('invalid-amount')
  if (!isValidPaymentDate(payment.date)) return ng('invalid-date')

  if (!Array.isArray(shares) || shares.length !== participantUids.length || !uniqueIds(shares.map(s => s?.uid))) return ng('invalid-share')
  let sum = 0
  for (const s of shares) {
    if (!s || typeof s.uid !== 'string' || !participantUids.includes(s.uid)) return ng('invalid-share')
    const amount = s.amount
    if (typeof s.name !== 'string' || typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > MAX_AMOUNT) return ng('invalid-share')
    sum += amount
  }
  // 1円のずれも許さない。ここを緩めると、イベント合計と履歴の金額が食い違う。
  if (sum !== total) return ng('share-mismatch')

  if (!ids || !validId(ids.historyId) || !Array.isArray(ids.transactions)) {
    return ng('missing-ids')
  }
  for (const t of ids.transactions) {
    if (!t || !validId(t.id) || !validId(t.uid)) return ng('missing-ids')
  }
  if (!uniqueIds(ids.transactions.map(t => t.id)) || !uniqueIds(ids.transactions.map(t => t.uid))) return ng('plan-mismatch')
  // 採番したあとに負担者の顔ぶれが変わっていたら、勝手に新しいIDを作らずに止める。
  // （新しいIDを作ると、先に確定していた取引が取り残されて二重に見える）
  const debtors = debtorsOf(shares, creditorUid)
  if (debtors.length !== ids.transactions.length) return ng('plan-mismatch')
  const numbered = new Set(ids.transactions.map((t) => t.uid))
  for (const d of debtors) {
    if (!numbered.has(d.uid) || ids.transactions.find(t => t.uid === d.uid).amount !== d.amount) return ng('plan-mismatch')
  }

  return { ok: true, reason: null }
}

function ng(reason) {
  return { ok: false, reason }
}

// ---------------------------------------------------------------------------
// 3. 書き込む中身（既存の1枚登録と同じ形にそろえる）
// ---------------------------------------------------------------------------

/** 店名の整形（空なら既定値、長すぎたら切り詰め）。 */
function normalizeItemName(raw) {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) return FALLBACK_ITEM_NAME
  return name.length > MAX_ITEM_NAME_LENGTH ? name.slice(0, MAX_ITEM_NAME_LENGTH) : name
}

/** いまの時刻を `HH:MM` で（既存フォームの time と同じ形）。 */
function nowHHMM() {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

/**
 * 履歴のpayload。**並び・既定値は `EventDetails.vue` の `addHistory`（910〜927行）と同じ。**
 * ここを直すときは、必ず向こうと見比べてください。
 */
function buildHistoryPayload({ payment, creditorUid, shares, transactionIds, serverTimestamp }) {
  return {
    payer: payment.payer,
    payerUid: creditorUid, // 立替者のUID（役割判定を名前でなくUIDで行う）
    itemName: normalizeItemName(payment.itemName),
    category: payment.category || 'その他', // 支払いジャンル
    registrationNumber: payment.registrationNumber || null, // 事業者登録番号（インボイス）
    splitType: payment.splitType, // 一括は全員均等なので 'all'
    taxMode: payment.taxMode || 'included', // 税の計算方法（再編集時に復元）
    remainder: payment.remainder || null, // 不明な残金（差額の負担者＋理由）
    amount: Number(payment.amount),
    date: payment.date,
    time: payment.time ?? nowHHMM(),
    status: 'unpaid',
    timestamp: serverTimestamp(), // 並び替えに使用
    shares: shares || [], // 各メンバーの負担額（精算サマリーの正データ）
    items: payment.items || [],
    ...(payment.receipt ? { receipt: payment.receipt } : {}),
    transactionIds, // 決済完了時に transactions 側も更新するための紐付け
  }
}

/**
 * 取引のpayload。既存（`addHistory` 894〜903行）と同じ項目に `historyId` を足したもの。
 * 最初から `historyId` を入れるので、保存後に `updateDoc` で付け直すループは要りません。
 */
function buildTransactionPayload({ debtorUid, creditorUid, amount, eventId, eventName, itemName, historyId, serverTimestamp }) {
  return {
    paidById: debtorUid, // 債務者（払う人）
    paidToId: creditorUid, // 債権者（立て替えた人）
    amount,
    status: 'unpaid',
    approvalReviewRequired: false, // 新規なので確認は不要
    eventId,
    eventName: eventName || '',
    itemName,
    historyId, // 最初から紐づける
    createdAt: serverTimestamp(),
  }
}

// ---------------------------------------------------------------------------
// 4. エラーの見分け
// ---------------------------------------------------------------------------

/** FirebaseError の code は 'permission-denied' や 'firestore/permission-denied' の形で来る。 */
function errorCode(error) {
  const raw = error && typeof error.code === 'string' ? error.code : ''
  return raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw
}

/**
 * 保存が確定していないと言い切れるときだけ `failed`。
 * 通信断・時間切れ・中断・サーバー内部エラーは、確定したかどうかが分からないので `unknown`。
 * `aborted`（競合でやり直しきれなかった）も、確定していない可能性が高いものの
 * 断定はしないで `unknown` に寄せています。お金の話では、決めつけない側に倒します。
 * @param {any} error
 * @returns {'failed'|'unknown'}
 */
export function classifySaveError(error) {
  if (error && error.__validationReason) return 'failed'
  return DEFINITELY_NOT_SAVED.has(errorCode(error)) ? 'failed' : 'unknown'
}

function reasonOf(error) {
  const code = errorCode(error)
  if (code) return code
  if (error && typeof error.message === 'string' && error.message) return error.message
  return 'error'
}

/** 時間切れを混ぜた待ち合わせ。元の処理は止められないので、投げっぱなしの失敗だけ拾っておく。 */
function withTimeout(promise, ms) {
  if (!Number.isFinite(ms) || ms <= 0) return promise
  promise.catch(() => {}) // 時間切れ後に転んでも未処理の失敗にしない
  let timer = null
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error('timeout')
      e.__timeout = true
      reject(e)
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

function makeResult(status, historyId, sideEffectFails, reason) {
  return {
    status,
    historyId: historyId || null,
    sideEffectFails: [...sideEffectFails],
    reason: reason || null,
  }
}

// ---------------------------------------------------------------------------
// 5. 保存（本体）
// ---------------------------------------------------------------------------

/**
 * レシート1枚ぶんを保存します。**再送でも同じ `ids` を渡してください。**
 * 同じ `ids.historyId` で何度呼んでも、イベント合計は二重に加算されません。
 *
 * @param {Object} args
 * @param {string} args.eventId
 * @param {string} [args.eventName] 取引の件名表示用
 * @param {string[]} args.participantUids イベントの参加者UID
 * @param {string} args.creditorUid 立替者（債権者）のUID
 * @param {Share[]} args.shares 各メンバーの負担額。**合計＝総額**でないと保存しません
 * @param {Object} args.payment 支払いの中身
 * @param {string} args.payment.payer 立替者の表示名
 * @param {string} args.payment.itemName 店名
 * @param {number} args.payment.amount 総額（1以上の整数）
 * @param {string} args.payment.date `YYYY/MM/DD`
 * @param {string} [args.payment.time] `HH:MM`（省略時は現在時刻）
 * @param {string} [args.payment.splitType] 既定 'all'
 * @param {SaveIds} args.ids `prepareSaveIds()` の戻り値
 * @param {Record<string,string>} [args.participantNames] UID→表示名（チャット作成に使う）
 * @param {boolean} [args.eventEnded] 終了済みイベントには保存しない
 * @param {string[]} [args.previousSideEffectFails] 前回の付随処理の失敗（引き継いで消さない）
 * @param {number} [args.timeoutMs]
 * @returns {Promise<SaveResult>}
 */
export async function saveOnePayment(args) {
  const {
    eventId,
    eventName = '',
    creditorUid,
    shares,
    payment = {},
    ids,
    participantNames = {},
    previousSideEffectFails = [],
    timeoutMs = SAVE_TIMEOUT_MS,
  } = args || {}

  // 前回の警告は握りつぶさない（同じ種別は1回だけ）
  const sideEffectFails = [...new Set((previousSideEffectFails || []).filter(Boolean))]
  const historyId = ids && ids.historyId ? ids.historyId : null

  const check = validateSavePlan(args)
  if (!check.ok) return makeResult('failed', historyId, sideEffectFails, check.reason)

  let b
  try {
    b = await getBindings()
  } catch (e) {
    // Firestoreを読み込めていない＝1件も書いていない
    return makeResult('failed', historyId, sideEffectFails, 'no-firestore')
  }

  const { db, doc, runTransaction, serverTimestamp, increment } = b
  const historyRef = doc(db, 'events', eventId, 'history', historyId)
  const eventRef = doc(db, 'events', eventId)
  const debtors = debtorsOf(shares, creditorUid)
  const idByUid = new Map(ids.transactions.map((t) => [t.uid, t.id]))
  const transactionIds = debtors.map((d) => idByUid.get(d.uid))
  const itemName = normalizeItemName(payment.itemName)
  const total = Number(payment.amount)

  // 1回の確定処理にまとめる：
  //   履歴の存在確認（読み取り）→ 取引N件＋履歴1件＋イベント合計の加算（書き込み）
  // 全部入るか、全部入らないかのどちらかになります。
  let already = false
  const commit = runTransaction(db, async (tx) => {
    // コールバックはやり直しで再実行され得るので、毎回ここで初期化する。
    // 同じ理由で、この中に副作用（チャット・通知・画面）は置かない。
    already = false
    const snap = await tx.get(historyRef) // 読み取りは必ず書き込みより前
    if (snap.exists()) {
      if (!historyMatchesPlan(snap.data(), args)) throw new Error('plan-conflict')
      already = true
      return // 既に確定済み。合計は足さない
    }
    const eventSnap = await tx.get(eventRef)
    const current = eventSnap.exists() ? eventSnap.data() : null
    const invalid = !current ? 'invalid-event' : current.ended ? 'ended'
      : !Array.isArray(current.participants) || !uniqueIds(current.participants) || current.participants.length !== args.participantUids.length
        || !current.participants.every(uid => args.participantUids.includes(uid)) ? 'participants-changed' : null
    if (invalid) {
      const error = new Error(invalid)
      error.__validationReason = invalid
      throw error
    }
    for (const d of debtors) {
      tx.set(
        doc(db, 'transactions', idByUid.get(d.uid)),
        buildTransactionPayload({
          debtorUid: d.uid,
          creditorUid,
          amount: d.amount,
          eventId,
          eventName,
          itemName,
          historyId,
          serverTimestamp,
        })
      )
    }
    tx.set(
      historyRef,
      buildHistoryPayload({ payment: { ...payment, itemName }, creditorUid, shares, transactionIds, serverTimestamp })
    )
    // 合計の加算も同じ確定処理の中。ここが外に出ると、重複時に合計だけ二重になる。
    tx.update(eventRef, { totalAmount: increment(total) })
  })

  let status
  try {
    await withTimeout(commit, timeoutMs)
    status = already ? 'already' : 'saved'
  } catch (e) {
    if (e && e.__timeout) {
      // 返事が返らなかっただけで、保存の要求を取り消したわけではない。
      // ここを failed にすると「新しく登録し直す」導線に流れて二重登録になる。
      return makeResult('unknown', historyId, sideEffectFails, 'timeout')
    }
    return makeResult(classifySaveError(e), historyId, sideEffectFails, reasonOf(e))
  }

  // ---- ここから付随処理（確定の外）。転んでも saved は取り消さない ----
  await withTimeout(runSideEffects({
    bindings: b,
    status,
    historyId,
    debtors,
    creditorUid,
    eventId,
    eventName,
    itemName,
    total,
    transactionIds,
    participantNames,
    sideEffectFails,
  }), args.sideEffectTimeoutMs ?? 10000).catch(() => {
    if (!sideEffectFails.includes('チャット')) sideEffectFails.push('チャット')
  })

  return makeResult(status, historyId, sideEffectFails, null)
}

/**
 * 付随処理（いまはグループチャットの生成だけ）。
 * 取引には最初から `historyId` を入れてあるので、後付けの `updateDoc` ループはありません。
 */
async function runSideEffects(ctx) {
  const {
    bindings: b, status, historyId, debtors, creditorUid, eventId, eventName,
    itemName, total, transactionIds, participantNames, sideEffectFails,
  } = ctx

  const markFailed = (kind, e) => {
    if (!sideEffectFails.includes(kind)) sideEffectFails.push(kind)
    console.error(`支払いは保存できたが「${kind}」の反映に失敗:`, e)
  }
  const clearFailed = (kind) => {
    const index = sideEffectFails.indexOf(kind)
    if (index >= 0) sideEffectFails.splice(index, 1)
  }

  if (debtors.length === 0) return // 割り勘の相手がいない＝チャットは作らない

  const info = () => {
    const participants = [creditorUid, ...debtors.map((d) => d.uid)]
    const names = {}
    participants.forEach((uid) => {
      // 一人称は相手の一覧にそのまま出るので、保存の時点で弾く
      names[uid] = isSelfName(participantNames[uid]) ? 'メンバー' : participantNames[uid]
    })
    return {
      participants,
      participantNames: names,
      creditorUid,
      eventId,
      eventName,
      itemName,
      amount: total,
      transactionIds,
    }
  }

  try {
    if (status === 'saved') {
      await b.ensurePaymentThread(historyId, info())
      clearFailed('チャット')
      return
    }

    // status === 'already'：前回の送信で保存は済んでいるが、そのときチャット作成に
    // 失敗していたかもしれない。警告を黙って消さないために、チャットの有無を
    // サーバーで確かめ、無いぶんだけ補う方針にする。
    // 無条件に作り直さないのは、`ensurePaymentThread` が merge 書き込みで
    // unread（未読数）や lastMessage を初期値へ戻してしまうため。
    const missing = await paymentThreadMissingOnServer(b, historyId)
    if (missing === true) {
      await b.ensurePaymentThread(historyId, info())
      clearFailed('チャット')
    } else if (missing === false) {
      clearFailed('チャット')
    } else if (missing === null) {
      // 確かめられなかった＝「チャットは反映済み」とは言えない。警告を残す。
      markFailed('チャット', new Error('チャットの有無を確認できませんでした'))
    }
  } catch (e) {
    markFailed('チャット', e)
  }
}

/**
 * 保存結果が不明だった後に履歴の確定を確認できた場合、金額を再送せず付随処理だけを補う。
 * チャットが既にあれば触らず、無いとサーバーで確認できた場合だけ作成する。
 */
export async function recoverPaymentSideEffects(args) {
  const {
    eventId,
    eventName = '',
    creditorUid,
    shares,
    payment = {},
    ids,
    participantNames = {},
    previousSideEffectFails = [],
    timeoutMs = 10000,
  } = args || {}
  const sideEffectFails = [...new Set((previousSideEffectFails || []).filter(Boolean))]
  const historyId = ids?.historyId || null
  const check = validateSavePlan(args)
  if (!check.ok) return makeResult('unknown', historyId, sideEffectFails, check.reason)

  let b
  try { b = await getBindings() }
  catch { return makeResult('saved', historyId, [...new Set([...sideEffectFails, 'チャット'])], 'no-firestore') }

  const debtors = debtorsOf(shares, creditorUid)
  const idByUid = new Map(ids.transactions.map(item => [item.uid, item.id]))
  const transactionIds = debtors.map(item => idByUid.get(item.uid))
  await withTimeout(runSideEffects({
    bindings: b,
    status: 'already',
    historyId,
    debtors,
    creditorUid,
    eventId,
    eventName,
    itemName: normalizeItemName(payment.itemName),
    total: Number(payment.amount),
    transactionIds,
    participantNames,
    sideEffectFails,
  }), timeoutMs).catch(() => {
    if (!sideEffectFails.includes('チャット')) sideEffectFails.push('チャット')
  })
  return makeResult('saved', historyId, sideEffectFails, sideEffectFails.length ? 'side-effect-failed' : null)
}

/**
 * 支払いチャットが「サーバー上に」無いかどうか。
 * @returns {Promise<boolean|null>} true=無い / false=ある / null=確かめられなかった
 */
async function paymentThreadMissingOnServer(b, historyId) {
  if (!b.getDocFromServer || !b.paymentThreadId) return null
  try {
    const snap = await b.getDocFromServer(b.doc(b.db, 'threads', b.paymentThreadId(historyId)))
    if (!isServerTruth(snap)) return null // キャッシュの返事は判断材料にしない
    return !snap.exists()
  } catch (e) {
    return null
  }
}

/** キャッシュ由来・未確定の書き込み込みの返事を、確定と見なさないための確認。 */
function isServerTruth(snap) {
  const meta = snap && snap.metadata
  if (!meta) return false
  return meta.fromCache === false && meta.hasPendingWrites === false
}

// ---------------------------------------------------------------------------
// 6. 再確認（`unknown` のカード用）
// ---------------------------------------------------------------------------

/**
 * 履歴がサーバーで確定しているかを確かめ直します。`unknown` のカードの入口に使います。
 *
 * - `saved`: サーバーが「ある」と答えた（キャッシュではない）
 * - `failed`: サーバーが「無い」と答えた＝同じIDで送り直してよい
 * - `unknown`: 確かめられなかった。**読めない理由が権限エラーでも、保存されていない
 *   証拠にはならない**ので `failed` にはしません。
 *
 * @param {Object} params
 * @param {string} params.eventId
 * @param {string} params.historyId
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ status: 'saved'|'failed'|'unknown', historyId: string|null, reason: string|null }>}
 */
export async function confirmSavedOnServer({ eventId, historyId, plan, timeoutMs = SAVE_TIMEOUT_MS }) {
  if (!eventId || !historyId) return { status: 'unknown', historyId: historyId || null, reason: 'missing-ids' }
  let b
  try {
    b = await getBindings()
  } catch (e) {
    return { status: 'unknown', historyId, reason: 'no-firestore' }
  }
  try {
    const snap = await withTimeout(
      b.getDocFromServer(b.doc(b.db, 'events', eventId, 'history', historyId)),
      timeoutMs
    )
    if (!isServerTruth(snap)) return { status: 'unknown', historyId, reason: 'cache-only' }
    if (snap.exists() && plan && !historyMatchesPlan(snap.data(), plan)) return { status: 'unknown', historyId, reason: 'plan-conflict' }
    return snap.exists()
      ? { status: 'saved', historyId, reason: null }
      : { status: 'failed', historyId, reason: 'not-saved' }
  } catch (e) {
    if (e && e.__timeout) return { status: 'unknown', historyId, reason: 'timeout' }
    return { status: 'unknown', historyId, reason: reasonOf(e) }
  }
}
