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
      { type: 'action', sel: '[data-tour="bell"]', title: 'ここを押します', desc: '右上のベルです。届いているお知らせが開きます。' },
      { type: 'explain', sel: '[data-tour="notif-panel"]', title: '届いているお知らせ', desc: '催促とフレンド申請が来ています。デモ太郎さんの申請を「承認する」と、フレンドが増えます。答えるものは、答えるまで残ります。' },
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
      { type: 'action', sel: '[data-tour="nav-event"]', title: 'ここを押します', desc: '画面の下にある「イベント」です。' },
      { type: 'action', sel: '[data-tour="event-card"]', title: 'このイベントを開きます', desc: '「札幌旅行（デモ）」を押してください。' },
      { type: 'explain', sel: '[data-tour="ev-summary"]', title: '3人ぶんの貸し借り', desc: '誰がいくら立て替えて、誰がいくら負担したかがまとまっています。このカードから、全員ぶんをまとめて精算できます。' },
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
      { type: 'action', sel: '[data-tour="nav-money"]', title: 'ここを押します', desc: '画面の下にある「支払い」です。' },
      { type: 'action', sel: '[data-tour="pay-settle"]', title: '「まとめて」を押します', desc: '上に並んだタブの3つめです。' },
      { type: 'action', sel: '[data-tour="settle-person"]', title: 'この相手を押します', desc: '全部のイベントをまたいで差し引いた金額が出ています。押すと中身が見られます。' },
      { type: 'action', sel: '[data-tour="settle-go"]', title: 'ここまで押し切ります', desc: '差し引きの結果です。この青（または橙）のボタンを押すと手続きの画面へ進み、この手順は完了になります。' },
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
      { type: 'action', sel: '[data-tour="nav-event"]', title: 'ここを押します', desc: '画面の下にある「イベント」です。' },
      { type: 'action', sel: '[data-tour="event-card"]', title: 'このイベントを開きます', desc: '「札幌旅行（デモ）」を押してください。' },
      { type: 'action', sel: '[data-tour="ev-summary"]', title: 'このカードを押します', desc: '参加者全員の貸し借りをまとめた結果が開きます。' },
      { type: 'action', sel: '[data-tour="ev-settle-confirm"]', title: 'ここまで押し切ります', desc: '「この内容でまとめて精算を始める」を押すと、3人の貸し借りが送金2回にまとまり、この手順は完了になります。デモなので、押しても実際のお金は動きません。' },
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
      { type: 'action', sel: '[data-tour="chat"]', title: 'ここを押します', desc: '左上のふきだしです。相談の一覧が開きます。' },
      { type: 'action', sel: '[data-tour="chat-thread"]', title: 'この相談を開きます', desc: 'デモ太郎さんから「いつごろ払えそうですか？」と来ています。' },
      { type: 'action', sel: '[data-tour="rh-toggle"]', title: '「AIと返信を考える」を押します', desc: '会話の下にあります。' },
      { type: 'action', sel: '[data-tour="rh-ai"]', title: 'ここまで押し切ります', desc: '「AIに相談する」を押すと、AIが会話を読んで文案を3つ出します。名前は送らず「参加者1」に置き換えてから渡しています。' },
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
      { type: 'action', sel: '[data-tour="nav-add"]', title: 'ここを押します', desc: '画面の下、まん中の緑の「＋」です。' },
      { type: 'action', sel: '[data-tour="sheet-friend-split"]', title: '「フレンドと割り勘」を押します', desc: 'イベントを作らずに、1件だけ記録する入口です。' },
      { type: 'action', sel: '[data-tour="friend-row"]', title: 'この相手を選びます', desc: 'デモ花子さんははじめからフレンドです。' },
      { type: 'action', sel: '[data-tour="fp-save"]', title: '入れてから、ここまで押し切ります', desc: '品名と金額を入れると、誰が誰へいくら払う形になるかが先に出ます。「この内容で記録する」を押すと、この手順は完了になります。デモなので実際のお金は動きません。' },
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
      { type: 'action', sel: '[data-tour="nav-add"]', title: 'ここを押します', desc: '画面の下、まん中の緑の「＋」です。' },
      { type: 'action', sel: '[data-tour="sheet-payment"]', title: '「お支払いを追加」を押します', desc: 'どのイベントに足すかを選ぶ画面になります。' },
      { type: 'action', sel: '[data-tour="event-card"]', title: 'このイベントを選びます', desc: '「札幌旅行（デモ）」を押すと、支払いを追加する画面が開きます。' },
      { type: 'explain', sel: '[data-tour="receipt-drop"]', title: 'ここからレシートを撮ります', desc: '撮ると店名・金額・消費税をAIが入れます。1回に5枚まで。レシートが無ければ、見るだけで大丈夫です。' },
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
