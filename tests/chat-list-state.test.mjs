import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import { createRenderer, h, reactive } from 'vue';

const mockUrl = 'data:text/javascript;base64,' + Buffer.from(`
import {reactive} from ${JSON.stringify(import.meta.resolve('vue'))};
export const route=reactive({params:{uid:'a'}});
export const io={subscriptions:[],pushes:[],writes:[],writePlan:[],writeResolvers:[]};
export const auth={currentUser:{uid:'me'}},db={};
export const useRoute=()=>route,useRouter=()=>({push:r=>io.pushes.push(r)});
export const collection=(_,...p)=>p,doc=collection,where=(...a)=>a,query=(ref,...filters)=>({ref,filters});
export const onSnapshot=(q,success,error)=>{const s={q,success,error,closed:false};io.subscriptions.push(s);return ()=>s.closed=true;};
export const updateDoc=(...a)=>{io.writes.push(a);const p=io.writePlan.shift();if(p==='reject')return Promise.reject(Error('offline'));if(p==='hold')return new Promise(r=>io.writeResolvers.push(r));return Promise.resolve();};
export const arrayUnion=(...a)=>a;
export const formatDate=()=>'',avatarColor=()=>'',avatarInitial=()=>'';
export default {};
`).toString('base64');

const { io, route } = await import(mockUrl);
async function component(path) {
  const { descriptor } = parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const source = compileScript(descriptor, { id: path }).content
    .replace(/from ['"]([^'"]+)['"]/g, (_all, name) => `from ${JSON.stringify(name === 'vue' ? import.meta.resolve('vue') : mockUrl)}`);
  const result = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
  result.render = () => null;
  return result;
}

const Chats = await component('../src/views/ChatListView.vue');
const Person = await component('../src/views/PersonChatsView.vue');
const renderer = createRenderer({ createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {} });
let app;
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function mount(target) {
  app = renderer.createApp({ render: () => h(target) });
  app.mount({});
  await tick();
  return app._instance.subTree.component.setupState;
}
const snap = (rows) => ({ docs: rows.map((row) => ({ id: row.id, data: () => row })) });
const thread = (id, other = 'a') => ({
  id, participants: ['me', other], participantNames: { [other]: `相手${other}` },
  updatedAt: { seconds: 1 }, subjectLabel: `${id}の支払い`, lastMessage: '相談内容',
});

beforeEach(() => {
  io.subscriptions = []; io.pushes = []; io.writes = []; io.writePlan = []; io.writeResolvers = [];
  route.params.uid = 'a';
});
afterEach(() => { app?.unmount(); app = null; });

test('一覧は取得失敗を空状態と分け、再読込で古い購読を捨てる', async () => {
  const state = await mount(Chats);
  io.subscriptions[0].success(snap([thread('one')]));
  assert.equal(state.matters.length, 1);
  io.subscriptions[0].error(Error('offline'));
  assert.match(state.loadError, /読み込めません/);
  assert.deepEqual(state.matters, []);
  state.subscribe();
  assert.equal(io.subscriptions[0].closed, true);
  io.subscriptions[0].success(snap([thread('stale')]));
  assert.deepEqual(state.matters, []);
  io.subscriptions[1].success(snap([]));
  assert.equal(state.loadError, '');
});

test('相談は重複分類せず、イベント名・参加者・同じ会話IDを保つ', async () => {
  const state = await mount(Chats);
  io.subscriptions[0].success(snap([{
    ...thread('group'), participants: ['me', 'a', 'b'],
    participantNames: { a: '相手A', b: '相手B' }, eventId: 'event-1', eventName: '架空イベント',
  }]));
  assert.equal(state.matters[0].participantCount, 3);
  assert.equal(state.visibleMatters.length, 1);
  assert.equal(state.visibleMatters[0].title, '架空イベント');
  assert.equal(state.visibleMatters[0].threadId, 'group');
});

test('最初は30件だけ描画し、以前の相談を30件ずつ追加する', async () => {
  const state = await mount(Chats);
  const rows = Array.from({ length: 65 }, (_, index) => ({
    ...thread(`thread-${index}`), updatedAt: { seconds: 65 - index },
  }));
  io.subscriptions[0].success(snap(rows));
  assert.equal(state.visibleMatters.length, 30);
  assert.equal(state.hasMore, true);
  state.showMore();
  assert.equal(state.visibleMatters.length, 60);
  state.showMore();
  assert.equal(state.visibleMatters.length, 65);
  assert.equal(state.hasMore, false);
});

test('相手切替で前の会話を残さず、非表示失敗を表示する', async () => {
  const state = await mount(Person);
  io.subscriptions[0].success(snap([thread('one')]));
  route.params.uid = 'b';
  assert.deepEqual(state.threads, []);
  assert.equal(io.subscriptions[0].closed, true);
  io.subscriptions[1].success(snap([thread('two', 'b')]));
  assert.deepEqual(state.threads.map((item) => item.id), ['two']);
  io.writePlan = ['reject'];
  const original = console.error; console.error = () => {};
  try { await state.deleteThread(state.threads[0]); } finally { console.error = original; }
  assert.match(state.actionError, /非表示にできません/);
});
