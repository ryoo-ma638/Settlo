// イベント一覧（ホーム／進行中イベント）の並び替え・振り分けだけを行う純粋な計算。
// ここは Firestore に触れない（どの画面でも同じ結果になるようにするため）。
//
// ■ 並び順の基準
// イベントを作った日時ではなく「最後にお支払い（立て替え履歴）が追加・編集された日時」
// の新しい順にする。まだ支払いが無いイベントは作成日時をその代わりに使う。
//
// ■ 終了済みの扱い
// event.ended を立てたイベントは「進行中」から外す（見られなくなっては困るので、
// 呼び出し側で別のタブ・別の場所に出す）。

import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

// FirestoreのTimestamp／Dateオブジェクト／数値のどれで来てもミリ秒に揃える
export function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// そのイベントの「最後の動き」の時刻（ミリ秒）。
// lastActivityAt（＝立て替え履歴の最新timestamp）が無ければ作成日時で代える。
export function eventActivityMillis(event) {
  const activity = toMillis(event?.lastActivityAt);
  if (activity > 0) return activity;
  return toMillis(event?.createdAt);
}

// 「最後に動きがあった順」＝新しい順に並べ替える（元の配列は変えない）
export function sortEventsByActivity(events = []) {
  return [...(events || [])].sort((a, b) => eventActivityMillis(b) - eventActivityMillis(a));
}

// 終了済み(ended)と進行中に分ける。終了済みも別枠で見られるように両方返す。
export function splitEventsByEnded(events = []) {
  const ongoing = [];
  const ended = [];
  for (const e of events || []) {
    if (e && e.ended) ended.push(e);
    else ongoing.push(e);
  }
  return { ongoing, ended };
}

// そのイベントで最後に支払い（立て替え履歴）が追加・編集された時刻を取ってくる。
// 複合インデックスが要らないよう、絞り込み無し・並び替え1項目だけのクエリにする。
export async function fetchLastActivityAt(db, eventId) {
  try {
    const q = query(
      collection(db, 'events', eventId, 'history'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data().timestamp || null;
  } catch (e) {
    console.error('最終活動時刻の取得に失敗:', e);
    return null;
  }
}
