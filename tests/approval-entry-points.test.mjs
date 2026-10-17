// 承認・拒否・まとめ精算の確定が、画面から取引を直接書かずにサーバー側（settlementBatch）へ集まっていることを守るテスト。
//   実行: node --test tests/approval-entry-points.test.mjs
//
// なぜ守るか
//   画面が取引を1件ずつ書くと、途中で止まったときに「片側だけ完了」「内訳なし」「通知だけ」が残る。
//   また承認の入口が3つ（お知らせ・決済の詳細・チャット）あり、単位がそろっていないと
//   まとめ精算の1件だけが完了するなどの食い違いが起きた。
//   2026-10-17 から、確定は Cloud Functions（functions/settlementBatchCore.js）が1回で行い、
//   画面は「見た申請（内訳ID／申請ID）と金額」を渡すだけにする。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const read = (p) => readFileSync(SRC + p, 'utf8');
const section = (text, start, end) => {
  const i = text.indexOf(start);
  assert.ok(i >= 0, `${start} が見つからない`);
  const j = end ? text.indexOf(end, i + start.length) : text.length;
  assert.ok(j > i, `${end} が見つからない`);
  return text.slice(i, j);
};
const writesTransactions = (body) => /updateDoc\(\s*doc\(db,\s*["']transactions["']/.test(body)
  || /setDoc\(\s*doc\(db,\s*["']transactions["']/.test(body) || /runTransaction\(/.test(body) || /writeBatch\(/.test(body);
const sourceFiles = (dir) => readdirSync(dir).flatMap((name) => {
  const full = dir + name;
  if (statSync(full).isDirectory()) return sourceFiles(full + '/');
  return /\.(vue|js)$/.test(name) ? [full] : [];
});

// 承認・拒否の3つの入口。[ファイル, 入口の始まり, 入口の終わり]
const ENTRIES = [
  ['components/NotificationIcon.vue', 'const decideRequest = async', 'const approveRestore = async'],
  ['views/PaymentDetailView.vue', 'const decideItems = async', 'const confirmCash = () => {'],
  ['views/ThreadView.vue', 'const decideTx = async', 'const scrollToBottom'],
];

test('承認・拒否の3つの入口は、取引・お知らせ・履歴を直接書かずにサーバー側の判断を1回呼ぶ', () => {
  for (const [file, start, end] of ENTRIES) {
    const body = section(read(file), start, end);
    assert.ok(body.includes('decideSettlementApproval('), `${file}: サーバー側の判断を呼んでいない`);
    assert.ok(!writesTransactions(body), `${file}: 取引を直接書いている`);
    assert.ok(!body.includes('logApprovalBoth('), `${file}: 承認履歴を画面から書いている（サーバー側で書く）`);
    assert.ok(!/addDoc\(\s*collection\(db,\s*["']notifications["']/.test(body), `${file}: 結果のお知らせを画面から作っている`);
    // 連打・二重送信の守りが残っている
    assert.ok(/acting\.value|submitting\.value|approving\.value/.test(body), `${file}: 二重送信の守りがない`);
  }
});

test('各入口は、画面が見た申請（内訳ID または 申請ID）と金額をサーバーへ渡す', () => {
  for (const [file, start, end] of ENTRIES) {
    const body = section(read(file), start, end);
    assert.ok(/requestId/.test(body), `${file}: 画面が見た申請を渡していない`);
    assert.ok(/expectedAmount/.test(body), `${file}: 画面に出していた金額を渡していない`);
  }
  // 決済の詳細は、読み込んだ取引ごとに「見た申請」を持つ（まとめ精算・イベント単位・1件の3経路）
  const detail = read('views/PaymentDetailView.vue');
  const carried = detail.match(/requestId: (?:t|data)\.settlementBatch\?\.id \|\| (?:t|data)\.approvalRequestId \|\| null/g) || [];
  assert.equal(carried.length, 3, `読み込み経路に見た申請が入っていない（${carried.length}/3）`);
});

test('まとめ精算の確定画面は、取引を直接書かずに申請（submitSettlementBatch）を呼ぶ', () => {
  const text = read('views/CombinedActionView.vue');
  assert.ok(text.includes('submitSettlementBatch('));
  assert.ok(!writesTransactions(text), '取引を直接書いている');
  assert.ok(!/addDoc\(/.test(text), 'お知らせを画面から作っている');
  assert.ok(!text.includes('stampSettlementBatch'), '内訳を画面から付けている');
  // 見せた内訳（対象・相殺・実質・件数）をそのまま渡す
  assert.ok(/expected\s*=\s*\{\s*gross:/.test(text) || text.includes('gross: Number(route.query.gross)'), '見せた内訳を渡していない');
});

test('画面側に、内訳を付ける・逆方向を戻す・未読の承認リクエストを探す処理が残っていない', () => {
  const files = sourceFiles(SRC);
  assert.ok(files.length > 20, 'ソースを読めていない');
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const where = file.replace(SRC, 'src/');
    for (const gone of ['stampSettlementBatch', 'revertCounterTransactions', 'findBatchApprovalRequests', 'revertBatchCounterparts', 'clearApprovalNotif']) {
      assert.ok(!text.includes(gone), `${where} に ${gone} が残っている`);
    }
    // 内訳（settlementBatch）を画面から書く形が無い（消すこと＝null は今までどおり）
    assert.ok(!/settlementBatch:\s*\{/.test(text), `${where} が内訳を画面から書いている`);
  }
});

test('支払い報告（単発）は申請IDを付けて保存し、お知らせにも同じIDを入れる', () => {
  const body = section(read('views/PaymentDetailView.vue'), "title: '現金の支払い確認'", '</script>');
  assert.ok(body.includes('makeRequestId()'));
  assert.ok(body.includes("updateAllItems('awaiting_approval', (it) => ({ approvalRequestId: requestIds.get(it.id) }))"));
  assert.ok(body.includes('{ approvalRequestId: requestIds.get(it.id) }'));
});

test('付随処理（チャットの経緯）は保存の後に settlementFollowUps で待ち、お金の更新を再送しない', () => {
  const checks = [
    ...ENTRIES.map(([file, start, end]) => [file, section(read(file), start, end), 'decideSettlementApproval(']),
    ['views/CombinedActionView.vue', read('views/CombinedActionView.vue'), 'submitSettlementBatch('],
  ];
  for (const [file, body, call] of checks) {
    const saved = body.indexOf(call);
    const followed = body.indexOf('settlementFollowUps(');
    assert.ok(saved >= 0 && followed > saved, `${file}: 付随処理が保存より前にある、または待っていない`);
    assert.ok(!/retry|resend|再送/.test(body.slice(followed, followed + 400)) || body.includes('再送しない'), `${file}: 付随処理の失敗で再送している疑い`);
  }
});
