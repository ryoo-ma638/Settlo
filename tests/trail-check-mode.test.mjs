import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GUEST_TRAIL } from '../src/lib/guestTrail.js';

const strip = (path) => readFileSync(path, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// src の中にある data-tour の名前を全部集める
const anchors = (() => {
  const found = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(vue|js)$/.test(name)) continue;
      for (const m of readFileSync(full, 'utf8').matchAll(/data-tour="([^"]*)"/g)) {
        // :data-tour="index === 0 ? 'event-card' : null" のような書き方も拾う
        for (const q of m[1].matchAll(/'([\w-]+)'/g)) found.add(q[1]);
        if (/^[\w-]+$/.test(m[1])) found.add(m[1]);
      }
    }
  };
  walk('src');
  return found;
})();

test('見るだけの手順と、やってみる手順を分けている', () => {
  for (const step of GUEST_TRAIL) {
    assert.ok(['tap', 'action'].includes(step.check), `${step.id} の区別が無い`);
  }
  const look = GUEST_TRAIL.filter((s) => s.check === 'tap').map((s) => s.id);
  const doIt = GUEST_TRAIL.filter((s) => s.check === 'action').map((s) => s.id);
  assert.deepEqual(look, ['notice', 'event', 'receipt'], '見るだけの手順が変わっている');
  assert.deepEqual(doIt, ['offset', 'settle', 'chat', 'split'], 'やってみる手順が変わっている');
});

test('どの手順にも、実際のボタンを光らせる案内が付いている', () => {
  // 文字で「右上のベル」と書くだけでは、どれを押すのか分からなかった
  for (const step of GUEST_TRAIL) {
    assert.ok(Array.isArray(step.guide) && step.guide.length > 0, `${step.id} に案内が無い`);
    for (const g of step.guide) {
      assert.ok(['action', 'explain'].includes(g.type), `${step.id}: 案内の種類が不明`);
      assert.ok(g.title && g.desc, `${step.id}: 案内の文が足りない`);
      assert.match(g.sel, /^\[data-tour="[\w-]+"\]$/, `${step.id}: 指す先の書き方が違う（${g.sel}）`);
    }
  }
});

test('案内が指すボタンは、実際に画面にある', () => {
  // 画面から消えたボタンを指したままだと、案内が途中で飛ばされる
  for (const step of GUEST_TRAIL) {
    for (const g of step.guide) {
      const name = /data-tour="([\w-]+)"/.exec(g.sel)[1];
      assert.ok(anchors.has(name), `${step.id}: data-tour="${name}" がどこにも無い`);
    }
  }
});

test('やってみる手順は、最後に本当のボタンを押させて終わる', () => {
  // 途中の画面を見ただけで終わらせない
  for (const step of GUEST_TRAIL.filter((s) => s.check === 'action')) {
    const last = step.guide[step.guide.length - 1];
    assert.equal(last.type, 'action', `${step.id}: 最後が押すところで終わっていない`);
    assert.match(last.desc, /押/, `${step.id}: 最後に何を押すのか書かれていない`);
  }
});

test('最後まで行かずにやめた分は、済みにしない', () => {
  const tour = strip('src/components/ButtonTour.vue');
  assert.match(tour, /completed\.value = true/, '最後まで行ったことを覚えていない');
  assert.match(tour, /if \(wasTask && wasDone\) markTrailDone\(wasTask\)/, '途中でやめても済みになる');
});

test('やり終えた印は端末に残す（別の画面で操作しても消えない）', () => {
  const signal = strip('src/lib/trailProgressSignal.js');
  // markTrailDone の中だけを見る（同じファイルに開始の合図もあるため）
  const body = signal.slice(signal.indexOf('export function markTrailDone'));
  assert.match(body, /localStorage\.setItem\(TRAIL_KEY/, '端末に書いていない');
  const write = body.indexOf('localStorage.setItem(TRAIL_KEY');
  const fire = body.indexOf('dispatchEvent');
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
  const view = strip('src/views/CombinedSettlementView.vue');
  assert.ok(!view.includes('markTrailDone'), '内容を見た時点で済みにしている');
});

test('「触ってみる」はアシスタントの中に、いまの1件だけ出す', () => {
  // 7件を一度に並べると読みづらく、どれからやるのか分からなかった
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /<GuestTryCard/, 'アシスタントの中に入っていない');
  const panel = header.indexOf('<GuestTryCard');
  const guide = header.indexOf('<ActionGuide');
  assert.ok(panel !== -1 && guide !== -1 && panel < guide, 'パネルを開いて最初に出ない');

  const card = strip('src/components/GuestTryCard.vue');
  assert.match(card, /nextTrailStep/, 'いまの1件を選んでいない');
  assert.match(card, /startGuidedTask/, '案内を始められない');
  assert.ok(!/v-for="\(step, i\) in steps"[\s\S]{0,200}try__go/.test(card), '全部の手順に開始ボタンを出している');
});

test('お試しの人には、アシスタントの場所を目立たせる', () => {
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /is-calling/, '強調の指定が無い');
  assert.match(header, /ここから/, '入口だと分かる文字が無い');
  assert.match(header, /callAttention = computed/, '出す条件が無い');
  assert.match(header, /trailLeft\.value > 0/, 'ひと通り済んでも出したままになる');
});

test('ホームには「触ってみる」を出さない（アシスタントへ集約した）', () => {
  const home = strip('src/views/HomeView.vue');
  assert.ok(!home.includes('GuestTrailCard'), 'ホームに古い案内が残っている');
});

test('案内は、チャット画面へ移っても消えない', () => {
  // /thread はシェル無しで開く。シェルの中に置くと、その画面へ移った瞬間に
  // 案内ごと外れて、途中で止まっていた（2026-09-19）。
  const app = strip('src/App.vue');
  const shellEnd = app.indexOf('</div>', app.indexOf('class="app-shell"'));
  const tour = app.indexOf('<ButtonTour />');
  assert.ok(tour !== -1, 'ボタンの案内が置かれていない');
  assert.ok(tour > shellEnd, 'シェルの中に置いてある（チャットで消える）');
});

test('見つからなかった手順は、飛ばしても済みにしない', () => {
  const tour = strip('src/components/ButtonTour.vue');
  assert.match(tour, /skipped\.value \+= 1/, '飛ばした数を数えていない');
  assert.match(tour, /completed\.value && skipped\.value === 0/, '飛ばしても済みになる');
});
