// 🌟 「〜したい」から入る5つの入口。案内の中身をここに1か所でまとめる。
//
// 展示では「お支払いを追加したい」のように用で聞かれることが多かった。
// 機能の名前で並べると、どれを押せばいいのか結び付かないので、
// したいことを見出しにして、そのまま光らせる手順につなげる。
//
// 並びは 記録 → 精算 → 催促 の順。3本目は催促で、承認ではない。
// デモの種データには自分が承認する側の取引が無いので、承認までは通せない。
// 先頭3本でできるのは、記録を1件・相殺の確認（まとめて精算）・催促を1件。
// 文字列と並び順を入れ替えるだけで言い方を変えられるよう、定義はこのファイルだけに置く。
//
// 形は src/lib/guestTrail.js の課題と同じ（id・title・desc・where・check・minutes・guide）。
// guide:   実際のボタンを1つずつ光らせて案内する手順。
//          type='action' は光ったボタンを押すと次へ、'explain' は説明だけ。
// where:   一覧に短く出す「押す場所」の要約
// check:   'tap' … 見れば済み ／ 'action' … 実際にやったら済み
// minutes: 一覧に出す目安の時間
//
// 画面側はまだこの定義を読んでいない。つなぐのは次の段。

import { GUEST_TRAIL } from './guestTrail.js';

// 「初めての方へ」と同じ手順は書き写さずに借りる。
// 写すと、片方だけ直したときに文言と行き先がずれる。
function trail(id) {
  const course = GUEST_TRAIL.find((step) => step.id === id);
  if (!course) throw new Error(`初めての方への課題が見つかりません: ${id}`);
  return course.guide;
}

// id は guestTrail の課題と重ならない名前にする。
// 「済み」は端末に id で残るので、同じ名前だと昔の印を引き継いで最初から済みに見える。
export const TASK_ENTRIES = [
  {
    id: 'add-payment',
    guide: [
      ...trail('receipt').slice(0, 3),
      { type: 'action', sel: '[data-tour="ap-save"]', title: '金額と割り方を入れて追加', desc: 'デモなのでお金は動きません' },
    ],
    where: '「＋」→「お支払いを追加」',
    check: 'action',
    minutes: '40秒',
    title: 'お支払いを追加したい',
    desc: '立て替えた分を、割り方まで決めて記録します。',
  },
  {
    id: 'settle-batch',
    guide: trail('settle'),
    // 「まとめて精算」のカードを開いてから、その中のボタンを押す。
    // イベント一覧の見出し横にも「精算を始める」があり、そちらは指していない。
    where: '「まとめて精算」のカード →「この内容でまとめて精算を始める」',
    check: 'action',
    // 手順をそのまま借りているので、時間も借用元に合わせる（guestTrail の settle ＝ 1分）。
    minutes: '1分',
    title: 'まとめて精算したい',
    desc: 'イベントの貸し借りが、送金1回にまとまります。',
  },
  {
    id: 'remind',
    guide: [
      ...trail('offset').slice(0, 1),
      { type: 'action', sel: '[data-tour="pay-waiting-row"]', title: '相手の行を押す', desc: '' },
      { type: 'action', sel: '[data-tour="pd-remind"]', title: '催促するを押す', desc: '送った回数も残ります' },
    ],
    where: '下の「支払い」→ 相手の行',
    check: 'action',
    minutes: '30秒',
    title: '催促したい',
    desc: 'まだ払われていない分に、通知を送ります。',
  },
  {
    id: 'receipt-read',
    guide: trail('receipt'),
    where: '「＋」→「お支払いを追加」',
    check: 'tap',
    minutes: '40秒',
    title: 'レシートを読ませたい',
    desc: '店名・金額・消費税をAIが入れます。1回に5枚まで。',
  },
  {
    id: 'notify-setup',
    guide: [
      ...trail('notice'),
      { type: 'action', sel: '[data-tour="avatar"]', title: 'マイページを押す', desc: '' },
      { type: 'explain', sel: '[data-tour="mp-notify"]', title: '通知設定', desc: '受け取る種類をここで選びます' },
    ],
    where: '右上のベル →「マイページ」',
    check: 'tap',
    // 借用元 notice は2手順で30秒＝1手順15秒。ここはそこへ2手順足すので +30秒 で合計1分。
    minutes: '1分',
    title: '通知を受け取りたい',
    desc: '届いたお知らせを見て、受け取り方を決めます。',
  },
];
