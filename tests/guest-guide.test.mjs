import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { ONBOARDING_KEY, TRAIL_KEY, TRAIL_HIDDEN_KEY, TRAIL_KEYS, ALL_GUIDE_KEYS, clearKeys, showTrailAgain, resetGuestGuide } from '../src/lib/guestGuide.js';

const fakeStore = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
};

test('案内だけ出し直すときは、はじめてガイドの記録を消さない', () => {
  // 道案内を閉じた人が「もう一度」を押しただけで、3枚のガイドまで出ると煩わしい
  const store = fakeStore({ [ONBOARDING_KEY]: '1', [TRAIL_KEY]: '["event"]', [TRAIL_HIDDEN_KEY]: 'true' });
  showTrailAgain(store);
  assert.equal(store.getItem(ONBOARDING_KEY), '1', 'はじめてガイドまで消している');
  assert.equal(store.getItem(TRAIL_KEY), null);
  assert.equal(store.getItem(TRAIL_HIDDEN_KEY), null);
});

test('最初からやり直すときは、案内の記録を全部消す', () => {
  const store = fakeStore({ [ONBOARDING_KEY]: '1', [TRAIL_KEY]: '["event"]', [TRAIL_HIDDEN_KEY]: 'true', 'ほかの設定': 'のこす' });
  resetGuestGuide(store);
  for (const key of ALL_GUIDE_KEYS) assert.equal(store.getItem(key), null, `${key} が残っている`);
  assert.equal(store.getItem('ほかの設定'), 'のこす', '関係ない保存まで消している');
});

test('鍵の並びに、はじめてガイドと道案内の両方が入っている', () => {
  assert.deepEqual(TRAIL_KEYS, [TRAIL_KEY, TRAIL_HIDDEN_KEY]);
  assert.ok(ALL_GUIDE_KEYS.includes(ONBOARDING_KEY));
  assert.equal(new Set(ALL_GUIDE_KEYS).size, ALL_GUIDE_KEYS.length, '鍵が重複している');
});

test('保存が使えない端末でも落ちない', () => {
  assert.deepEqual(clearKeys(ALL_GUIDE_KEYS, null), []);
  const broken = { removeItem: () => { throw new Error('使えません'); } };
  assert.deepEqual(clearKeys(ALL_GUIDE_KEYS, broken), []);
});

test('画面側が、やり直しと出し直しの入口を持っている', () => {
  // 同じ端末を次の人へ渡せないと、展示で前の人のデータから始まってしまう。
  // 「閉じる」を押した人が戻せないと、案内が二度と出ない。
  const mypage = readFileSync('src/views/MyPageView.vue', 'utf8');
  assert.match(mypage, /デモを最初からやり直す/, 'やり直しの入口が無い');
  assert.match(mypage, /resetGuestGuide\(\)/, '案内の記録を消していない');
  assert.match(mypage, /signOut\(auth\)/, '次の人が新しいゲストで始められない');
  assert.match(mypage, /v-if="isGuest"/, 'ゲスト以外にも出してしまう');

  const help = readFileSync('src/views/HelpView.vue', 'utf8');
  assert.match(help, /ホームのお試し案内をもう一度出す/, '出し直しの入口が無い');
  assert.match(help, /showTrailAgain\(\)/, '案内の記録を消していない');
});

test('案内の記録は1か所にまとめる', () => {
  // 鍵の名前が散らばると、やり直しても片方だけ残る
  for (const path of ['src/components/GuestTrailCard.vue', 'src/components/OnboardingModal.vue', 'src/views/HelpView.vue', 'src/views/MyPageView.vue']) {
    const source = readFileSync(path, 'utf8')
      .split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    assert.ok(!/'settlo_onboarding_done'|'settlo_guest_trail/.test(source), `${path} が鍵の名前を直接書いている`);
  }
});
