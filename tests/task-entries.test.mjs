import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { TASK_ENTRIES } from '../src/lib/taskEntries.js';

// 画面のテンプレート（.vue）だけを1つの文字列にして、目印の付け先を集める。
// 手順を書いてあるファイル（taskEntries.js・guestTrail.js）は入れない。
// そこには sel の文字列そのものが載っているので、入れると「自分で自分を保証」してしまう。
const templates = (function walk(dir) {
  let out = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out += walk(path);
    else if (entry.name.endsWith('.vue')) out += readFileSync(path, 'utf8');
  }
  return out;
}('src'));

const allSteps = TASK_ENTRIES.flatMap((entry) => entry.guide);

// 「30秒」「1分」「1分30秒」を秒に直す
function seconds(text) {
  const m = /^(?:(\d+)分)?(?:(\d+)秒)?$/.exec(String(text));
  assert.ok(m && (m[1] || m[2]), `時間の書き方が読めない: ${text}`);
  return Number(m[1] || 0) * 60 + Number(m[2] || 0);
}

test('入口は5本で、記録→精算→承認の順に並んでいる', () => {
  // 展示では先頭3本だけ勧める。並びが変わると、勧める中身も変わってしまう。
  assert.deepEqual(
    TASK_ENTRIES.map((entry) => entry.id),
    ['add-payment', 'settle-batch', 'remind', 'receipt-read', 'notify-setup'],
  );
});

test('入口の id は「初めての方へ」と重ならない', async () => {
  // 「済み」は端末に id で残る。同じ id を使うと昔の印を引き継いで最初から済みに見える。
  const { GUEST_TRAIL } = await import('../src/lib/guestTrail.js');
  const old = new Set(GUEST_TRAIL.map((step) => step.id));
  const collided = TASK_ENTRIES.map((entry) => entry.id).filter((id) => old.has(id));
  assert.deepEqual(collided, [], '古い課題と同じ id を使っている');
});

test('手順が指す目印は、すべて画面に置いてある', () => {
  // 動的に付けているところ（:data-tour="index === 0 ? 'event-card' : null"）もあるので、
  // 属性そのものと、文字列としての出現の両方を見る。
  const placed = (name) => templates.includes(`data-tour="${name}"`) || templates.includes(`'${name}'`);
  const missing = [];
  for (const step of allSteps) {
    const m = /^\[data-tour="([^"]+)"\]$/.exec(step.sel);
    assert.ok(m, `sel の書き方がそろっていない: ${step.sel}`);
    if (!placed(m[1])) missing.push(m[1]);
  }
  assert.deepEqual([...new Set(missing)], [], '画面に無い目印を指している手順がある');
});

test('入口ごとに、形がそろっている', () => {
  for (const entry of TASK_ENTRIES) {
    for (const key of ['id', 'title', 'desc', 'where', 'check', 'minutes']) {
      assert.ok(entry[key], `${entry.id}: ${key} が無い`);
    }
    assert.ok(['tap', 'action'].includes(entry.check), `${entry.id}: check が tap / action ではない`);
    assert.ok(entry.guide.length >= 3, `${entry.id}: 手順が少なすぎる`);
    for (const step of entry.guide) {
      assert.ok(['action', 'explain'].includes(step.type), `${entry.id}: type が action / explain ではない`);
      assert.ok(step.title, `${entry.id}: 手順に title が無い`);
      assert.equal(typeof step.desc, 'string', `${entry.id}: 手順の desc が文字列でない`);
    }
  }
});

test('手順の合計は20件までにおさえる', () => {
  // 前は課題7件・手順26件で、3〜5分の枠を最初から超えていた。
  assert.ok(allSteps.length <= 20, `手順が多すぎる: ${allSteps.length}件`);
});

test('5本やり切って5分以内におさまる', () => {
  const total = TASK_ENTRIES.reduce((sum, entry) => sum + seconds(entry.minutes), 0);
  assert.ok(total <= 300, `目安の合計が5分を超えている: ${total}秒`);
});

test('入口の説明は1行（40字まで）', () => {
  // 一覧に5本並べる。1本が2行になると、画面に入りきらない。
  for (const entry of TASK_ENTRIES) {
    assert.ok([...entry.desc].length <= 40, `${entry.id}: 説明が長い（${[...entry.desc].length}字）`);
    assert.ok(!entry.desc.includes('\n'), `${entry.id}: 説明が改行を含む`);
  }
});

test('同じ手順は書き写さず、「初めての方へ」から借りている', async () => {
  // 書き写すと、片方だけ直したときに文言と行き先がずれる。
  const { GUEST_TRAIL } = await import('../src/lib/guestTrail.js');
  const borrowed = new Set(GUEST_TRAIL.flatMap((step) => step.guide));
  const reused = allSteps.filter((step) => borrowed.has(step));
  assert.ok(reused.length >= 15, `借りている手順が少ない: ${reused.length}件`);
});
