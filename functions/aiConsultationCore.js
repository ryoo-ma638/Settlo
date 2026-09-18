// 相談の返信案をAIへ相談するための、外部接続を含まない処理。
//
// 方針
//   - 画面から本文を受け取らない。取引IDだけを受け取り、サーバーが読んで組み立てる。
//     画面を信用すると、当事者でない人が好きな文章を送れてしまう。
//   - 相手の名前とUIDはAIへ送らない。同じ人は同じ匿名ラベルへ置き換える。
//   - AIの返答をそのまま画面へ流さない。決まった形と長さへ必ず切り詰める。
//   - 金額・日付・支払い状況はこちらが持っている事実だけを渡し、AIに作らせない。

const MAX_MESSAGES = 20;          // 直近何件まで渡すか
const MAX_MESSAGE_LENGTH = 500;   // 1件あたりの上限
const MAX_SUGGESTIONS = 3;

const text = (value, max) => (typeof value === 'string' ? value : '').trim().slice(0, max);
const count = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};

/** 会話を匿名化し、AIへ渡す形へ組み立てる */
function buildRequest({ facts = {}, messages = [], myUid = '', replyConditions = {} } = {}) {
  const aliases = new Map();
  let next = 1;
  const speakerOf = (message) => {
    if (message.system) return 'system';
    if (message.fromUid && message.fromUid === myUid) return 'self';
    const key = text(message.fromUid, 128) || `unknown-${next}`;
    if (!aliases.has(key)) aliases.set(key, `participant_${next++}`);
    return aliases.get(key);
  };

  const recent = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && text(m.text, MAX_MESSAGE_LENGTH))
    .slice(-MAX_MESSAGES)
    .map((m, i) => ({
      id: text(m.id, 128) || `message_${i + 1}`,
      speaker: speakerOf(m),
      text: text(m.text, MAX_MESSAGE_LENGTH),
    }));

  return {
    schemaVersion: 3,
    facts: {
      subject: text(facts.subject, 160),
      eventName: text(facts.eventName, 120),
      itemName: text(facts.itemName, 120),
      amount: count(facts.amount),
      transactionStatus: text(facts.transactionStatus, 40) || 'unknown',
      myRole: facts.myRole === 'payer' ? 'payer' : 'receiver',
    },
    messages: recent,
    replyConditions: normalizeConditions(replyConditions),
  };
}

/** 画面から来た条件を、決まった形へそろえる */
function normalizeConditions(input = {}) {
  const methods = ['paypay', 'cash', 'bank'];
  const pick = (list) => [...new Set((Array.isArray(list) ? list : [])
    .map((v) => text(v, 20))
    .filter((v) => methods.includes(v)))];
  const allowed = pick(input.allowedMethods);
  const blocked = pick(input.blockedMethods).filter((m) => !allowed.includes(m));
  return {
    role: input.role === 'payer' ? 'payer' : 'receiver',
    methodMode: input.methodMode === 'specify' ? 'specify' : 'ask',
    allowedMethods: allowed,
    blockedMethods: blocked,
    dueDate: text(input.dueDate, 40),
  };
}

const CONFIDENCE = ['high', 'medium', 'low'];
const uniqueText = (values, limit, max) => [...new Set((Array.isArray(values) ? values : [])
  .map((v) => text(v, max))
  .filter(Boolean))].slice(0, limit);

/** AIの返答を、画面が扱える小さな形へ必ず切り詰める */
// 🌟 AIへ渡すとき、相手は participant_1 のような仮の名前に置き換えている。
//    返ってきた文にそのまま残ると、読む人には意味が分からない文字列になる。
//    名前は渡していないので本名には戻せない。読める言い方へ直す。
//    自分は self で渡している。これも「あなた」へ直す。
const humanize = (value) => (typeof value === 'string'
  ? value
      .replace(/participant[_ ]?(\d+)/gi, '相手')
      .replace(/\bself\b/gi, 'あなた')
      .replace(/相手さん/g, '相手')
      .replace(/あなたさん/g, 'あなた')
  : value);

function normalizeResult(raw, validMessageIds = []) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const valid = new Set(validMessageIds.map((id) => String(id)));

  const issues = (Array.isArray(src.issues) ? src.issues : []).slice(0, 5).map((issue) => ({
    title: humanize(text(issue?.title, 80)),
    detail: humanize(text(issue?.detail, 240)),
    confidence: CONFIDENCE.includes(issue?.confidence) ? issue.confidence : 'low',
    evidenceMessageIds: uniqueText(issue?.evidenceMessageIds, 5, 128).filter((id) => valid.has(id)),
  })).filter((issue) => issue.title || issue.detail);

  const replySuggestions = (Array.isArray(src.replySuggestions) ? src.replySuggestions : [])
    .slice(0, MAX_SUGGESTIONS)
    .map((reply) => ({
      label: humanize(text(reply?.label, 40)) || '返信案',
      text: humanize(text(reply?.text, 300)),
    }))
    .filter((reply) => reply.text);

  return {
    summary: humanize(text(src.summary, 400)),
    issues,
    missingInformation: uniqueText(src.missingInformation, 5, 160).map(humanize),
    replySuggestions,
  };
}

// AIへの指示。事実を作らせないことと、下書きであることを守らせる。
const PROMPT = `あなたは割り勘アプリの相談相手です。次のJSONは、ある立て替えについての会話です。
名前は匿名のラベルに置き換えてあります。self が相談してきた本人です。

守ること
- facts に書かれていない金額・日付・支払い状況を作らない。分からないことは missingInformation に書く。
- 事実と推測を分ける。推測には confidence を low か medium にする。
- 返信案は下書きで、送信は本人が行う。相手を責める書き方にしない。
- replyConditions が specify のときは allowedMethods の方法だけを使い、blockedMethods は提案しない。
- dueDate があるときは、その日付をそのまま使う。勝手に別の日付を作らない。
- 返信案は日本語で、丁寧だが硬すぎない文にする。1案は120字以内。
- 返信案は最大3件。会話に沿った言い方にする。

出力はJSONだけ。`;

// 返答の形をAI側にも指定して、想定外の形が返るのを減らす
const SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          confidence: { type: 'string', enum: CONFIDENCE },
          evidenceMessageIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['title'],
      },
    },
    missingInformation: { type: 'array', items: { type: 'string' } },
    replySuggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, text: { type: 'string' } },
        required: ['label', 'text'],
      },
    },
  },
  required: ['summary', 'replySuggestions'],
};

module.exports = {
  buildRequest,
  normalizeConditions,
  normalizeResult,
  PROMPT,
  SCHEMA,
  LIMITS: Object.freeze({ messages: MAX_MESSAGES, messageLength: MAX_MESSAGE_LENGTH, suggestions: MAX_SUGGESTIONS }),
};
