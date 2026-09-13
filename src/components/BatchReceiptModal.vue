<script setup>
/**
 * 複数レシート一括読み込みシート（最小形＝S0）。
 *
 * 複数レシート一括読み込み_設計図.md のとおり、次の範囲だけを実装します。
 *   最大3枚／1枚ずつ順に読み取り／同一イベント・同一立替者・全員均等／
 *   除外できる／部分成功を件数で報告／再送しても増えない。
 *
 * このファイルはまだどこからも開かれません（入口をつなぐのは別日の作業）。
 * 開発中は `/dev/card-sandbox`（`CardSandboxView.vue`）から手動で確認できます。
 *
 * 守っていること
 * - 結果カードは `ReceiptResultCardStub.vue` をそのまま使う（本物のカードは作らない）。
 *   カードには `retry` を作らない約束なので、再送・再確認のボタンはこの画面側に置く。
 * - 保存は `batchPaymentSave.js` を呼ぶだけ。保存ロジック（固定ID・バッチ確定・
 *   二重防止）はここに書かない。`unknown`（応答不明）のカードは、利用者が
 *   ボタンを押したときしか確認・再送しない（自動での再送は二重登録の入口になる）。
 * - 読み取りは1枚ずつ `await` で待ってから次へ進む（並列にしない）。
 * - 金額は文字列のまま持ち回り、表示直前だけ整形する（`toLocaleString` は表示専用）。
 */
import { ref, computed, watch } from 'vue'
import { app } from '@/firebase'
import { getFunctions, httpsCallable } from 'firebase/functions'
import ReceiptResultCardStub from '@/components/ReceiptResultCardStub.vue'
import { isSubmitTarget, canExclude, canRestore } from '@/lib/batchStates.js'
import { prepareSaveIds, saveOnePayment, confirmSavedOnServer } from '@/lib/batchPaymentSave.js'
import { evenShares } from '@/lib/evenShares.js'
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  ANALYZE_TIMEOUT_MS,
  RETRY_GAP_MS,
  clampReceiptData,
  evaluateCardReadiness,
  sumReadyAmounts,
  summarizeBatchResults,
  describeSaveFailure,
} from '@/lib/batchReceiptCalc.js'

const props = defineProps({
  isOpen: Boolean,
  eventId: { type: String, required: true },
  eventName: { type: String, default: '' },
  eventEnded: { type: Boolean, default: false },
  // イベントの実参加者。AddPaymentModal.vue と同じ形（{ id, name, photo, isMe }）
  participants: { type: Array, default: () => [] },
  myUid: { type: String, default: '' },
  myName: { type: String, default: '' },
})
const emit = defineEmits(['close'])

// --- シート全体の状態 -------------------------------------------------------
const fileInput = ref(null)
const cards = ref([])
const runId = ref(0) // 選び直し・閉じるたびに増やす。古い読み取りの遅延到着を見分ける（設計4-8）
const readingIndex = ref(0) // 0＝読み取り中でない
const totalToRead = ref(0)
const overflowNotice = ref('')
const creditorUid = ref('')
const batchBusy = ref(false) // 保存にかかわる操作をまとめてロックする（二度押し防止）

let cardSeq = 0

// シートを開いた瞬間に初期状態へ戻す（編集の途中で閉じても、次に開いたときは新規扱い）
watch(
  () => props.isOpen,
  (open) => {
    if (open) resetSheet()
  }
)

function resetSheet() {
  runId.value += 1 // 走っている読み取りがあれば、その結果は捨てる
  cards.value = []
  overflowNotice.value = ''
  batchBusy.value = false
  readingIndex.value = 0
  totalToRead.value = 0
  const me = (props.participants || []).find((p) => p.isMe)
  creditorUid.value = (me && me.id) || props.myUid || (props.participants || [])[0]?.id || ''
}

function closeModal() {
  if (batchBusy.value) return // 保存の途中は閉じない（送信は取り消せないため・4-3）
  runId.value += 1 // 呼び出し自体は止められないが、返ってきても画面には反映しない
  emit('close')
}

// --- 読み取り ----------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function pickFiles() {
  if (props.eventEnded || batchBusy.value) return
  fileInput.value?.click()
}

function onFilesChosen(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = '' // 同じファイルを選び直しても change が発火するように
  if (files.length > 0) startReading(files)
}

function makeCard(file) {
  cardSeq += 1
  return {
    id: `brc-${Date.now()}-${cardSeq}`,
    file,
    store: '',
    amount: '',
    date: '',
    state: 'reading',
    reasonText: '',
    prevState: null, // 除外する前の状態（戻すときに使う）
    sideEffectFails: [],
    saveReason: null,
    ids: null, // prepareSaveIds() の戻り値。一度決めたら送信のたびに使い回す
    frozenPayment: null, // 送信直前に固定した内容（再送でも同じものを送る）
    frozenShares: null,
  }
}

async function startReading(files) {
  runId.value += 1
  const myRun = runId.value

  overflowNotice.value =
    files.length > MAX_IMAGES ? `4枚以上選ばれたので、最初の${MAX_IMAGES}枚だけを読み取りました。` : ''

  const targets = files.slice(0, MAX_IMAGES)
  cards.value = targets.map((file) => makeCard(file))
  totalToRead.value = cards.value.length

  // 1枚ずつ必ず await して待つ（Geminiの同時実行と費用を避けるため並列にしない・設計4-2）
  for (let i = 0; i < cards.value.length; i += 1) {
    if (myRun !== runId.value) return // シートを閉じた／選び直した
    readingIndex.value = i + 1
    const card = cards.value[i]
    await readOneCard(card, myRun)
    if (myRun !== runId.value) return
    const isLast = i === cards.value.length - 1
    if (card.state === 'readFailed' && !isLast) {
      await sleep(RETRY_GAP_MS) // 失敗直後に間を置かず叩き続けない（設計4-2）
    }
  }
  readingIndex.value = 0
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(reader.error || new Error('file-read-error'))
    reader.readAsDataURL(file)
  })
}

/** 読み取り中・除外されていない・現在の読み取り回であるカードにだけ結果を反映する。 */
function applyToCard(card, myRun, patch) {
  if (myRun !== runId.value) return // シートを閉じた／選び直した後の遅延到着は捨てる
  if (!cards.value.includes(card)) return
  if (card.state === 'excluded') return // 読み取り中に除外されたら、返ってきた結果は捨てる（設計3-3）
  Object.assign(card, patch)
}

async function readOneCard(card, myRun) {
  if (card.file.size > MAX_IMAGE_BYTES) {
    applyToCard(card, myRun, {
      state: 'readFailed',
      reasonText: '画像が大きすぎます（4MBを超えています）。別の写真を選ぶか、除外してください。',
    })
    return
  }

  let dataUrl
  try {
    dataUrl = await fileToDataUrl(card.file)
  } catch (e) {
    applyToCard(card, myRun, { state: 'readFailed', reasonText: '画像を読み込めませんでした。' })
    return
  }

  try {
    // 既存の1枚読み取り（AddPaymentModal.vue）と同じ呼び方。ここだけタイムアウトを明示する（設計4-3）
    const functions = getFunctions(app, 'asia-northeast1')
    const analyzeReceipt = httpsCallable(functions, 'analyzeReceipt', { timeout: ANALYZE_TIMEOUT_MS })
    const result = await analyzeReceipt({ image: dataUrl })
    const clamped = clampReceiptData(result.data)
    const readiness = evaluateCardReadiness({ amount: clamped.amount, date: clamped.date })
    applyToCard(card, myRun, {
      state: readiness.ready ? 'ready' : 'warn',
      store: clamped.store,
      amount: clamped.amount,
      date: clamped.date,
      reasonText: clamped.notice,
    })
  } catch (e) {
    console.error('一括読み取り：1枚の解析に失敗:', e)
    applyToCard(card, myRun, {
      state: 'readFailed',
      reasonText: '通信の状態か時間切れで読み取れませんでした。金額を手で入れれば進められます。',
    })
  }
}

const progressText = computed(() => {
  if (readingIndex.value > 0) return `${totalToRead.value}枚中 ${readingIndex.value}枚目を読んでいます`
  if (cards.value.length > 0) return `${totalToRead.value}枚中 ${cards.value.length}枚 完了`
  return ''
})

// --- カードの操作（金額の手直し・除外・戻す） --------------------------------
function todayDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

function onCardAmountUpdate(card, value) {
  card.amount = value
  if (card.state !== 'warn' && card.state !== 'readFailed') return

  // readFailed は日付を読み取れていない（一括側は日付を編集できない仕様のため）。
  // 金額が手で入ったら「新規の手入力」として今日の日付を補う（AddPaymentModal.vue の
  // 新規作成時と同じ既定値）。warn（読み取りはできたが日付が読めない等）は補わない＝
  // 読み取った値のまま登録する方針を守り、日付が原因の warn は除外してもらう。
  if (card.state === 'readFailed' && !card.date) card.date = todayDate()

  const readiness = evaluateCardReadiness({ amount: card.amount, date: card.date })
  if (readiness.ready) {
    card.state = 'ready'
    card.reasonText = ''
  }
}

function onCardRemove(card) {
  if (!canExclude(card.state)) return
  card.prevState = card.state
  card.state = 'excluded'
}

function onCardRestore(card) {
  if (!canRestore(card.state)) return
  card.state = card.prevState || 'warn'
  card.prevState = null
}

/** 保存に失敗・確認できなかったカードは、OCRの注意書きより今の理由を優先して見せる。 */
function cardReasonText(card) {
  if (card.state === 'saveFailed' || card.state === 'unknown') {
    return describeSaveFailure(card.saveReason) || card.reasonText
  }
  return card.reasonText
}

// --- まとめて設定・合計 -------------------------------------------------------
const participantNameMap = computed(() => {
  const map = {}
  ;(props.participants || []).forEach((p) => {
    if (p && p.id) map[p.id] = p.name || ''
  })
  return map
})

function payerName(uid) {
  const found = (props.participants || []).find((p) => p.id === uid)
  return found ? found.name : props.myName || ''
}

const readyCount = computed(() => cards.value.filter((c) => isSubmitTarget(c.state)).length)
const displayTotal = computed(() => sumReadyAmounts(cards.value))

// --- 保存 ---------------------------------------------------------------------
/**
 * レシート1枚ぶんを保存する。`ids` と `frozenPayment` / `frozenShares` は
 * 初回だけ確定させ、再送（retryFailed・resultSummary経由の再実行）では
 * 必ず同じものを使い回す。ここを送信のたびに作り直すと、金額を直していなくても
 * 別内容として送ってしまう恐れがあるため（設計4-5）。
 */
async function saveCard(card) {
  card.state = 'saving'
  card.saveReason = null

  if (!card.ids) {
    const shares = evenShares(props.participants, Number(card.amount), creditorUid.value)
    card.frozenShares = shares
    card.frozenPayment = {
      payer: payerName(creditorUid.value),
      itemName: card.store,
      amount: Number(card.amount),
      date: card.date,
      splitType: 'all',
    }
    card.ids = await prepareSaveIds({
      eventId: props.eventId,
      creditorUid: creditorUid.value,
      shares,
    })
  }

  const result = await saveOnePayment({
    eventId: props.eventId,
    eventName: props.eventName,
    creditorUid: creditorUid.value,
    shares: card.frozenShares,
    payment: card.frozenPayment,
    ids: card.ids,
    participantNames: participantNameMap.value,
    eventEnded: props.eventEnded,
    previousSideEffectFails: card.sideEffectFails,
  })

  card.sideEffectFails = result.sideEffectFails
  card.saveReason = result.reason
  card.state =
    result.status === 'saved' || result.status === 'already'
      ? 'saved'
      : result.status === 'unknown'
        ? 'unknown'
        : 'saveFailed'
}

async function submitReady() {
  if (batchBusy.value || props.eventEnded || !creditorUid.value) return
  const targets = cards.value.filter((c) => isSubmitTarget(c.state)) // 押した瞬間に対象を固定する
  if (targets.length === 0) return
  batchBusy.value = true
  try {
    for (const card of targets) await saveCard(card) // 必ず順番に待つ（並列にしない）
  } finally {
    batchBusy.value = false // 例外が出ても必ず解除する（押せないまま固まらないように）
  }
}

/** 保存に失敗したと確認できたカードだけ、利用者が押したときに送り直す。自動では送らない。 */
async function retryFailed(card) {
  if (batchBusy.value) return
  batchBusy.value = true
  try {
    await saveCard(card)
  } finally {
    batchBusy.value = false
  }
}

/**
 * 応答が返らず `unknown` のままのカードを確認する。**ここでは書き込みをしない**
 * （`confirmSavedOnServer` は読むだけ）。保存されていないと確認できたら `saveFailed` にして、
 * そこから先は `retryFailed` の通常の再送に任せる。応答不明のまま自動で送り直すことはしない。
 */
async function recheckUnknown(card) {
  if (batchBusy.value || !card.ids) return
  batchBusy.value = true
  try {
    const r = await confirmSavedOnServer({ eventId: props.eventId, historyId: card.ids.historyId })
    if (r.status === 'saved') {
      card.state = 'saved'
      card.saveReason = null
    } else if (r.status === 'failed') {
      card.state = 'saveFailed'
      card.saveReason = r.reason
    } else {
      card.saveReason = r.reason // まだ分からない。unknown のまま
    }
  } finally {
    batchBusy.value = false
  }
}

/** 保存が終わった（成功・失敗・応答不明）カードだけを見て、シートに出す結果文言を作る（設計3-4）。 */
const resultSummary = computed(() => {
  const finished = cards.value.filter((c) => c.state === 'saved' || c.state === 'saveFailed' || c.state === 'unknown')
  if (finished.length === 0) return null // まだ1件も終わっていない（未送信・保存中のみ）
  const results = finished.map((c) => ({
    status: c.state === 'saved' ? 'saved' : c.state === 'unknown' ? 'unknown' : 'failed',
    sideEffectFails: c.sideEffectFails,
  }))
  return summarizeBatchResults(results)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="brm-overlay" @click.self="closeModal">
      <div class="brm-sheet">
        <div class="brm-head">
          <h2 class="brm-title">レシートをまとめて読み取る</h2>
          <button class="brm-close" type="button" :disabled="batchBusy" @click="closeModal" aria-label="閉じる">×</button>
        </div>

        <div class="brm-body">
          <div v-if="eventEnded" class="ocr-notice">
            <p class="ocr-notice-line">終了済みのイベントです。新しい支払いは追加できません。</p>
          </div>

          <div v-else-if="cards.length === 0" class="card brm-pick">
            <p class="brm-pick__hint">
              レシートの写真を最大{{ MAX_IMAGES }}枚まで選べます。選ぶとすぐに、1枚ずつ順番に読み取りを始めます。
            </p>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="brm-hidden-input"
              @change="onFilesChosen"
            >
            <button type="button" class="btn-brand" @click="pickFiles">アルバムから選ぶ</button>
          </div>

          <template v-else>
            <p v-if="overflowNotice" class="ocr-notice">
              <span class="ocr-notice-line">{{ overflowNotice }}</span>
            </p>
            <p v-if="progressText" class="brm-progress">{{ progressText }}</p>

            <div class="stack brm-cards">
              <div v-for="card in cards" :key="card.id" class="brm-card">
                <ReceiptResultCardStub
                  :store="card.store"
                  :amount="card.amount"
                  :date="card.date"
                  :state="card.state"
                  :reason-text="cardReasonText(card)"
                  @update:amount="(v) => onCardAmountUpdate(card, v)"
                  @remove="() => onCardRemove(card)"
                  @restore="() => onCardRestore(card)"
                />
                <!-- 再送・再確認はカードに作らない約束（設計）なので、この画面側に置く -->
                <div v-if="card.state === 'saveFailed'" class="brm-card__retry">
                  <button type="button" class="btn-outline" :disabled="batchBusy" @click="retryFailed(card)">
                    もう一度送る
                  </button>
                </div>
                <div v-else-if="card.state === 'unknown'" class="brm-card__retry">
                  <button type="button" class="btn-outline" :disabled="batchBusy" @click="recheckUnknown(card)">
                    保存できたか確認する
                  </button>
                </div>
              </div>
            </div>

            <div class="card brm-settings">
              <p class="section-title">まとめて設定</p>
              <label class="brm-field">
                <span class="brm-field__label">立替えた人</span>
                <select v-model="creditorUid" class="standard-input select-style" :disabled="batchBusy">
                  <option v-if="participants.length === 0" disabled value="">参加者がいません</option>
                  <option v-for="p in participants" :key="p.id" :value="p.id">
                    {{ p.isMe ? p.name + '（自分）' : p.name }}
                  </option>
                </select>
              </label>
              <p class="brm-field__note">割り勘は全員で均等（固定）です。</p>
            </div>

            <div class="card brm-total">
              <span>合計（登録対象 {{ readyCount }}件）</span>
              <strong class="tnum">¥{{ displayTotal.toLocaleString('ja-JP') }}</strong>
            </div>

            <div v-if="resultSummary" class="brm-result" :class="{ 'is-warn': resultSummary.failedCount + resultSummary.unknownCount > 0 }">
              <p>{{ resultSummary.message }}</p>
            </div>

            <button type="button" class="btn-outline" :disabled="batchBusy" @click="resetSheet">写真を選び直す</button>
          </template>
        </div>

        <div v-if="cards.length > 0 && !eventEnded" class="brm-footer">
          <button
            type="button"
            class="btn-brand"
            :disabled="batchBusy || readyCount === 0 || !creditorUid"
            @click="submitReady"
          >
            {{ batchBusy ? '送信しています…' : `${readyCount}件をまとめて追加する` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* モーダルの器・スクロール域・フッターは main.css に無いため、
   複数レシート一括読み込み_設計図.md 1-3 のとおりここに複製する。
   色・角丸・余白・重なり順は base.css のトークンから取り、数値は直書きしない。 */
.brm-overlay {
  position: fixed;
  inset: 0;
  background: var(--c-overlay);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: var(--z-modal);
}
.brm-sheet {
  background: var(--c-bg);
  width: 100%;
  max-width: var(--app-max);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}
.brm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-4) var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-line);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  flex-shrink: 0;
}
.brm-title { margin: 0; font-size: 18px; font-weight: var(--fw-black); color: var(--c-ink); }
.brm-close {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--c-surface-2);
  color: var(--c-text-sub);
  font-size: 18px;
  font-weight: var(--fw-bold);
  flex-shrink: 0;
}
.brm-close:disabled { opacity: 0.5; }

.brm-body {
  overflow-y: auto;
  padding: var(--space-4);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.brm-hidden-input { display: none; }
.brm-pick { padding: var(--space-5) var(--space-4); text-align: center; display: flex; flex-direction: column; gap: var(--space-4); }
.brm-pick__hint { font-size: 13px; color: var(--c-text-sub); line-height: 1.7; }

.brm-progress { font-size: 13px; font-weight: var(--fw-bold); color: var(--c-brand-deep); }

.brm-card { display: flex; flex-direction: column; gap: var(--space-2); }
.brm-card__retry { display: flex; justify-content: flex-end; }
.brm-card__retry .btn-outline { width: auto; padding: var(--space-2) var(--space-4); font-size: 13px; }

.brm-settings { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.brm-field { display: block; }
.brm-field__label { display: block; font-size: 12px; font-weight: var(--fw-bold); color: var(--c-text-sub); margin-bottom: var(--space-1); }
.brm-field__note { font-size: 12px; color: var(--c-text-faint); }

/* AddPaymentModal.vue の同名クラス（scoped）と見た目をそろえるための複製（あちらは触っていない） */
.standard-input {
  width: 100%;
  padding: 12px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--c-line-bold);
  background: var(--c-surface-2);
  font-size: 14px;
  font-weight: var(--fw-heavy);
  color: var(--c-text);
  outline: none;
  box-sizing: border-box;
}
.select-style { appearance: none; cursor: pointer; }

.ocr-notice {
  background: var(--c-pay-weak);
  border: 1px solid var(--c-pay);
  border-radius: var(--r-lg);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.ocr-notice-line { margin: 0; font-size: 12.5px; line-height: 1.6; font-weight: var(--fw-bold); color: var(--c-pay-strong); }

.brm-total { padding: var(--space-4); display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: var(--fw-bold); color: var(--c-text-strong); }
.brm-total strong { font-size: 20px; color: var(--c-ink); }

.brm-result { padding: var(--space-3) var(--space-4); border-radius: var(--r-lg); background: var(--c-brand-weak); color: var(--c-brand-deep); font-size: 13px; font-weight: var(--fw-bold); line-height: 1.7; }
.brm-result.is-warn { background: var(--c-pay-weak); color: var(--c-pay-strong); }

.brm-footer { padding: var(--space-4); background: var(--c-surface); border-top: 1px solid var(--c-line); flex-shrink: 0; }
</style>
