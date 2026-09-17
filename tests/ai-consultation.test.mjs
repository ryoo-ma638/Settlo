import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AI_CONSULTATION_LIMITS,
  buildAiConsultationRequest,
  buildConditionalReplySuggestions,
  normalizeAiConsultationResult,
  normalizeReplyConditions,
} from '../src/lib/aiConsultation.js';

test('金額と状態を事実として保ち、氏名を送らず直近20件だけに絞る', () => {
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
    replyConditions: { paymentMethod: 'other', dueDate: '9月20日' },
    messages,
  });

  assert.equal(result.facts.amount, 300);
  assert.equal(result.facts.transactionStatus, 'unpaid');
  assert.deepEqual(result.facts.paymentProgress, { completed: 1, total: 2 });
  assert.equal(result.messages.length, AI_CONSULTATION_LIMITS.messages);
  assert.equal(result.messages[0].id, 'm5');
  assert.equal(result.messages[0].speaker, 'participant_1');
  assert.equal(result.messages[1].speaker, 'self');
  assert.deepEqual(result.replyConditions, { paymentMethod: 'other', dueDate: '9月20日' });
  assert.doesNotMatch(JSON.stringify(result), /実名/);
});

test('本人がPayPay以外を選ぶと、別の方法を尋ねる返信だけを作る', () => {
  const replies = buildConditionalReplySuggestions({
    conditions: { paymentMethod: 'other' }, amount: 300,
  });
  assert.equal(replies.length, 2);
  assert.match(replies[0].text, /PayPay以外/);
  assert.match(replies[0].text, /銀行振込や現金/);
  assert.doesNotMatch(replies[0].text, /PayPayで大丈夫/);
});

test('本人が日付を指定した場合だけ、金額と指定日を返信案へ入れる', () => {
  const replies = buildConditionalReplySuggestions({
    conditions: { paymentMethod: 'ask', dueDate: '9月20日' }, amount: 300,
  });
  assert.match(replies[0].text, /300円/);
  assert.match(replies[0].text, /9月20日まで/);

  const unspecified = buildConditionalReplySuggestions({ amount: 300 });
  assert.doesNotMatch(unspecified[0].text, /9月20日/);
});

test('不正な条件は推測せず、安全な未指定へ戻す', () => {
  assert.deepEqual(normalizeReplyConditions({ paymentMethod: 'crypto', dueDate: 'x'.repeat(80) }), {
    paymentMethod: 'ask', dueDate: 'x'.repeat(40),
  });
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
