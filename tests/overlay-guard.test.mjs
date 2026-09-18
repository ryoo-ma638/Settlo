import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// 画面全体を覆う部品。消えかけの覆いが押さえたままだと、
// 画面のどこを押しても反応しなくなる（2026-09-18に「＋」のシートで起きた）。
const files = [
  'src/components/AppFooter.vue',
  'src/components/NotificationIcon.vue',
  'src/components/BaseModal.vue',
  'src/components/FriendAddModal.vue',
  'src/components/OnboardingModal.vue',
];

test('消えかけの覆いは、クリックを押さえない', () => {
  for (const path of files) {
    const css = readFileSync(path, 'utf8')
      .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    const guarded = /leave-active,\s*\.[\w-]*leave-to\s*\{[^}]*pointer-events:\s*none/.test(css);
    assert.ok(guarded, `${path} に消えかけの覆いを無効にする指定が無い`);
  }
});
