<script setup>
import { computed, ref } from 'vue';
import BeforeModal from 'virtual:receipt-before';
import AddPaymentModal from '../../../src/components/AddPaymentModal.vue';
import ReceiptResultCard from '../../../src/components/ReceiptResultCard.vue';
import FlowProposal from './FlowProposal.vue';
import { listBatchCardStates } from '../../../src/lib/batchStates.js';
import { setFirestoreBindings } from '../../../src/lib/batchPaymentSave.js';
import { fixtures, fixtureFile } from './fixtures.js';
const query = new URLSearchParams(location.search);
const proposal = query.has('proposal');
const view = query.get('view');
const before = view === 'before';
const isPane = ['before','after'].includes(view);
const cardsOnly = query.has('cards');
const width = ref(['320','390','600','900'].includes(query.get('width')) ? query.get('width') : '390');
const open = ref(false);
const fixtureIndex = ref('0');
const mode = ref('saved');
const message = ref('');
const cardEvents = ref([]);
const amount = ref('1000');
const people = [{id:'a',name:'参加者A'}, {id:'b',name:'参加者B'}, {id:'c',name:'参加者C',isMe:true}];
const dbKey = `settlo:receipt-comparison:mock-db:${view}`;
const eventKey = `settlo:receipt-comparison:current-event:${view}`;
const docs = new Map(JSON.parse(sessionStorage.getItem(dbKey) || '[]'));
const eventId = ref(sessionStorage.getItem(eventKey) || `compare-${view}-${crypto.randomUUID()}`);
const total = ref(0);
const docsVersion = ref(0);
const savedHistory = computed(() => { docsVersion.value; return [...docs].filter(([path]) => path.startsWith(`events/${eventId.value}/history/`)).map(([path,data]) => ({id:path.split('/').at(-1),...data})); });
const savedTransactions = computed(() => { docsVersion.value; return [...docs].filter(([path,data]) => path.startsWith('transactions/') && data.eventId === eventId.value).map(([path,data]) => ({id:path.split('/').at(-1),...data})); });
const saveDb = () => { sessionStorage.setItem(dbKey, JSON.stringify([...docs])); docsVersion.value++; };
function ensureEvent() {
  const path = `events/${eventId.value}`;
  if (!docs.has(path)) docs.set(path, {participants:['a','b','c'],ended:false,totalAmount:0});
  total.value=docs.get(path).totalAmount;
  sessionStorage.setItem(eventKey,eventId.value); saveDb();
}
if (isPane) ensureEvent();
const snapshot = data => ({exists:()=>data!==undefined,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}});
if (isPane && !before) setFirestoreBindings({
  db:{}, collection:(_, ...parts)=>({path:parts.join('/')}),
  doc:(base,...parts)=>{const id=parts.length?parts.at(-1):`demo-${crypto.randomUUID()}`;return {id,path:parts.length?parts.join('/'):`${base.path}/${id}`};},
  serverTimestamp:()=> 'demo-time', increment:n=>({increment:n}),
  getDocFromServer:async ref=>snapshot(docs.get(ref.path)),
  runTransaction:async(_,fn)=>{
    const response=mode.value;
    await new Promise(resolve=>setTimeout(resolve,500));
    if(response==='failed') throw {code:'permission-denied'};
    const writes=[];
    await fn({
      get:async ref=>snapshot(docs.get(ref.path)),
      set:(ref,data)=>writes.push([ref.path,data]),
      update:(ref,data)=>writes.push([ref.path,{...docs.get(ref.path),totalAmount:docs.get(ref.path).totalAmount+data.totalAmount.increment}]),
    });
    for(const [path,data] of writes) docs.set(path,data);
    total.value=docs.get(`events/${eventId.value}`).totalAmount; saveDb();
    if(response==='unknown') throw {code:'unavailable'};
  },
  ensurePaymentThread:async(id,info)=>{docs.set(`threads/pay-${id}`,info);saveDb();},paymentThreadId:id=>`pay-${id}`,
});
function injectFixtures(all=false) {
  const input=document.querySelector(all?'input[multiple]':'input[type="file"]:not([capture]):not([multiple])');
  if(!input) {message.value=all?'フォームの「複数レシート」を先に押してください。':'フォームを開いてください。';return;}
  const transfer=new DataTransfer();
  for(const index of all?[0,1,2,3,4]:[Number(fixtureIndex.value)]) transfer.items.add(fixtureFile(index));
  input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true}));message.value='';
}
function dropFixtures() {
  const dropZone=document.querySelector('.batch-drop-zone');
  if(!dropZone) {message.value='フォームの「複数レシート」を先に押してください。';return;}
  const transfer=new DataTransfer();
  for(const index of [0,1,2,3,4]) transfer.items.add(fixtureFile(index));
  dropZone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));message.value='';
}
function recordBefore(payload) {
  // 旧フォームから出たsubmitを受け取る検証用の親。旧EventDetailsの保存処理ではない。
  const response=mode.value;
  if(response==='failed') {message.value='模擬受付は拒否。旧フォームは保存の返事を待たず閉じました。';return;}
  total.value+=payload.amount;
  docs.set(`events/${eventId.value}`,{...docs.get(`events/${eventId.value}`),totalAmount:total.value}); saveDb();
  message.value=`旧フォームから ${payload.amount.toLocaleString()}円・${payload.date} を受け付けました。${response==='unknown'?'模擬受付後の応答断。旧フォーム自体には結果の再確認ボタンがありません。':'保存処理は検証用の受付に置き換えています。'}`;
}
function newExample() {
  if (document.querySelector('.close-btn')?.disabled) {message.value='保存結果が返るまで待ってください。';return;}
  open.value=false;eventId.value=`compare-${view}-${crypto.randomUUID()}`;ensureEvent();message.value='新しい架空イベントに切り替えました。';
}
const sourceText = computed(()=>before?'変更前：9e8dc56（旧単枚フォーム）':'変更後：今回の未コミット実装');
</script>
<template>
  <FlowProposal v-if="proposal" />
  <main v-else-if="!isPane && !cardsOnly" class="comparison-hub">
    <h1>複数レシート：変更前後の比較</h1>
    <p><a href="?proposal">新しい画面案：単枚とそろえた撮影・確認・個別登録</a>（架空データの操作見本）</p>
    <p>変更前は作業開始コミット <code>9e8dc56</code>。公開中の版との一致は未確認です。変更後は今回の未コミット差分です。</p>
    <p>枠内のフォームは実際のVue部品です。両側の参加者・画像・OCR応答は同じ架空データで、通信と保存先は模擬です。本番データ・課金OCRへ接続しません。旧版にない複数枚機能は追加していません。</p>
    <label>両側の画面幅 <select v-model="width"><option value="320">320px</option><option value="390">390px</option><option value="600">600px</option><option value="900">900px</option></select></label>
    <p class="comparison-links"><a :href="`?view=before&width=${width}`">変更前を単独で開く</a> / <a :href="`?view=after&width=${width}`">変更後を単独で開く</a> / <a href="?cards">カード9状態</a></p>
    <ol class="comparison-steps">
      <li>両側でフォームを開き、変更前は「選んだ1枚を投入」、変更後は「複数レシート」→「同じ3枚を投入」。旧版は1枚ずつ読み取り、比較用に「全員で均等」を選びます。新版は3件の結果が並びます。</li>
      <li>1枚目を1,001円へ修正。新版の2枚目の日付を2026-09-16にします。日付不明を補えることを確認します。</li>
      <li>新版の3枚目を除外→戻す→除外。読取失敗に戻り、最終の登録対象は2件・1,302円になります。</li>
      <li>新版の「読み取り詳細」で時刻・明細・ポイント・登録番号を確認できます。登録すると2件保存済みになり、模擬登録先の合計も1,302円になります。旧版は入力1件を送って閉じます（旧親の保存処理は比較外）。</li>
      <li>新版の「新しい架空例」でやり直し、保存応答を「保存後の応答断」にして1件を登録。結果不明→「保存結果を確認」で保存済みになり、合計が増えないことを確認します。</li>
    </ol>
    <div class="comparison-panes">
      <section><h2>変更前：単枚</h2><iframe title="変更前の単枚フォーム" :src="`?view=before&width=${width}`" :style="{width:width+'px'}"></iframe></section>
      <section><h2>変更後：複数枚</h2><iframe title="変更後の複数レシート" :src="`?view=after&width=${width}`" :style="{width:width+'px'}"></iframe></section>
    </div>
    <p>このURLはこのMac用です。スマホの実機確認は未実施です。</p>
  </main>
  <main v-else-if="cardsOnly" class="card-page">
    <h1>実カード9状態・架空の値</h1><p>{{ cardEvents.join('、') }}</p><button @click="amount='2345'">親から金額を変更</button>
    <div class="card-list"><ReceiptResultCard v-for="spec in listBatchCardStates()" :key="spec.state" :state="spec.state" store="長い名前の検証店舗・お弁当とお茶をまとめて購入したレシート" :amount="amount" date="2026/09/17" reason-text="ここに確認理由が入ります。長い説明を折り返します。" @update:amount="amount=$event;cardEvents.push('金額:'+JSON.stringify($event))" @remove="cardEvents.push('除外')" @restore="cardEvents.push('復帰')" /></div>
  </main>
  <main v-else class="comparison-frame" :style="{'--preview-width':width+'px'}">
    <header class="comparison-controls">
      <h1>検証イベント · {{sourceText}}</h1>
      <p>イベントの追加入口と画面部品は実物相当／画像・OCR・保存先はローカル代替</p>
      <p class="mock-warning"><strong>5207番は架空画像専用です。</strong>実レシートは読み取りません。Geminiを使う確認は <a href="http://localhost:5173/" target="_blank" rel="noopener">実API確認版</a> で行います。</p>
      <p class="scope-note">{{before?'旧親の保存処理は比較外（submit受付を模擬）':'登録・再確認は実処理＋模擬データベース'}}</p>
      <div class="control-row"><button @click="open=true">イベントの支払いを追加</button><button @click="newExample">新しい架空例</button></div>
      <label>保存応答 <select v-model="mode"><option value="saved">成功</option><option value="failed">拒否</option><option value="unknown">保存後の応答断</option></select></label>
      <div v-if="before" class="control-row"><select v-model="fixtureIndex" aria-label="投入する架空レシート"><option v-for="(f,i) in fixtures" :key="i" :value="String(i)">{{f.name}}</option></select><button @click="injectFixtures(false)">選んだ1枚を投入</button></div>
      <div v-else class="control-row"><button @click="injectFixtures(true)">条件の違う5枚を投入</button><button @click="dropFixtures">同じ5枚をドラッグ投入</button><span>フォームの「複数レシート」を先に選択</span></div>
      <p class="mock-total">模擬登録先の合計：{{total.toLocaleString()}}円</p>
      <p v-if="!before" class="mock-total">履歴 {{savedHistory.length}}件 ／ 取引 {{savedTransactions.length}}件</p>
      <p v-if="message" role="status" class="comparison-message">{{message}}</p>
      <details v-if="!before && savedHistory.length"><summary>保存された履歴と取引を確認</summary><p v-for="item in savedHistory" :key="item.id">履歴：{{item.itemName}}・{{item.date}}・{{item.amount.toLocaleString()}}円</p><p v-for="item in savedTransactions" :key="item.id">取引：{{item.paidById}} → {{item.paidToId}}・{{item.amount.toLocaleString()}}円</p></details>
    </header>
    <component :is="before?BeforeModal:AddPaymentModal" :key="eventId" :is-open="open" :participants="people" my-uid="c" my-name="参加者C" v-bind="before ? {} : { eventId, eventName: '同じ架空イベント' }" @close="open=false" @submit="recordBefore" />
  </main>
</template>
<style>
body { margin:0; background:#f4f7f9; font-family:sans-serif; color:#22303b; }
.comparison-hub { padding:24px; max-width:1440px; margin:auto; }
.comparison-hub h1 { font-size:24px; }.comparison-hub h2 {font-size:18px;}
.comparison-hub p,.comparison-steps { line-height:1.7; }.comparison-steps {max-width:1000px;}
.comparison-steps li {margin:6px 0;}.comparison-links a {color:#056b50;}
.comparison-panes {display:flex;flex-wrap:wrap;gap:24px;overflow-x:auto;align-items:flex-start;}
.comparison-panes section {flex:none;}.comparison-panes iframe {box-sizing:content-box;height:1080px;border:1px solid #cbd5db;border-radius:12px;background:white;}
.comparison-frame {max-width:var(--preview-width);margin:auto;}
.comparison-controls {height:290px;box-sizing:border-box;padding:12px;background:white;border-bottom:1px solid #cbd5db;overflow:auto;position:relative;z-index:2200;}
.comparison-controls h1 {font-size:16px;margin:0 0 6px;font-weight:800;}
.comparison-controls p {font-size:12px;margin:4px 0;line-height:1.5;}
.comparison-controls .mock-warning {padding:7px 9px;border:1px solid #e2b96c;border-radius:8px;background:#fff7e8;color:#71450b;}
.comparison-controls .mock-warning a {color:#056b50;font-weight:800;}
.comparison-controls .scope-note {color:#51616b;}.comparison-controls label {display:flex;align-items:center;gap:6px;font-size:13px;margin:6px 0;}
.control-row {display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:6px 0;}
.control-row span {font-size:11px;}.control-row select {max-width:100%;}
.comparison-controls button,.comparison-controls select,.comparison-hub select {font-size:13px;padding:7px;border:1px solid #bdccc5;border-radius:8px;background:#f4f7f9;color:#22303b;}
.comparison-controls .mock-total {font-size:14px;font-weight:800;color:#056b50;}
body:has(.comparison-frame) .modal-overlay {top:290px;height:calc(100% - 290px);left:50%;transform:translateX(-50%);width:min(100%,var(--pane-width,390px));}
body:has(.comparison-frame) .modal-content {max-height:100%;}
.card-page {padding:16px;}.card-list {display:grid;gap:16px;max-width:600px;margin-top:16px;}
</style>
<style>
/* 比較用の外枠だけを通常アプリの端末フレームから外す。部品内の見た目は維持する。 */
body:has(.comparison-hub), body:has(.comparison-frame), body:has(.card-page), body:has(.flow-proposal) { padding:0; display:block; }
body #app { max-width:none; height:auto; min-height:100dvh; overflow:visible; border-radius:0; box-shadow:none; }
</style>
