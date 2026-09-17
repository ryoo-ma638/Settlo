const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 500;

const cleanText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);
const safeCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

const PAYMENT_METHODS = new Set(['paypay', 'cash', 'bank']);
const METHOD_LABELS = { paypay: 'PayPay', cash: '現金', bank: '銀行振込' };
const PAYMENT_ROLES = new Set(['payer', 'receiver']);
const METHOD_MODES = new Set(['ask', 'specified']);

const uniqueMethods = (value) => [...new Set((Array.isArray(value) ? value : [])
  .map((method) => cleanText(method, 20).toLowerCase())
  .filter((method) => PAYMENT_METHODS.has(method)))];

export function normalizeReplyConditions(value = {}) {
  const methodMode = METHOD_MODES.has(value.methodMode) ? value.methodMode : 'ask';
  const allowedMethods = uniqueMethods(value.allowedMethods);
  const blockedMethods = uniqueMethods(value.blockedMethods);
  const conflicts = [];
  if (methodMode === 'ask' && (allowedMethods.length || blockedMethods.length)) {
    conflicts.push('方法を相手に聞く場合は、方法の指定を解除してください。');
  }
  allowedMethods.forEach((method) => {
    if (blockedMethods.includes(method)) {
      conflicts.push(`${METHOD_LABELS[method]}を「利用できる」と「利用しない」の両方には設定できません。`);
    }
  });
  return {
    role: PAYMENT_ROLES.has(value.role) ? value.role : 'receiver',
    methodMode,
    allowedMethods,
    blockedMethods,
    dueDate: cleanText(value.dueDate, 40),
    valid: conflicts.length === 0,
    conflicts,
  };
}

// 本人が選んだ支払い方法・日付だけを条件に使い、金額や期限を推測しない。
export function buildConditionalReplySuggestions({ conditions = {}, amount = 0 } = {}) {
  const normalized = normalizeReplyConditions(conditions);
  if (!normalized.valid) return [];
  const { role, methodMode, allowedMethods, blockedMethods, dueDate } = normalized;
  const amountText = safeCount(amount) > 0 ? `${safeCount(amount).toLocaleString('ja-JP')}円` : '';
  const deadline = dueDate ? `${dueDate}までに` : '';
  const methods = allowedMethods.map((method) => METHOD_LABELS[method]);
  const blocked = blockedMethods.map((method) => METHOD_LABELS[method]);
  const methodText = methods.length ? methods.join('または') : '';
  const blockedText = blocked.length ? `${blocked.join('・')}以外` : '';
  const usableMethod = methodText || blockedText;

  if (role === 'payer') {
    if (methodMode === 'ask') {
      return [
        { label: '支払い条件を確認する', text: `${amountText ? `${amountText}の` : ''}支払い方法と支払える日を確認して、改めて連絡します。` },
      ];
    }
    return [
      { label: '支払える条件を伝える', text: `${usableMethod ? `${usableMethod}で` : ''}${deadline || '都合のよい日までに'}${amountText ? `${amountText}を` : ''}支払えます。` },
      { label: '難しい場合を相談する', text: `${usableMethod ? `支払い方法は${usableMethod}を希望します。` : ''}${dueDate ? `${dueDate}が難しい場合は、別の日を相談させてください。` : '支払日を相談させてください。'}` },
    ];
  }

  if (methodMode === 'ask') {
    return [
      { label: '方法と日付を確認する', text: `${amountText ? `金額は${amountText}です。` : ''}${dueDate ? `${dueDate}までにお願いできますか？` : ''}利用できる支払い方法と、${dueDate ? '難しい場合は支払える日を' : '支払える日を'}教えてください。` },
      ...(dueDate ? [{ label: '日付を先に伝える', text: `${dueDate}までにお願いできますか？支払い方法は都合のよい方法を教えてください。` }] : []),
    ];
  }
  return [
    { label: '希望条件を伝える', text: `${amountText ? `${amountText}を` : ''}${usableMethod ? `${usableMethod}で` : ''}${deadline || '都合のよい日までに'}お願いできますか？` },
    { label: '難しい場合も確認する', text: `${usableMethod ? `支払い方法は${usableMethod}を希望します。` : ''}${dueDate ? `${dueDate}が難しい場合は、` : ''}対応できる方法と日を教えてください。` },
  ];
}

// Geminiへ渡す内容を、現在の相談に必要な事実と直近の会話だけに絞る。
// 話者IDとfromNameは送らず、同じ相手を同じ匿名ラベルへ置き換える。
// 件名や本文は利用者の入力を含むため、外部API接続時は送信前の説明と追加の匿名化が必要。
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
    schemaVersion: 3,
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
      userTextMayContainPersonalInformation: true,
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
