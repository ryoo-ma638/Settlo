const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 500;

const cleanText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);
const safeCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

const PAYMENT_METHODS = new Set(['paypay', 'other', 'ask']);

export function normalizeReplyConditions(value = {}) {
  const paymentMethod = PAYMENT_METHODS.has(value.paymentMethod) ? value.paymentMethod : 'ask';
  return {
    paymentMethod,
    dueDate: cleanText(value.dueDate, 40),
  };
}

// 本人が選んだ支払い方法・日付だけを条件に使い、金額や期限を推測しない。
export function buildConditionalReplySuggestions({ conditions = {}, amount = 0 } = {}) {
  const { paymentMethod, dueDate } = normalizeReplyConditions(conditions);
  const amountText = safeCount(amount) > 0 ? `${safeCount(amount).toLocaleString('ja-JP')}円` : '';
  const deadline = dueDate ? `${dueDate}までに` : '';
  const timing = deadline || '都合のよい日までに';

  if (paymentMethod === 'other') {
    return [
      { label: 'PayPay以外をお願いする', text: `PayPay以外の方法でお願いできますか？${deadline ? `${deadline}、` : ''}銀行振込や現金など、可能な方法を教えてください。` },
      { label: '相手の希望を聞く', text: `PayPay以外で、${timing}対応できる支払い方法を教えてください。` },
    ];
  }
  if (paymentMethod === 'paypay') {
    return [
      { label: 'PayPayでお願いする', text: `PayPayで大丈夫です。${deadline ? `${deadline}お願いします。` : '支払える日を教えてください。'}` },
      { label: '難しい場合も確認する', text: `PayPayでお願いします。${deadline ? `${deadline}が難しい場合は、` : ''}別の方法や支払える日を教えてください。` },
    ];
  }
  if (dueDate) {
    return [
      { label: '日付を指定する', text: `${amountText ? `${amountText}を` : ''}${dueDate}までにお願いできますか？支払い方法は都合のよい方法を教えてください。` },
      { label: '難しい場合も確認する', text: `${dueDate}までの支払いが難しい場合は、支払える日と方法を教えてください。` },
    ];
  }
  return [
    { label: '方法と日付を確認する', text: `支払い方法と、支払える日を教えてください。${amountText ? `金額は${amountText}です。` : ''}` },
  ];
}

// Geminiへ渡す内容を、現在の相談に必要な事実と直近の会話だけに絞る。
// 氏名は送らず、同じ相手を同じ匿名ラベルへ置き換える。
export function buildAiConsultationRequest({ thread = {}, messages = [], myUid = '', replyConditions = {} } = {}) {
  const aliases = new Map();
  let nextAlias = 1;
  const speakerOf = (message) => {
    if (message.system) return 'system';
    if (message.fromUid === myUid) return 'self';
    const key = cleanText(message.fromUid, 128) || `unknown-${nextAlias}`;
    if (!aliases.has(key)) aliases.set(key, `participant_${nextAlias++}`);
    return aliases.get(key);
  };

  const recentMessages = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && cleanText(message.text, MAX_MESSAGE_LENGTH))
    .slice(-MAX_MESSAGES)
    .map((message, index) => ({
      id: cleanText(message.id, 128) || `message_${index + 1}`,
      speaker: speakerOf(message),
      text: cleanText(message.text, MAX_MESSAGE_LENGTH),
    }));

  return {
    schemaVersion: 2,
    facts: {
      subject: cleanText(thread.subjectLabel, 160),
      eventName: cleanText(thread.eventName, 120),
      itemName: cleanText(thread.itemName, 120),
      amount: safeCount(thread.amount),
      transactionStatus: cleanText(thread.transactionStatus, 40) || 'unknown',
      participantCount: safeCount(thread.participantCount),
      paymentProgress: {
        completed: safeCount(thread.progressDone),
        total: safeCount(thread.progressTotal),
      },
    },
    messages: recentMessages,
    replyConditions: normalizeReplyConditions(replyConditions),
    instructions: {
      distinguishFactsAndInferences: true,
      doNotInventAmountsDatesOrPaymentStatus: true,
      doNotPerformActions: true,
      replySuggestionsAreDraftsOnly: true,
      branchReplySuggestionsBySelectedConditions: true,
    },
  };
}

const confidence = (value) => ['high', 'medium', 'low'].includes(value) ? value : 'low';
const uniqueStrings = (values, limit, maxLength) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => cleanText(value, maxLength))
  .filter(Boolean))].slice(0, limit);

// AIの返答をそのまま表示せず、画面が扱う小さな形式へ制限する。
export function normalizeAiConsultationResult(raw, validMessageIds = []) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const validIds = new Set(validMessageIds.map((id) => String(id)));
  const issues = (Array.isArray(source.issues) ? source.issues : []).slice(0, 5).map((issue) => ({
    title: cleanText(issue?.title, 80),
    detail: cleanText(issue?.detail, 240),
    confidence: confidence(issue?.confidence),
    evidenceMessageIds: uniqueStrings(issue?.evidenceMessageIds, 5, 128)
      .filter((id) => validIds.has(id)),
  })).filter((issue) => issue.title || issue.detail);

  const replySuggestions = (Array.isArray(source.replySuggestions) ? source.replySuggestions : [])
    .slice(0, 3)
    .map((reply) => ({
      label: cleanText(reply?.label, 40) || '返信案',
      text: cleanText(reply?.text, 300),
    }))
    .filter((reply) => reply.text);

  return {
    summary: cleanText(source.summary, 400),
    issues,
    missingInformation: uniqueStrings(source.missingInformation, 5, 160),
    replySuggestions,
  };
}

export const AI_CONSULTATION_LIMITS = Object.freeze({
  messages: MAX_MESSAGES,
  messageLength: MAX_MESSAGE_LENGTH,
  replySuggestions: 3,
});
