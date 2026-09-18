import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, h } from 'vue';

const mockUrl='data:text/javascript;base64,'+Buffer.from(`
import {reactive} from ${JSON.stringify(import.meta.resolve('vue'))};
export const route=reactive({params:{name:'相手'},query:{uid:'friend'}});
export const io={rows:[],pushes:[],writes:[],stamps:[],toasts:[]};
export const useRoute=()=>route,useRouter=()=>({push:r=>io.pushes.push(r)});
export const auth={currentUser:{uid:'me'}},db={};
export const doc=(_db,...p)=>p,collection=doc,where=(field,op,value)=>({field,value}),query=(ref,...filters)=>({filters});
const snapshot=rows=>({docs:rows.map(t=>({id:t.id,data:()=>t})),forEach:fn=>rows.forEach(t=>fn({id:t.id,data:()=>t}))});
export const getDocs=async q=>{const f=q.filters[0];return snapshot(io.rows.filter(t=>t[f.field]===f.value));};
export const getDoc=async p=>{const id=p.at(-1);const row=io.rows.find(t=>t.id===id);return {exists:()=>Boolean(row)||p[0]==='users',data:()=>row||({name:id==='me'?'本人':'相手'})};};
export const updateDoc=async(p,data)=>io.writes.push({kind:'update',id:p.at(-1),data});
export const addDoc=async(p,data)=>{io.writes.push({kind:'add',path:p,data});return{id:'notification'}};
export const serverTimestamp=()=>({seconds:1});
export const showToast=message=>io.toasts.push(message);
export const getMyName=async()=>'本人';
export const resolveThreadForTx=async()=>{},postPaymentEventByTx=async()=>{};
export const makeBatchId=()=> 'batch-test';
export const stampSettlementBatch=async(batch,entries)=>io.stamps.push({batch,entries});
export const batchBreakdownText=()=> '対象と相殺の内訳';
export default {};
`).toString('base64');
const mock=await import(mockUrl);const {io,route}=mock;

async function loadComponent(file, actualImports={}){
 const {descriptor}=parse(readFileSync(new URL(file,import.meta.url),'utf8'));
 const source=compileScript(descriptor,{id:file}).content.replace(/from ['"]([^'"]+)['"]/g,(_all,name)=>'from '+JSON.stringify(name==='vue'?import.meta.resolve('vue'):actualImports[name]||mockUrl));
 const component=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;component.render=()=>null;return component;
}
const Settlement=await loadComponent('../src/views/CombinedSettlementView.vue',{
 '@/lib/balance':new URL('../src/lib/balance.js',import.meta.url).href,
 '@/lib/format':new URL('../src/lib/format.js',import.meta.url).href,
 '@/lib/eventSettlementGuard':new URL('../src/lib/eventSettlementGuard.js',import.meta.url).href,
 // お試し案内への合図は本物を通す（ただの合図なので差し替える必要が無い）
 '@/lib/trailProgressSignal.js':new URL('../src/lib/trailProgressSignal.js',import.meta.url).href,
});
// 取引の状態を書き換える形（確認の印を含む）は本物を読む。
// ここを偽物にすると、印の付け外しが壊れていてもテストが通ってしまう。
const Action=await loadComponent('../src/views/CombinedActionView.vue',{
 '@/lib/eventSettlementGuard':new URL('../src/lib/eventSettlementGuard.js',import.meta.url).href,
 '@/lib/transactionPatch':new URL('../src/lib/transactionPatch.js',import.meta.url).href,
});
const renderer=createRenderer({createComment:()=>({}),insert(){},remove(){},parentNode(){},nextSibling(){}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let app;
async function mount(component){app=renderer.createApp({render:()=>h(component)});app.mount({});const state=app._instance.subTree.component.setupState;await tick();return state;}
const tx=(id,amount,side,status='unpaid')=>({id,amount,status,itemName:id,paidById:side==='pay'?'me':'friend',paidToId:side==='pay'?'friend':'me'});
beforeEach(()=>{io.rows=[];io.pushes=[];io.writes=[];io.stamps=[];io.toasts=[];route.params.name='相手';route.query={uid:'friend'};});
afterEach(()=>{app?.unmount();app=null;});

test('明細の除外を反映し、承認待ちを二重精算せず次画面へ渡す',async()=>{
 io.rows=[tx('receive-500',500,'receive'),tx('pay-300',300,'pay'),tx('pending-200',200,'receive','awaiting_approval'),tx('done',900,'pay','completed')];
 const state=await mount(Settlement);
 assert.deepEqual(state.allEvents.map(t=>t.id),['receive-500','pending-200','pay-300']);
 assert.equal(state.pendingTotal,200);assert.equal(state.settleNet,200);
 state.toggleInclude(state.allEvents.find(t=>t.id==='pay-300'));
 assert.equal(state.settleNet,500);
 state.goToActionPage('remind');
 const url=io.pushes.at(-1);const q=new URLSearchParams(url.split('?')[1]);
 assert.equal(q.get('amount'),'500');assert.equal(q.get('ids'),'receive-500');assert.equal(q.get('gross'),'500');assert.equal(q.get('offset'),'0');assert.equal(q.get('count'),'1');assert.equal(q.get('counterCount'),'0');
 assert(!q.get('ids').includes('pending-200'));
});

test('受け取る明細を外すと、支払う明細だけを先に精算できる',async()=>{
 io.rows=[tx('receive-500',500,'receive'),tx('pay-300',300,'pay')];
 const state=await mount(Settlement);
 state.toggleInclude(state.allEvents.find(t=>t.id==='receive-500'));
 assert.equal(state.settleNet,-300);
 state.goToActionPage('pay');
 const url=io.pushes.at(-1);const q=new URLSearchParams(url.split('?')[1]);
 assert.equal(q.get('type'),'pay');assert.equal(q.get('amount'),'300');assert.equal(q.get('ids'),'pay-300');
 assert.equal(q.get('gross'),'300');assert.equal(q.get('offset'),'0');assert.equal(q.get('count'),'1');assert.equal(q.get('counterCount'),'0');
});

test('支払う側の相殺精算で、選択ID・内訳・状態・承認通知が一致する',async()=>{
 io.rows=[tx('pay-500',500,'pay'),tx('receive-300',300,'receive')];
 route.query={uid:'friend',type:'pay',amount:'200',ids:'pay-500,receive-300',gross:'500',offset:'300',count:'1',counterCount:'1'};
 const state=await mount(Action);
 state.confirmCash();
 await state.modalState.onConfirm('確認用メモ');
 const updates=io.writes.filter(w=>w.kind==='update');
 assert.deepEqual(updates.map(w=>[w.id,w.data.status]),[['receive-300','completed'],['pay-500','awaiting_approval']]);
 assert.equal(io.stamps.length,1);assert.deepEqual(io.stamps[0].entries,[{id:'pay-500',role:'main'},{id:'receive-300',role:'offset'}]);
 const notice=io.writes.find(w=>w.kind==='add').data;
 assert.deepEqual(notice.transactionIds,['pay-500']);assert.deepEqual(notice.counterTransactionIds,['receive-300']);assert.equal(notice.amount,200);assert.equal(notice.batchGross,500);assert.equal(notice.batchOffset,300);
});
