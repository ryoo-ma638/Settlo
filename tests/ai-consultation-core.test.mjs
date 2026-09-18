// 相談の返信案をAIへ渡す前と、返ってきた後の処理を確かめるテスト。
//   実行: node --test tests/ai-consultation-core.test.mjs
//
// 確かめること
//   1. 相手の名前とUIDをAIへ送らない（同じ人は同じ匿名ラベルになる）
//   2. 会話は直近20件・1件500字までに切る
//   3. 事実はこちらが持っている値だけを渡す
//   4. AIの返答を、決まった形と長さへ必ず切り詰める
//   5. 会話に無いメッセージIDを根拠として受け取らない
//   6. 条件の指定が、使える方法と使わない方法で矛盾しない

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../functions/aiConsultationCore.js');

const msg = (id, fromUid, text, system = false) => ({ id, fromUid, text, system });

test('相手のUIDは匿名のラベルに置き換えて渡す', () => {
  const req = core.buildRequest({
    myUid: 'me',
    messages: [
      msg('m1', 'friend-uid-abc', 'いつ払えますか？'),
      msg('m2', 'me', '来週には払えます'),
      msg('m3', 'friend-uid-abc', 'わかりました'),
      msg('m4', null, 'ゲスト222さんが支払いました', true),
    ],
  });
  const speakers = req.messages.map((m) => m.speaker);
  assert.deepEqual(speakers, ['participant_1', 'self', 'participant_1', 'system']);
  // 生のUIDがどこにも残っていない
  assert.ok(!JSON.stringify(req).includes('friend-uid-abc'));
});

test('別々の相手は別々のラベルになる', () => {
  const req = core.buildRequest({
    myUid: 'me',
    messages: [msg('m1', 'a', 'あ'), msg('m2', 'b', 'い'), msg('m3', 'a', 'う')],
  });
  assert.deepEqual(req.messages.map((m) => m.speaker), ['participant_1', 'participant_2', 'participant_1']);
});

test('会話は直近20件までにする', () => {
  const messages = [];
  for (let i = 1; i <= 30; i += 1) messages.push(msg(`m${i}`, 'other', `発言${i}`));
  const req = core.buildRequest({ myUid: 'me', messages });
  assert.equal(req.messages.length, 20);
  assert.equal(req.messages[0].id, 'm11');
  assert.equal(req.messages.at(-1).id, 'm30');
});

test('1件の本文は500字までに切る', () => {
  const req = core.buildRequest({ myUid: 'me', messages: [msg('m1', 'other', 'あ'.repeat(900))] });
  assert.equal(req.messages[0].text.length, 500);
});

test('本文が空の発言は渡さない', () => {
  const req = core.buildRequest({ myUid: 'me', messages: [msg('m1', 'o', '   '), msg('m2', 'o', 'あり')] });
  assert.deepEqual(req.messages.map((m) => m.id), ['m2']);
});

test('事実は、こちらが持っている値だけを渡す', () => {
  const req = core.buildRequest({
    myUid: 'me',
    facts: { subject: '件名', eventName: 'イベント', itemName: '夕食代', amount: '1200', transactionStatus: 'unpaid', myRole: 'payer' },
    messages: [msg('m1', 'o', 'あ')],
  });
  assert.deepEqual(req.facts, {
    subject: '件名', eventName: 'イベント', itemName: '夕食代',
    amount: 1200, transactionStatus: 'unpaid', myRole: 'payer',
  });
});

test('壊れた金額は0として扱い、勝手な数字にしない', () => {
  const req = core.buildRequest({ myUid: 'me', facts: { amount: 'たくさん' }, messages: [msg('m1', 'o', 'あ')] });
  assert.equal(req.facts.amount, 0);
});

test('使える方法と使わない方法が重ならない', () => {
  const c = core.normalizeConditions({ methodMode: 'specify', allowedMethods: ['paypay', 'cash'], blockedMethods: ['cash', 'bank'] });
  assert.deepEqual(c.allowedMethods, ['paypay', 'cash']);
  assert.deepEqual(c.blockedMethods, ['bank']);
});

test('知らない支払い方法は捨てる', () => {
  const c = core.normalizeConditions({ allowedMethods: ['paypay', 'crypto', ''] });
  assert.deepEqual(c.allowedMethods, ['paypay']);
});

test('AIの返答は決まった形と長さへ切り詰める', () => {
  const out = core.normalizeResult({
    summary: 'あ'.repeat(900),
    issues: [{ title: 'い'.repeat(200), detail: 'う'.repeat(900), confidence: 'とても高い', evidenceMessageIds: ['m1', 'にせID'] }],
    missingInformation: ['え', 'え', 'お'],
    replySuggestions: [
      { label: 'か'.repeat(90), text: 'き'.repeat(900) },
      { label: '2', text: 'く' }, { label: '3', text: 'け' }, { label: '4', text: 'こ' },
    ],
  }, ['m1', 'm2']);

  assert.equal(out.summary.length, 400);
  assert.equal(out.issues[0].title.length, 80);
  assert.equal(out.issues[0].detail.length, 240);
  assert.equal(out.issues[0].confidence, 'low');           // 知らない値は low に倒す
  assert.deepEqual(out.issues[0].evidenceMessageIds, ['m1']); // 会話に無いIDは落とす
  assert.deepEqual(out.missingInformation, ['え', 'お']);   // 重複を消す
  assert.equal(out.replySuggestions.length, 3);             // 3件まで
  assert.equal(out.replySuggestions[0].text.length, 300);
});

test('返信案が空のものは出さない', () => {
  const out = core.normalizeResult({ replySuggestions: [{ label: 'あ', text: '  ' }, { label: 'い', text: 'ok' }] });
  assert.deepEqual(out.replySuggestions.map((r) => r.text), ['ok']);
});

test('こわれた返答でも落ちない', () => {
  for (const input of [null, undefined, 'ただの文字列', 42, []]) {
    const out = core.normalizeResult(input, []);
    assert.equal(out.summary, '');
    assert.deepEqual(out.replySuggestions, []);
  }
});

test('AIへの指示に、事実を作らせない約束が入っている', () => {
  assert.match(core.PROMPT, /作らない/);
  assert.match(core.PROMPT, /下書き/);
  assert.match(core.PROMPT, /blockedMethods/);
});

test('仮の名前は、返ってきた文から読める言い方へ直す', () => {
  // AIへは名前を渡さず participant_1 のような仮名にしている。
  // そのまま画面へ出すと、読む人には意味の分からない文字列になる。
  const out = core.normalizeResult({
    summary: 'participant_1さんから支払い時期の確認が来ています。',
    issues: [{ title: 'participant_1 の希望', detail: 'participant_2 が未回答', confidence: 'low' }],
    missingInformation: ['participant_1さんの希望する支払い方法'],
    replySuggestions: [{ label: 'participant_1へ返す', text: 'participant_1さん、来週払います。' }],
  });
  assert.ok(!JSON.stringify(out).includes('participant'), `仮の名前が残っている: ${JSON.stringify(out)}`);
  assert.equal(out.summary, '相手から支払い時期の確認が来ています。');
  assert.equal(out.replySuggestions[0].text, '相手、来週払います。');
});
