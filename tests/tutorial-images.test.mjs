import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const files = ['src/views/HelpView.vue', 'src/components/OnboardingModal.vue'];

test('使い方の画面で指している写真が、実際に置いてある', () => {
  // 写真を足さずに説明だけ増やすと、枠だけ空いた画面になる
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const names = new Set([
      ...[...source.matchAll(/tutorialImage\('([^']+)'\)/g)].map((m) => m[1]),
      ...[...source.matchAll(/img:\s*'([^']+)'/g)].map((m) => `${m[1]}.jpg`),
    ]);
    assert.ok(names.size > 0, `${path} が写真を1枚も指していない`);
    for (const name of names) {
      assert.ok(existsSync(`public/tutorial/${name}`), `${path} が指す ${name} が無い`);
    }
  }
});

test('同じ写真を別の説明に使い回していない', () => {
  // 中身と合わない写真が付くと、読んだ人が混乱する
  const source = readFileSync('src/views/HelpView.vue', 'utf8');
  const used = [...source.matchAll(/img:\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(used.length, new Set(used).size, `同じ写真が2か所で使われている: ${used.join(', ')}`);
});
