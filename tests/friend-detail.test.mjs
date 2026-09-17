import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, h } from 'vue';
import { dateMillis, registrationLabel, historyMonth, transactionStatus, transactionCategory, statusTone } from '../src/lib/friendHistory.js';
import { eventSettlementStatusLabel } from '../src/lib/eventSettlementGuard.js';
const mockUrl='data:text/javascript;base64,'+Buffer.from(`
import {reactive} from ${JSON.stringify(import.meta.resolve('vue'))};
export const route=reactive({query:{uid:'friend'},params:{uid:'friend',name:'相手'}});
export const io={rows:[],fail:false,pushes:[],writes:[],defer:null};
export const useRoute=()=>route,useRouter=()=>({push:r=>io.pushes.push(r)});
export const auth={currentUser:{uid:'me'}},db={};
export const doc=(_db,...p)=>p,collection=doc,where=(field,op,value)=>({field,value}),query=(ref,...filters)=>({filters});
export const getDoc=async()=>({exists:()=>true,data:()=>({name:'相手'})});
export const getDocs=async q=>{if(io.defer)await io.defer;if(io.fail)throw Error('offline');const f=q.filters[0];return {forEach:fn=>io.rows.filter(t=>t[f.field]===f.value).forEach(t=>fn({id:t.id,data:()=>t}))};};
export const deleteDoc=(...a)=>io.writes.push(a),addDoc=deleteDoc,serverTimestamp=()=>{},getMyName=()=>'';
export default {};
`).toString('base64');
const ioModule=await import(mockUrl);const {io,route}=ioModule;
const {descriptor}=parse(readFileSync(new URL('../src/views/FriendDetailView.vue',import.meta.url),'utf8'));
const source=compileScript(descriptor,{id:'friend-detail-test'}).content.replace(/from ['"]([^'"]+)['"]/g,(_all,name)=>'from '+JSON.stringify(name==='vue'?import.meta.resolve('vue'):name==='../lib/friendHistory.js'?new URL('../src/lib/friendHistory.js',import.meta.url).href:name==='@/lib/balance'?new URL('../src/lib/balance.js',import.meta.url).href:name==='@/lib/eventSettlementGuard'?new URL('../src/lib/eventSettlementGuard.js',import.meta.url).href:mockUrl));
const Component=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;Component.render=()=>null;
const renderer=createRenderer({createComment:()=>({}),insert(){},remove(){},parentNode(){},nextSibling(){}});
let app,state;const tick=()=>new Promise(resolve=>setImmediate(resolve));
const tx=(id,status,side='receive',extra={})=>({id,status,amount:1000,paidById:side==='pay'?'me':'friend',paidToId:side==='pay'?'friend':'me',itemName:id,createdAt:{seconds:100},...extra});
async function mount(){app=renderer.createApp({render:()=>h(Component)});app.mount({});state=app._instance.subTree.component.setupState;await tick();}
beforeEach(()=>{io.rows=[];io.fail=false;io.pushes=[];io.writes=[];io.defer=null;route.query.uid='friend';});
afterEach(()=>{app?.unmount();app=null;assert.equal(io.writes.length,0);});

test('登録日時のTimestamp/Date/文字列と欠落・不正を区別し、現在日で埋めない',()=>{
 const date=new Date(2026,8,16,12,30);assert.equal(registrationLabel({toDate:()=>date}),'2026/9/16 12:30 登録');
 assert.equal(historyMonth(date),'2026年9月');assert.equal(dateMillis(date.toISOString()),date.getTime());
 for(const value of [null,undefined,'bad-date',{toDate:()=>new Date('bad')}]){assert.equal(registrationLabel(value),'登録日不明');assert.equal(dateMillis(value),-Infinity);}
 assert.equal(dateMillis({seconds:0}),0);
});
test('履歴は完了を含めて登録順に並び、未精算の金額を変えない',async()=>{
 io.rows=[tx('old','unpaid'),tx('new','completed','pay',{createdAt:{seconds:300}}),tx('middle','awaiting_approval','receive',{createdAt:{seconds:200}})];await mount();
 assert.deepEqual(state.historyItems.map(t=>t.id),['new','middle','old']);assert.equal(state.openHistoryCount,2);assert.equal(state.netBalance,2000);assert.equal(state.loading,false);
 assert.deepEqual(state.sortedHistoryItems.map(t=>t.id),['new','middle','old']);
 state.historySort='oldest';await tick();assert.deepEqual(state.sortedHistoryItems.map(t=>t.id),['old','middle','new']);
});
test('取引履歴を、未精算の対応状況と精算済みの方向まで件数つきで切り替えられる',async()=>{
 io.rows=[tx('unpaid','unpaid','pay'),tx('waiting','unpaid'),tx('confirm-self','awaiting_approval'),tx('confirm-other','awaiting_approval','pay'),tx('paid','completed','pay'),tx('received','completed')];await mount();
 assert.deepEqual(state.historyFilterOptions.map(o=>[o.label,o.count]),[['すべて',6],['未精算',4],['精算済み',2]]);
 state.historyFilter='open';await tick();
 assert.deepEqual(state.historySubfilterOptions.map(o=>[o.label,o.count]),[['すべて',4],['未払い',1],['お支払い待ち',1],['受け取りを確認',1],['相手の確認待ち',1]]);
 for(const [filter,id] of [['unpaid','unpaid'],['waiting-payment','waiting'],['confirm-self','confirm-self'],['confirm-other','confirm-other']]){state.historySubfilter=filter;await tick();assert.deepEqual(state.filteredHistoryItems.map(t=>t.id),[id]);}
 state.historyFilter='completed';await tick();assert.equal(state.historySubfilter,'all');
 assert.deepEqual(state.historySubfilterOptions.map(o=>[o.label,o.count]),[['すべて',2],['支払った',1],['受け取った',1]]);
 state.historySubfilter='paid';await tick();assert.deepEqual(state.filteredHistoryItems.map(t=>t.id),['paid']);
 state.historySubfilter='received';await tick();assert.deepEqual(state.filteredHistoryItems.map(t=>t.id),['received']);
});
test('履歴の完了・未払いをタップすると相手と支払方向に合う詳細へ進む',async()=>{
 io.rows=[tx('done','completed','pay'),tx('open','unpaid')];await mount();
 state.openTx(state.historyItems.find(t=>t.id==='done'),'unpaid');state.openTx(state.historyItems.find(t=>t.id==='open'),'waiting');
 assert.deepEqual(io.pushes,['/payment-detail/unpaid-done','/payment-detail/waiting-open']);
});
test('差額0でも貸し借りが両方残っていれば、精算済みにしない',async()=>{
 io.rows=[tx('receive','unpaid'),tx('pay','unpaid','pay')];await mount();assert.equal(state.netBalance,0);assert.equal(state.hasOpenItems,true);assert.equal(state.openHistoryCount,2);
});
test('取得失敗を取引なしと表示せず、再試行で読み込める',async()=>{
 io.fail=true;await mount();assert(state.loadError);assert.equal(state.friend,null);io.fail=false;io.rows=[tx('retry','unpaid')];await state.loadFriend();assert.equal(state.loadError,'');assert.equal(state.historyItems.length,1);
});
test('まとめ申請はmain側・offset側の実際の履歴から同じまとめ詳細へ進む',async()=>{
 const base={id:'sample',offset:1000,net:2000,count:2,payerUid:'me',receiverUid:'friend'};
 io.rows=[
  tx('main','awaiting_approval','pay',{amount:3000,settlementBatch:{...base,role:'main'}}),
  tx('offset','completed','receive',{amount:1000,settlementBatch:{...base,role:'offset'}}),
 ];
 await mount();assert.equal(state.historyItems.length,2);
 for(const item of state.historyItems){state.openTx(item,item.type==='pay'?'unpaid':'waiting');}
 assert.deepEqual(io.pushes,['/payment-detail/unpaid-batch-sample','/payment-detail/unpaid-batch-sample']);
});
test('自分が受取人のまとめ履歴は、offset側からも受け取り側の全体詳細へ進む',async()=>{
 const base={id:'receive-batch',offset:1000,net:2000,count:2,payerUid:'friend',receiverUid:'me'};
 io.rows=[
  tx('main','awaiting_approval','receive',{amount:3000,settlementBatch:{...base,role:'main'}}),
  tx('offset','completed','pay',{amount:1000,settlementBatch:{...base,role:'offset'}}),
 ];
 await mount();
 for(const item of state.historyItems){state.openTx(item,item.type==='pay'?'unpaid':'waiting');}
 assert.deepEqual(io.pushes,['/payment-detail/waiting-batch-receive-batch','/payment-detail/waiting-batch-receive-batch']);
});
test('確認待ちは自分の受け取り確認と相手待ちを区別する',()=>{
 assert.equal(transactionStatus({status:'unpaid',type:'receive'}),'お支払い待ち');
 assert.equal(transactionStatus({status:'unpaid',type:'pay'}),'未払い');
 assert.equal(transactionStatus({status:'awaiting_approval',type:'receive'}),'受け取りの確認が必要');
 assert.equal(transactionStatus({status:'awaiting_approval',type:'pay'}),'相手の確認待ち');
 assert.equal(transactionCategory({status:'completed',type:'receive'}),'received');
});
test('画面を閉じた後の応答で取引を復活させない',async()=>{
 let resolve;io.defer=new Promise(r=>resolve=r);await mount();app.unmount();app=null;resolve();await tick();assert.equal(state.friend,null);
});

// まとめて精算に予約された取引を、通常の未払い・精算済みと取り違えないこと。
// 予約中と確定済みを同じ扱いにすると、絞り込みの件数と中身がずれる。
const settled = (status, type) => ({
 status, type,
 eventSettlementLabel: eventSettlementStatusLabel({ eventSettlementPlanId: 'plan1', eventId: 'ev1', status }) || null,
});
test('まとめて精算に予約された未完了の取引は、未払いではなく「まとめて精算中」に分ける',()=>{
 assert.equal(transactionCategory(settled('unpaid','pay')),'event-settlement');
 assert.equal(transactionCategory(settled('unpaid','receive')),'event-settlement');
 assert.equal(transactionStatus(settled('unpaid','pay')),'イベントでまとめて精算中');
 assert.equal(statusTone(settled('unpaid','pay')),'status-wait');
 // 予約が無い取引は今までどおり
 assert.equal(transactionCategory({status:'unpaid',type:'pay'}),'unpaid');
 assert.equal(transactionCategory({status:'unpaid',type:'receive'}),'waiting-payment');
});
test('まとめて精算で完了した取引は「支払った／受け取った」に数え、済みの色にする',()=>{
 assert.equal(transactionCategory(settled('completed','pay')),'paid');
 assert.equal(transactionCategory(settled('completed','receive')),'received');
 assert.equal(statusTone(settled('completed','pay')),'status-done');
 // 表示文は確定済みと分かる言い方を残す
 assert.equal(transactionStatus(settled('completed','pay')),'まとめて精算で確定済み');
});
