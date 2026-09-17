<script setup>
import { computed, ref } from 'vue';
const page = ref('capture');
const entries = ref([]);
const editing = ref(-1);
const screen = ref('履歴');
const proposedLimit = 5;
const samples = [
  {store:'まちの食堂', amount:1200, date:'2026-09-17', time:'12:34', item:'日替わりランチ', payer:'自分', split:'全員で均等'},
  {store:'駅前カフェ', amount:900, date:'2026-09-17', time:'15:10', item:'コーヒー 2点', payer:'自分', split:'全員で均等'},
  {store:'暮らしのスーパー', amount:2380, date:'2026-09-16', time:'18:22', item:'食材', payer:'参加者A', split:'商品ごとに指定'},
  {store:'パンのお店', amount:640, date:'2026-09-17', time:'08:05', item:'パン 2点', payer:'自分', split:'金額を指定'},
];
const draft = ref({...samples[0]});
const total = computed(()=>entries.value.reduce((sum,r)=>sum+Number(r.amount),0));
const valid = computed(()=>draft.value.store.trim() && Number.isInteger(Number(draft.value.amount)) && Number(draft.value.amount)>0 && draft.value.date);
function capture() { if(entries.value.length>=proposedLimit)return;editing.value=-1; draft.value={...samples[entries.value.length%samples.length]};page.value='check'; }
function confirm() {
  if(!valid.value || (editing.value<0 && entries.value.length>=proposedLimit))return;
  const receipt={...draft.value,amount:Number(draft.value.amount)};
  if(editing.value>=0) entries.value[editing.value]=receipt;else entries.value.push(receipt);
  page.value='list';
}
function edit(i) {editing.value=i;draft.value={...entries.value[i]};page.value='check';}
function showFour() {entries.value=samples.map(r=>({...r}));page.value='list';}
</script>

<template>
  <main class="flow-proposal">
    <aside class="proposal-note">
      <strong>画面案・操作見本</strong>
      <p>架空データです。撮影・画像解析・保存・通知は実行しません。入力欄と4件を個別に扱う流れを確認できます。</p>
      <p>複数レシートは1回5枚までの初期案です。実機で待ち時間・画像のメモリ使用量を確認して決めます。現在の実装の上限を変更したものではありません。</p>
      <button type="button" @click="showFour">4枚確認した状態を見る</button>
      <a href="/">現在の実装との比較へ</a>
    </aside>
    <section class="proposal-phone" aria-label="撮影と確認の画面案">
      <header class="flow-header"><p>検証イベント</p><h1>支払いを追加</h1><nav class="entry-modes" aria-label="追加方法"><a href="?view=before&width=390">1枚ずつ入力</a><strong aria-current="page">複数レシート</strong></nav><span>撮影・読み取り → 内容確認 → 登録</span></header>
      <div class="flow-body">
        <template v-if="page==='capture'">
          <h2>レシートを読み取る</h2>
          <p class="description">1枚ずつ撮影して、金額や日付を確認します。1回に5枚まで追加できます（確認済み {{entries.length}} / 5枚）。</p>
          <div class="capture-box">
            <p>レシート全体を明るい場所で撮影</p>
            <div class="capture-actions">
              <button type="button" @click="capture"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><circle cx="12" cy="13" r="3.2"/></svg>カメラで撮影<span>（1枚ずつ撮影）</span></button>
              <button type="button" @click="capture"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M21 16l-5-5-9 8"/></svg>アルバムから<span>複数選択もできます</span></button>
            </div>
          </div>
          <p class="description">複数選んだ写真も1枚ずつ読み取ります。各レシートの店名・日付・金額を確認してから登録します。</p>
          <button v-if="entries.length" class="secondary full" @click="page='list'">確認済みの{{entries.length}}件を見る</button>
        </template>
        <template v-if="page==='check'">
          <div class="section-heading"><h2>{{editing>=0?editing+1:entries.length+1}}枚目を確認</h2><span class="state">読み取り完了の例</span></div>
          <details class="photo-preview"><summary>レシート画像を確認</summary><div class="sample-receipt"><strong>{{draft.store}}</strong><span>{{draft.date}} {{draft.time}}</span><hr><span>{{draft.item}}</span><b>合計 ¥{{Number(draft.amount).toLocaleString()}}</b><small>架空のレシート見本</small></div></details>
          <label class="amount-field">合計金額（円）<input v-model="draft.amount" inputmode="numeric" type="text"></label>
          <label>店名・内容<input v-model="draft.store" type="text"></label>
          <div class="field-pair"><label>日付<input v-model="draft.date" type="date"></label><label>時刻（任意）<input v-model="draft.time" type="time"></label></div>
          <label>立替えた人<select v-model="draft.payer"><option>自分</option><option>参加者A</option></select></label>
          <label>割り勘の方法<select v-model="draft.split"><option>全員で均等</option><option>金額を指定</option><option>商品ごとに指定</option></select></label>
          <p class="description">この1枚に対する設定です。内訳の入力画面は単枚と共通にする案です。この見本では方式の選択だけを試せます。</p>
          <details class="receipt-info"><summary>読み取った明細・税・登録番号</summary><p>{{draft.item}}　¥{{Number(draft.amount).toLocaleString()}}</p><p>税込 / ポイント利用なし / 登録番号は記載なしの例</p></details>
          <p class="description">写真と照らして確認してください。日付が読めない場合は、未入力のまま案内します。</p>
        </template>
        <template v-if="page==='list'">
          <h2>確認済みのレシート <span>{{entries.length}} / 5枚</span></h2>
          <p class="description">それぞれ独立した支払いとして登録します。追加や修正を終えてから、下の登録ボタンを押してください。</p>
          <article v-for="(entry,i) in entries" :key="i" class="receipt-row"><div class="receipt-number">{{i+1}}</div><div class="receipt-copy"><h3>{{entry.store}}</h3><p>{{entry.date}} · {{entry.payer}}が立替</p><span>{{entry.split}}</span></div><div class="receipt-price"><b>¥{{entry.amount.toLocaleString()}}</b><button @click="edit(i)">内容を修正</button></div></article>
          <button class="secondary full add-another" :disabled="entries.length>=proposedLimit" @click="page='capture'">{{entries.length>=proposedLimit?'5枚の確認ができました':'＋ 次のレシートを追加'}}</button>
          <p v-if="entries.length>=proposedLimit" class="description">残りの写真は、この5件の登録後に続けて追加できます。</p>
          <details class="receipt-info"><summary>登録後はどう表示される？</summary><p>履歴とチャットにはレシートごとの枠ができます。精算の申請・確認も対象のレシートへ結び付けます。</p><p>追加のお知らせは1枚ごと、スマホへの通知は今回の登録分をまとめて1回にする案です。</p></details>
        </template>
        <template v-if="page==='result'">
          <h2>{{entries.length}}件を個別に登録する例</h2>
          <p class="description">これは反映先の構成見本です。実際の保存や各ページとの接続は行っていません。</p>
          <div class="screen-tabs"><button v-for="name in ['履歴','チャット','お知らせ案']" :key="name" :aria-pressed="screen===name" @click="screen=name">{{name}}</button></div>
          <div v-if="screen==='お知らせ案'" class="push-example"><span>スマホに届く通知の見本・1回</span><strong>支払いが{{entries.length}}件追加されました</strong><p>タップして各レシートの内容を確認</p></div>
          <p v-if="screen==='お知らせ案'" class="description">アプリ内のお知らせは以下の{{entries.length}}件。それぞれ対象のレシートへ進める案です。通知の送信は行いません。</p>
          <article v-for="(entry,i) in entries" :key="i" class="receipt-row"><div class="receipt-copy"><h3>{{entry.store}}{{screen==='チャット'?'のお支払いの件':''}}</h3><p>{{screen==='お知らせ案'?'支払いが追加されました':entry.date}}</p><span>{{screen==='履歴'?'このレシートの内訳・編集・精算へ':screen==='チャット'?'このレシートのやり取りへ':'このレシートの詳細へ'}}</span></div><b>¥{{entry.amount.toLocaleString()}}</b></article>
          <p class="description">{{entries.length}}件の金額を合算した総額は上位の集計に使い、各レシートの明細や状態は独立して残します。</p>
        </template>
      </div>
      <footer v-if="page==='check'" class="flow-footer"><button class="primary full" :disabled="!valid" @click="confirm">確認して一覧に追加</button><button class="text-button" @click="page=entries.length?'list':'capture'">戻る</button></footer>
      <footer v-if="page==='list'" class="flow-footer"><div class="total-row"><span>確認済み {{entries.length}}件</span><b>合計 ¥{{total.toLocaleString()}}</b></div><button class="primary full" :disabled="!entries.length" @click="page='result'">{{entries.length}}件を個別に登録する（見本）</button></footer>
      <footer v-if="page==='result'" class="flow-footer"><button class="secondary full" @click="page='list'">確認済み一覧へ戻る</button></footer>
    </section>
    <aside class="proposal-note"><p>撮影欄のカメラ・アルバムのアイコンは単枚画面から流用。色・角丸・入力の文字サイズも既存の基準へそろえる案です。写真自体の永続保存はこの案に含みません。</p></aside>
  </main>
</template>

<style scoped>
.flow-proposal {padding:24px 12px 40px;color:var(--c-text);max-width:780px;margin:auto;}
.proposal-note {font-size:13px;line-height:1.8;margin:0 auto 20px;max-width:550px;}.proposal-note p{margin:4px 0 10px;}.proposal-note button,.proposal-note a{margin:0 12px 8px 0;color:var(--c-brand-strong);}.proposal-note button{padding:9px 12px;border:1px solid var(--c-line-bold);border-radius:10px;background:var(--c-surface);}
.proposal-phone{max-width:390px;margin:auto;background:var(--c-surface-2);border-radius:28px;box-shadow:var(--shadow-card);overflow:hidden;}
.flow-header{padding:24px;background:var(--c-surface);border-bottom:1px solid var(--c-line);}.flow-header p{margin:0 0 6px;font-size:12px;color:var(--c-text-sub);}.flow-header h1{font-size:20px;line-height:1.5;margin:0 0 10px;font-weight:800;}.flow-header span{font-size:12px;color:var(--c-brand-strong);}
.flow-body{padding:24px;}.flow-body h2{font-size:17px;margin:0 0 12px;line-height:1.5;}.flow-body h2 span{font-size:14px;color:var(--c-brand-strong);}.description{font-size:13px;line-height:1.8;color:var(--c-text-strong);margin:0 0 18px;}
.entry-modes{display:flex;gap:6px;margin:12px 0 18px;font-size:13px;}.entry-modes a,.entry-modes strong{flex:1;text-align:center;padding:12px 6px;border:1px solid var(--c-line-bold);border-radius:12px;text-decoration:none;color:var(--c-text-sub);background:var(--c-surface-2);}.entry-modes strong{border-color:var(--c-brand);color:var(--c-brand-strong);background:var(--c-brand-weak);}.push-example{padding:16px;background:var(--c-brand-weak);border-radius:16px;margin:0 0 16px;}.push-example span{display:block;font-size:12px;color:var(--c-brand-strong);margin-bottom:8px;}.push-example strong{font-size:15px;}.push-example p{font-size:12px;margin:8px 0 0;line-height:1.7;}
.capture-box{border:2px dashed var(--c-line-strong);border-radius:20px;padding:18px;background:var(--c-surface);margin:20px 0;}.capture-box>p{font-size:13px;font-weight:700;text-align:center;margin:0 0 16px;}.capture-actions{display:flex;gap:10px;}.capture-actions button{flex:1;min-width:0;padding:14px 6px;background:var(--c-surface-2);border:1px solid var(--c-line-bold);border-radius:16px;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:7px;color:var(--c-text);font-weight:700;}.capture-actions button span{font-size:11px;font-weight:400;line-height:1.5;}.capture-actions svg{width:26px;height:26px;fill:none;stroke:var(--c-brand);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;}
button{cursor:pointer;font-family:inherit;}button:disabled{opacity:.5;cursor:default;}button:focus-visible,summary:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--c-brand);outline-offset:3px;}.full{width:100%;}.primary{background:var(--c-brand);border:0;border-radius:18px;padding:17px 12px;color:var(--c-surface);font-size:15px;font-weight:800;}.secondary{border:1px solid var(--c-line-bold);border-radius:14px;padding:14px;background:var(--c-surface);font-size:14px;color:var(--c-text);}.text-button{display:block;margin:10px auto 0;padding:8px 16px;border:0;background:transparent;color:var(--c-text-sub);font-size:14px;}
.section-heading{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;}.state{font-size:11px;color:var(--c-brand-strong);}.photo-preview,.receipt-info{background:var(--c-surface);border-radius:16px;padding:4px 14px;margin:6px 0 20px;font-size:13px;line-height:1.8;}.photo-preview summary,.receipt-info summary{padding:12px 0;cursor:pointer;}.sample-receipt{padding:22px 12px;border:1px solid var(--c-line-bold);margin:0 0 12px;text-align:center;display:grid;gap:12px;background:var(--c-surface);}.sample-receipt hr{width:100%;border:0;border-top:1px dashed var(--c-line-strong);}.sample-receipt small{color:var(--c-text-sub);}
.flow-body label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:700;margin:18px 0;}.flow-body input,.flow-body select{width:100%;min-width:0;box-sizing:border-box;border:1px solid var(--c-line-bold);border-radius:12px;padding:12px;background:var(--c-surface);color:var(--c-text);font-family:inherit;font-size:16px;min-height:46px;}.flow-body .amount-field input{font-size:30px;font-weight:800;}.field-pair{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;}.field-pair label{margin:0;}
.receipt-row{display:flex;align-items:flex-start;gap:10px;padding:18px 0;border-bottom:1px solid var(--c-line-bold);font-size:13px;}.receipt-number{color:var(--c-brand-strong);font-size:12px;padding-top:3px;}.receipt-copy{flex:1;min-width:0;}.receipt-copy h3{font-size:14px;margin:0 0 6px;line-height:1.5;overflow-wrap:anywhere;}.receipt-copy p{font-size:11px;color:var(--c-text-sub);margin:0 0 5px;}.receipt-copy span{font-size:11px;color:var(--c-text-strong);}.receipt-price{text-align:right;}.receipt-price b{display:block;font-size:15px;}.receipt-price button{border:0;background:none;color:var(--c-brand-strong);font-size:12px;min-height:44px;padding:6px 0;}.add-another{margin:22px 0;}.flow-footer{padding:18px 24px 24px;border-top:1px solid var(--c-line-bold);background:var(--c-surface);}.total-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:14px;}.screen-tabs{display:flex;gap:5px;margin-bottom:20px;}.screen-tabs button{flex:1;font-size:12px;padding:12px 4px;border:1px solid var(--c-line-bold);border-radius:12px;background:var(--c-surface);color:var(--c-text);}.screen-tabs button[aria-pressed=true]{border-color:var(--c-brand);background:var(--c-brand-weak);color:var(--c-brand-strong);}
@media(max-width:360px){.flow-body,.flow-header,.flow-footer{padding:18px;}.field-pair{grid-template-columns:1fr;}.proposal-phone{border-radius:20px;}.capture-box{padding:14px 10px;}}
</style>
