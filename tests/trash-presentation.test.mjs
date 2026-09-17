import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/views/TrashView.vue', import.meta.url), 'utf8');

test('空状態をイベント非表示と取引記録で分ける', () => {
  assert.match(source, /非表示にしたイベントはありません/);
  assert.match(source, /復元できる取引記録はありません/);
  assert.match(source, /保留中のものはありません/);
});

test('読込失敗と権限不明を期限切れと断定しない', () => {
  assert.match(source, /通信状況を確認してください/);
  assert.match(source, /権限またはログイン状態を確認してください/);
  assert.doesNotMatch(source, /permission-denied[^\n]*期限切れ/);
});

test('保留にも元の削除日基準の残日数を表示する', () => {
  assert.match(source, /元の削除日から7日で自動整理されます/);
  assert.match(source, /あと\{\{ daysLeft\(item\) \}\}日/);
});

test('共有する金銭記録には手動削除を出さない', () => {
  assert.match(source, /共有するお金の記録は、この画面から消せません/);
  assert.match(source, /v-if="item.type === 'event'" class="btn-outline act"/);
  assert.match(source, /if \(item.type !== 'event'\) return/);
});

test('画面名と復元操作を対象別の言葉で区別する', () => {
  assert.match(source, /PageHeader title="元に戻す"/);
  assert.match(source, />表示を戻す<\/button>/);
  assert.match(source, />取引を復元<\/button>/);
  assert.match(source, />未精算へ戻す<\/button>/);
});

test('確認文は影響範囲・相手確認・送金が戻らないことを説明する', () => {
  assert.match(source, /ほかの参加者の一覧は変わりません/);
  assert.match(source, /「正しくない」が選ばれた場合は再び削除状態に戻ります/);
  assert.match(source, /承認されるまでは精算済みのままです/);
  assert.match(source, /実際の送金は取り消されません/);
});
