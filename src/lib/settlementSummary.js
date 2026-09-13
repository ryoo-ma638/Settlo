// 精算サマリー（誰から誰へ、いくら）の計算。
// ここは純粋な計算だけを置く（Firestore・Vue に触れない＝単体で検証できる）。
//
// 🌟 集計は「名前」ではなく「UID」で行う（同名の参加者や改名でも壊れないため）。
//    債権者＝history.payerUid、債務者＝shares[].uid を正とし、
//    無い古いデータだけ名前→UIDの逆引き（uidByName）にフォールバックする。
//
// 🌟 状態は「人ごと」に見る（shares[].status）。
//    履歴単位の二値（全員が払い終わったか）を全員に当てると、
//    もう払い終わった人まで未払いで残り、その行から支払い画面へ進んでも
//    対象の取引が無く「見つかりません」になる。詳細は src/lib/eventStatus.js。

// 拡張子まで書くのは、ブラウザ用のビルドを通さずに node で単体検証するため
import { toBinary, normalizeStatus, PENDING } from './eventStatus.js';

export function buildSettlementSummary({ participants = [], history = [], myUid = null, myName = '' } = {}) {
  // 参加者UID → 表示名/写真（表示は常に「現在の参加者情報」を使う＝改名に追従）
  // 写真が無い人の見た目（頭文字と色）はアバター部品が名前から決めるので、ここでは扱わない。
  const partByUid = (uid) => participants.find((p) => p.id === uid);
  const uidByName = (nm) => participants.find((p) => p.name === nm)?.id || null;
  // 集計の識別子：UIDがあればUID、無ければ名前ベースの擬似ID（古いデータ救済）
  const idOf = (uid, name) => uid || (name ? `name:${name}` : null);
  const nameOf = (id) => {
    if (!id) return '?';
    if (String(id).startsWith('name:')) return String(id).slice(5);
    return partByUid(id)?.name || '?';
  };
  const photoOf = (id) => (String(id).startsWith('name:') ? '' : (partByUid(id)?.photo || ''));

  // 自分のUID（認証を正とし、取れなければ表示名から逆引き）
  const me = myUid || uidByName(myName);

  const rawDebts = [];

  // 1. まず全ての「誰から誰へ、いくら」の生の借金データを洗い出す（UIDで）
  history.forEach((hist) => {
    const creditorId = idOf(hist.payerUid, hist.payer);
    if (!creditorId) return; // 債権者不明はスキップ
    const histStatus = toBinary(hist.status);

    // 🌟 shares（各メンバーの負担額・uid付き）があれば、それを正として債務を作る
    if (Array.isArray(hist.shares) && hist.shares.length > 0) {
      hist.shares.forEach((s) => {
        if (!s) return;
        const debtorId = idOf(s.uid, s.name);
        if (debtorId && debtorId !== creditorId && Number(s.amount) > 0) {
          // その人の取引の状態を使う（無ければ履歴の状態）
          const own = s.status ? normalizeStatus(s.status) : null;
          rawDebts.push({
            fromId: debtorId, toId: creditorId,
            from: nameOf(debtorId), to: nameOf(creditorId),
            amount: Number(s.amount), itemName: hist.itemName,
            status: own ? toBinary(own) : histStatus,
            pending: own === PENDING,
          });
        }
      });
      return; // この履歴は shares で処理済み
    }

    // 後方互換：shares が無い古い履歴は従来ロジック（名前→UID逆引き）
    if (hist.splitType === 'all' || hist.splitType === '全員で割勘') {
      const amountPerPerson = Math.floor(hist.amount / participants.length);
      participants.forEach((p) => {
        if (p.id !== creditorId) {
          rawDebts.push({
            fromId: p.id, toId: creditorId,
            from: p.name, to: nameOf(creditorId),
            amount: amountPerPerson, itemName: hist.itemName,
            status: histStatus, pending: !!hist.pending,
          });
        }
      });
    } else if (hist.splitType === 'item' && hist.items) {
      hist.items.forEach((item) => {
        if (item.assignees && item.assignees.length > 0) {
          const itemAmount = Math.floor(item.price / item.assignees.length);
          item.assignees.forEach((assigneeName) => {
            const debtorId = idOf(uidByName(assigneeName), assigneeName);
            if (debtorId && debtorId !== creditorId) {
              rawDebts.push({
                fromId: debtorId, toId: creditorId,
                from: nameOf(debtorId), to: nameOf(creditorId),
                amount: itemAmount, itemName: item.name,
                status: histStatus, pending: !!hist.pending,
              });
            }
          });
        }
      });
    }
  });

  // 2. 洗い出した借金データを「ステータス」と「2人のペア（UID）」ごとに相殺（ネット）する
  const aggregated = [];
  const statuses = ['unpaid', 'completed'];

  statuses.forEach((status) => {
    const debtsForStatus = rawDebts.filter((d) => d.status === status);
    const pairs = {};

    debtsForStatus.forEach((debt) => {
      const idA = debt.fromId < debt.toId ? debt.fromId : debt.toId;
      const idB = debt.fromId < debt.toId ? debt.toId : debt.fromId;
      const key = `${idA}|${idB}`;

      if (!pairs[key]) pairs[key] = { netA: 0, details: [] };

      if (debt.fromId === idA) {
        pairs[key].netA -= debt.amount;
      } else {
        pairs[key].netA += debt.amount;
      }
      pairs[key].details.push(debt);
    });

    // 3. 相殺された結果から、最終的な「サマリーカード」を生成
    Object.keys(pairs).forEach((key) => {
      const [idA, idB] = key.split('|');
      const netA = pairs[key].netA;
      const details = pairs[key].details;

      if (netA === 0) return;

      let fromId, toId, finalAmount;
      if (netA < 0) {
        fromId = idA; toId = idB; finalAmount = Math.abs(netA);
      } else {
        fromId = idB; toId = idA; finalAmount = netA;
      }

      // fromId＝債務者（払う側）/ toId＝債権者（受け取る側）。自分が fromId なら「自分が払う側」。
      const iAmPayer = (fromId === me);
      const involvesMe = (fromId === me || toId === me);
      const opponentId = iAmPayer ? toId : fromId;
      aggregated.push({
        id: `${status}-${key}`,
        from: nameOf(fromId), fromPhoto: photoOf(fromId),
        to: nameOf(toId), toPhoto: photoOf(toId),
        amount: finalAmount,
        status: status,
        isMePayer: iAmPayer,
        involvesMe,
        // 🌟 自分が当事者でない（他人同士の）貸し借りか。金額の色分けと、
        //    自分では操作できない行にボタンを出さないために使う。
        isOthers: !involvesMe,
        // 申請済み（相手の承認待ち）の分が含まれるか
        pending: details.some((d) => d.pending),
        opponentName: nameOf(opponentId),
        opponentUid: String(opponentId).startsWith('name:') ? null : opponentId,
        details: details,
      });
    });
  });

  return aggregated;
}
