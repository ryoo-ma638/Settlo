// 🌟 ゲスト（お試し）で入った人に、3〜5分でひと通り触ってもらうための道順。
//
// 展示では、こちらが横に付いて説明できないことがある。
// 何をすればいいか分からないまま離脱しないよう、
// 「押す → その画面へ行く → 済みが付く」だけの短い一覧にしている。
//
// 画面に出す文言と行き先はここにまとめる。画面側は並べるだけ。

// 保存する場所の名前は src/lib/guestGuide.js にまとめてある。

// action: 'route' … その画面へ移動する ／ 'event' … 画面の部品を開く合図を出す
export const GUEST_TRAIL = [
  {
    id: 'notice',
    minutes: '30秒',
    title: 'お知らせを見る',
    desc: '催促とフレンド申請が届いています。申請を承認すると、フレンドが増えます。',
    action: 'event',
    event: 'settlo:open-notifications',
  },
  {
    id: 'event',
    minutes: '40秒',
    title: 'イベントの中身を見る',
    desc: '「札幌旅行（デモ）」に3人ぶんの立て替えが入っています。誰がいくら負担したかまで出ます。',
    action: 'route',
    to: '/event?open=first',
  },
  {
    id: 'settle',
    minutes: '1分',
    title: 'まとめて精算してみる',
    desc: 'イベントの「精算を始める」で、3人の貸し借りが送金2回にまとまります。金額を押すと、その額になった元の立て替えも見られます。',
    action: 'route',
    to: '/event?open=settlement',
    star: true,
  },
  {
    id: 'chat',
    minutes: '1分',
    title: '相談して、AIに文案を作ってもらう',
    desc: 'デモ太郎さんから相談が届いています。「返信を考える」→「AIに相談する」で、会話を読んだ文案が3つ出ます。',
    action: 'route',
    to: '/chats',
    star: true,
  },
  {
    id: 'split',
    minutes: '30秒',
    title: 'イベントを作らずに1件だけ割り勘',
    desc: '手順1でデモ花子さんのフレンド申請を承認してからどうぞ。品名と金額を入れるだけで、誰がいくら払う形になるか先に出ます。',
    action: 'route',
    to: '/friend?pick=split',
  },
  {
    id: 'receipt',
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
