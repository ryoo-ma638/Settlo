<template>
  <div class="money">
    <header class="screen-head">
      <h1 class="screen-head__title">お支払い・精算</h1>
    </header>

    <div class="money__body">
      <div class="seg seg--3" data-tour="pay-tabs">
        <button class="seg__item" :class="{ 'is-active': currentTab === 'waiting' }" @click="currentTab = 'waiting'">お支払い待ち</button>
        <button class="seg__item" :class="{ 'is-active': currentTab === 'unpaid' }" @click="currentTab = 'unpaid'">未払い</button>
        <button class="seg__item" data-tour="pay-settle" :class="{ 'is-active': currentTab === 'settle' }" @click="currentTab = 'settle'">まとめて</button>
      </div>

      <!-- 入金待ち -->
      <div v-if="currentTab === 'waiting'">
        <SkeletonRows v-if="loading" :rows="1" />
        <div v-else class="summary summary--receive">
          <p class="summary__label">{{ receiveHeadline.caption }}</p>
          <div class="summary__amount tnum">¥{{ receiveHeadline.amount.toLocaleString() }}</div>
          <span class="summary__badge">{{ receiveHeadline.count }}件</span>
          <div v-if="receivableReview.length" class="summary__review">
            <span>送金状況の確認が必要</span>
            <strong>¥{{ receivableReviewAmount.toLocaleString() }}・{{ receivableReview.length }}件</strong>
          </div>
          <div v-if="receivableEvent.length && !receiveHeadline.eventOnly" class="summary__review">
            <span>イベントでまとめて精算中</span>
            <strong>¥{{ receivableEventAmount.toLocaleString() }}・{{ receivableEvent.length }}件</strong>
          </div>
        </div>

        <p v-if="!loading && (overviewIssues.length || loadFailed)" class="overview-warning" role="status">一部の取引を確認できないため、確認できた分を表示しています。</p>

        <!-- 同じ相手に「受け取る」と「支払う」の両方があると、この一覧の額面と
             「まとめて」の差し引きが違う数字になる。どちらが本当か分からなくなるので、
             違いが出る相手がいるときだけ理由を出す。 -->
        <button v-if="!loading && offsettablePeople.length" type="button" class="offset-hint" @click="currentTab = 'settle'">
          <span class="offset-hint__title">この一覧は1件ずつの額面です</span>
          <span class="offset-hint__text">
            {{ offsetHintText }}
            「まとめて」では受け取る分と差し引いた、実際にやり取りする金額が出ます。
          </span>
          <span class="offset-hint__go">まとめてを見る ›</span>
        </button>

        <!-- 🌟 あなたの承認が必要（相手が支払い済みでリクエスト中） -->
        <template v-if="!loading && receivableAwaiting.length">
          <h2 class="money__section money__section--action">承認待ち・あなたの承認が必要（{{ receivableAwaiting.length }}件）</h2>
          <div class="stack">
            <div v-for="item in receivableAwaiting" :key="item.id" class="trow trow--action" role="button" tabindex="0"
            @click="openRow(item, 'waiting')"
            @keydown.enter="openRow(item, 'waiting')"
            @keydown.space.prevent="openRow(item, 'waiting')">
              <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge trow__badge--action">あなたが承認</span><span v-if="item.batchId" class="trow__badge">まとめ精算</span></p>
              </div>
              <div class="trow__right">
                <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
                <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            </div>
          </div>
        </template>

        <template v-if="!loading && receivableReview.length">
          <h2 class="money__section money__section--review">送金状況の確認が必要（{{ receivableReview.length }}件）</h2>
          <p class="review-note">追加で送金せず、相手と送金済みか確認してください。</p>
          <div class="stack">
            <div v-for="item in receivableReview" :key="item.id" class="trow trow--review" role="button" tabindex="0"
            @click="openRow(item, 'waiting')"
            @keydown.enter="openRow(item, 'waiting')"
            @keydown.space.prevent="openRow(item, 'waiting')">
              <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge trow__badge--review">送金状況を確認</span></p>
              </div>
              <div class="trow__right"><span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span><svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
            </div>
          </div>
        </template>


        <!-- イベント全体のまとめて精算に入っている分。ここからは操作せず、イベントへ送る -->
        <template v-if="!loading && receivableEvent.length">
          <h2 class="money__section money__section--event">イベントでまとめて精算中（{{ receivableEvent.length }}件）</h2>
          <p class="review-note">この分はイベントの「まとめて精算」でやり取りします。金額は受け取る分と支払う分を差し引いた後の額です。押すとイベントの精算画面が開きます。</p>
          <div class="stack">
            <div v-for="item in receivableEvent" :key="item.id" class="trow trow--event" role="button" tabindex="0"
            @click="openEventSettlement(item)"
            @keydown.enter="openEventSettlement(item)"
            @keydown.space.prevent="openEventSettlement(item)">
              <UserAvatar class="trow__avatar" :name="eventRowName(item)" :photo="item.isEventNetRow ? '' : item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ eventRowName(item) }}</p>
                <p class="trow__sub"><template v-if="item.isEventNetRow">差し引き後にやり取りする金額・{{ item.count }}件分</template><template v-else>{{ item.date }}・{{ item.itemName }}</template><span class="trow__badge trow__badge--event">イベントで精算中</span></p>
              </div>
              <div class="trow__right"><span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span><svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
            </div>
          </div>
        </template>

        <h2 class="money__section">お支払い待ち詳細</h2>
        <div class="stack">
          <SkeletonRows v-if="loading" :rows="4" />
          <div v-else-if="receivableUnpaid.length === 0" class="empty-box">お支払い待ちはありません</div>
          <div v-for="item in receivableUnpaid" :key="item.id" class="trow" role="button" tabindex="0"
            @click="$router.push('/payment-detail/waiting-' + item.id)"
            @keydown.enter="$router.push('/payment-detail/waiting-' + item.id)"
            @keydown.space.prevent="$router.push('/payment-detail/waiting-' + item.id)">
            <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
            <div class="trow__info">
              <p class="trow__name">{{ item.name }}</p>
              <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span v-if="item.remindCount" class="trow__badge trow__badge--remind">催促 {{ item.remindCount }}回</span></p>
            </div>
            <div class="trow__right">
              <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
              <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- 未払い -->
      <div v-else-if="currentTab === 'unpaid'">
        <SkeletonRows v-if="loading" :rows="1" />
        <div v-else class="summary summary--pay">
          <p class="summary__label">{{ payHeadline.eventOnly ? 'イベントで精算中' : '現在の未払い' }}</p>
          <div class="summary__amount tnum">¥{{ payHeadline.amount.toLocaleString() }}</div>
          <span class="summary__badge">{{ payHeadline.count }}件</span>
          <div v-if="payableReview.length" class="summary__review">
            <span>送金状況の確認が必要</span>
            <strong>¥{{ payableReviewAmount.toLocaleString() }}・{{ payableReview.length }}件</strong>
          </div>
          <div v-if="payableEvent.length && !payHeadline.eventOnly" class="summary__review">
            <span>イベントでまとめて精算中</span>
            <strong>¥{{ payableEventAmount.toLocaleString() }}・{{ payableEvent.length }}件</strong>
          </div>
        </div>

        <p v-if="!loading && (overviewIssues.length || loadFailed)" class="overview-warning" role="status">一部の取引を確認できないため、確認できた分を表示しています。</p>

        <button v-if="!loading && offsettablePeople.length" type="button" class="offset-hint" @click="currentTab = 'settle'">
          <span class="offset-hint__title">この一覧は1件ずつの額面です</span>
          <span class="offset-hint__text">
            {{ offsetHintText }}
            「まとめて」では受け取る分と差し引いた、実際にやり取りする金額が出ます。
          </span>
          <span class="offset-hint__go">まとめてを見る ›</span>
        </button>

        <!-- 🌟 リクエスト済み（自分が支払い済み・相手の承認待ち） -->
        <template v-if="!loading && payableAwaiting.length">
          <h2 class="money__section">リクエスト済み・相手の承認待ち（{{ payableAwaiting.length }}件）</h2>
          <div class="stack">
            <div v-for="item in payableAwaiting" :key="item.id" class="trow trow--muted" role="button" tabindex="0"
            @click="openRow(item, 'unpaid')"
            @keydown.enter="openRow(item, 'unpaid')"
            @keydown.space.prevent="openRow(item, 'unpaid')">
              <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge">リクエスト済み</span><span v-if="item.batchId" class="trow__badge">まとめ精算</span></p>
              </div>
              <div class="trow__right">
                <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
                <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
              </div>
            </div>
          </div>
        </template>

        <template v-if="!loading && payableReview.length">
          <h2 class="money__section money__section--review">送金状況の確認が必要（{{ payableReview.length }}件）</h2>
          <p class="review-note">追加で送金せず、相手と送金済みか確認してください。</p>
          <div class="stack">
            <div v-for="item in payableReview" :key="item.id" class="trow trow--review" role="button" tabindex="0"
            @click="openRow(item, 'unpaid')"
            @keydown.enter="openRow(item, 'unpaid')"
            @keydown.space.prevent="openRow(item, 'unpaid')">
              <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ item.name }}</p>
                <p class="trow__sub">{{ item.date }}・{{ item.itemName }}<span class="trow__badge trow__badge--review">送金状況を確認</span></p>
              </div>
              <div class="trow__right"><span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span><svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
            </div>
          </div>
        </template>


        <!-- イベント全体のまとめて精算に入っている分。ここからは操作せず、イベントへ送る -->
        <template v-if="!loading && payableEvent.length">
          <h2 class="money__section money__section--event">イベントでまとめて精算中（{{ payableEvent.length }}件）</h2>
          <p class="review-note">この分はイベントの「まとめて精算」でやり取りします。金額は受け取る分と支払う分を差し引いた後の額です。押すとイベントの精算画面が開きます。</p>
          <div class="stack">
            <div v-for="item in payableEvent" :key="item.id" class="trow trow--event" role="button" tabindex="0"
            @click="openEventSettlement(item)"
            @keydown.enter="openEventSettlement(item)"
            @keydown.space.prevent="openEventSettlement(item)">
              <UserAvatar class="trow__avatar" :name="eventRowName(item)" :photo="item.isEventNetRow ? '' : item.photo" :size="40" />
              <div class="trow__info">
                <p class="trow__name">{{ eventRowName(item) }}</p>
                <p class="trow__sub"><template v-if="item.isEventNetRow">差し引き後にやり取りする金額・{{ item.count }}件分</template><template v-else>{{ item.date }}・{{ item.itemName }}</template><span class="trow__badge trow__badge--event">イベントで精算中</span></p>
              </div>
              <div class="trow__right"><span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span><svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
            </div>
          </div>
        </template>

        <h2 class="money__section">支払い詳細</h2>
        <div class="stack">
          <SkeletonRows v-if="loading" :rows="4" />
          <div v-else-if="payableUnpaid.length === 0" class="empty-box">未払いはありません</div>
          <div v-for="item in payableUnpaid" :key="item.id" class="trow" role="button" tabindex="0"
            @click="$router.push('/payment-detail/unpaid-' + item.id)"
            @keydown.enter="$router.push('/payment-detail/unpaid-' + item.id)"
            @keydown.space.prevent="$router.push('/payment-detail/unpaid-' + item.id)">
            <UserAvatar class="trow__avatar" :name="item.name" :photo="item.photo" :size="40" />
            <div class="trow__info">
              <p class="trow__name">{{ item.name }}</p>
              <p class="trow__sub">{{ item.date }}・{{ item.itemName }}</p>
            </div>
            <div class="trow__right">
              <span class="trow__amount tnum">¥{{ item.amount.toLocaleString() }}</span>
              <svg class="trow__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- まとめて（全イベント横断・人ごと） -->
      <div v-else-if="currentTab === 'settle'">
        <p class="settle__lead">全部のイベントを合算した、その人との差し引きです。タップでまとめて精算できます。</p>
        <SkeletonRows v-if="loading" :rows="3" />
        <div v-else-if="settleByPerson.length === 0" class="empty-box">まとめて精算できる相手はいません</div>
        <div v-else class="settle__list">
          <button v-for="m in settleByPerson" :key="m.uid" class="scard" @click="goSettle(m)">
            <UserAvatar class="scard__avatar" :name="m.name" :photo="m.photo" :size="40" />
            <span class="scard__body">
              <span class="scard__name">{{ m.name }}</span>
              <span v-if="needsReview(m.uid)" class="scard__note scard__note--review">送金状況の確認が必要</span>
              <span v-else-if="m.pending > 0" class="scard__note">承認待ちのため確定前</span>
            </span>
            <span class="scard__right">
              <span v-if="m.pending > 0" class="scard__tag">{{ pendingLabel(m) }}</span>
              <span class="scard__action" :class="[m.net < 0 ? 'is-pay' : 'is-receive', { 'is-provisional': m.pending >= Math.abs(m.net) }]">
                {{ m.net < 0 ? '支払う' : '受け取る' }}
                <span class="scard__amt tnum">¥{{ Math.abs(m.net).toLocaleString() }}</span>
              </span>
            </span>
            <svg class="scard__chevron" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
          </button>
        </div>
      </div>

      <button class="money__history" data-tour="pay-history" @click="$router.push('/payment-history')">すべての履歴を見る</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db, auth } from '@/firebase' // 🌟 追加
import { onAuthStateChanged } from 'firebase/auth' // 🌟 追加
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore' // 🌟 追加
import SkeletonRows from '../components/SkeletonRows.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { formatDate } from '../lib/format'
import { balancesByPerson } from '../lib/balance'
import { eventSettlementRouteOf } from '../lib/eventSettlementGuard'
import { actionablePaymentItems, buildPaymentOverview, headlineOf } from '../lib/paymentOverview.js'

const route = useRoute()
const router = useRouter()
const currentTab = ref('waiting')

const summaryUid = ref('')
const receivingTransactions = ref([])
const payingTransactions = ref([])
const receiveReady = ref(false)
const payReady = ref(false)
const loadFailed = ref(false)
const loading = computed(() => !receiveReady.value || !payReady.value)
const paymentOverview = computed(() => buildPaymentOverview(
  [...receivingTransactions.value, ...payingTransactions.value], summaryUid.value,
))
const overviewIssues = computed(() => summaryUid.value ? paymentOverview.value.issues : [])
const userCache = reactive({})
const decorate = (items) => items.map((item) => {
  const cached = userCache[item.opponentUid]
  const fallbackName = item.paidToId === summaryUid.value ? item.paidByName : item.paidToName
  return {
    ...item,
    date: formatDate(item.createdAt),
    name: cached?.name || fallbackName || '名前を確認中',
    photo: cached?.photo || '',
    itemName: item.itemName || 'イベント代',
  }
})
const receivableUnpaid = computed(() => decorate(paymentOverview.value.receive.unpaid.items))
const receivableAwaiting = computed(() => decorate(paymentOverview.value.receive.pending.items))
const receivableReview = computed(() => decorate(paymentOverview.value.receive.review.items))
const payableUnpaid = computed(() => decorate(paymentOverview.value.pay.unpaid.items))
const payableAwaiting = computed(() => decorate(paymentOverview.value.pay.pending.items))
const payableReview = computed(() => decorate(paymentOverview.value.pay.review.items))
// 「まとめて」で新しく精算できるのは通常の未払いと承認待ちだけ。
// 送金状況を確認中の取引は、再送金の対象へ混ぜない。
const receivableList = computed(() => decorate(actionablePaymentItems(paymentOverview.value, 'receive')))
const payableList = computed(() => decorate(actionablePaymentItems(paymentOverview.value, 'pay')))
// 大きい数字はホームのカードと同じ作り方にする。
// 未払い＋送金状況の確認が必要な分＋イベントでまとめて精算中の分。
// 片方だけ額面、片方だけ差し引きだと、同じ相手で違う数字が出て迷わせる。
const receiveHeadline = computed(() => headlineOf(paymentOverview.value, 'receive'))
const payHeadline = computed(() => headlineOf(paymentOverview.value, 'pay'))
const receivableReviewAmount = computed(() => paymentOverview.value.receive.review.amount)
const payableReviewAmount = computed(() => paymentOverview.value.pay.review.amount)
// イベント全体のまとめて精算に入っている分。金額は出すが、ここからは操作させない。
const receivableEvent = computed(() => decorate(paymentOverview.value.receive.event.items))
const payableEvent = computed(() => decorate(paymentOverview.value.pay.event.items))
const receivableEventAmount = computed(() => paymentOverview.value.receive.event.amount)
const payableEventAmount = computed(() => paymentOverview.value.pay.event.amount)
const reviewOpponentUids = computed(() => new Set([
  ...paymentOverview.value.receive.review.items,
  ...paymentOverview.value.pay.review.items,
].map((item) => item.opponentUid).filter(Boolean)))
const needsReview = (uid) => reviewOpponentUids.value.has(uid)

// 🌟 全イベント横断で「人ごと」に相殺した、まとめて精算できる相手の一覧
//    net > 0 = その人から受け取る（催促）／ net < 0 = その人へ支払う
//    計算は src/lib/balance.js に集約（承認待ちのまとめ精算は実質額で1件に数える）。
//    精算を申請しただけで金額が動かないようにするため。
const settleByPerson = computed(() => balancesByPerson(receivableList.value, payableList.value))

// 🌟 受け取る分と支払う分の両方がある相手。
//    この人たちは「1件ずつの額面」と「差し引き」で金額が変わるので、
//    どちらが本当か分からなくなる。違いが出るときだけ理由を出す。
const offsettablePeople = computed(() =>
  settleByPerson.value.filter((m) => (m.receive || 0) > 0 && (m.pay || 0) > 0)
)
const offsetHintText = computed(() => {
  const list = offsettablePeople.value
  if (list.length === 0) return ''
  const names = list.slice(0, 2).map((m) => m.name || '相手').join('・')
  const more = list.length > 2 ? `ほか${list.length - 2}人` : ''
  return `${names}${more}さんとは、受け取る分と支払う分の両方があります。`
})

// 承認待ちの内訳ラベル。申請中＝自分が出した精算／要承認＝自分が承認する側。
const pendingLabel = (m) => {
  if (m.pendingPay > 0 && m.pendingReceive > 0) return `承認待ち ¥${m.pending.toLocaleString()}`
  if (m.pendingPay > 0) return `申請中 ¥${m.pendingPay.toLocaleString()}`
  return `要承認 ¥${m.pendingReceive.toLocaleString()}`
}
const goSettle = (m) => {
  router.push(`/combined-settlement/${encodeURIComponent(m.name || '相手')}?uid=${m.uid}`)
}

// 押されたらイベントの精算画面へ送る（この画面では操作させない）
// まとめて精算の1行は、相手1人ではなくイベント全体の差し引き。
// 相手の名前を出すと、その人とだけのやり取りに見えてしまう。
const eventRowName = (item) => (item.isEventNetRow ? (item.eventName || 'イベント') : item.name)

const openEventSettlement = (item) => {
  const target = eventSettlementRouteOf(item)
  if (target) router.push(target)
}

const openRow = (item, prefix) => {
  router.push(item.batchId ? `/payment-detail/${prefix}-batch-${item.batchId}` : `/payment-detail/${prefix}-${item.id}`);
};

const saveTransaction = async (selectedFriend, amount, itemName, isMePaying) => {
  try {
    await addDoc(collection(db, "transactions"), {
      itemName: itemName,
      amount: Number(amount),
      // 🌟 条件分岐で入れ替える
      paidById: isMePaying ? auth.currentUser.uid : selectedFriend.uid,
      paidToId: isMePaying ? selectedFriend.uid : auth.currentUser.uid,
      status: "unpaid",
      approvalReviewRequired: false, // 新規なので確認は不要
      createdAt: serverTimestamp()
    });
    alert("保存が完了しました！");
  } catch (e) {
    console.error(e);
  }
};

let unsubReceivable = null
let unsubPayable = null
let unsubAuth = null
let subscriptionVersion = 0
const stopTransactions = () => {
  if (unsubReceivable) { unsubReceivable(); unsubReceivable = null }
  if (unsubPayable) { unsubPayable(); unsubPayable = null }
}
const getUserInfo = async (uid, version) => {
  if (!uid || userCache[uid]) return
  try {
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (version !== subscriptionVersion || !userDoc.exists()) return
    const data = userDoc.data()
    userCache[uid] = { name: data.name || '不明なユーザー', photo: data.photo || data.photoURL || '' }
  } catch (error) { console.error('ユーザー取得失敗:', error) }
}

onMounted(() => {
  if (route.query.tab) currentTab.value = route.query.tab
  unsubAuth = onAuthStateChanged(auth, (user) => {
    stopTransactions()
    const version = ++subscriptionVersion
    const myUid = user?.uid || ''
    summaryUid.value = myUid
    receivingTransactions.value = []
    payingTransactions.value = []
    receiveReady.value = !myUid
    payReady.value = !myUid
    loadFailed.value = false
    if (!myUid) return

    const watchSide = (field, target, ready) => onSnapshot(
      query(collection(db, 'transactions'), where(field, '==', myUid)),
      (snapshot) => {
        if (version !== subscriptionVersion) return
        target.value = snapshot.docs.map((transactionDoc) => ({ ...transactionDoc.data(), id: transactionDoc.id }))
        ready.value = true
        const opposite = field === 'paidToId' ? 'paidById' : 'paidToId'
        for (const uid of new Set(target.value.map((item) => item[opposite]).filter(Boolean))) getUserInfo(uid, version)
      },
      (error) => {
        if (version !== subscriptionVersion) return
        console.error('支払い状況を取得できませんでした:', error)
        loadFailed.value = true
        ready.value = true
      },
    )
    unsubReceivable = watchSide('paidToId', receivingTransactions, receiveReady)
    unsubPayable = watchSide('paidById', payingTransactions, payReady)
  })
})

onUnmounted(() => {
  subscriptionVersion++
  stopTransactions()
  if (unsubAuth) unsubAuth()
})

// タブを切り替えずにパラメーターだけ変わった時にも対応
watch(() => route.query.tab, (newTab) => {
  if (newTab) currentTab.value = newTab
})

</script>

<style scoped>
.money__body { padding: 6px var(--pad) 28px; }

/* セグメント */
.seg { margin-bottom: 18px; }

/* サマリー */
.summary {
  border-radius: var(--r-lg);
  padding: 20px;
  color: #fff;
  margin-bottom: 8px;
}
.summary--receive { background: var(--c-receive); }
.summary--pay { background: var(--c-pay-strong); } /* 白文字が読めるよう濃いアンバーに */
.summary__label { font-size: 13px; opacity: 0.92; font-weight: var(--fw-medium); }
.summary__amount {
  font-size: 34px;
  font-weight: var(--fw-black);
  letter-spacing: -0.01em;
  margin: 4px 0 10px;
}
.summary__badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.22);
  padding: 4px 12px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: var(--fw-bold);
}
.summary__review { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-top: 12px; padding: 9px 11px; border-radius: 12px; background: rgba(255,255,255,0.18); font-size: 11px; }
.summary__review strong { font-size: 13px; font-variant-numeric: tabular-nums; }

.money__section {
  font-size: 15px;
  font-weight: var(--fw-bold);
  color: var(--c-ink);
  margin: 22px 0 12px;
}
.money__section--action { color: var(--c-brand-strong); }
.money__section--review { color: #8a4b20; }
.money__section--event { color: #1f5f8b; }
.review-note, .overview-warning { font-size: 12.5px; line-height: 1.6; color: var(--c-text-sub); margin: -4px 2px 10px; }
.overview-warning { margin: 10px 2px 0; padding: 10px 12px; border: 1px solid var(--c-line); border-radius: 10px; background: var(--c-surface); }
.trow--action { border: 1.5px solid var(--c-brand); }
.trow--muted { opacity: 0.82; }
.trow--review { border: 1px solid #e8c7aa; background: #fffaf5; }
.trow--event { border: 1px solid #b9d6e8; background: #f6fbff; }

/* まとめて精算（人ごと・3つ目のタブ） */
.seg--3 .seg__item { font-size: 12.5px; padding: 9px 2px; letter-spacing: -0.01em; }
.settle__lead { font-size: 12.5px; color: var(--c-text-sub); margin: 16px 2px 12px; line-height: 1.6; }
.settle__list { display: flex; flex-direction: column; gap: 10px; }
.scard {
  width: 100%; display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: var(--c-surface);
  border: 1px solid var(--c-line); border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm); text-align: left;
}
.scard:active { transform: scale(0.99); background: var(--c-surface-2); }
.scard__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.scard__name { font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scard__note { font-size: 11px; color: var(--c-text-sub); }
.scard__note--review { color: #8a4b20; font-weight: var(--fw-bold); }
.scard__right { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.scard__tag { background: var(--c-pay-weak); color: var(--c-pay-strong); font-size: 10px; font-weight: var(--fw-bold); padding: 2px 8px; border-radius: var(--r-pill); }
.scard__action { display: flex; align-items: baseline; gap: 6px; font-size: 12px; font-weight: var(--fw-bold); }
.scard__action.is-pay { color: var(--c-pay-strong); }
.scard__action.is-receive { color: var(--c-receive); }
/* 承認待ちで確定していない金額は、色を落として「まだ確定前」と分かるようにする */
.scard__action.is-provisional { color: var(--c-text-sub); }
.scard__amt { font-size: 17px; font-weight: var(--fw-black); }
.scard__chevron { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* 取引行 */
.trow {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--c-surface);
  border-radius: var(--r-md);
  padding: 12px 14px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.trow:active { transform: scale(0.985); }
.trow__info { flex: 1; min-width: 0; }
.trow__name {
  font-size: 15px; font-weight: var(--fw-bold); color: var(--c-ink);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.trow__sub { font-size: 12px; color: var(--c-text-sub); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.trow__badge { background: var(--c-pay-weak); color: var(--c-pay-strong); font-size: 10px; font-weight: var(--fw-bold); padding: 2px 8px; border-radius: var(--r-pill); }
.trow__badge--action { background: var(--c-brand-weak); color: var(--c-brand-strong); }
.trow__badge--remind { background: var(--c-receive-weak); color: var(--c-receive); }
.trow__badge--review { background: #fff0e1; color: #8a4b20; }
.trow__badge--event { background: #e7f2fa; color: #1f5f8b; }
.trow__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.trow__amount { font-size: 16px; font-weight: var(--fw-black); color: var(--c-ink); }
.offset-hint {
  display: block; width: 100%; text-align: left;
  background: var(--c-surface-2, #f8fafc);
  border: 1px solid var(--c-line, #e5e7eb); border-radius: var(--r-lg, 14px);
  padding: 12px 14px; margin: 10px 0 4px; cursor: pointer;
}
.offset-hint:active { background: var(--c-line, #eef2f7); }
.offset-hint__title { display: block; font-size: 13px; font-weight: 700; color: var(--c-text, #1f2937); }
.offset-hint__text { display: block; margin-top: 4px; font-size: 12px; line-height: 1.6; color: var(--c-text-sub, #6b7280); }
.offset-hint__go { display: block; margin-top: 6px; font-size: 12px; font-weight: 700; color: var(--c-brand, #16a34a); }

.trow__chevron { width: 18px; height: 18px; flex-shrink: 0; fill: none; stroke: var(--c-text-faint); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.trow__btn {
  background: var(--c-brand-weak);
  color: var(--c-brand-strong);
  padding: 6px 14px;
  border-radius: var(--r-pill);
  font-size: 12px;
  font-weight: var(--fw-bold);
}
.trow__btn:active { transform: scale(0.95); }
.trow__btn--primary { background: var(--c-brand); color: #fff; }

/* 履歴へ */
.money__history {
  display: block;
  width: fit-content;
  margin: 26px auto 0;
  padding: 12px 24px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1px solid var(--c-line-bold);
  color: var(--c-text);
  font-size: 14px;
  font-weight: var(--fw-bold);
  box-shadow: var(--shadow-sm);
}
.money__history:active { transform: scale(0.97); background: var(--c-surface-2); }
</style>
