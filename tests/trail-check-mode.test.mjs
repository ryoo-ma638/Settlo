import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { GUEST_TRAIL } from '../src/lib/guestTrail.js';

const strip = (path) => readFileSync(path, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('見るだけの手順と、やってみる手順を分けている', () => {
  for (const step of GUEST_TRAIL) {
    assert.ok(['tap', 'action'].includes(step.check), `${step.id} の区別が無い`);
  }
  const look = GUEST_TRAIL.filter((s) => s.check === 'tap').map((s) => s.id);
  const doIt = GUEST_TRAIL.filter((s) => s.check === 'action').map((s) => s.id);
  assert.deepEqual(look, ['notice', 'event', 'receipt'], '見るだけの手順が変わっている');
  assert.deepEqual(doIt, ['offset', 'settle', 'chat', 'split'], 'やってみる手順が変わっている');
});

test('やってみる手順は、押しただけでは済みにならない', () => {
  // 押した時点で済みにすると「やった気」で終わってしまう
  const card = strip('src/components/GuestTrailCard.vue');
  assert.match(card, /if \(step\.check !== 'action'\) complete\(step\.id\)/, '押しただけで済みにしている');
  assert.match(card, /addEventListener\(TRAIL_DONE_EVENT/, 'やり終えた合図を聞いていない');
  assert.match(card, /removeEventListener\(TRAIL_DONE_EVENT/, '合図の後片付けをしていない');
});

test('やり終えたところから合図を出している', () => {
  const places = {
    'src/views/CombinedSettlementView.vue': "markTrailDone('offset')",
    'src/views/EventDetails.vue': "markTrailDone('settle')",
    'src/views/ThreadView.vue': "markTrailDone('chat')",
    'src/components/FriendPaymentModal.vue': "markTrailDone('split')",
  };
  for (const [path, call] of Object.entries(places)) {
    assert.ok(strip(path).includes(call), `${path} から合図が出ていない`);
  }
});

test('やってみる手順には、済みの付き方が書いてある', () => {
  // 押しても✓が付かない理由が分からないと、壊れていると思われる
  const card = strip('src/components/GuestTrailCard.vue');
  assert.match(card, /やると✓/, '済みの付き方が画面に出ていない');
});
