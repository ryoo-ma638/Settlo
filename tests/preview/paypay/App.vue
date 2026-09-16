<script setup>
import {ref,reactive} from 'vue';
import PayPayAction from '@/components/PayPayAction.vue';
import ReceiptPaymentModal from '@/components/ReceiptPaymentModal.vue';
import {profiles,testState as rawState} from './mock.js';
const testState=reactive(rawState);
const mode=ref('remind'), uid=ref('a'), key=ref(0),receipt=ref(false),role=ref('debtor');
const history={id:'sample',itemName:'確認用の立替',payerUid:'a',amount:3000,status:'unpaid',shares:[]};
</script><template>
<main style="padding:20px;max-width:560px;margin:auto"><h1 style="font-size:20px">PayPay操作のローカル確認</h1><p>保存先はこの画面のメモリ内です。本番データへ接続しません。外部リンクも開きません。</p><p>修正対象：src/components/PayPayAction.vue の style scoped。</p>
<label>表示 <select v-model="mode"><option value="remind">請求する</option><option value="pay">支払う</option></select></label>
<label>相手 <select v-model="uid"><option value="a">リンク登録済み</option><option value="b">リンク未登録</option></select></label>
<p><label><input type="checkbox" v-model="testState.fail">取得失敗</label> <label>遅延 <input type="number" v-model.number="testState.delay" style="width:70px">ms</label></p>
<p><button @click="profiles.me='';key++">自分のリンクを未登録にする</button> <button @click="profiles.me='https://qr.paypay.ne.jp/p/preview-long-example-link';key++">自分のリンクを登録済みにする</button></p><button @click="key++">部品を開き直す</button>
<section style="margin-top:24px"><PayPayAction :key="key" :mode="mode" :opponentUid="uid"/></section>
<p v-if="testState.openedUrl" role="status">確認した支払先：{{testState.openedUrl}}（外部には移動しません）</p><hr><label>レシートの立場 <select v-model="role"><option value="debtor">支払う側</option><option value="payer">立て替えた側</option><option value="none">対象外</option></select></label><button @click="receipt=true">レシート詳細を開く</button>
<ReceiptPaymentModal :isOpen="receipt" :history="history" :myRole="role" @close="receipt=false"/>
</main></template>
<style scoped>
main > p { margin: 12px 0; }
main > p > button, main > button { padding: 8px; margin: 4px 0; border: 1px solid #c7d4cd; border-radius: 6px; }
</style>
