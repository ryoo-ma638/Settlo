import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as eventStatus from '../src/lib/eventStatus.js';
import { buildEventNetSettlement } from '../src/lib/eventNetSettlement.js';

// 実際の画面の選択欄と computed を検証する。通信・保存・精算計算は対象外。
const { descriptor } = parse(readFileSync(new URL('../src/views/EventDetails.vue', import.meta.url), 'utf8'));
const models = Object.fromEntries([...descriptor.template.content.matchAll(/<select\s+v-model="([^"]+)"[^>]*aria-label="([^"]+)"/g)].map(match => [match[2], match[1]]));
const importNames = new Set();
const compiled = compileScript(descriptor, { id: 'event-filters-test' }).content
  .replace(/^import\s+(.+?)\s+from\s+['"][^'"]+['"];?.*$/gm, (_line, imports) => {
    for (const name of imports.replace(/[{}]/g, '').split(',').map(value => value.trim())) importNames.add(name);
    return '';
  }).replace('export default', 'return');
const externalCalls = [];
const apiHandlers = {};
const routeParams = {};
const routeQuery = Vue.reactive({});
const routeReplacements = [];
const bindings = Object.fromEntries([...importNames].map(name => [name, (...args) => {
  if (apiHandlers[name]) return apiHandlers[name](...args);
  externalCalls.push(name);
  throw Error(`Unexpected call: ${name}`);
}]));
Object.assign(bindings, eventStatus, Object.fromEntries([...importNames].filter(name => name in Vue).map(name => [name, Vue[name]])), {
  auth: { currentUser: null },
  useRoute: () => ({ params: routeParams, query: routeQuery }),
  useRouter: () => ({ replace: async target => {
    routeReplacements.push(target);
    for (const key of Object.keys(routeQuery)) delete routeQuery[key];
    Object.assign(routeQuery, target.query);
  } }),
  useEventActionContext: () => ({ setPaymentAvailability() {} }),
  buildEventNetSettlement,
});
const Component = new Function(...Object.keys(bindings), compiled)(...Object.values(bindings));
Component.render = () => null;
const renderer = Vue.createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} });
let app;
afterEach(() => {
  app?.unmount(); app = null;
  assert.deepEqual(externalCalls, [], '一覧・入口の操作でAPIや保存処理を呼ばない');
});
function mount() {
  externalCalls.length = 0;
  for (const name of Object.keys(apiHandlers)) delete apiHandlers[name];
  delete routeParams.id;
  for (const key of Object.keys(routeQuery)) delete routeQuery[key];
  routeReplacements.length = 0;
  bindings.auth.currentUser = null;
  app = renderer.createApp({ render: () => Vue.h(Component) });
  app.mount({});
  const state = app._instance.subTree.component.setupState;
  bindings.auth.currentUser = { uid: 'me' };
  state.myName = '確認用';
  state.eventData.ended = false;
  state.eventData.history = [
    { id: 'history-unpaid-me', status: 'unpaid', payerUid: 'other', shares: [{ uid: 'me', amount: 100, settled: false }], timestamp: 10 },
    { id: 'history-completed-me', status: 'completed', payerUid: 'other', shares: [{ uid: 'me', amount: 100, settled: true }], timestamp: 40 },
    { id: 'history-unpaid-other', status: 'unpaid', involvesMe: false, timestamp: 30 },
    { id: 'history-completed-other', status: 'completed', involvesMe: false, timestamp: 20 },
  ];
  return state;
}
const ids = rows => rows.map(row => row.id);

test('立て替え履歴は状態と並び順を独立して絞り込める', () => {
  const state = mount();
  const historyModel = models['立て替え履歴の表示状態'];
  assert.equal(state[historyModel], 'unpaid');
  for (const historyStatus of ['unpaid', 'all', 'completed']) {
    state[historyModel] = historyStatus;
    const expected = state.eventData.history
      .filter(row => historyStatus === 'all' || row.status === historyStatus)
      .sort((a, b) => b.timestamp - a.timestamp);
    assert.deepEqual(ids(state.filteredHistory), ids(expected));
  }
  state.histSort = 'old';
  assert.deepEqual(ids(state.filteredHistory), ['history-completed-other', 'history-completed-me']);
});

test('まとめて精算は独立した内訳フィルターを持たず、全員分をまとめた結果を表示する', async () => {
  const state = mount();
  state.eventData.participants = [
    { id: 'me', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' },
  ];
  state.txLoaded = true;
  state.txById = {
    ab: { id: 'ab', paidById: 'me', paidToId: 'B', amount: 1000, status: 'unpaid', itemName: '宿' },
    bc: { id: 'bc', paidById: 'B', paidToId: 'C', amount: 1000, status: 'unpaid', itemName: '食事' },
  };
  await Vue.nextTick();
  assert.equal(models['精算の内訳の表示状態'], undefined);
  assert.equal(state.netSettlementRows.length, 1);
  assert.equal(state.netSettlementRows[0].fromId, 'me');
  assert.equal(state.netSettlementRows[0].toId, 'C');
  assert.equal(state.netSettlementRows[0].amount, 1000);
  assert.equal(state.netSettlementRows[0].details.length, 2);
});

test('まとめて精算は未精算を既定表示にし、確定済みを切り替えて確認できる', async () => {
  const state = mount();
  state.eventData.participants = [
    { id: 'me', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' },
  ];
  state.eventData.activeEventSettlementPlanId = 'plan-1';
  state.settlementPlan = { id: 'plan-1', status: 'open', sourceTransactions: [
    { id: 'old-source', paidById: 'me', paidToId: 'C', amount: 200, itemName: '以前の立て替え' },
    { id: 'new-source', paidById: 'me', paidToId: 'B', amount: 500, itemName: '追加分' },
  ] };
  state.settlementLegs = [
    { id: 'open', fromId: 'me', toId: 'B', amount: 500, status: 'unpaid', sourceTransactionIds: ['old-source', 'new-source'] },
    { id: 'pending', fromId: 'B', toId: 'C', amount: 300, status: 'awaiting_approval' },
    { id: 'done', fromId: 'me', toId: 'C', amount: 200, status: 'completed', sourceTransactionIds: ['old-source'] },
  ];
  await Vue.nextTick();
  assert.equal(state.settlementFilter, 'unpaid');
  assert.deepEqual(ids(state.filteredNetSettlementRows), ['open', 'pending']);
  assert.equal(state.outstandingTotal, 800);
  assert.deepEqual(state.settlementProgress, { total: 3, done: 1, percent: 33 });
  state.settlementFilter = 'completed';
  assert.deepEqual(ids(state.filteredNetSettlementRows), ['done']);
  assert.deepEqual(state.filteredNetSettlementRows[0].details.map((row) => row.id), ['old-source']);
  state.settlementFilter = 'all';
  assert.deepEqual(ids(state.filteredNetSettlementRows), ['open', 'pending', 'done']);
});

test('進行中に追加された取引だけを反映する前に確認を求める', async () => {
  const state = mount();
  routeParams.id = 'event-test';
  state.eventData.participants = [
    { id: 'me', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' },
  ];
  state.eventData.activeEventSettlementPlanId = 'plan-1';
  state.settlementPlan = { id: 'plan-1', status: 'open', sourceTransactions: [] };
  state.settlementLegs = [{ id: 'open', fromId: 'me', toId: 'B', amount: 500, status: 'unpaid' }];
  state.txLoaded = true;
  state.txById = {
    reserved: { id: 'reserved', paidById: 'me', paidToId: 'B', amount: 500, status: 'unpaid', eventSettlementPlanId: 'plan-1' },
    added: { id: 'added', paidById: 'B', paidToId: 'C', amount: 300, status: 'unpaid' },
  };
  await Vue.nextTick();
  assert.equal(state.canRefreshNetSettlement, true);
  state.refreshNetSettlement();
  assert.equal(state.alertState.show, true);
  assert.equal(state.alertState.title, '追加分を反映しますか？');
  assert.match(state.alertState.message, /確定済みと受取確認待ちの支払いは変えず/);
  assert.equal(state.settlementBusy, false);
});

test('まとめて精算の詳細は計算元を閉じた状態で開く', () => {
  const state = mount();
  state.showSummarySources = true;
  const row = {
    from: 'A', to: 'C', amount: 1000, involvesMe: false, isPreview: true,
    details: [{ itemName: '食事', from: 'A', to: 'B', amount: 1000 }],
  };
  state.openSummaryDetail(row);
  assert.equal(state.modals.summaryDetail, true);
  assert.deepEqual(state.selectedSummary, row);
  assert.equal(state.showSummarySources, false);
  assert.equal(state.roleLabelOf(row), '精算前');
});

test('精算前の詳細からも、保存前の確認画面へ進める', async () => {
  const state = mount();
  routeParams.id = 'event-test';
  state.eventData.participants = [
    { id: 'me', name: 'A' }, { id: 'B', name: 'B' }, { id: 'C', name: 'C' },
  ];
  state.txLoaded = true;
  state.txById = {
    ab: { id: 'ab', paidById: 'me', paidToId: 'B', amount: 1000, status: 'unpaid', itemName: '宿' },
    bc: { id: 'bc', paidById: 'B', paidToId: 'C', amount: 1000, status: 'unpaid', itemName: '食事' },
  };
  await Vue.nextTick();
  state.openSummaryDetail(state.netSettlementRows[0]);
  assert.equal(state.modals.summaryDetail, true);
  state.startNetSettlementFromDetail();
  assert.equal(state.modals.summaryDetail, false);
  assert.equal(state.alertState.show, true);
  assert.equal(state.alertState.title, 'まとめて精算を始めますか？');
  assert.equal(state.alertState.confirmText, '開始する');
  assert.equal(state.settlementBusy, false);
});

test('申請中の自分・立替者・無関係な参加者の履歴を区別し、同名を混同しない', () => {
  const state = mount();
  state.eventData.history = [
    { id: 'pending', payerUid: 'other', status: 'unpaid', shares: [{ uid: 'me', amount: 250, status: eventStatus.PENDING, settled: false }], timestamp: 4 },
    { id: 'receive', payerUid: 'me', payer: '変更前の名前', status: 'unpaid', outstanding: 500, timestamp: 3 },
    { id: 'unrelated-same-name', payerUid: 'other', payer: '確認用', status: 'unpaid', shares: [{ uid: 'another', name: '確認用', amount: 100 }], timestamp: 2 },
    { id: 'zero-share', payerUid: 'other', status: 'unpaid', shares: [{ uid: 'me', amount: 0 }], timestamp: 1 },
  ];
  state.histFilterScope = 'me';
  assert.deepEqual(ids(state.filteredHistory), ['pending', 'receive']);
  assert.equal(state.mySharePending(state.filteredHistory[0]), true);
  assert.equal(state.myReceivableOf(state.filteredHistory[1]), 500);
  state.histFilterStatus = 'completed';
  assert.deepEqual(ids(state.filteredHistory), []);
});

test('UIDのない旧履歴は名前で照合し、受取・支払・他人同士の色と詳細への金額を維持する', () => {
  const state = mount();
  const history = { id: 'legacy', payer: '参加者', status: 'unpaid', amount: 400, shares: [{ name: '確認用', amount: 150, settled: false }] };
  state.eventData.history = [history];
  state.histFilterScope = 'me';
  assert.deepEqual(ids(state.filteredHistory), ['legacy']);
  state.openHistoryDetail(history);
  assert.equal(state.selectedMyRole, 'debtor');
  assert.equal(state.selectedMyAmount, 150);
  assert.equal(state.amountToneOf({ involvesMe: true, isMePayer: false }), 'blue-text');
  assert.equal(state.amountToneOf({ involvesMe: true, isMePayer: true }), 'orange-text');
  assert.equal(state.amountToneOf({ involvesMe: false, isMePayer: false }), 'muted-text');
});

test('終了済みは追加ハンドラーでも止め、保存時の拒否と記録の閲覧を維持する', async () => {
  const state = mount();
  state.eventData.ended = true;
  const before = JSON.stringify(state.eventData);
  state.openNewPayment();
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.alertState.title, '終了済みのイベントです');
  assert.equal(state.alertState.show, true);
  await state.addHistory({ amount: 100 });
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.moneyBusy, false);
  assert.equal(JSON.stringify(state.eventData), before);
  state.histFilterStatus = 'completed';
  assert.deepEqual(ids(state.filteredHistory), ['history-completed-me', 'history-completed-other']);
  state.openHistoryDetail(state.filteredHistory[0]);
  assert.equal(state.modals.historyDetail, true);
});

test('イベント読込中は支払い追加とイベント終了を始めない', () => {
  const state = mount();
  state.eventData.ended = null;
  state.openNewPayment();
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.toastMsg, 'イベントを読み込んでいます');
  state.handleEndEvent();
  assert.equal(state.alertState.show, false);
});

test('まとめて精算に予約した立て替えは個別の編集・削除・完了・差し戻しを重ねない', () => {
  const state = mount();
  const history = { ...state.eventData.history[0], transactionIds: ['locked'] };
  state.eventData.history = [history];
  state.txById = {
    locked: { id: 'locked', status: 'unpaid', eventSettlementPlanId: 'plan-1' },
  };
  state.openEditPayment(history);
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.alertState.title, 'まとめて精算に含まれています');
  state.deletePayment(history);
  assert.equal(state.alertState.title, 'まとめて精算に含まれています');
  state.markAsCompleted(history.id);
  assert.equal(state.alertState.title, 'まとめて精算に含まれています');
  state.revertSettlement(history);
  assert.equal(state.alertState.title, 'まとめて精算に含まれています');
});

test('未終了の支払い追加は編集対象を外して入力画面を開くが、まだ保存しない', () => {
  const state = mount();
  state.editingHistory = state.eventData.history[0];
  const before = JSON.stringify(state.eventData);
  state.openNewPayment();
  assert.equal(state.modals.addPayment, true);
  assert.equal(state.editingHistory, null);
  assert.equal(state.alertState.show, false);
  assert.equal(JSON.stringify(state.eventData), before);
});

test('終了警告からまとめて精算へ到達し、履歴フィルターや選択明細を変えない', async () => {
  const state = mount();
  const before = JSON.stringify(state.eventData);
  const scrolled = [];
  state.summaryHeading = {
    focus: options => scrolled.push(['focus', options]),
    closest: () => null,
    scrollIntoView: options => scrolled.push(['scroll', options]),
  };
  for (const previousSelection of [null, { id: 'previously-viewed' }]) {
    state.selectedSummary = previousSelection;
    const selected = state.selectedSummary;
    state.histFilterScope = 'me';
    state.histFilterStatus = 'completed';
    state.histSort = 'old';
    state.handleEndEvent();
    assert.equal(state.modals.unpaidWarning, true);
    assert.equal(state.alertState.show, false);
    await state.showUnpaidSummary();
    assert.equal(state.modals.unpaidWarning, false);
    assert.equal(state.modals.summaryDetail, false);
    assert.equal(state.selectedSummary, selected);
    assert.equal(state.histFilterScope, 'me');
    assert.equal(state.histFilterStatus, 'completed');
    assert.equal(state.histSort, 'old');
    assert.equal(state.eventData.ended, false);
    assert.equal(JSON.stringify(state.eventData), before);
  }
  assert.equal(scrolled.filter(([action]) => action === 'scroll').length, 2);
});

test('履歴表示が完了でも未払いtransactionがあればイベントを終了しない', () => {
  const state = mount();
  state.eventData.history = state.eventData.history.map(row => ({ ...row, status: 'completed' }));
  state.txLoaded = true;
  state.txById = {
    remaining: { id: 'remaining', paidById: 'me', paidToId: 'other', amount: 100, status: 'unpaid' },
  };
  state.handleEndEvent();
  assert.equal(state.modals.unpaidWarning, true);
  assert.equal(state.eventData.ended, false);
});


test('警告からの移動は内側のスクロール領域だけを動かし、ヘッダーの下へ合わせる', async () => {
  const state = mount();
  const moves = [];
  const scroller = {
    scrollTop: 1500,
    getBoundingClientRect: () => ({ top: 100 }),
    querySelector: selector => { assert.equal(selector, '.event-page-header'); return { getBoundingClientRect: () => ({ height: 80 }) }; },
    scrollTo: options => moves.push(options),
  };
  state.summaryHeading = {
    focus: () => {},
    closest: selector => { assert.equal(selector, '.app-main'); return scroller; },
    getBoundingClientRect: () => ({ top: -200 }),
    scrollIntoView: () => assert.fail('外側の比較画面までスクロールしない'),
  };
  await state.showUnpaidSummary();
  assert.deepEqual(moves, [{ top: 1108, behavior: 'smooth' }]);
});

test('再開は確認前に保存せず、確認後もイベントの終了状態だけを更新する', async () => {
  const state = mount();
  state.eventData.ended = true;
  routeParams.id = 'event-test';
  const history = JSON.stringify(state.eventData.history);
  const updates = [];
  let finish;
  apiHandlers.doc = (_db, collection, id) => { assert.equal(collection, 'events'); assert.equal(id, 'event-test'); return 'event-ref'; };
  apiHandlers.updateDoc = (ref, patch) => { updates.push({ ref, patch }); return new Promise(resolve => { finish = resolve; }); };
  state.handleReopenEvent();
  assert.equal(state.alertState.confirmText, '再開する');
  assert.deepEqual(updates, []);
  assert.equal(state.eventData.ended, true);
  // 閉じれば保存されず、開き直して確認した場合だけ更新する。
  state.alertState.show = false;
  assert.deepEqual(updates, []);
  state.handleReopenEvent();
  const confirm = state.alertState.onConfirm;
  const saving = confirm();
  assert.equal(state.reopening, true);
  assert.equal(state.eventData.ended, true, '保存前に再開済みと扱わない');
  await confirm();
  assert.deepEqual(updates, [{ ref: 'event-ref', patch: { ended: false, endedAt: null } }]);
  finish();
  await saving;
  assert.equal(state.eventData.ended, false);
  assert.equal(state.reopening, false);
  assert.equal(JSON.stringify(state.eventData.history), history);
  state.openNewPayment();
  assert.equal(state.modals.addPayment, true);
});

test('再開の保存が失敗したら終了済みを維持し、履歴・精算状態を変えない', async () => {
  const state = mount();
  state.eventData.ended = true;
  routeParams.id = 'event-test';
  const before = JSON.stringify(state.eventData);
  apiHandlers.doc = () => 'event-ref';
  apiHandlers.updateDoc = async () => { throw new Error('offline'); };
  state.handleReopenEvent();
  const originalError = console.error;
  console.error = () => {};
  try { await state.alertState.onConfirm(); } finally { console.error = originalError; }
  assert.equal(JSON.stringify(state.eventData), before);
  assert.equal(state.reopening, false);
  assert.equal(state.alertState.type, 'error');
  assert.equal(state.alertState.title, '再開できませんでした');
  state.openNewPayment();
  assert.equal(state.modals.addPayment, false);
});


test('同じ詳細の＋要求を検知し、他のqueryを保ったまま消費して何度でも開ける', async () => {
  const state = mount();
  state.eventData.participants = [{ id: 'me' }];
  routeQuery.keep = 'filter';
  for (let i = 0; i < 2; i++) {
    routeQuery.addPayment = '1';
    await Vue.nextTick(); await Vue.nextTick();
    assert.equal(state.modals.addPayment, true);
    assert.equal(routeQuery.addPayment, undefined);
    assert.equal(routeQuery.keep, 'filter');
    assert.equal(routeReplacements.length, i + 1);
    state.modals.addPayment = false;
    state.eventData.participants.push({id: 'other' + i});
    await Vue.nextTick();
    assert.equal(state.modals.addPayment, false, '参加者更新では再表示しない');
  }
});

test('参加者の読込前は要求を残し、読込後に一度だけ追加画面を開く', async () => {
  const state = mount();
  routeQuery.addPayment = '1';
  await Vue.nextTick();
  assert.equal(state.modals.addPayment, false);
  assert.equal(routeReplacements.length, 0);
  state.eventData.participants = [{id:'me'}];
  await Vue.nextTick(); await Vue.nextTick();
  assert.equal(state.modals.addPayment, true);
  assert.equal(routeReplacements.length, 1);
});

test('終了済みの追加要求は画面を開かずに消費し、後の再開でも自動で開かない', async () => {
  const state = mount();
  state.eventData.ended = true;
  state.eventData.participants = [{id:'me'}];
  routeQuery.addPayment = '1';
  await Vue.nextTick(); await Vue.nextTick();
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.alertState.show, true);
  assert.equal(state.alertState.title, '終了済みのイベントです');
  assert.match(state.alertState.message, /イベントを再開/);
  assert.equal(routeQuery.addPayment, undefined);
  state.alertState.show = false;
  state.eventData.ended = false;
  await Vue.nextTick();
  assert.equal(state.modals.addPayment, false);
  assert.equal(state.alertState.show, false);
});
