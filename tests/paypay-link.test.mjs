import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, beforeEach, afterEach } from 'node:test';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, h, reactive, nextTick } from 'vue';

// 実コンポーネントの処理を、通信だけ置き換えて検査する。Firebaseには接続しない。
const mockUrl = 'data:text/javascript;base64,' + Buffer.from(`
export const auth = { currentUser: { uid: 'me' } };
export const db = {};
export const reads = [], writes = [], listeners = new Set();
export const doc = (_db, collection, uid) => ({ collection, uid });
export const getDoc = ref => new Promise((resolve, reject) => reads.push({ ...ref, resolve, reject }));
export const updateDoc = (ref, data) => new Promise((resolve, reject) => writes.push({ ...ref, data, resolve, reject }));
export function onAuthStateChanged(_auth, callback) {
  listeners.add(callback); callback(auth.currentUser);
  return () => listeners.delete(callback);
}
export function signIn(uid) {
  auth.currentUser = uid ? { uid } : null;
  for (const callback of listeners) callback(auth.currentUser);
}
export default {};
`).toString('base64');
const io = await import(mockUrl);
const { descriptor } = parse(readFileSync(new URL('../src/components/PayPayAction.vue', import.meta.url), 'utf8'));
const source = compileScript(descriptor, { id: 'paypay-link-test' }).content
  .replace(/from ['"]vue['"]/g, `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  .replace(/from ['"](?:@\/firebase|firebase\/firestore|firebase\/auth|\.\/BaseModal\.vue)['"]/g, `from ${JSON.stringify(mockUrl)}`);
const Component = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
Component.render = () => null;
const renderer = createRenderer({
  createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {},
});
const LINK_A = 'https://qr.paypay.ne.jp/p/test-a';
const LINK_B = 'https://qr.paypay.ne.jp/p/test-b';
const settle = async () => { await Promise.resolve(); await nextTick(); };
const respond = (request, link) => request.resolve({ exists: () => link !== null, data: () => ({ paypayLink: link }) });
let app, props, state;
const mount = (mode = 'pay', opponentUid = 'a') => {
  props = reactive({ mode, opponentUid });
  app = renderer.createApp({ render: () => h(Component, props) });
  app.mount({});
  state = app._instance.subTree.component.setupState;
};
beforeEach(() => {
  io.reads.length = 0; io.writes.length = 0; io.listeners.clear();
  io.auth.currentUser = { uid: 'me' };
});
afterEach(() => { app?.unmount(); app = null; });

test('相手変更直後に以前のリンクを無効にし、未登録の相手へ持ち越さない', async () => {
  mount(); respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
  assert.equal(state.opponentPayPayLink, LINK_A);
  props.opponentUid = 'b'; await nextTick();
  assert.equal(state.opponentPayPayLink, '');
  respond(io.reads.find(r => r.uid === 'b'), ''); await settle();
  assert.equal(state.opponentPayPayLink, '');
});
test('遅れて届いた前の相手の応答で、新しい相手のリンクを上書きしない', async () => {
  mount(); const old = io.reads.find(r => r.uid === 'a');
  props.opponentUid = 'b'; await nextTick();
  respond(io.reads.find(r => r.uid === 'b'), LINK_B); await settle();
  respond(old, LINK_A); await settle();
  assert.equal(state.opponentPayPayLink, LINK_B);
});
test('相手UIDがなくなったらリンクを消す', async () => {
  mount(); respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
  props.opponentUid = ''; await nextTick();
  assert.equal(state.opponentPayPayLink, '');
});
test('リンク取得失敗を未登録と区別し、以前のリンクを開かせない', async () => {
  mount(); respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
  props.opponentUid = 'b'; await nextTick();
  io.reads.find(r => r.uid === 'b').reject(new Error('offline')); await settle();
  assert.equal(state.opponentPayPayLink, '');
  assert.equal(state.opponentLinkState, 'error');
});
test('請求モードでは支払先を取得せず、支払いモードへ戻ると取得する', async () => {
  mount('remind');
  assert.equal(io.reads.some(r => r.uid === 'a'), false);
  props.mode = 'pay'; await nextTick();
  respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
  assert.equal(state.opponentPayPayLink, LINK_A);
  props.mode = 'remind'; await nextTick();
  assert.equal(state.opponentPayPayLink, '');
});
test('ログアウト時にリンクと入力を消し、遅い自分の取得結果も捨てる', async () => {
  mount(); const own = io.reads.find(r => r.uid === 'me');
  respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
  io.signIn(null); await settle();
  respond(own, LINK_A); await settle();
  assert.equal(state.myPayPayLink, '');
  assert.equal(state.inputLink, '');
  assert.equal(state.opponentPayPayLink, '');
});
test('画面を閉じると認証の監視を解除する', () => {
  mount(); assert.equal(io.listeners.size, 1);
  app.unmount(); app = null;
  assert.equal(io.listeners.size, 0);
});
test('保存中に入力が変わっても、実際に保存した値を表示する', async () => {
  mount('remind'); respond(io.reads.find(r => r.uid === 'me'), ''); await settle();
  state.inputLink = LINK_A;
  const pending = state.saveMyLink();
  state.inputLink = LINK_B;
  io.writes[0].resolve(); await pending;
  assert.equal(io.writes[0].data.paypayLink, LINK_A);
  assert.equal(state.myPayPayLink, LINK_A);
});
test('保存ボタンを連打しても同時に二度保存しない', async () => {
  mount('remind'); state.inputLink = LINK_A;
  const first = state.saveMyLink(); const second = state.saveMyLink();
  assert.equal(io.writes.length, 1);
  io.writes[0].resolve(); await Promise.all([first, second]);
});
test('自分の古い取得結果が新しく保存したリンクを上書きしない', async () => {
  mount('remind'); const old = io.reads.find(r => r.uid === 'me');
  state.inputLink = LINK_B; const pending = state.saveMyLink();
  io.writes[0].resolve(); await pending;
  respond(old, LINK_A); await settle();
  assert.equal(state.myPayPayLink, LINK_B);
});
test('保存中のアカウント変更後に前のアカウントのリンクを表示しない', async () => {
  mount('remind'); state.inputLink = LINK_A; const pending = state.saveMyLink();
  io.signIn('next'); await settle();
  io.writes[0].resolve(); await pending;
  assert.equal(io.writes[0].uid, 'me');
  assert.equal(state.myPayPayLink, '');
  assert.equal(state.alertState.show, false);
});
test('取得失敗後の再取得で、現在の相手のリンクを使える', async () => {
  mount(); io.reads.find(r => r.uid === 'a').reject(new Error('offline')); await settle();
  const pending = state.fetchOpponentLink();
  respond(io.reads.at(-1), LINK_A); await pending;
  assert.equal(state.opponentLinkState, 'ready');
  assert.equal(state.opponentPayPayLink, LINK_A);
});
test('保存失敗後は入力を残し、保存済みの表示を変えず再操作できる', async () => {
  mount('remind'); respond(io.reads.find(r => r.uid === 'me'), LINK_A); await settle();
  state.startEdit(); state.inputLink = LINK_B;
  const pending = state.saveMyLink(); io.writes[0].reject(new Error('offline')); await pending;
  assert.equal(state.myPayPayLink, LINK_A);
  assert.equal(state.inputLink, LINK_B);
  assert.equal(state.isEditingLink, true);
  assert.equal(state.saving, false);
  assert.equal(state.alertState.title, '保存失敗');
});
test('画面を閉じた後の遅い応答を反映しない', async () => {
  mount(); const old = io.reads.find(r => r.uid === 'a');
  app.unmount(); app = null;
  respond(old, LINK_A); await settle();
  assert.equal(state.opponentPayPayLink, '');
});
test('支払先を開く操作は、取得済みの現在の相手だけを対象にする', async () => {
  const previous = globalThis.window;
  const opened = [];
  globalThis.window = { open: (...args) => opened.push(args) };
  try {
    mount(); respond(io.reads.find(r => r.uid === 'a'), LINK_A); await settle();
    state.payToOpponent();
    assert.equal(opened[0][0], LINK_A);
    props.opponentUid = 'b'; await nextTick();
    state.payToOpponent();
    assert.equal(opened.length, 1);
    respond(io.reads.find(r => r.uid === 'b'), LINK_B); await settle();
    state.payToOpponent();
    assert.equal(opened[1][0], LINK_B);
  } finally { globalThis.window = previous; }
});

// レシート履歴の実テンプレートが、立替者UIDと閲覧者の役割を渡すことを確認する。
const { renderToString } = await import('@vue/server-renderer');
const childUrl = 'data:text/javascript;base64,' + Buffer.from(`
import { h } from ${JSON.stringify(import.meta.resolve('vue'))};
export default { props: ['mode', 'opponentUid'], render() {
  return h('span', { 'data-paypay-mode': this.mode, 'data-paypay-uid': this.opponentUid });
}};
`).toString('base64');
const receipt = parse(readFileSync(new URL('../src/components/ReceiptPaymentModal.vue', import.meta.url), 'utf8'));
const receiptSource = compileScript(receipt.descriptor, { id: 'receipt-link-test', inlineTemplate: true }).content
  .replace(/from ['"]vue['"]/g, `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  .replace(/from ['"]\.\.\/components\/(?:PayPayAction|GenreIcon)\.vue['"]/g, `from ${JSON.stringify(childUrl)}`);
const Receipt = (await import('data:text/javascript;base64,' + Buffer.from(receiptSource).toString('base64'))).default;
for (const [role, mode] of [['payer', 'remind'], ['debtor', 'pay'], ['none', null]]) {
  test(`レシート詳細：${role}のリンクの用途と相手`, async () => {
    const context = {};
    await renderToString(h(Receipt, {
      isOpen: true, myRole: role,
      history: { id: 'h', status: 'unpaid', amount: 3000, payerUid: 'creditor', paidById: 'wrong-debtor' },
    }), context);
    const html = context.teleports.body;
    if (mode) {
      assert.ok(html.includes(`data-paypay-mode="${mode}"`));
      assert.ok(html.includes('data-paypay-uid="creditor"'));
    } else assert.equal(html.includes('data-paypay-mode='), false);
  });
}
