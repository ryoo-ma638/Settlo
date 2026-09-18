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
  assert.match(card, /完了したらチェック/, '済みの付き方が画面に出ていない');
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

test('押す場所の案内が、実際のボタン名と合っている', () => {
  // 画面のボタン名を変えたのに案内が古いままだと、書いてある場所を探しても無い
  const sources = {
    'src/components/AppFooter.vue': ['イベント', '支払い', 'フレンドと割り勘', 'お支払いを追加'],
    'src/views/MoneyPage.vue': ['まとめて'],
    'src/views/EventDetails.vue': ['精算を始める'],
  };
  const all = Object.values(sources).flat();
  const named = new Set();
  for (const step of GUEST_TRAIL) {
    for (const m of step.where.matchAll(/「([^」]+)」/g)) named.add(m[1]);
  }
  for (const label of named) {
    if (label === '＋') continue; // ＋ボタンには文字が無い
    assert.ok(all.includes(label), `案内の「${label}」が、どの画面のボタン名でもない`);
  }
  for (const [path, labels] of Object.entries(sources)) {
    const src = readFileSync(path, 'utf8');
    for (const label of labels) {
      if (!named.has(label)) continue;
      assert.ok(src.includes(label), `${path} に「${label}」というボタンが無い`);
    }
  }
});

test('押す場所を画面にも出している', () => {
  const card = strip('src/components/GuestTrailCard.vue');
  assert.match(card, /step\.where/, '押す場所が画面に出ていない');
});

test('閉じる・やり直しは、たずねてから実行する', () => {
  // どちらも押し間違えると、試した印や案内そのものが消える
  const card = strip('src/components/GuestTrailCard.vue');
  assert.match(card, /@click="askReset"/, 'やり直しがその場で実行されている');
  assert.match(card, /@click="askHide"/, '閉じるがその場で実行されている');
  assert.match(card, /<BaseModal/, 'たずねる画面が無い');
  assert.match(card, /最初からやり直しますか？/, 'やり直しの確認文が無い');
  assert.match(card, /この案内を閉じますか？/, '閉じるときの確認文が無い');
  // やめるを押したときに実行されないこと
  assert.match(card, /@cancel="confirmState\.show = false"/, 'やめたときの動きが無い');
});
