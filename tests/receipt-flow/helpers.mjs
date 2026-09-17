import { readFileSync } from 'node:fs';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as save from '../../src/lib/batchPaymentSave.js';
import * as states from '../../src/lib/batchStates.js';
import { evenShares } from '../../src/lib/evenShares.js';

export const people = [{ id: 'a', name: '参加者A' }, { id: 'b', name: '参加者B' }, { id: 'c', name: '参加者C' }];
export const clone = value => JSON.parse(JSON.stringify(value));
export const snapshot = data => ({ exists: () => data !== undefined, data: () => clone(data), metadata: { fromCache: false, hasPendingWrites: false } });
export function fakeStore() {
  const docs = new Map([['events/demo-event', { participants: people.map(p => p.id), ended: false, totalAmount: 0 }]]);
  let seq = 0;
  let tail = Promise.resolve();
  const calls = { commits: 0, reads: 0, threads: 0 };
  const bindings = {
    db: {},
    collection: (_, ...parts) => ({ path: parts.join('/') }),
    doc: (base, ...parts) => ({ path: parts.length ? parts.join('/') : `${base.path}/id${++seq}`, id: parts.length ? parts.at(-1) : `id${seq}` }),
    serverTimestamp: () => 'server-time',
    increment: n => ({ increment: n }),
    getDocFromServer: async ref => { calls.reads++; return snapshot(docs.get(ref.path)); },
    runTransaction: (_, work) => {
      const task = tail.then(async () => {
        calls.commits++;
        const pending = [];
        await work({
          get: async ref => { if (pending.length) throw new Error('read-after-write'); return snapshot(docs.get(ref.path)); },
          set: (ref, data) => pending.push([ref.path, data]),
          update: (ref, data) => pending.push([ref.path, { ...docs.get(ref.path), totalAmount: docs.get(ref.path).totalAmount + data.totalAmount.increment }]),
        });
        for (const [path, data] of pending) docs.set(path, clone(data));
      });
      tail = task.catch(() => {});
      return task;
    },
    ensurePaymentThread: async id => { calls.threads++; docs.set(`threads/pay-${id}`, {}); },
    paymentThreadId: id => `pay-${id}`,
  };
  return { bindings, docs, calls };
}
export async function plan(total = 1000) {
  const shares = evenShares(people, total, 'c');
  return { eventId: 'demo-event', eventName: '検証イベント', creditorUid: 'c', participantUids: people.map(p => p.id), participantNames: Object.fromEntries(people.map(p => [p.id, p.name])), shares,
    payment: { amount: total, date: '2026/09/17', payer: '参加者C', itemName: '検証店舗', splitType: 'all' },
    ids: await save.prepareSaveIds({ eventId: 'demo-event', creditorUid: 'c', shares }) };
}
export function memoryStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), entries };
}
export function loadModal({ storage = memoryStorage(), ocr = async () => ({ data: { storeName: '検証店舗', totalAmount: 1000, date: '2026-09-17', currency: 'JPY' } }), overrides = {}, props: extra = {} } = {}) {
  const source = readFileSync(new URL('../../src/components/AddPaymentModal.vue', import.meta.url), 'utf8');
  const content = compileScript(parse(source).descriptor, { id: 'receipt-test' }).content;
  const script = content.replace(/^import .*;?\s*$/gm, '').replace('export default', 'return');
  const bindings = { ref: Vue.ref, computed: Vue.computed, reactive: Vue.reactive, watch: Vue.watch, ...save, ...states, evenShares, publishPaymentAddedNotifications: async () => ({ createdCount: 0 }), BaseModal: {}, MessageField: {}, GenreIcon: {}, UserAvatar: {}, ReceiptResultCard: {}, app: {}, getFunctions: () => ({}), httpsCallable: () => ocr,
    sessionStorage: storage, FileReader: class { readAsDataURL(file) { this.result = file.name; queueMicrotask(() => this.onload()); } }, ...overrides };
  const component = new Function(...Object.keys(bindings), script)(...Object.values(bindings));
  const props = Vue.reactive({ isOpen: true, participants: clone(people), myName: '参加者C', myUid: 'c', editData: null, eventId: 'demo-event', eventName: '検証イベント', eventEnded: false, ...extra });
  const scope = Vue.effectScope();
  const events = [];
  const api = scope.run(() => component.setup(props, { expose: () => {}, emit: (...args) => events.push(args) }));
  return { api, props, events, storage, stop: () => scope.stop() };
}
export function imageEvent(count = 1) {
  return { target: { files: Array.from({ length: count }, (_, i) => ({ name: `image-${i}`, type: 'image/png', size: 100 })), value: 'images' } };
}
