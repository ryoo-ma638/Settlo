import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import * as firestore from 'firebase/firestore';
import { setFirestoreBindings, saveOnePayment, prepareSaveIds, confirmSavedOnServer } from '../../src/lib/batchPaymentSave.js';
import { evenShares } from '../../src/lib/evenShares.js';

// 専用demoプロジェクト/localhost固定。本番設定・環境変数・共有データは読まない。
const projectId = 'demo-receipt-flow';
const enabled = process.env.RECEIPT_EMULATOR_TEST === '1';
test('専用Firestoreエミュレータ：現行rulesで一括保存・競合・拒否・応答断を確認', {skip: !enabled}, async t => {
  const app=initializeApp({projectId,apiKey:'demo-key'}, `receipt-${Date.now()}`);
  const db=firestore.getFirestore(app);
  firestore.connectFirestoreEmulator(db,'127.0.0.1',8087,{mockUserToken:{sub:'demo-c',user_id:'demo-c'}});
  const bindings={...firestore,db,paymentThreadId:id=>`pay-${id}`,ensurePaymentThread: async (id,info) => firestore.setDoc(firestore.doc(db,'threads',`pay-${id}`),info)};
  setFirestoreBindings(bindings);
  const people=[{id:'demo-a',name:'参加者A'},{id:'demo-b',name:'参加者B'},{id:'demo-c',name:'参加者C'}];
  async function newPlan(total=1000,payerUid='demo-c') {
    const eventRef=firestore.doc(firestore.collection(db,'events'));
    await firestore.setDoc(eventRef,{participants:people.map(p=>p.id),ended:false,totalAmount:0});
    const shares=evenShares(people,total,payerUid);
    return {eventId:eventRef.id, eventName:'検証イベント', participantUids:people.map(p=>p.id),creditorUid:payerUid,shares,ids:await prepareSaveIds({eventId:eventRef.id,creditorUid:payerUid,shares}),payment:{amount:total,date:'2026/09/17',payer:people.find(p=>p.id===payerUid).name,itemName:'検証店舗',splitType:'all'},participantNames:Object.fromEntries(people.map(p=>[p.id,p.name]))};
  }
  try {
    await t.test('同じIDを同時に送信しても履歴1件・取引2件・合計1回',async()=>{
      const input=await newPlan();
      input.payment.time='';
      input.payment.registrationNumber='T1234567890123';
      input.payment.receipt={storeName:'検証店舗',date:'2026-09-17',time:'',currency:'JPY',totalAmount:1000,pointsUsed:100,taxIncluded:true,registrationNumber:'T1234567890123',items:[{name:'明細不明',lineTotal:null,quantity:null,taxRate:null}]};
      const results=await Promise.all([saveOnePayment(input),saveOnePayment(input)]);
      assert.deepEqual(results.map(r=>r.status).sort(),['already','saved']);
      const event=await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId));
      assert.equal(event.data().totalAmount,1000);
      const history=await firestore.getDocs(firestore.collection(db,'events',input.eventId,'history')); assert.equal(history.size,1);
      assert.equal(history.docs[0].data().time,'');
      assert.deepEqual(history.docs[0].data().receipt,input.payment.receipt);
      assert.equal(history.docs[0].data().registrationNumber,'T1234567890123');
      const txs=await Promise.all(input.ids.transactions.map(tx=>firestore.getDocFromServer(firestore.doc(db,'transactions',tx.id))));
      assert.deepEqual(txs.map(s=>s.data().amount),[333,333]);
      assert.equal((await confirmSavedOnServer({eventId:input.eventId,historyId:input.ids.historyId,plan:input})).status,'saved');
    });
    await t.test('Aが3000円立替：BとCからAへ各1000円を正データとして保存',async()=>{
      const input=await newPlan(3000,'demo-a');
      assert.deepEqual(input.shares.map(s=>[s.uid,s.amount]),[['demo-a',1000],['demo-b',1000],['demo-c',1000]]);
      assert.equal((await saveOnePayment(input)).status,'saved');
      const history=await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId,'history',input.ids.historyId));
      assert.equal(history.data().amount,3000);
      assert.equal(history.data().payerUid,'demo-a');
      assert.deepEqual(history.data().shares.map(s=>[s.uid,s.amount]),input.shares.map(s=>[s.uid,s.amount]));
      const txs=await Promise.all(input.ids.transactions.map(tx=>firestore.getDocFromServer(firestore.doc(db,'transactions',tx.id))));
      assert.deepEqual(txs.map(s=>[s.data().paidById,s.data().paidToId,s.data().amount]).sort(),[
        ['demo-b','demo-a',1000],['demo-c','demo-a',1000],
      ]);
      assert.equal((await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId))).data().totalAmount,3000);
    });
    await t.test('終了済み/参加者変更を保存直前に拒否し、文書も合計も増やさない',async()=>{
      for(const change of [{ended:true},{participants:['demo-c']}]) {
        const input=await newPlan();
        await firestore.updateDoc(firestore.doc(db,'events',input.eventId),change);
        assert.equal((await saveOnePayment(input)).status,'failed');
        assert.equal((await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId))).data().totalAmount,0);
        assert.equal((await firestore.getDocs(firestore.collection(db,'events',input.eventId,'history'))).size,0);
      }
    });
    await t.test('参加者でない利用者を現行rulesが拒否',async()=>{
      const input=await newPlan();
      const otherApp=initializeApp({projectId,apiKey:'demo-key'},`outsider-${Date.now()}`);
      const otherDb=firestore.getFirestore(otherApp);
      firestore.connectFirestoreEmulator(otherDb,'127.0.0.1',8087,{mockUserToken:{sub:'outsider',user_id:'outsider'}});
      setFirestoreBindings({...bindings,db:otherDb});
      try {assert.equal((await saveOnePayment(input)).status,'failed');} finally {setFirestoreBindings(bindings);await firestore.terminate(otherDb);await deleteApp(otherApp);}
      assert.equal((await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId))).data().totalAmount,0);
    });
    await t.test('実保存後の応答だけを遮断：unknown→サーバー確認でsaved、合計は1回',async()=>{
      const input=await newPlan(1001);
      setFirestoreBindings({...bindings,runTransaction:async(...args)=>{await firestore.runTransaction(...args);throw {code:'unavailable'};}});
      assert.equal((await saveOnePayment(input)).status,'unknown');
      assert.equal((await confirmSavedOnServer({eventId:input.eventId,historyId:input.ids.historyId,plan:input})).status,'saved');
      setFirestoreBindings(bindings);
      assert.equal((await saveOnePayment(input)).status,'already');
      assert.equal((await firestore.getDocFromServer(firestore.doc(db,'events',input.eventId))).data().totalAmount,1001);
    });
  } finally {setFirestoreBindings(null);await firestore.terminate(db);await deleteApp(app);}
});
