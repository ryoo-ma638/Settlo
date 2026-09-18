import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';

// localStorage と window を用意してから読み込む
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};
const fired = [];
globalThis.window = { dispatchEvent: (e) => fired.push(e.detail && e.detail.id) };
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };

const { markTrailDone } = await import('../src/lib/trailProgressSignal.js');
const { TRAIL_KEY } = await import('../src/lib/guestGuide.js');
const read = () => JSON.parse(localStorage.getItem(TRAIL_KEY) || '[]');

beforeEach(() => { store.clear(); fired.length = 0; });

test('やり終えた印を、端末に書いて残す', () => {
  // 合図を飛ばすだけだと、別の画面で操作しているあいだは誰も聞いていない
  markTrailDone('settle');
  assert.deepEqual(read(), ['settle'], '書かれていない');
});

test('同じ画面に案内があるときは、その場でも知らせる', () => {
  markTrailDone('chat');
  assert.deepEqual(fired, ['chat']);
});

test('二度呼んでも増えない', () => {
  markTrailDone('split');
  markTrailDone('split');
  assert.deepEqual(read(), ['split']);
  assert.deepEqual(fired, ['split'], '2回目も合図を出している');
});

test('前に済んだ分は消さない', () => {
  markTrailDone('offset');
  markTrailDone('settle');
  assert.deepEqual(read(), ['offset', 'settle']);
});

test('知らない名前は書かない', () => {
  markTrailDone('しらない手順');
  assert.deepEqual(read(), []);
});

test('空や保存できない端末でも落ちない', () => {
  markTrailDone('');
  markTrailDone(null);
  assert.deepEqual(read(), []);
  const ok = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('使えません'); };
  markTrailDone('chat');  // 例外が外へ出ないこと
  globalThis.localStorage.setItem = ok;
});
