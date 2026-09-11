<script setup>
/**
 * 結果カードの確認用画面（開発中だけ・本番には出ません）。
 *
 * 何のための画面か
 *   複数レシート一括読み込みの「結果カード」を、Firebase もレシートの読み取りも使わずに
 *   1枚だけ置いて、9状態の見た目と、親へ届くイベントを目で確かめるための場所です。
 *
 * 開き方
 *   npm run dev → http://localhost:5173/#/dev/card-sandbox
 *   （このアプリの router はハッシュ方式なので、URL に `#` が入ります）
 *
 * どのカードを出すか
 *   `src/components/ReceiptResultCard.vue`（本物）があればそれを、無ければ
 *   `ReceiptResultCardStub.vue`（仮）を出します。画面の上にどちらを出しているかを書きます。
 *   本物を置いたあとは、いちど dev サーバーを再起動すると確実に切り替わります。
 */
import { computed, defineAsyncComponent, ref } from 'vue'
import ReceiptResultCardStub from '../components/ReceiptResultCardStub.vue'
import { BATCH_CARD_STATE_ORDER, listBatchCardStates } from '../lib/batchStates'

/* --- 本物のカードがあれば読み込む ------------------------------------------
   まだ存在しないファイルを `import()` で直接書くとビルドが通らないため、
   `import.meta.glob` で「あれば入る／無ければ空」の形にしています。 */
const realCardModules = import.meta.glob('../components/ReceiptResultCard.vue')
const realCardLoader = realCardModules['../components/ReceiptResultCard.vue']
const usingRealCard = Boolean(realCardLoader)

const CardComponent = realCardLoader
  ? defineAsyncComponent({
      loader: realCardLoader,
      // 本物の読み込みに失敗しても、この画面ごと真っ白にはしない
      errorComponent: ReceiptResultCardStub,
      timeout: 5000,
    })
  : ReceiptResultCardStub

/* --- カードへ流し込む値 ---------------------------------------------------- */
const state = ref('ready')
const store = ref('鳥貴族 名古屋駅前店')
const amount = ref('6820')
const date = ref('2026/09/13')
const reasonText = ref('')

const states = listBatchCardStates()
const currentSpec = computed(() => states.find((s) => s.state === state.value))

/** 画面の幅を切り替える（スマホ幅の再現） */
const frames = [
  { key: 'w320', label: '320px', width: 320 },
  { key: 'w390', label: '390px', width: 390 },
  { key: 'full', label: '画面いっぱい', width: 0 },
]
const frame = ref('w390')
const frameWidth = computed(() => {
  const f = frames.find((x) => x.key === frame.value)
  return f && f.width ? `${f.width}px` : '100%'
})

/* --- 親が受け取ったイベントのログ ------------------------------------------ */
const logs = ref([])
const LOG_MAX = 60

const stamp = () => {
  const d = new Date()
  const pad = (n, w = 2) => String(n).padStart(w, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
}

const pushLog = (name, detail) => {
  logs.value.unshift({ id: `${Date.now()}-${Math.random()}`, time: stamp(), name, detail })
  if (logs.value.length > LOG_MAX) logs.value.length = LOG_MAX
}

const clearLogs = () => { logs.value = [] }

/** カードから金額が届いた。契約どおり文字列のまま受け取る（丸めない）。 */
const onUpdateAmount = (value) => {
  amount.value = value
  pushLog('update:amount', `${typeof value} ／ ${value === '' ? '(空文字)' : JSON.stringify(value)}`)
}

/** 除外したい。state を親が差し替えるのが本番と同じ形。 */
const onRemove = () => {
  pushLog('remove', '引数なし')
  state.value = 'excluded'
}

/** 除外から戻したい。本番では除外前の状態へ戻す（ここでは ready にする）。 */
const onRestore = () => {
  pushLog('restore', '引数なし')
  state.value = 'ready'
}

/* --- 手早く試すための下ごしらえ -------------------------------------------- */
const presets = [
  { label: '普通のレシート', store: '鳥貴族 名古屋駅前店', amount: '6820', date: '2026/09/13', reasonText: '' },
  { label: '長い店名', store: 'セブン-イレブン愛知工業大学八草キャンパス前店 二号店', amount: '1240', date: '2026/09/13', reasonText: '' },
  { label: '金額が空', store: 'ローソン', amount: '', date: '2026/09/13', reasonText: '金額を読み取れませんでした。手で入れてください。' },
  { label: '店名も日付も空', store: '', amount: '980', date: '', reasonText: '日付を読み取れませんでした。' },
  { label: '外貨で要確認', store: 'DUTY FREE SHOP', amount: '', date: '2026/09/13', reasonText: '日本円以外のレシートのようです。金額は入れていません。' },
]

const applyPreset = (p) => {
  store.value = p.store
  amount.value = p.amount
  date.value = p.date
  reasonText.value = p.reasonText
  pushLog('（この画面の操作）', `下ごしらえ「${p.label}」を流し込みました`)
}

/** 親から値を変えたときに、カードの表示が追従するかを見るためのボタン */
const bumpAmount = () => {
  const next = String((Number(amount.value) || 0) + 1000)
  amount.value = next
  pushLog('（この画面の操作）', `親から amount を ${next} に変えました`)
}
</script>

<template>
  <div class="screen sandbox">
    <div class="card sandbox__head">
      <h1 class="sandbox__title">結果カードの確認用画面</h1>
      <p class="sandbox__lead">
        開発中だけの画面です。Firebase もレシートの読み取りも使いません。
        カードの見た目と、親へ届くイベントをここで確かめます。
      </p>
      <p class="sandbox__which" :class="usingRealCard ? 'is-real' : 'is-stub'">
        いま出しているカード：<strong>{{ usingRealCard ? '本物（ReceiptResultCard.vue）' : '仮（ReceiptResultCardStub.vue）' }}</strong>
        <span v-if="!usingRealCard" class="sandbox__which-note">
          ／ src/components/ReceiptResultCard.vue を置くと、こちらが自動で本物に変わります
        </span>
      </p>
    </div>

    <!-- 状態の切り替え -->
    <div class="card sandbox__block">
      <p class="section-title">状態を切り替える（全9つ）</p>
      <div class="sandbox__states">
        <button
          v-for="s in states"
          :key="s.state"
          type="button"
          class="sandbox__state-btn"
          :class="{ 'is-active': s.state === state }"
          @click="state = s.state"
        >
          <span class="sandbox__state-key">{{ s.state }}</span>
          <span class="sandbox__state-label">{{ s.label }}</span>
        </button>
      </div>

      <div v-if="currentSpec" class="sandbox__spec">
        <p class="sandbox__spec-meaning">{{ currentSpec.meaning }}</p>
        <ul class="sandbox__spec-list">
          <li>金額を編集：<b>{{ currentSpec.canEditAmount ? 'できる' : 'できない' }}</b></li>
          <li>除外：<b>{{ currentSpec.canExclude ? 'できる' : 'できない' }}</b></li>
          <li>戻す：<b>{{ currentSpec.canRestore ? 'できる' : 'できない' }}</b></li>
          <li>登録の対象：<b>{{ currentSpec.isSubmitTarget ? '対象' : '対象外' }}</b>（親が判断）</li>
        </ul>
      </div>
    </div>

    <!-- 流し込む値 -->
    <div class="card sandbox__block">
      <p class="section-title">カードへ流し込む値</p>

      <div class="sandbox__presets">
        <button v-for="p in presets" :key="p.label" type="button" class="sandbox__chip" @click="applyPreset(p)">
          {{ p.label }}
        </button>
      </div>

      <label class="sandbox__field">
        <span class="sandbox__field-label">store（店名）</span>
        <input v-model="store" type="text" class="sandbox__input" placeholder="空にすると、空のときの表示が見られます">
      </label>

      <label class="sandbox__field">
        <span class="sandbox__field-label">amount（金額・文字列）</span>
        <input v-model="amount" type="text" class="sandbox__input" placeholder="空文字も試してください">
      </label>

      <label class="sandbox__field">
        <span class="sandbox__field-label">date（日付）</span>
        <input v-model="date" type="text" class="sandbox__input" placeholder="2026/09/13">
      </label>

      <label class="sandbox__field">
        <span class="sandbox__field-label">reasonText（理由・任意）</span>
        <input v-model="reasonText" type="text" class="sandbox__input" placeholder="要確認や失敗の理由">
      </label>

      <button type="button" class="btn-outline sandbox__bump" @click="bumpAmount">
        親から金額を +1000 する（カードが追従するか）
      </button>
    </div>

    <!-- カードの表示 -->
    <div class="card sandbox__block">
      <div class="sandbox__frame-head">
        <p class="section-title sandbox__frame-title">カードの表示</p>
        <div class="seg sandbox__seg">
          <button
            v-for="f in frames"
            :key="f.key"
            type="button"
            class="seg__item"
            :class="{ 'is-active': frame === f.key }"
            @click="frame = f.key"
          >{{ f.label }}</button>
        </div>
      </div>

      <div class="sandbox__stage">
        <div class="sandbox__frame" :style="{ width: frameWidth }">
          <component
            :is="CardComponent"
            :store="store"
            :amount="amount"
            :date="date"
            :state="state"
            :reason-text="reasonText"
            @update:amount="onUpdateAmount"
            @remove="onRemove"
            @restore="onRestore"
          />
        </div>
      </div>
      <p class="sandbox__hint">枠の幅＝スマホの画面幅の目安です。入力欄やボタンが枠からはみ出さないか見てください。</p>
    </div>

    <!-- イベントのログ -->
    <div class="card sandbox__block">
      <div class="sandbox__log-head">
        <p class="section-title sandbox__frame-title">親に届いたイベント</p>
        <button type="button" class="sandbox__chip" @click="clearLogs">ログを消す</button>
      </div>
      <p v-if="!logs.length" class="sandbox__hint">まだ何も届いていません。カードの金額を変える／除外する／戻すと、ここに出ます。</p>
      <ol v-else class="sandbox__logs">
        <li v-for="l in logs" :key="l.id" class="sandbox__log">
          <span class="sandbox__log-time tnum">{{ l.time }}</span>
          <span class="sandbox__log-name">{{ l.name }}</span>
          <span class="sandbox__log-detail">{{ l.detail }}</span>
        </li>
      </ol>
    </div>

    <!-- 状態の一覧（仕様の正本） -->
    <div class="card sandbox__block">
      <p class="section-title">9状態の一覧（正本＝src/lib/batchStates.js）</p>
      <div class="sandbox__table-wrap">
        <table class="sandbox__table">
          <thead>
            <tr><th>state</th><th>表示名</th><th>編集</th><th>除外</th><th>戻す</th><th>登録</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in states" :key="s.state" :class="{ 'is-current': s.state === state }">
              <td><code>{{ s.state }}</code></td>
              <td>{{ s.label }}</td>
              <td>{{ s.canEditAmount ? '○' : '×' }}</td>
              <td>{{ s.canExclude ? '○' : '×' }}</td>
              <td>{{ s.canRestore ? '○' : '×' }}</td>
              <td>{{ s.isSubmitTarget ? '対象' : '×' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="sandbox__hint">
        並び順は {{ BATCH_CARD_STATE_ORDER.join(' → ') }} です。
        再送（retry）のイベントはカードに作りません。保存失敗・応答不明のカードをもう一度送るのは親の仕事です。
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 色・余白・角丸は base.css のトークンから取ります。
   文字サイズだけはトークンが無いため具体値で書きます（この画面は開発中だけの道具です）。 */
.sandbox { padding-bottom: var(--space-6); }

.sandbox__head { margin-bottom: var(--space-3); }
.sandbox__title { font-size: 18px; margin-bottom: var(--space-2); }
.sandbox__lead { font-size: 13px; line-height: 1.7; color: var(--c-text-sub); }

.sandbox__which {
  margin-top: var(--space-3);
  font-size: 13px;
  line-height: 1.6;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--r-sm);
  overflow-wrap: anywhere;
}
.sandbox__which.is-real { background: var(--c-brand-weak); color: var(--c-brand-deep); }
.sandbox__which.is-stub { background: var(--c-pay-weak); color: var(--c-pay-strong); }
.sandbox__which-note { display: block; font-size: 12px; opacity: 0.85; }

.sandbox__block { margin-bottom: var(--space-3); }

.sandbox__states { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.sandbox__state-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
}
.sandbox__state-btn.is-active { border-color: var(--c-brand); background: var(--c-brand-weak); }
.sandbox__state-key { font-size: 12px; font-weight: var(--fw-bold); color: var(--c-text-strong); }
.sandbox__state-label { font-size: 12px; color: var(--c-text-sub); }
.sandbox__state-btn.is-active .sandbox__state-key,
.sandbox__state-btn.is-active .sandbox__state-label { color: var(--c-brand-deep); }

.sandbox__spec { margin-top: var(--space-3); }
.sandbox__spec-meaning { font-size: 13px; line-height: 1.7; color: var(--c-text); }
.sandbox__spec-list { display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); margin-top: var(--space-2); }
.sandbox__spec-list li { font-size: 12px; color: var(--c-text-sub); }
.sandbox__spec-list b { color: var(--c-ink); }

.sandbox__presets { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-3); }
.sandbox__chip {
  font-size: 12px;
  font-weight: var(--fw-bold);
  color: var(--c-text-strong);
  background: var(--c-surface-2);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-pill);
  padding: var(--space-1) var(--space-3);
}

.sandbox__field { display: block; margin-bottom: var(--space-3); }
.sandbox__field-label { display: block; font-size: 12px; font-weight: var(--fw-bold); color: var(--c-text-strong); margin-bottom: var(--space-1); }
.sandbox__input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--c-line-bold);
  border-radius: var(--r-sm);
  background: var(--c-surface-2);
}
.sandbox__bump { width: 100%; }

.sandbox__frame-head,
.sandbox__log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}
.sandbox__frame-title { margin: 0; }
.sandbox__seg { flex-shrink: 0; }

.sandbox__stage {
  background: var(--c-bg);
  border-radius: var(--r-md);
  padding: var(--space-3);
  display: flex;
  justify-content: center;
  overflow-x: auto;
}
.sandbox__frame { max-width: 100%; flex-shrink: 0; }

.sandbox__hint { font-size: 12px; line-height: 1.7; color: var(--c-text-sub); margin-top: var(--space-2); }

.sandbox__logs { display: flex; flex-direction: column; gap: var(--space-1); }
.sandbox__log {
  display: flex;
  gap: var(--space-2);
  font-size: 12px;
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--c-line);
  overflow-wrap: anywhere;
}
.sandbox__log-time { color: var(--c-text-faint); flex-shrink: 0; }
.sandbox__log-name { font-weight: var(--fw-bold); color: var(--c-brand-deep); flex-shrink: 0; }
.sandbox__log-detail { color: var(--c-text-sub); }

.sandbox__table-wrap { overflow-x: auto; }
.sandbox__table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sandbox__table th,
.sandbox__table td { border-bottom: 1px solid var(--c-line); padding: var(--space-1) var(--space-2); text-align: left; white-space: nowrap; }
.sandbox__table th { color: var(--c-text-strong); font-weight: var(--fw-bold); }
.sandbox__table td { color: var(--c-text-sub); }
.sandbox__table tr.is-current td { background: var(--c-brand-weak); color: var(--c-brand-deep); }
.sandbox__table code { font-size: 12px; }
</style>
