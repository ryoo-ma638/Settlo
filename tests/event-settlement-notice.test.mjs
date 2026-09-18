// まとめて精算を始めたら、参加者全員に知らせる。
// これが無いと、自分の未払い・受け取りが支払い画面から急に消えたように見える。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const fn = readFileSync(new URL('../functions/eventNetSettlement.js', import.meta.url), 'utf8');
const icon = readFileSync(new URL('../src/components/NotificationIcon.vue', import.meta.url), 'utf8');

test('開始したときに、始めた本人以外へお知らせを出す', () => {
  assert.match(fn, /type: "event_settlement_started"/);
  assert.match(fn, /if \(to === actorUid\) continue;/);
});

test('お知らせは、その人が払う・受け取る額を書く', () => {
  assert.ok(fn.includes('支払います'), '払う額を書く');
  assert.ok(fn.includes('受け取ります'), '受け取る額を書く');
  assert.match(fn, /t\.fromId === to/, '払う側の行を拾う');
  assert.match(fn, /t\.toId === to/, '受け取る側の行を拾う');
  // 送金が無い人にも、何も無いことを伝える
  assert.match(fn, /他の人の送金にまとめられました/);
});

test('お知らせはお金の確定の外で出す（失敗しても精算を止めない）', () => {
  assert.match(fn, /お金の確定（runTransaction）とは分け/);
  assert.match(fn, /console\.error\("まとめて精算の開始をお知らせできませんでした:"/);
  // 同じ精算・同じ相手なら1件だけ（二重に出さない）
  assert.match(fn, /event-net-started-\$\{stableId\(planId, to\)\}/);
});

test('アプリ側がその種類を出せる', () => {
  assert.match(icon, /req\.type === 'event_settlement_started'/);
  assert.match(icon, /'event_settlement_started',/);
});
