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

test('やり終えた印は端末に残す（別の画面で操作しても消えない）', () => {
  // 案内はホームにあるので、別の画面で操作しているあいだは外れている。
  // 合図を飛ばすだけでは誰も聞いておらず、印が付かない。
  const signal = strip('src/lib/trailProgressSignal.js');
  assert.match(signal, /localStorage\.setItem\(TRAIL_KEY/, '端末に書いていない');
  const write = signal.indexOf('localStorage.setItem(TRAIL_KEY');
  const fire = signal.indexOf('dispatchEvent');
  assert.ok(write !== -1 && fire !== -1 && write < fire, '書く前に合図を出している');
});

test('やり終えたところから合図を出している', () => {
  const places = {
    'src/views/CombinedActionView.vue': "markTrailDone('offset')",
    'src/views/EventDetails.vue': "markTrailDone('settle')",
    'src/views/ThreadView.vue': "markTrailDone('chat')",
    'src/components/FriendPaymentModal.vue': "markTrailDone('split')",
  };
  for (const [path, call] of Object.entries(places)) {
    assert.ok(strip(path).includes(call), `${path} から合図が出ていない`);
  }
});

test('相手ごとの精算は、画面を見ただけでは済みにしない', () => {
  // 一覧から相手を選んで内容を見るところまでは「見ただけ」。
  // 実際に手続きへ進んだところで済みにする。
  const view = strip('src/views/CombinedSettlementView.vue');
  assert.ok(!view.includes('markTrailDone'), '内容を見た時点で済みにしている');
});

test('やってみる手順には、済みの付き方が書いてある', () => {
  // 押しても✓が付かない理由が分からないと、壊れていると思われる
  const card = strip('src/components/GuestTrailCard.vue');
  assert.match(card, /やると✓/, '済みの付き方が画面に出ていない');
});

test('案内の説明が、画面のボタン名と合っている', () => {
  // 画面の名前を変えたのに案内が古いままだと、探しても見つからない
  const thread = readFileSync('src/views/ThreadView.vue', 'utf8');
  const labels = [...thread.matchAll(/'([^']*返信を考える)'/g)].map((m) => m[1]);
  assert.ok(labels.length > 0, 'ボタン名が見つからない');
  const trail = readFileSync('src/lib/guestTrail.js', 'utf8');
  for (const label of labels) {
    assert.ok(trail.includes(label), `案内に「${label}」が出てこない`);
  }
});
