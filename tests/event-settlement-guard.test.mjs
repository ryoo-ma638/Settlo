import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertStandardPaymentAllowed,
  eventSettlementRouteOf,
  eventSettlementStatusLabel,
  isEventSettlementReserved,
} from '../src/lib/eventSettlementGuard.js';

test('予約済みの元取引は通常の支払い操作から除外する', () => {
  const transaction = {
    eventId: 'event 1', eventSettlementPlanId: 'plan-1', status: 'unpaid',
  };
  assert.equal(isEventSettlementReserved(transaction), true);
  assert.equal(eventSettlementStatusLabel(transaction), 'イベントでまとめて精算中');
  assert.deepEqual(eventSettlementRouteOf(transaction), {
    path: '/event/event%201', query: { settlement: 'plan-1' },
  });
  assert.throws(() => assertStandardPaymentAllowed(transaction), (error) => (
    error.code === 'event-settlement-reserved'
      && /まとめて精算中/.test(error.message)
      && error.route.path === '/event/event%201'
  ));
});

test('まとめて精算で完了した元取引は個別復元へ戻さない', () => {
  const transaction = {
    eventId: 'event-1', eventSettlementPlanId: 'plan-1', status: 'completed',
  };
  assert.equal(eventSettlementStatusLabel(transaction), 'まとめて精算で確定済み');
  assert.throws(() => assertStandardPaymentAllowed(transaction), /個別精算で確定済み|まとめて精算で確定済み/);
});

test('通常取引は従来の支払い操作を許可する', () => {
  const transaction = { eventId: 'event-1', status: 'unpaid' };
  assert.equal(isEventSettlementReserved(transaction), false);
  assert.equal(eventSettlementStatusLabel(transaction), '');
  assert.equal(assertStandardPaymentAllowed(transaction), transaction);
});
