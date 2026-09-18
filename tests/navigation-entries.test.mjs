// ナビの入口が切れていないかを、ソースを読んで確かめる。
// 画面の見た目ではなく「押した先が本当にその画面か」「押したラベルと画面名が同じか」を守る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL('../src/' + p, import.meta.url), 'utf8');

const footer = read('components/AppFooter.vue');
const friendView = read('views/FriendView.vue');
const friendDetail = read('views/FriendDetailView.vue');
const eventViews = read('views/EventViews.vue');
const myPage = read('views/MyPageView.vue');
const header = read('components/AppHeader.vue');
const trash = read('views/TrashView.vue');
const chatList = read('views/ChatListView.vue');
const paymentDetail = read('views/PaymentDetailView.vue');

test('下の＋の3つは、行き先が全部ある', () => {
  assert.match(footer, /pick\('\/make-event'\)/, 'イベントを作成');
  assert.match(footer, /pick\('\/event\?pick=payment'\)/, 'お支払いを追加');
  assert.match(footer, /pick\('\/friend\?pick=split'\)/, 'フレンドと割り勘');
});

test('「フレンドと割り勘」は一覧に飛ばすだけでなく、選ぶ画面になる', () => {
  // 受け取る側が ?pick=split を見ていないと、ただのフレンド一覧に着地してしまう
  assert.match(friendView, /route\.query\.pick === 'split'/);
  assert.match(friendView, /pickSplit/);
  // 相手を押したら、そのまま割り勘の入力が開くよう split=1 を渡す
  assert.match(friendView, /split: '1'/);
  assert.match(friendDetail, /route\.query\.split === '1'/);
});

test('「お支払いを追加」も同じ作りのまま（片方だけ直して作りがばらけないように）', () => {
  assert.match(eventViews, /route\.query\.pick === 'payment'/);
  assert.match(eventViews, /addPayment=1/);
});

test('押したラベルと、開く画面の名前が同じ', () => {
  const pairs = [
    ['元に戻す', trash],
    ['相談', chatList],
  ];
  for (const [label, view] of pairs) {
    assert.ok(myPage.includes(`<span class="menu__label">${label}</span>`), `マイページに「${label}」が無い`);
    assert.ok(view.includes(`title="${label}"`), `開く画面の名前が「${label}」ではない`);
  }
  // ヘッダーの吹き出しも同じ呼び方にしておく（読み上げだけ古い名前、を防ぐ）
  assert.match(header, /aria-label="相談"/);
  // 捨てる絵のままだと「元に戻す」と意味が逆になる
  assert.ok(!/menu__label">取引を元に戻す[\s\S]{0,10}<\/span>[\s\S]{0,200}M4 7h16/.test(myPage));
});

test('支払いの明細と相談は、行き来できる', () => {
  // 相談 → 明細（もともとある）
  assert.match(read('views/ThreadView.vue'), /payment-detail\//);
  // 明細 → 相談（今回足した分）。会話のIDの作り方は通知と同じものを使う
  assert.match(paymentDetail, /この支払いについて相談する/);
  assert.match(paymentDetail, /threadIdFor\(myUid, otherUid, `t-\$\{it\.id\}`\)/);
  // まとめて精算のように複数件を束ねた画面では出さない（どの取引か決まらないため）
  assert.match(paymentDetail, /!isBatch\.value && !isSettleBatch\.value && items\.value\.length === 1/);
});

test('消えかけの覆いが画面を塞がない', () => {
  // ＋のシートを閉じた直後に画面を移動すると、透明のまま body に取り残されて
  // 画面全体を塞ぐことがあった（見た目は普通なのに何も押せない）。
  // 押させない指定と、画面が変わったら閉じる指定の両方を残す。
  assert.match(footer, /\.sheet-fade-leave-active[^}]*pointer-events:\s*none/);
  assert.match(footer, /watch\(\(\) => route\.fullPath[\s\S]{0,80}showAddSheet\.value = false/);
  assert.match(header, /\.assist-leave-active[^}]*pointer-events:\s*none/);
});

test('はじめてガイドは前にも戻れる', () => {
  const tour = read('components/ButtonTour.vue');
  assert.match(tour, /class="tour__back"/);
  // 戻った先の画面まで帰さないと、対象が見つからず勝手に先へ進んでしまう
  assert.match(tour, /stepPaths\[stepIndex\.value\] = router\.currentRoute\.value\.path/);
  assert.match(tour, /data-tour="sheet-/);
});

test('押せる行は、キーボードでも選べる', () => {
  // 支払い画面の行は div で、タブキーで選べず Enter でも開けなかった。
  // イベントのカードは role と tabindex を持っているので、そこに合わせる。
  const money = read('views/MoneyPage.vue');
  // 行そのものだけ数える（trow__avatar のような中の部品は除く）
  const rows = money.match(/class="trow(?:\s[^"]*)?"/g) || [];
  const marked = money.match(/role="button" tabindex="0"/g) || [];
  assert.ok(rows.length > 0, '行が見つからない');
  assert.equal(marked.length, rows.length, '押せる行の数だけ role と tabindex が要る');
  assert.match(money, /@keydown\.enter=/);
  assert.match(money, /@keydown\.space\.prevent=/);
  assert.match(eventViews, /role="button" tabindex="0"/);
});

test('作成と参加のタブは、URLと合っている', () => {
  const makeEvent = read('views/MakeEventView.vue');
  assert.match(makeEvent, /watch\(\(\) => route\.query\.join/, '戻る・進むでタブとURLがずれる');
});
