import assert from 'node:assert/strict';
import { test } from 'node:test';
import { payerNameOf } from '../src/lib/payerName.js';

const hist = (o = {}) => ({ payerUid: 'u1', payer: 'ゲスト394', ...o });

test('参加者の名前が読めていれば、それを出す（改名に追従する）', () => {
  assert.equal(payerNameOf(hist(), [{ id: 'u1', name: '新しい名前' }]), '新しい名前');
});

test('読み込み中の仮の名前は使わず、記録に残っている名前を出す', () => {
  // ここで「メンバー」を返すと、精算を確定した直後に一瞬そう見えてしまう
  assert.equal(payerNameOf(hist(), [{ id: 'u1', name: 'メンバー' }]), 'ゲスト394');
});

test('参加者の一覧がまだ空でも、記録の名前を出す', () => {
  assert.equal(payerNameOf(hist(), []), 'ゲスト394');
  assert.equal(payerNameOf(hist(), undefined), 'ゲスト394');
});

test('参加者から抜けた人でも、記録の名前で出す', () => {
  assert.equal(payerNameOf(hist(), [{ id: 'u2', name: 'べつの人' }]), 'ゲスト394');
});

test('空白だけの名前は名前として扱わない', () => {
  assert.equal(payerNameOf(hist({ payer: '  ' }), [{ id: 'u1', name: '   ' }]), 'メンバー');
});

test('どちらも無いときだけ「メンバー」', () => {
  assert.equal(payerNameOf({}, []), 'メンバー');
  assert.equal(payerNameOf(null, []), 'メンバー');
});
