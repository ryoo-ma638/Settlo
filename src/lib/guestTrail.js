// 🌟 ゲスト（お試し）で入った人に、3〜5分でひと通り触ってもらうための道順。
//
// 展示では、こちらが横に付いて説明できないことがある。
// 何をすればいいか分からないまま離脱しないよう、
// 「押す → その画面へ行く → 済みが付く」だけの短い一覧にしている。
//
// 画面に出す文言と行き先はここにまとめる。画面側は並べるだけ。

// 保存する場所の名前は src/lib/guestGuide.js にまとめてある。

// guide:  実際のボタンを1つずつ光らせて、最後まで案内する手順。
//         type='action' は光ったボタンを押すと次へ、'explain' は説明だけ。
//         最後まで行ったところで、この手順は済みになる。
// where:  一覧に短く出す「押す場所」の要約
// action: 'route' … その画面へ移動する ／ 'event' … 画面の部品を開く合図を出す
// check:  'tap'   … 見れば済み ／ 'action' … 実際にやったら済み（アプリ側から合図が来る）
export const GUEST_TRAIL = [
  {
    id: 'notice',
    guide: [
      { type: 'action', sel: '[data-tour="bell"]', title: 'ベルを押す', desc: '' },
      { type: 'explain', sel: '[data-tour="notif-panel"]', title: 'お知らせが届いています', desc: '承認するとフレンドが増えます' },
    ],
    where: '右上のベル',
    check: 'tap',
    minutes: '30秒',
    title: 'お知らせを見る',
    desc: '催促とフレンド申請が届いています。デモ太郎さんの申請を承認すると、フレンドが増えます。',
    action: 'event',
    event: 'settlo:open-notifications',
  },
  {
    id: 'event',
    guide: [
      { type: 'action', sel: '[data-tour="nav-event"]', title: 'イベントを押す', desc: '' },
      { type: 'action', sel: '[data-tour="event-card"]', title: '札幌旅行（デモ）を押す', desc: '' },
      { type: 'explain', sel: '[data-tour="ev-summary"]', title: '3人ぶんの貸し借り', desc: '誰がいくら負担したかまで出ます' },
    ],
    where: '下の「イベント」',
    check: 'tap',
    minutes: '40秒',
    title: 'イベントの中身を見る',
    desc: '「札幌旅行（デモ）」に3人ぶんの立て替えが入っています。誰がいくら負担したかまで出ます。',
    action: 'route',
    to: '/event?open=first',
  },
  {
    id: 'offset',
    guide: [
      { type: 'action', sel: '[data-tour="nav-money"]', title: '支払いを押す', desc: '' },
      { type: 'action', sel: '[data-tour="pay-settle"]', title: 'まとめてを押す', desc: '' },
      { type: 'action', sel: '[data-tour="settle-person"]', title: '相手を押す', desc: '全イベントを差し引いた額です' },
      { type: 'action', sel: '[data-tour="settle-go"]', title: 'このボタンまで押す', desc: '押し切ると完了です' },
    ],
    where: '下の「支払い」→「まとめて」',
    check: 'action',
    minutes: '30秒',
    title: '相手ごとにまとめて精算する',
    desc: '「まとめて」タブは、全部のイベントをまたいで人ごとに差し引きます。デモ太郎さんとは受け取る¥2,000と払う¥3,000があるので、差し引き¥1,000を払うだけになります。',
    action: 'route',
    to: '/payment?tab=settle',
    star: true,
  },
  {
    id: 'settle',
    guide: [
      { type: 'action', sel: '[data-tour="nav-event"]', title: 'イベントを押す', desc: '' },
      { type: 'action', sel: '[data-tour="event-card"]', title: '札幌旅行（デモ）を押す', desc: '' },
      { type: 'action', sel: '[data-tour="ev-summary"]', title: 'このカードを押す', desc: '' },
      { type: 'action', sel: '[data-tour="ev-settle-confirm"]', title: 'この内容で始めるを押す', desc: '送金2回にまとまります' },
      { type: 'action', sel: '[data-tour="confirm-ok"]', title: '開始するを押す', desc: 'デモなのでお金は動きません' },
    ],
    where: '「イベント」→「精算を始める」',
    check: 'action',
    minutes: '1分',
    title: 'イベントごとにまとめて精算する',
    desc: 'イベントの「精算を始める」で、3人の貸し借りが送金2回にまとまります。金額を押すと、その額になった元の立て替えも見られます。始めた分は、同じお金を二重に精算しないよう上の「まとめて」からは外れます。',
    action: 'route',
    to: '/event?open=settlement',
    star: true,
  },
  {
    id: 'chat',
    guide: [
      { type: 'action', sel: '[data-tour="chat"]', title: 'ふきだしを押す', desc: '' },
      { type: 'action', sel: '[data-tour="chat-thread"]', title: 'この相談を押す', desc: '' },
      { type: 'action', sel: '[data-tour="rh-toggle"]', title: 'AIと返信を考えるを押す', desc: '' },
      { type: 'action', sel: '[data-tour="rh-ai"]', title: 'AIに相談するを押す', desc: '会話を読んだ文案が3つ出ます' },
    ],
    where: '左上のふきだし',
    check: 'action',
    minutes: '1分',
    title: '相談して、AIに文案を作ってもらう',
    desc: 'デモ太郎さんから相談が届いています。「AIと返信を考える」→「AIに相談する」で、会話を読んだ文案が3つ出ます。',
    action: 'route',
    to: '/chats',
    star: true,
  },
  {
    id: 'split',
    guide: [
      { type: 'action', sel: '[data-tour="nav-add"]', title: '＋を押す', desc: '' },
      { type: 'action', sel: '[data-tour="sheet-friend-split"]', title: 'フレンドと割り勘を押す', desc: '' },
      { type: 'action', sel: '[data-tour="friend-row"]', title: '相手を選ぶ', desc: '' },
      { type: 'action', sel: '[data-tour="fp-save"]', title: '品名と金額を入れて押す', desc: 'デモなのでお金は動きません' },
    ],
    where: '「＋」→「フレンドと割り勘」',
    check: 'action',
    minutes: '30秒',
    title: 'イベントを作らずに1件だけ割り勘',
    desc: 'デモ花子さんははじめからフレンドです。品名と金額を入れるだけで、誰がいくら払う形になるか先に出ます。',
    action: 'route',
    to: '/friend?pick=split',
  },
  {
    id: 'receipt',
    guide: [
      { type: 'action', sel: '[data-tour="nav-add"]', title: '＋を押す', desc: '' },
      { type: 'action', sel: '[data-tour="sheet-payment"]', title: 'お支払いを追加を押す', desc: '' },
      { type: 'action', sel: '[data-tour="event-card"]', title: 'イベントを選ぶ', desc: '' },
      { type: 'explain', sel: '[data-tour="receipt-drop"]', title: 'ここでレシートを撮ります', desc: '店名・金額・税をAIが入れます' },
    ],
    where: '「＋」→「お支払いを追加」',
    check: 'tap',
    minutes: '40秒',
    title: 'レシートを読み取る（レシートがあれば）',
    desc: '「＋」→「お支払いを追加」でレシートを撮ると、店名・金額・消費税をAIが入れます。1回に5枚まで。',
    action: 'route',
    to: '/event?pick=payment',
  },
];

const ids = new Set(GUEST_TRAIL.map((step) => step.id));

// 保存してある「済み」を、今の道順にある id だけに整える。
// 昔の id が残っていても数がずれないようにする。
export function normalizeDone(saved) {
  const list = Array.isArray(saved) ? saved : [];
  const seen = new Set();
  return list.filter((id) => typeof id === 'string' && ids.has(id) && !seen.has(id) && seen.add(id));
}

export function trailProgress(saved) {
  const done = normalizeDone(saved);
  return { done: done.length, total: GUEST_TRAIL.length, finished: done.length >= GUEST_TRAIL.length };
}

// 次にやること。全部済んでいれば null。
export function nextTrailStep(saved) {
  const done = new Set(normalizeDone(saved));
  return GUEST_TRAIL.find((step) => !done.has(step.id)) || null;
}

export function markDone(saved, id) {
  if (!ids.has(id)) return normalizeDone(saved);
  return normalizeDone([...normalizeDone(saved), id]);
}
