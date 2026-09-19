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
      assert.ok(g.title, `${step.id}: 何をするのか書かれていない`);
      // 展示では読ませない。画面が見えたまま触ってもらうため、文は短く保つ
      assert.ok(g.title.length <= 16, `${step.id}: 題が長い（${g.title}）`);
      assert.ok(typeof g.desc === 'string' && g.desc.length <= 20, `${step.id}: 説明が長い（${g.desc}）`);
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
    assert.match(last.title, /押|選/, `${step.id}: 最後に何をするのか題に無い`);
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

test('確認モーダルで止まる操作は、そこまで案内する', () => {
  // 「まとめて精算」は押したあとに確認が出る。そこで案内を終えると
  // 開始されないまま済みになってしまう（2026-09-19）。
  const settle = GUEST_TRAIL.find((s) => s.id === 'settle');
  const last = settle.guide[settle.guide.length - 1];
  assert.equal(last.sel, '[data-tour="confirm-ok"]', '確認まで案内していない');
  assert.ok(anchors.has('confirm-ok'), '共通の確認モーダルに目印が無い');
});

test('ふきだしは、光らせたボタンに重ねない', () => {
  // 重なると、押したい場所をふきだしが塞いで先へ進めなくなる
  const tour = strip('src/components/ButtonTour.vue');
  assert.ok(!/top = \(vh - ph\) \/ 2; \/\/ どちらにも入らない/.test(tour), '入らないとき真ん中に重ねている');
  assert.match(tour, /maxH = Math\.max\(MIN, below\)/, '入らないときに縮めていない');
});

test('画面を真っ暗にしない（どんなアプリか見えたまま触らせる）', () => {
  const tour = strip('src/components/ButtonTour.vue');
  const m = /\.tour__shield[\s\S]{0,240}?background: rgba\(15, 23, 42, ([\d.]+)\)/.exec(tour);
  assert.ok(m, '暗幕の濃さが読めない');
  assert.ok(Number(m[1]) <= 0.4, `暗幕が濃い（${m[1]}）。画面が見えなくなる`);
});

test('案内は、たずねてからスキップできる', () => {
  const card = strip('src/components/GuestTryCard.vue');
  assert.match(card, /案内をスキップ/, 'やめる道が無い');
  assert.match(card, /<BaseModal/, 'たずねずに消える');
  assert.match(card, /案内をスキップしますか？/, '確認の文が無い');
  assert.match(card, /TRAIL_HIDDEN_KEY/, 'やめたことを覚えていない');
});

test('アシスタントと案内は、行き来できる', () => {
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /panelTab/, '切り替えが無い');
  assert.match(header, /初めての方へ/, '案内側のタブが無い');
  assert.match(header, /assist-tab[\s\S]{0,400}アシスタント/, 'アシスタント側のタブが無い');
  assert.match(header, /min-height: 44px/, 'タブが指で押せる大きさでない');
  // 独自に作らず、アプリのタブ部品（.seg）を使う
  assert.match(header, /class="seg assist-tabs"/, '共通のタブ部品を使っていない');
  assert.match(header, /class="seg__item assist-tab"/, '共通のタブ部品を使っていない');
});

test('案内の見た目が、アプリの決まりから外れていない', () => {
  // ブランド緑は #059669。別の緑を混ぜると、案内だけ色が違って見える。
  const files = ['src/components/ButtonTour.vue', 'src/components/GuestTryCard.vue', 'src/components/AppHeader.vue'];
  for (const f of files) {
    const css = strip(f);
    const 生の色 = [...css.matchAll(/#(?:[0-9a-fA-F]{6})/g)].map((m) => m[0].toLowerCase());
    for (const c of 生の色) {
      assert.ok(['#059669', '#047857', '#065f46', '#ecfdf5', '#d1fae5', '#0f172a', '#475569', '#94a3b8', '#e2e8f0', '#f1f5f9', '#ffffff'].includes(c),
        `${f}: 決まりに無い色 ${c}`);
    }
  }
});

test('案内に絵文字を出さない（アプリは全部SVGにしてある）', () => {
  const 絵文字 = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u;
  for (const f of ['src/components/ButtonTour.vue', 'src/components/GuestTryCard.vue']) {
    const src = readFileSync(f, 'utf8');
    const tpl = src.slice(0, src.indexOf('<script setup>'));
    const 見つかった = tpl.split('\n').filter((l) => 絵文字.test(l) && !l.trim().startsWith('<!--'));
    assert.equal(見つかった.length, 0, `${f}: 画面に絵文字が出る → ${見つかった.join(' / ')}`);
  }
});

test('案内中は、ヘッダーの「初めての方はここから」を引っ込める', () => {
  // 出したままだと、光らせたボタンと重なる
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /初めての方はここから/, '入口の案内が無い');
  assert.match(header, /!tourActive\.value/, '案内中も出したままになる');
});

test('タブが、右上の「閉じる」と重ならない', () => {
  // 重なると、タブを押したつもりでパネルが閉じる
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /\.assist-tabs \{ margin: 0 36px 10px 0; \}/, '閉じるの分を空けていない');
});

test('案内のカードが、アシスタントのカードと同じ位置に並ぶ', () => {
  const header = strip('src/components/AppHeader.vue');
  assert.match(header, /\.assist-panel :deep\(\.try\) \{ margin: 0; \}/, 'カードの左右がずれる');
});
