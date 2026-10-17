<template>
    <div class="action-container">
      <PageHeader :title="isRemind ? '受け取り手続き' : '支払い手続き'" />
  
      <main class="content">
        <div class="summary-card" :class="isRemind ? 'blue-mode' : 'orange-mode'">
          <p class="summary-label">{{ $route.params.name }} さん{{ isRemind ? 'へ請求する' : 'に支払う' }}金額</p>
          <h2 class="total-amount">¥{{ Number($route.query.amount).toLocaleString() }}</h2>
          <p class="hint-badge">選んだ貸し借りを差し引いた金額です</p>
          <p v-if="breakdownText" class="hint-detail">{{ breakdownText }}</p>
        </div>
  
        <section class="action-section">
        <h3 class="section-sub">{{ isRemind ? '相手に請求する' : 'アプリで決済' }}</h3>
        <PayPayAction :mode="isRemind ? 'remind' : 'pay'" :opponentUid="targetUid" />
      </section>


  
        <footer class="footer-actions">
          <h3 class="section-sub">手渡しの場合</h3>
          <button class="method-btn cash" :disabled="settling" @click="confirmCash">
            {{ isRemind ? '現金で受け取った（精算を完了）' : '現金で支払った（相手に承認を依頼）' }}
          </button>
        </footer>
      </main>
      <BaseModal 
        :show="modalState.show"
        :type="modalState.type"
        :title="modalState.title"
        :message="modalState.message"
        :showCancel="modalState.showCancel"
        :confirmText="modalState.confirmText"
        :cancelText="modalState.cancelText"
        :withReason="modalState.withReason"
        :reasonPlaceholder="modalState.reasonPlaceholder"
        @confirm="handleConfirm"
        @cancel="handleCancel"
        @close="modalState.show = false"
      />
    </div>
  </template>
  
  <script setup>
  import { computed, reactive, ref } from 'vue'; // 🌟 reactiveを追加
  import { onMounted } from 'vue';
  import { markTrailDone } from '@/lib/trailProgressSignal.js';
  // 精算の中身を選んで、実際に手続きへ進んだところで「やってみた」と伝える
  onMounted(() => markTrailDone('offset'));
  import { useRoute, useRouter } from 'vue-router';
  import { db, auth } from '@/firebase';
  import { collection, query, where, getDocs } from 'firebase/firestore';
  import PayPayAction from '../components/PayPayAction.vue';
  import BaseModal from '../components/BaseModal.vue';
  import PageHeader from '../components/PageHeader.vue';
  import { resolveThreadForTx, postPaymentEventByTx } from '@/lib/thread';
  import { getMyName } from '@/lib/userName';
  import { makeBatchId } from '@/lib/settlement';
  import { submitSettlementBatch, settlementErrorMessage } from '@/lib/settlementApi';
  import { settlementFollowUps } from '@/lib/settlementEffects';
  import { batchBreakdownText } from '@/lib/format';
  import { showToast } from '@/lib/toast';


  const route = useRoute();
  const router = useRouter();
  const isRemind = computed(() => route.query.type === 'remind');
  const amount = computed(() => route.query.amount);
  const targetUid = computed(() => route.query.uid);

  // 相殺の内訳（前の画面から受け取る）。ここでも「対象¥500のうち¥400と相殺→実質¥100」を出す。
  // 払うのは自分（pay）か相手（remind）かで言い回しが変わるので、払う人のUIDを入れて判定させる。
  const breakdownText = computed(() => {
    const me = auth.currentUser?.uid || 'me';
    return batchBreakdownText({
      gross: Number(route.query.gross) || 0,
      offset: Number(route.query.offset) || 0,
      net: Number(route.query.amount) || 0,
      // 件数も前の画面から受け取る（他の画面と同じ「対象3件…」の言い回しにするため）
      count: Number(route.query.count) || 0,
      counterCount: Number(route.query.counterCount) || 0,
      payerUid: isRemind.value ? (route.query.uid || 'other') : me,
    }, me);
  });
  const settling = ref(false); // 🌟 まとめて精算の二重送信ガード（完了通知・ゴミ箱記録の重複を防ぐ）
  
  // 🌟 統一モーダルの状態管理
  const modalState = reactive({
    show: false, type: 'info', title: '', message: '',
    showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, onCancel: null,
    withReason: false, reasonPlaceholder: ''
  });

  const showModal = (options) => {
    Object.assign(modalState, { showCancel: false, confirmText: 'OK', cancelText: 'キャンセル', onConfirm: null, onCancel: null, withReason: false, reasonPlaceholder: '', ...options, show: true });
  };

  const handleConfirm = (reason) => {
    if (modalState.onConfirm) modalState.onConfirm(reason);
    modalState.show = false;
  };

  // 完了の案内で「承認待ちを見る／ホームへ」を選べるようにするため、キャンセル側にも行き先を持たせる
  const handleCancel = () => {
    const fn = modalState.onCancel;
    modalState.show = false;
    if (fn) fn();
  };
  
  // 🌟 confirm を美しいモーダルに！
  const confirmCash = () => {
    showModal({
      type: 'warning',
      title: '現金で精算',
      message: isRemind.value
        ? "現金を受け取りましたか？\n選んだ取引をまとめて「完了」にします。"
        : "現金を支払いましたか？\n相手に承認をお願いし、相手が承認すると「完了」になります。",
      showCancel: true,
      confirmText: isRemind.value ? '受け取った' : '支払った',
      withReason: true,
      reasonPlaceholder: '相手へのひとこと（任意・お礼など）',
      onConfirm: async (reason) => {
        if (settling.value) return; // 🌟 確定ボタン連打による重複精算を防ぐ
        settling.value = true;
        try {
          const myUid = auth.currentUser?.uid;
          const friendUid = route.query.uid;
          if (!myUid || !friendUid) {
            showModal({ type: 'error', title: 'エラー', message: '相手の情報が取得できませんでした。' });
            return;
          }
          const friendName = route.params.name || '相手';
          const myName = await getMyName();

          // 🌟 精算対象の取引ID＝前画面で「含める」を選んだものだけ（＝除外を反映）
          let ids = String(route.query.ids || '').split(',').map((s) => s.trim()).filter(Boolean);
          // 画面に出している内訳。サーバーはこれと今の取引を突き合わせ、違えば止める（見た金額と違う額で確定しない）
          let expected = {
            gross: Number(route.query.gross) || 0, offset: Number(route.query.offset) || 0, net: Number(route.query.amount) || 0,
            count: Number(route.query.count) || 0, counterCount: Number(route.query.counterCount) || 0,
          };
          // フォールバック：ids未指定（古いリンク等）は相手との未決済を全件集め、内訳もここで数える
          if (ids.length === 0) {
            const rows = new Map();
            const open = (t) => (t.status || 'unpaid') === 'unpaid' && !t.settlementBatch && !t.eventSettlementPlanId;
            const s1 = await getDocs(query(collection(db, "transactions"), where("paidToId", "==", myUid)));
            s1.forEach((d) => { const t = d.data(); if (t.paidById === friendUid && open(t)) rows.set(d.id, t); });
            const s2 = await getDocs(query(collection(db, "transactions"), where("paidById", "==", myUid)));
            s2.forEach((d) => { const t = d.data(); if (t.paidToId === friendUid && open(t)) rows.set(d.id, t); });
            ids = [...rows.keys()];
            const payerUid = isRemind.value ? friendUid : myUid;
            const main = [], offset = [];
            for (const t of rows.values()) (t.paidById === payerUid ? main : offset).push(Number(t.amount) || 0);
            const sum = (arr) => arr.reduce((s, v) => s + v, 0);
            expected = { gross: sum(main), offset: sum(offset), net: sum(main) - sum(offset), count: main.length, counterCount: offset.length };
          }
          if (ids.length === 0) {
            showModal({ type: 'info', title: '対象がありません', message: '精算できる未決済の取引が見つかりませんでした。' });
            return;
          }

          // 🌟 確定はサーバー側（settlementBatch）。対象の取引全件・相殺の内訳・お知らせを1回で書き、途中で止まれば何も残さない。
          //    自分が受け取る側＝その場で全件完了。自分が払う側＝自分が払う分は相手の承認待ち、相手が自分に払う分はその場で完了。
          const result = await submitSettlementBatch({
            batchId: makeBatchId(), friendUid, direction: isRemind.value ? 'remind' : 'pay',
            transactionIds: ids, expected, reason: reason || '',
          });
          const mainIds = result.mainTransactionIds || [];
          const counterIds = result.counterTransactionIds || [];
          const breakdown = batchBreakdownText(result, myUid);

          // 保存後の付随処理（支払いのチャットに経緯を残す・解決した1対1チャットを消す）。
          // 遅れても失敗しても、お金の更新は再送しない。
          const jobs = [];
          const received = (id) => jobs.push(
            postPaymentEventByTx(id, { text: `${myName}さんがまとめて受け取り、精算しました`, kind: 'completed', actorUid: myUid }),
            resolveThreadForTx(myUid, friendUid, id),
          );
          if (result.status === 'awaiting_approval') {
            counterIds.forEach(received);
            for (const id of mainIds) jobs.push(postPaymentEventByTx(id, { text: `${myName}さんがまとめて支払いました（相手の承認待ち）`, kind: 'paid', actorUid: myUid }));
          } else {
            [...mainIds, ...counterIds].forEach(received);
          }
          await settlementFollowUps(jobs);

          if (result.status === 'awaiting_approval') {
            // 🌟 一番緊張する操作なので、手応え（トースト）と次の行き先（承認待ち）をその場で出す
            showToast(`精算を申請しました（${friendName}さんの承認待ち）`, 3000);
            showModal({
              type: 'success', title: '承認を依頼しました',
              message: counterIds.length
                ? `${friendName}さんに${mainIds.length}件の精算リクエストを送信しました。相手が承認すると完了します。\n${breakdown}\n受け取る${counterIds.length}件も、拒否された場合は未払いに戻ります。`
                : `${friendName}さんに${mainIds.length}件の精算リクエストを送信しました。相手が承認すると完了します。`,
              showCancel: true,
              confirmText: '承認待ちを見る',
              cancelText: 'ホームへ',
              onConfirm: () => router.push('/approvals'),
              onCancel: () => router.push('/')
            });
          } else {
            const done = mainIds.length + counterIds.length;
            showToast(`${friendName}さんとの精算が完了しました`, 3000);
            showModal({
              type: 'success', title: '精算完了',
              message: breakdown
                ? `${done}件を精算済みにしました。\n${breakdown}\nお支払い履歴から確認できます。`
                : `${done}件を精算済みにしました。お支払い履歴から確認できます。`,
              onConfirm: () => router.push('/')
            });
          }
        } catch (e) {
          console.error("精算エラー:", e);
          // サーバーが理由付きで止めたとき（金額や対象が変わった・すでに申請済み 等）はその理由をそのまま出す
          showModal({ type: 'error', title: '確定できませんでした', message: settlementErrorMessage(e, '精算に失敗しました。電波状況を確認してください。') });
        } finally {
          settling.value = false;
        }
      }
    });
  };
  
  // 🌟 alert を美しいモーダルに！
  const createPayPayLink = () => {
    showModal({
      type: 'success',
      title: 'リンク作成完了',
      message: `¥${amount.value.toLocaleString()} のPayPay請求リンクを作成しました！\n相殺済みの金額です。`
    });
  };
  
  const confirmPayment = () => {
    showModal({ type: 'info', title: '準備中', message: 'PayPayアプリを起動します' });
  };
  </script>
  
<style scoped>
/* 🌟 overflow-x: hidden; を追加して横揺れを完全にブロック */
.action-container {
  background: var(--c-bg);
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.content {
  padding: 8px var(--pad) 28px;
  width: 100%;
  box-sizing: border-box;
}

.summary-card { padding: 24px; border-radius: var(--r-lg); color: white; text-align: center; margin-bottom: 22px; }
.blue-mode { background: var(--c-receive); }
.orange-mode { background: var(--c-pay); }
.summary-label { font-size: 14px; margin-bottom: 5px; opacity: 0.92; font-weight: var(--fw-medium); }
/* base.css が見出しに色を指定しているので、そのままだと黒くなる。
   カードの文字色（白）を引き継がせる。 */
.total-amount { font-size: 40px; font-weight: var(--fw-black); margin: 0 0 10px 0; color: inherit; }
.hint-badge { background: rgba(255,255,255,0.22); display: inline-block; padding: 4px 12px; border-radius: var(--r-pill); font-size: 11px; font-weight: var(--fw-bold); }
.hint-detail { margin: 10px 0 0; font-size: 12px; line-height: 1.5; font-weight: var(--fw-medium); opacity: 0.95; }

.section-sub { font-size: 15px; font-weight: var(--fw-bold); margin: 18px 0 10px; color: var(--c-ink); }
.method-btn { width: 100%; padding: 16px; border-radius: var(--r-md); border: none; font-weight: var(--fw-bold); font-size: 16px; cursor: pointer; }
.method-btn:disabled { opacity: 0.5; cursor: default; }
.cash { background-color: var(--c-brand); color: white; }
.paypay { background-color: var(--c-paypay); color: white; }
.footer-actions { margin-top: 26px; }
</style>
