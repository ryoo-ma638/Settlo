import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_CONSULTATION_LIMITS,
  buildAiConsultationRequest,
  buildConditionalReplySuggestions,
  normalizeAiConsultationResult,
  normalizeReplyConditions,
} from '../src/lib/aiConsultation.js';

test('金額と状態を保ち、話者IDとfromNameを除いて直近20件だけに絞る', () => {
  const messages = Array.from({ length: 24 }, (_, index) => ({
    id: `m${index + 1}`,
    fromUid: index % 2 ? 'me' : 'other-user',
    fromName: index % 2 ? '本人の実名' : '相手の実名',
    text: `メッセージ${index + 1}`,
  }));
  const result = buildAiConsultationRequest({
    myUid: 'me',
    thread: {
      subjectLabel: '夕食代の支払い', eventName: '架空の食事会', itemName: '夕食代',
      amount: 300, transactionStatus: 'unpaid', participantCount: 3,
      progressDone: 1, progressTotal: 2,
    },
    replyConditions: { role: 'receiver', methodMode: 'specified', allowedMethods: ['cash', 'bank'], dueDate: '9月20日' },
    messages,
  });

  assert.equal(result.facts.amount, 300);
  assert.equal(result.facts.transactionStatus, 'unpaid');
  assert.deepEqual(result.facts.paymentProgress, { completed: 1, total: 2 });
  assert.equal(result.messages.length, AI_CONSULTATION_LIMITS.messages);
  assert.equal(result.messages[0].id, 'm5');
  assert.equal(result.messages[0].speaker, 'participant_1');
  assert.equal(result.messages[1].speaker, 'self');
  assert.deepEqual(result.replyConditions, {
    role: 'receiver', methodMode: 'specified', allowedMethods: ['cash', 'bank'], blockedMethods: [],
    dueDate: '9月20日', valid: true, conflicts: [],
  });
  assert.doesNotMatch(JSON.stringify(result), /実名/);
});

test('受取側は複数の支払い方法と日付を同時に指定できる', () => {
  const replies = buildConditionalReplySuggestions({
    conditions: {
      role: 'receiver', methodMode: 'specified',
      allowedMethods: ['cash', 'bank'], blockedMethods: ['paypay'], dueDate: '9月20日',
    },
    amount: 300,
  });
  assert.equal(replies.length, 2);
  assert.match(replies[0].text, /現金または銀行振込/);
  assert.match(replies[0].text, /9月20日まで/);
  assert.match(replies[0].text, /300円/);
});

test('本人が日付を指定した場合だけ、金額と指定日を返信案へ入れる', () => {
  const replies = buildConditionalReplySuggestions({
    conditions: { methodMode: 'ask', dueDate: '9月20日' }, amount: 300,
  });
  assert.match(replies[0].text, /300円/);
  assert.match(replies[0].text, /9月20日まで/);

  const unspecified = buildConditionalReplySuggestions({ amount: 300 });
  assert.doesNotMatch(unspecified[0].text, /9月20日/);
});

test('矛盾する方法は黙って上書きせず、選び直しを要求する', () => {
  const conditions = normalizeReplyConditions({
    methodMode: 'specified', allowedMethods: ['paypay', 'cash'], blockedMethods: ['paypay'],
  });
  assert.equal(conditions.valid, false);
  assert.match(conditions.conflicts[0], /PayPay/);
  assert.deepEqual(buildConditionalReplySuggestions({ conditions }), []);
});

test('相手に聞く条件と方法指定は排他にし、条件解除後は有効に戻る', () => {
  const invalid = normalizeReplyConditions({ methodMode: 'ask', allowedMethods: ['cash'] });
  assert.equal(invalid.valid, false);
  assert.match(invalid.conflicts[0], /指定を解除/);
  assert.equal(normalizeReplyConditions({ methodMode: 'ask', allowedMethods: [] }).valid, true);
});

test('支払側には自分が支払える条件、受取側には相手へお願いする文を出す', () => {
  const base = { methodMode: 'specified', allowedMethods: ['paypay', 'cash'], dueDate: '9月20日' };
  const payer = buildConditionalReplySuggestions({ conditions: { ...base, role: 'payer' }, amount: 300 });
  const receiver = buildConditionalReplySuggestions({ conditions: { ...base, role: 'receiver' }, amount: 300 });
  assert.match(payer[0].text, /支払えます/);
  assert.match(receiver[0].text, /お願いできますか/);
  assert.doesNotMatch(payer[0].text, /お願いできますか/);
});

test('AI出力は件数と文字数を制限し、存在しない根拠IDを捨てる', () => {
  const result = normalizeAiConsultationResult({
    summary: '状況'.repeat(300),
    issues: [{
      title: '支払い方法が未確定', detail: '返答待ち', confidence: 'certain',
      evidenceMessageIds: ['m1', 'not-found'],
    }],
    missingInformation: ['期限', '期限', '方法', '金額', '参加者', 'メモ', '余分'],
    replySuggestions: Array.from({ length: 5 }, (_, index) => ({ label: `案${index}`, text: `返信${index}` })),
  }, ['m1']);

  assert.equal(result.summary.length, 400);
  assert.equal(result.issues[0].confidence, 'low');
  assert.deepEqual(result.issues[0].evidenceMessageIds, ['m1']);
  assert.deepEqual(result.missingInformation, ['期限', '方法', '金額', '参加者', 'メモ']);
  assert.equal(result.replySuggestions.length, 3);
});

test('AIが空や不正な形式を返しても安全な空結果にする', () => {
  assert.deepEqual(normalizeAiConsultationResult(null), {
    summary: '', issues: [], missingInformation: [], replySuggestions: [],
  });
});
