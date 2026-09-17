import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { setFirestoreBindings } from '../../src/lib/batchPaymentSave.js';
import { fakeStore, loadModal, imageEvent, memoryStorage } from './helpers.mjs';

function confirmReady(api) {
  api.batchCards.value.filter(card => card.state === 'ready').forEach(card => api.confirmBatchSettlement(card));
}

test('3枚を原画像のまま直列に読み取り、全項目を写真ごとに保存・復元する', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings);
  const storage = memoryStorage();
  const pending = []; const images = []; let active = 0; let maxActive = 0;
  const responses = [
    { storeName: '朝食', date: '2026-09-01', time: '08:09', currency: 'JPY', totalAmount: 1000, pointsUsed: 100, taxIncluded: true, registrationNumber: 'T1234567890123', items: [{name:'パン2個',lineTotal:1200,quantity:2,taxRate:8},{name:'値引',lineTotal:-200,quantity:1,taxRate:8}] },
    { storeName: '昼食', date: '2026-09-02', time: '12:34', currency: 'JPY', totalAmount: 1100, pointsUsed: null, taxIncluded: false, registrationNumber: null, items: [{name:'定食',lineTotal:1000,quantity:1,taxRate:10}] },
    { storeName: '夕食', date: '2026-09-03', time: null, currency: 'JPY', totalAmount: 700, pointsUsed: null, taxIncluded: null, registrationNumber: null, items: [{name:'不明な明細',lineTotal:null,quantity:null,taxRate:null}] },
  ];
  let h = loadModal({storage, ocr: ({image}) => {
    images.push(image); active++; maxActive = Math.max(active, maxActive);
    return new Promise(resolve => pending.push(data => {active--;resolve({data});}));
  }});
  try {
    const reading = h.api.onBatchFiles(imageEvent(3));
    for (let i=0;i<3;i++) {
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(images.length,i+1,'前の応答が返るまで次の写真を送らない');
      assert.equal(h.api.batchCanSave.value,false);
      pending[i](responses[i]);
    }
    await reading;
    assert.equal(maxActive,1);
    assert.deepEqual(images,['image-0','image-1','image-2'],'FileReaderの結果を縮小・結合しない');
    const cards = h.api.batchCards.value;
    assert.deepEqual(cards.map(c=>c.date),responses.map(r=>r.date));
    assert.deepEqual(cards.map(c=>c.receipt.time),['08:09','12:34','']);
    h.api.updateBatchAmount(cards[0],'1001');
    cards[0].date='2026-09-04'; h.api.refreshBatchCard(cards[0]);
    confirmReady(h.api);
    await h.api.saveBatchCards(h.api.batchTargets.value);
    const saved=cards.map(c=>store.docs.get(`events/demo-event/history/${c.plan.ids.historyId}`));
    assert.deepEqual(saved.map(d=>d.time),['08:09','12:34',''],'時刻不明を現在時刻で埋めない');
    assert.equal(saved[0].amount,1001); assert.equal(saved[0].date,'2026/09/04');
    assert.equal(saved[0].receipt.totalAmount,1000); assert.equal(saved[0].receipt.date,'2026-09-01','読み取り値と修正値を混同しない');
    assert.equal(saved[0].registrationNumber,'T1234567890123'); assert.equal(saved[0].receipt.pointsUsed,100);
    assert.deepEqual(saved[0].items.map(i=>[i.lineTotal,i.qty,i.price]),[[1200,2,1200],[-200,1,-200]],'数量で金額を二重に掛けない');
    assert.equal(saved[1].taxMode,'aggregate'); assert.equal(saved[1].items[0].price,1100);
    assert.equal(saved[2].receipt.items[0].lineTotal,null); assert.deepEqual(saved[2].items,[],'不明な明細を0円にしない');
    assert.equal(store.docs.get('events/demo-event').totalAmount,2801);
    const recovery = JSON.parse([...storage.entries.values()][0]);
    assert.ok(recovery.cards.every(c=> !('image' in c)),'画像は再開情報へ保存しない');
    h.stop(); h=loadModal({storage});
    assert.deepEqual(h.api.batchCards.value.map(c=>c.receipt),saved.map(d=>d.receipt));
  } finally {h.stop();}
});

test('撮影を1枚ずつ5枚まで追加でき、6枚目・大きすぎる画像は追加送信しない', async () => {
  let calls=0;
  const h=loadModal({ocr:async()=>{calls++;return {data:{date:'2026-09-17',totalAmount:100}};}});
  try {
    for(let i=0;i<5;i++) await h.api.onBatchFiles(imageEvent());
    assert.equal(h.api.batchCards.value.length,5); assert.equal(calls,5); assert.equal(h.api.batchCanAdd.value,false);
    await h.api.onBatchFiles(imageEvent()); assert.equal(calls,5);
  } finally {h.stop();}
  const oversized=loadModal({ocr:async()=>{throw new Error('呼び出してはいけない');}});
  try {
    const event=imageEvent();event.target.files[0].size=4*1024*1024+1;
    await oversized.api.onBatchFiles(event);
    assert.equal(oversized.api.batchCards.value[0].state,'readFailed');
    assert.match(oversized.api.batchCards.value[0].reasonText,/4MB/);
  } finally {oversized.stop();}
});

test('5枚を一度に選んでもOCRを同時実行せず、選択順に1枚ずつ読む', async () => {
  let active=0; let maxActive=0; const order=[];
  const h=loadModal({ocr:async ({image})=>{ active++; maxActive=Math.max(maxActive,active); order.push(image); await new Promise(resolve=>setImmediate(resolve)); active--; return {data:{date:'2026-09-17',totalAmount:100,currency:'JPY'}}; }});
  try {
    await h.api.onBatchFiles(imageEvent(5));
    assert.equal(maxActive,1);
    assert.deepEqual(order,['image-0','image-1','image-2','image-3','image-4']);
    assert.deepEqual(h.api.batchCards.value.map(card=>card.state),['ready','ready','ready','ready','ready']);
  } finally {h.stop();}
});

test('実ブラウザのFileListをinput初期化前に退避する', async () => {
  const calls=[];
  const h=loadModal({ocr:async ({image})=>{calls.push(image);return {data:{date:'2026-09-17',totalAmount:100,currency:'JPY'}};}});
  let selected=imageEvent(2).target.files;
  const target={
    get files(){return selected;},
    get value(){return selected.length ? 'images' : '';},
    set value(value){if(value==='') selected=[];},
  };
  try {
    await h.api.onBatchFiles({target});
    assert.deepEqual(calls,['image-0','image-1']);
    assert.equal(selected.length,0,'同じ画像を再選択できるようinputは初期化する');
  } finally {h.stop();}
});

test('PCで複数画像をドラッグしても、選択時と同じ順次読み取りに渡す', async () => {
  const calls=[];
  const h=loadModal({ocr:async ({image})=>{calls.push(image);return {data:{date:'2026-09-17',totalAmount:100,currency:'JPY'}};}});
  try {
    const files=imageEvent(3).target.files;
    await h.api.onBatchDrop({dataTransfer:{files}});
    assert.deepEqual(calls,['image-0','image-1','image-2']);
    assert.deepEqual(h.api.batchCards.value.map(card=>card.state),['ready','ready','ready']);
    assert.equal(h.api.batchDragging.value,false);
  } finally {h.stop();}
});

test('レシートごとに立替者と均等・金額指定・商品ごとの精算を確認して保存する', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings);
  const h=loadModal({ocr:async()=>({data:{storeName:'店舗',date:'2026-09-17',currency:'JPY',totalAmount:1000,taxIncluded:true,items:[{name:'料理',lineTotal:600,quantity:1,taxRate:10},{name:'飲み物',lineTotal:400,quantity:1,taxRate:10}]}})});
  try {
    await h.api.onBatchFiles(imageEvent(3));
    const [equal, custom, item]=h.api.batchCards.value;
    h.api.updateBatchPayer(custom,'a'); h.api.setBatchSplitType(custom,'custom');
    h.api.updateBatchCustomAmount(custom,'a','200'); h.api.updateBatchCustomAmount(custom,'b','300'); h.api.updateBatchCustomAmount(custom,'c','500');
    h.api.updateBatchPayer(item,'b'); h.api.setBatchSplitType(item,'item');
    h.api.toggleBatchItemAssignee(item,item.allocationItems[0],'c');
    h.api.toggleBatchItemAssignee(item,item.allocationItems[1],'a'); h.api.toggleBatchItemAssignee(item,item.allocationItems[1],'b');
    confirmReady(h.api);
    assert.equal(h.api.batchTargets.value.length,3);
    assert.deepEqual(h.api.batchSettlementPreview(equal).shares.map(s=>s.amount),[333,333,334]);
    assert.deepEqual(h.api.batchSettlementPreview(custom).shares.map(s=>s.amount),[200,300,500]);
    assert.deepEqual(h.api.batchSettlementPreview(item).shares.map(s=>s.amount),[300,300,400]);
    await h.api.saveBatchCards(h.api.batchTargets.value);
    assert.deepEqual(h.api.batchCards.value.map(c=>[c.plan.creditorUid,c.plan.payment.splitType]),[['c','all'],['a','custom'],['b','item']]);
    assert.deepEqual(item.plan.payment.items.map(row=>row.assignees),[['参加者A','参加者B'],['参加者C']]);
  } finally {h.stop();}
});

test('3枚の選択→金額訂正→除外/復帰→保存を実コンポーネントで通す（OCR/保存は模擬）', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings);
  const h = loadModal(); const a = h.api;
  try {
    await a.onBatchFiles(imageEvent(3));
    assert.deepEqual(a.batchCards.value.map(c => c.state),['ready','ready','ready']);
    const [first, second] = a.batchCards.value;
    a.updateBatchAmount(first,''); assert.equal(first.amount,''); assert.equal(first.state,'warn');
    a.updateBatchAmount(first,'1001');
    confirmReady(a);
    a.excludeBatchCard(second); assert.equal(second.state,'excluded'); assert.equal(a.batchTotal.value,2001);
    a.restoreBatchCard(second); a.confirmBatchSettlement(second); assert.equal(second.state,'ready'); assert.equal(a.batchTotal.value,3001);
    a.excludeBatchCard(second);
    assert.equal(a.batchCanSave.value,true);
    await a.saveBatchCards(a.batchTargets.value);
    assert.deepEqual(a.batchCards.value.map(c => c.state),['saved','excluded','saved']);
    assert.equal(store.docs.get('events/demo-event').totalAmount,2001);
    assert.deepEqual(first.plan.shares.map(s => s.amount),[333,333,335]);
    const count = store.calls.commits;
    await a.saveBatchCards(a.batchCards.value); assert.equal(store.calls.commits,count);
    assert.equal(h.events.length,0, '単枚のsubmitに重複送信しない');
  } finally { h.stop(); }
});
test('OCR失敗と日付不明から手入力で進み、外貨/小数を丸めて登録しない', async () => {
  let call = 0;
  const h = loadModal({ocr:async () => {
    call++;
    if (call===1) throw new Error('offline');
    return {data: call===2 ? {totalAmount:12.5,date:'2026-02-30'} : {totalAmount:100,date:'2026-09-17',currency:'USD'}};
  }});
  try {
    await h.api.onBatchFiles(imageEvent(3));
    const [failed, decimal, foreign] = h.api.batchCards.value;
    assert.equal(failed.state,'readFailed'); h.api.excludeBatchCard(failed); h.api.restoreBatchCard(failed); assert.equal(failed.state,'readFailed'); assert.equal(decimal.amount,''); assert.equal(decimal.date,''); assert.equal(foreign.amount,'');
    failed.date = '2026-09-17'; h.api.updateBatchAmount(failed,'12'); assert.equal(failed.state,'ready');
    decimal.date = '2024-02-29'; h.api.updateBatchAmount(decimal,'1e3'); assert.equal(decimal.state,'warn');
    h.api.updateBatchAmount(decimal,'100'); assert.equal(decimal.state,'ready');
  } finally { h.stop(); }
});
test('3枚の途中で読取失敗しても成功分を保持し、失敗した1枚だけ直して保存再試行できる', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings);
  let read = 0;
  const h = loadModal({ocr: async () => {
    read++;
    if (read === 2) throw new Error('offline');
    return {data:{storeName:`店舗${read}`,date:`2026-09-0${read}`,time:`0${read}:00`,currency:'JPY',totalAmount:1000,items:[{name:`品目${read}`,lineTotal:1000,quantity:1,taxRate:10}]}};
  }});
  try {
    await h.api.onBatchFiles(imageEvent(3));
    const [first, failed, third] = h.api.batchCards.value;
    assert.deepEqual(h.api.batchCards.value.map(c=>c.state),['ready','readFailed','ready']);
    assert.deepEqual([first.store,first.date,first.receipt.time,third.store,third.date,third.receipt.time],['店舗1','2026-09-01','01:00','店舗3','2026-09-03','03:00']);
    h.api.updateBatchStore(first,'修正した店舗1');
    h.api.updateBatchStore(failed,'手入力店舗'); h.api.updateBatchDate(failed,'2026-09-02'); h.api.updateBatchAmount(failed,'1000');
    assert.equal(failed.state,'ready');

    const originalRun=store.bindings.runTransaction; let saveAttempt=0;
    store.bindings.runTransaction=(...args)=>{ saveAttempt++; if(saveAttempt===2) return Promise.reject({code:'permission-denied'}); return originalRun(...args); };
    confirmReady(h.api);
    await h.api.saveBatchCards(h.api.batchTargets.value);
    assert.deepEqual(h.api.batchCards.value.map(c=>c.state),['saved','saveFailed','saved']);
    assert.equal(store.docs.get('events/demo-event').totalAmount,2000);
    const firstId=first.plan.ids.historyId, thirdId=third.plan.ids.historyId, failedId=failed.plan.ids.historyId;
    assert.equal(store.docs.get(`events/demo-event/history/${firstId}`).receipt.time,'01:00');
    assert.equal(store.docs.get(`events/demo-event/history/${firstId}`).itemName,'修正した店舗1');
    assert.equal(store.docs.get(`events/demo-event/history/${firstId}`).receipt.storeName,'店舗1','読み取り原本は修正値で上書きしない');
    assert.equal(store.docs.get(`events/demo-event/history/${thirdId}`).receipt.time,'03:00');

    store.bindings.runTransaction=originalRun;
    await h.api.saveBatchCards([failed]);
    assert.deepEqual(h.api.batchCards.value.map(c=>c.state),['saved','saved','saved']);
    assert.equal(failed.plan.ids.historyId,failedId,'再試行で履歴IDを作り直さない');
    assert.equal(store.docs.get('events/demo-event').totalAmount,3000,'成功済み2枚を加算し直さない');
    assert.equal(store.docs.get(`events/demo-event/history/${firstId}`).receipt.time,'01:00');
    assert.equal(store.docs.get(`events/demo-event/history/${thirdId}`).receipt.time,'03:00');
  } finally { h.stop(); }
});
test('保存できた明細だけを通知し、失敗分の再試行は別の1件として通知する', async () => {
  const store = fakeStore(); setFirestoreBindings(store.bindings);
  const notifications = [];
  const h = loadModal({overrides:{publishPaymentAddedNotifications: async payload => { notifications.push(payload); return {createdCount:1}; }}});
  try {
    await h.api.onBatchFiles(imageEvent(3));
    const [first, failed, third] = h.api.batchCards.value;
    const originalRun=store.bindings.runTransaction; let attempt=0;
    store.bindings.runTransaction=(...args)=>{ attempt++; if(attempt===2) return Promise.reject({code:'permission-denied'}); return originalRun(...args); };
    confirmReady(h.api);
    await h.api.saveBatchCards(h.api.batchTargets.value);
    assert.equal(notifications.length,1);
    assert.equal(notifications[0].eventId,'demo-event');
    assert.ok(notifications[0].operationId);
    assert.deepEqual(notifications[0].historyIds,[first.plan.ids.historyId, third.plan.ids.historyId]);
    assert.ok(!notifications[0].historyIds.includes(failed.plan.ids.historyId), '保存失敗の明細を追加済み通知へ含めない');
    store.bindings.runTransaction=originalRun;
    await h.api.saveBatchCards([failed]);
    assert.equal(notifications[1].eventId,'demo-event');
    assert.equal(notifications[1].operationId,notifications[0].operationId,'再試行でも同じ登録操作IDを使う');
    assert.deepEqual(notifications[1].historyIds,[failed.plan.ids.historyId]);
  } finally {h.stop();}
});
test('読取中の除外→復帰で遅延結果を上書きせず、追加のOCRを呼ばない', async () => {
  let finish; let count=0;
  const h = loadModal({ocr: () => { count++; return new Promise(resolve => { finish=resolve; }); }});
  try {
    const work = h.api.onBatchFiles(imageEvent());
    await new Promise(resolve => setImmediate(resolve));
    const card=h.api.batchCards.value[0];
    h.api.excludeBatchCard(card); h.api.restoreBatchCard(card);
    card.date='2026-09-17'; h.api.updateBatchAmount(card,'33');
    finish({data:{totalAmount:999,date:'2026-09-01'}}); await work;
    assert.equal(card.amount,'33'); assert.equal(card.date,'2026-09-17'); assert.equal(count,1);
  } finally { h.stop(); }
});
test('結果不明は閉じ直し/再作成でも同じIDを保持し、確認で書込みを増やさない', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings);
  const original=store.bindings.runTransaction;
  store.bindings.runTransaction=async (...args) => {await original(...args);throw {code:'unavailable'};};
  const storage=memoryStorage(); let h=loadModal({storage});
  try {
    await h.api.onBatchFiles(imageEvent()); confirmReady(h.api); await h.api.saveBatchCards(h.api.batchTargets.value);
    const card=h.api.batchCards.value[0]; const id=card.plan.ids.historyId;
    assert.equal(card.state,'unknown'); assert.equal(store.calls.commits,1);
    h.api.closeModal(); h.props.isOpen=false; await nextTick(); h.props.isOpen=true; await nextTick();
    assert.equal(h.api.batchCards.value[0].plan.ids.historyId,id);
    h.stop(); h=loadModal({storage});
    assert.equal(h.api.batchCards.value[0].state,'unknown');
    assert.equal(h.api.batchCards.value[0].plan.ids.historyId,id);
    assert.equal(store.calls.commits,1);
    await h.api.confirmBatchCard(h.api.batchCards.value[0]);
    assert.equal(h.api.batchCards.value[0].state,'saved'); assert.equal(store.calls.commits,1);
    assert.equal(store.docs.get('events/demo-event').totalAmount,1000);
    assert.equal(store.calls.threads,1,'金額を再送せず、欠けたチャットだけを補う');
  } finally {h.stop();}
});
test('結果不明→未保存確認→本人の再送でだけ同じIDを使う', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings); const original=store.bindings.runTransaction;
  store.bindings.runTransaction=async () => {throw {code:'unavailable'};};
  const h=loadModal();
  try {
    await h.api.onBatchFiles(imageEvent()); confirmReady(h.api); await h.api.saveBatchCards(h.api.batchTargets.value);
    const card=h.api.batchCards.value[0]; const originalPlan=JSON.stringify(card.plan);
    await h.api.confirmBatchCard(card); assert.equal(card.state,'saveFailed'); assert.equal(store.calls.commits,0);
    store.bindings.runTransaction=original;
    await h.api.saveBatchCards([card]); assert.equal(card.state,'saved'); assert.equal(store.calls.commits,1);
    assert.equal(JSON.stringify(card.plan),originalPlan);
  } finally {h.stop();}
});
test('保存前に再開情報を保持できなければ書き込まない', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings);
  const h=loadModal({storage:{getItem:()=>null,setItem:()=>{throw new Error('full');}}});
  try {
    await h.api.onBatchFiles(imageEvent()); confirmReady(h.api); await h.api.saveBatchCards(h.api.batchTargets.value);
    assert.equal(store.calls.commits,0); assert.equal(h.api.batchRecoveryError.value,true);
  } finally {h.stop();}
});
test('保存中の連打/閉じるを止め、保存済みと不明を混同しない', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings); let release;
  const original=store.bindings.runTransaction;
  store.bindings.runTransaction=(...args)=> new Promise(resolve => {release=()=>resolve(original(...args));});
  const h=loadModal();
  try {
    await h.api.onBatchFiles(imageEvent()); confirmReady(h.api); const work=h.api.saveBatchCards(h.api.batchTargets.value);
    await new Promise(resolve=>setImmediate(resolve));
    h.api.closeModal(); assert.equal(h.events.length,0);
    await h.api.saveBatchCards(h.api.batchTargets.value);
    release(); await work; assert.equal(store.calls.commits,1);
  } finally {h.stop();}
});
test('参加者不足と終了済みを拒否し、破損した再開情報を自動破棄しない', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings);
  for (const props of [{participants:[]},{eventEnded:true}]) {
    const h=loadModal({props});
    try {await h.api.onBatchFiles(imageEvent()); assert.equal(h.api.batchCanSave.value,false);} finally {h.stop();}
  }
  const storage=memoryStorage(); storage.setItem('settlo:receipt-batch:v1:c:demo-event','invalid');
  const h=loadModal({storage});
  try {assert.equal(h.api.batchRecoveryError.value,true); assert.equal(storage.getItem('settlo:receipt-batch:v1:c:demo-event'),'invalid');} finally {h.stop();}
});
test('アカウント/イベントの変更で他の再開情報を混ぜない', async () => {
  const store=fakeStore(); setFirestoreBindings(store.bindings);
  const h=loadModal();
  try {
    await h.api.onBatchFiles(imageEvent()); confirmReady(h.api); await h.api.saveBatchCards(h.api.batchTargets.value);
    h.props.eventId='other-event'; await nextTick(); assert.equal(h.api.batchCards.value.length,0);
    h.props.eventId='demo-event'; await nextTick(); assert.equal(h.api.batchCards.value[0].state,'saved');
    h.props.myUid='a'; await nextTick(); assert.equal(h.api.batchCards.value.length,0);
  } finally {h.stop();}
});
