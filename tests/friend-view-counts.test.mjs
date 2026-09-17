import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, h } from 'vue';

const mockUrl = 'data:text/javascript;base64,' + Buffer.from(`
export let authNext; export let authStopped=false;
export const streams=[],writes=[];
export const auth={currentUser:{uid:'me'}}, db={};
export const onAuthStateChanged=(_auth,next)=>{authNext=next;authStopped=false;next(auth.currentUser);return()=>{authStopped=true;};};
export const useRouter=()=>({push(){}});
export const collection=(_db,...path)=>({path:path.join('/')});
export const where=(field,op,value)=>({field,op,value});
export const query=(ref,...filters)=>({...ref,filters});
export const onSnapshot=(ref,next,error)=>{const stream={ref,next,error,active:true};streams.push(stream);return()=>{stream.active=false;};};
export const doc=()=>{},getDoc=async()=>({exists:()=>false}),getDocFromServer=getDoc,serverTimestamp=()=>{};
export const setDoc=(...args)=>writes.push(args),updateDoc=setDoc,deleteDoc=setDoc,addDoc=setDoc;
export const writeBatch=()=>({set(){},delete(){},commit(){return Promise.resolve();}});
export default {};
`).toString('base64');
const io = await import(mockUrl);
const { descriptor } = parse(readFileSync(new URL('../src/views/FriendView.vue', import.meta.url), 'utf8'));
const source = compileScript(descriptor, {id:'friend-count-test'}).content.replace(/from ['"]([^'"]+)['"]/g, (_all,name) => 'from ' + JSON.stringify(
  name==='vue' ? import.meta.resolve('vue') : name==='../lib/friendTransactionCounts.js' ? new URL('../src/lib/friendTransactionCounts.js',import.meta.url).href : mockUrl));
const Component=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
Component.render=()=>null;
const renderer=createRenderer({createComment:()=>({}),insert(){},remove(){},parentNode(){},nextSibling(){}});
let app,state;
const snapshot=rows=>({docs:rows.map(({id,...data})=>({id,data:()=>data}))});
const stream=(path,field)=>io.streams.find(s=>s.active && s.ref.path===path && (!field || s.ref.filters?.some(f=>f.field===field)));
const emit=(path,rows,field)=>stream(path,field).next(snapshot(rows));
const tx=(id,status='unpaid',extra={})=>({id,paidById:'friend',paidToId:'me',amount:100,status,...extra});
const ready=()=>{
  emit('users/me/friends',[{id:'friend',uid:'friend',name:'相手',tradeCount:0,isFriend:true,addedAt:{seconds:10}},{id:'other',uid:'other',name:'もう一人',tradeCount:900,isFriend:true,addedAt:{seconds:20}}]);
  emit('transactions',[tx('a'),tx('b','completed')],'paidToId');
  emit('transactions',[tx('c','unpaid',{paidById:'me',paidToId:'friend'})],'paidById');
};
beforeEach(()=>{io.streams.length=0;io.writes.length=0;io.auth.currentUser={uid:'me'};app=renderer.createApp({render:()=>h(Component)});app.mount({});state=app._instance.subTree.component.setupState;});
afterEach(()=>{app?.unmount();assert.equal(io.writes.length,0,'閲覧・集計ではDBを書き換えない');});

test('保存された0回/900回ではなく元の取引を数え、残高は従来どおり',()=>{
  ready();const rows=state.processedList;
  assert.equal(rows.find(r=>r.id==='friend').tradeCount,3);
  assert.equal(rows.find(r=>r.id==='other').tradeCount,0);
  assert.equal(rows.find(r=>r.id==='friend').net,0);
});
test('取引多い順と追加順を独立して選べる',()=>{
  ready();assert.deepEqual(state.processedList.map(r=>r.id),['other','friend']);
  state.currentSort='trade_desc';assert.deepEqual(state.processedList.map(r=>r.id),['friend','other']);
  state.currentSort='added_desc';assert.deepEqual(state.processedList.map(r=>r.id),['other','friend']);
});
test('受取側だけが届いた段階は0回と断定せず、両側が届いて確定',()=>{
  emit('users/me/friends',[{id:'friend',name:'相手',tradeCount:0}]);
  emit('transactions',[tx('a')],'paidToId');
  assert.equal(state.processedList[0].tradeCount,null);assert.equal(state.processedList[0].tradeCountState,'loading');
  emit('transactions',[],'paidById');assert.equal(state.processedList[0].tradeCount,1);
});
test('取得エラーでは0回を表示せず、再読込で届いた件数へ戻る',()=>{
  ready();stream('transactions','paidToId').error(new Error('offline'));
  assert.equal(state.processedList[0].tradeCount,null);assert.equal(state.processedList[0].tradeCountState,'error');
  io.authNext({uid:'me'});ready();assert.equal(state.processedList.find(r=>r.id==='friend').tradeCount,3);
});
test('ゴミ箱へ移した分は減り、別IDで復元されても1回だけ戻る',()=>{
  ready();emit('transactions',[tx('b','completed')],'paidToId');
  assert.equal(state.processedList.find(r=>r.id==='friend').tradeCount,2);
  emit('transactions',[tx('restored-a'),tx('b','completed')],'paidToId');
  assert.equal(state.processedList.find(r=>r.id==='friend').tradeCount,3);
});
test('ログアウト後の古い取得結果が、件数・名前・残高を復活させない',()=>{
  ready();const previous=[...io.streams];io.authNext(null);
  assert.equal(io.streams.filter(s=>s.active).length,0);assert.equal(state.processedList.length,0);
  previous.find(s=>s.ref.path==='users/me/friends').next(snapshot([{id:'friend',name:'古い相手'}]));
  previous.find(s=>s.ref.path==='transactions').next(snapshot([tx('late')]));
  assert.equal(state.processedList.length,0);assert.deepEqual(state.balanceByUid,{});
});
test('利用者が切り替わると前の件数を引き継がず、購読を付け替える',()=>{
  ready();const previous=io.streams.filter(s=>s.active);io.authNext({uid:'second'});
  assert(previous.every(s=>!s.active));
  emit('users/second/friends',[{id:'friend',name:'相手'}]);
  emit('transactions',[],'paidToId');emit('transactions',[],'paidById');
  assert.equal(state.processedList[0].tradeCount,0);
});
test('画面を閉じると認証とデータの購読を解除し、遅い応答を無視する',()=>{
  ready();const previous=[...io.streams];app.unmount();app=null;
  assert(io.authStopped);assert(previous.every(s=>!s.active));
  previous.find(s=>s.ref.path==='transactions').next(snapshot([]));
  assert.equal(state.processedList.find(r=>r.id==='friend').tradeCount,3);
});
test('確認が双方向に残るときも一覧に両方渡し、取得失敗時は完了扱いしない',()=>{
  ready();
  emit('transactions',[tx('a','awaiting_approval'),tx('b','completed')],'paidToId');
  emit('transactions',[tx('c','awaiting_approval',{paidById:'me',paidToId:'friend'})],'paidById');
  assert.deepEqual(state.processedList.find(r=>r.id==='friend').settlement,{unsettled:2,myConfirmation:1,theirConfirmation:1});
  stream('transactions','paidById').error(new Error('offline'));
  assert.equal(state.processedList.find(r=>r.id==='friend').settlement,null);
});
test('申請状態を確認できなかった後も、確認ボタンから再取得して承認画面を開ける',async()=>{
  const request={id:'request-1',formId:'friend',formName:'相手'};
  state.markApprovalUnknown(request.id);
  assert.equal(state.approvalStateFor(request),'unknown');
  await state.openApproveModal(request);
  assert.equal(state.approvalStateFor(request),'ready');
  assert.equal(state.isApproveModalOpen,true);
});
