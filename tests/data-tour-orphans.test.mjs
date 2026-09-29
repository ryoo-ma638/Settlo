// 案内が指す先の目印（data-tour）は、案内を削ると使われないまま画面に残る。
// 残っていても見た目は変わらないので、誰も気づけないまま増えていく。
// #348 で使い方ツアーを43件から30件へ減らしたとき、実際に12件が浮いた。
// ここでは「画面に置いた目印は、必ずどこかの案内かコードから使われていること」を見張る。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(vue|js)$/.test(entry.name)) files.push(path);
  }
}('src'));

// 画面に置いてある目印。静的な data-tour="…" と、
// 1行目だけに付ける :data-tour="index === 0 ? '…' : null" の両方を拾う。
const placed = new Map();
// 案内やコードから指している目印。手順の sel は [data-tour="…"] の形で書く。
const referenced = new Set();

for (const path of files) {
  const source = readFileSync(path, 'utf8');
  for (const m of source.matchAll(/(?<!\[):?data-tour="([a-z0-9-]+)"/g)) {
    if (!placed.has(m[1])) placed.set(m[1], path);
  }
  for (const m of source.matchAll(/:data-tour="[^"]*'([a-z0-9-]+)'/g)) {
    if (!placed.has(m[1])) placed.set(m[1], path);
  }
  for (const m of source.matchAll(/\[data-tour="([a-z0-9-]+)"\]/g)) referenced.add(m[1]);
}

// 案内には出さないが、コードから使うので残す目印。足すときは理由も書く。
// ButtonTour.vue は step.sel を 'data-tour="sheet-' の前方一致でも見ている
// （＋シートが開いているかの判定）が、sheet- の4件はどれも手順の sel に出ているので
// ここには要らない。いまは該当が無いので空にしておく。
const ALLOWLIST = new Map([]);

test('目印の拾い方が壊れていない（数えられている）', () => {
  // 正規表現を直したときに、何も拾えていないのに合格になるのを防ぐ。
  assert.ok(placed.size > 30, `画面の目印が少なすぎる: ${placed.size}件`);
  assert.ok(referenced.size > 30, `案内が指す目印が少なすぎる: ${referenced.size}件`);
});

test('画面に置いた目印は、どこかの案内かコードから使われている', () => {
  const orphans = [...placed.keys()]
    .filter((name) => !referenced.has(name) && !ALLOWLIST.has(name))
    .map((name) => `${name}（${placed.get(name)}）`)
    .sort();
  assert.deepEqual(orphans, [], 'どこからも呼ばれない目印が残っている');
});

test('案内が指す目印は、すべて画面に置いてある', () => {
  // 逆向きも見る。目印を消したのに手順が残っていると、案内が黙って飛ぶ。
  const missing = [...referenced].filter((name) => !placed.has(name)).sort();
  assert.deepEqual(missing, [], '画面に無い目印を指している手順がある');
});

test('allowlist に載せた目印は、実際に画面へ置いてある', () => {
  // 消した目印の名前が allowlist に残ると、次に浮いた目印を見逃す。
  const stale = [...ALLOWLIST.keys()].filter((name) => !placed.has(name)).sort();
  assert.deepEqual(stale, [], '画面に無い目印が allowlist に残っている');
});
