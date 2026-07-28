// 🌟 ファイルの先頭はこれだけ！(チェックが爆速で終わるようになります)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// 🌟 新しく追加：Firestore（データベース）を操作するための準備
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// =================================================================
// 1. レシート解析AI機能 (今まで通り！)
// =================================================================
exports.analyzeReceipt = onCall(
  {
    region: "asia-northeast1",
    cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app', 'https://settlo-app.web.app', 'https://settlo-app.firebaseapp.com'],
    // 🔐 Gemini APIキーは Secret Manager から注入（コード/リポジトリには絶対に置かない）
    //   事前に: firebase functions:secrets:set GEMINI_API_KEY
    secrets: ["GEMINI_API_KEY"],
  },
  async (request) => {
    try {
      // 🌟 AIライブラリの読み込み自体を「関数の中」に移動！（タイムアウト対策の最終奥義）
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      console.log("初期化");
      if (!request.data || !request.data.image) {
        throw new HttpsError('invalid-argument', '画像データが送られてきませんでした。');
      }
      console.log("初期化2");
      const base64Image = request.data.image; 
      const mimeTypeMatch = base64Image.match(/data:(.*?);base64/);
      console.log("初期化3");
      if (!mimeTypeMatch) {
        throw new HttpsError('invalid-argument', '画像のデータ形式が正しくありません。');
      }
      console.log("初期化4");
      const mimeType = mimeTypeMatch[1];
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      console.log("初期化5");
      const prompt = `
        レシート画像から以下の情報を抽出し、必ず指定されたJSON形式のみで出力してください。
        同じ商品が複数ある場合や「×3」などの記載がある場合は、個数をカウントしてください。

        【最重要ルール】
        - "totalAmount" は「レシートに印字された、実際に支払った最終合計（税込）」。ここが最も正確な正データです。
        - 各商品の "price" は【換算せず、レシートに印字されている単価そのまま】を入れてください（税込表示なら税込のまま・税抜表示なら税抜のまま）。

        【税の判定】
        - "taxIncluded"：商品の価格欄が税込表示（合計＝商品の単純合算）なら true。
          税抜表示（小計の後に消費税額が加算されている）なら false。
          判定方法：レシートに「外税」「税抜」「消費税 ¥xxx」など小計への課税行があれば false。
          「内税」「税込」表記や、商品合算＝最終合計ならば true。
        - 各商品の "taxRate"：適用税率が判別できれば 8（軽減税率・食品/飲料のテイクアウト等）か 10（標準）を入れる。
          レシートの「※」「*」「軽」マークは軽減税率8%の印であることが多い。
          判別できない場合は、食品・飲料なら 8、それ以外は 10 と推定して入れる。

        "registrationNumber" は「事業者登録番号（インボイス登録番号）」です。
        レシート上の「登録番号」や「T」で始まる13桁の番号（例: T1234567890123）を探し、
        見つかれば "T" を含む形の文字列で入れてください。見つからなければ null にしてください。
        {
          "storeName": "店名",
          "date": "YYYY-MM-DD",
          "time": "HH:MM",
          "totalAmount": 実際に支払った最終合計(税込・数値),
          "taxIncluded": true または false,
          "registrationNumber": "事業者登録番号(例 T1234567890123 / 無ければ null)",
          "items": [
            { "name": "商品名", "price": 印字どおりの単価×数量の合計(数値・換算しない), "quantity": 個数(数値、不明な場合は1), "taxRate": 8または10 }
          ]
        }
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: mimeType } }
      ]);
      
      const responseText = result.response.text();
      const jsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      console.log("初期化6");
      return JSON.parse(jsonString);

    } catch (error) {
      console.error("AI解析エラー詳細:", error);
      throw new HttpsError('internal', 'AI解析エラー: ' + error.message);
    }
  }
);


// =================================================================
// 2. 精算アルゴリズム機能 (新しく追加！)
// =================================================================

// 純粋な計算ロジック（settle.cjsから移植）
function calculateMinimalTransfers(balances) {
  const creditors = [];
  const debtors = [];

  // プラス（もらいすぎ）とマイナス（払いすぎ）に分ける
  Object.keys(balances).forEach(user => {
    const amount = balances[user];
    if (amount > 0) creditors.push({ name: user, amount });
    else if (amount < 0) debtors.push({ name: user, amount: Math.abs(amount) });
  });

  // 金額が大きい順に並び替え
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers = [];
  let i = 0, j = 0;
  
  // Greedy Matching アルゴリズム実行
  while (i < creditors.length && j < debtors.length) {
    const credit = creditors[i];
    const debt = debtors[j];
    const settlementAmount = Math.min(credit.amount, debt.amount);

    transfers.push({
      from: debt.name,
      to: credit.name,
      amount: Math.round(settlementAmount)
    });

    credit.amount -= settlementAmount;
    debt.amount -= settlementAmount;
    
    if (credit.amount === 0) i++;
    if (debt.amount === 0) j++;
  }
  return transfers;
}

// フロントエンドから呼ばれる「精算実行API」
exports.calculateSettlement = onCall(
  { region: "asia-northeast1", cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app', 'https://settlo-app.web.app', 'https://settlo-app.firebaseapp.com'] }, 
  async (request) => {
    // ログインチェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }

    const { eventId } = request.data;
    if (!eventId) {
      throw new HttpsError("invalid-argument", "イベントIDが指定されていません。");
    }

    try {
      // イベント情報を取得
      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await eventRef.get();

      if (!eventSnap.exists) {
        throw new HttpsError("not-found", "イベントが見つかりません。");
      }

      const eventData = eventSnap.data();
      // 参加者のリスト（FirestoreにはUIDなどが配列で入っている想定）
      const participants = eventData.participants || [];
      const participantCount = participants.length;

      if (participantCount === 0) return { transfers: [] };

      /// ========================================================
      // 🌟 新しい計算ロジック（ハッカソン仕様：アイテムごとの均等割り）
      // ========================================================
      
      // イベントの立て替え履歴（history）をすべて取得
      const historySnap = await eventRef.collection("history").get();
      let totalAmount = 0;
      const balances = {};

      // 参加者全員の残高を0で初期化
      participants.forEach(pUid => balances[pUid] = 0);

      // 履歴を1件ずつ確認し、「立て替え（プラス）」と「負担（マイナス）」を計算
      historySnap.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        const payer = data.payerUid; // 立て替えた人

        totalAmount += amount;

        // 【ルール1】立て替えた人（Payer）は「プラス（受け取る側）」になる
        if (balances[payer] !== undefined) {
          balances[payer] += amount;
        } else {
          balances[payer] = amount;
        }

        // 🌟 ここが超重要：この支払いを「誰で割り勘するか」のリスト
        // （フロントエンドから 'assignees' という配列で保存されている想定）
        // もし指定がなければ、フォールバックとしてイベント参加者全員で割る
        const assignees = data.assignees && data.assignees.length > 0 ? data.assignees : participants;

        // 【ルール2】選択された人たち（Assignees）で均等割りして「マイナス（払う側）」にする
        const splitAmount = amount / assignees.length;
        
        assignees.forEach(assigneeUid => {
          if (balances[assigneeUid] !== undefined) {
            balances[assigneeUid] -= splitAmount;
          } else {
            balances[assigneeUid] = -splitAmount;
          }
        });
      });

      // ========================================================

      // アルゴリズム実行！
      const transfers = calculateMinimalTransfers(balances);

      // フロントエンドへ結果を返す
      return {
        success: true,
        totalAmount: totalAmount,
        transfers: transfers 
      };

    } catch (error) {
      console.error("精算エラー:", error);
      throw new HttpsError("internal", "精算計算中にエラーが発生しました。");
    }
});
// =================================================================
// 3. ゴミ箱の自動お掃除（毎日1回・7日超を本削除）
//    - users/{uid}/trash に入って7日たった項目を自動で消す。
//    - イベント: 復元権が消える（events.hiddenBy は残す＝本人には非表示のまま）。
//    - 決済: 完了で確定（transactions は completed のまま・履歴に残る）。
//    - 承認待ち(pending)で7日たったものも失効させて掃除する。
// =================================================================
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.purgeTrash = onSchedule(
  {
    schedule: "every day 04:00",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
  },
  async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // 全ユーザーのゴミ箱を横断（collectionGroup）
    const snap = await db.collectionGroup("trash").where("trashedAt", "<", cutoff).get();
    if (snap.empty) {
      console.log("ゴミ箱: 削除対象なし");
      return;
    }
    let count = 0;
    // 500件ごとにバッチコミット
    let batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    await batch.commit();
    console.log(`ゴミ箱: ${count}件を自動削除しました`);
  }
);

// =================================================================
// 4. プッシュ通知（お知らせ作成時にスマホへ実配信）
//    notifications / friendRequests にドキュメントが作られたら、
//    宛先ユーザーの登録トークン(users/{uid}.fcmTokens)へ送信する。
// =================================================================
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

// 通知タイプ → プッシュの本文
const PUSH_TEXT = {
  approval_request: "支払いの承認リクエストが届きました",
  approval_rejected: "承認リクエストが拒否されました",
  payment_reminder: "支払いの催促が届きました",
  payment_completed: "支払いが完了しました！",
  payment_edited: "支払いが編集されました",
  payment_deleted: "支払いが削除されました。確認してください",
  payment_delete_rejected: "削除に「正しくない」が選ばれました",
  event_edited: "イベントが編集されました",
  event_invite: "イベントに招待されています",
  invite_rejected: "招待が拒否されました",
  event_joined: "イベントに新しいメンバーが参加しました",
  event_restored: "イベントが復元されました。確認してください",
  event_restore_rejected: "復帰に「正しくない」が選ばれました",
  event_left_check: "メンバーがイベントから抜けました。確認してください",
  event_left_rejected: "退出に「正しくない」が選ばれました",
  restore_check: "取引が元に戻されました。確認してください",
  restore_reverted: "取引がゴミ箱に戻されました",
  friend_removed: "フレンドから削除されました",
  event_member_removed: "イベントから外されました",
  settlement_restore_request: "未精算に戻す依頼が届きました",
  settlement_restore_approved: "未精算に戻す依頼が承認されました",
  settlement_restore_rejected: "未精算に戻す依頼が拒否されました",
};

// 宛先ユーザーのトークンにプッシュを送り、無効なトークンは掃除する
async function sendPushTo(uid, title, body) {
  if (!uid) return;
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) return;
  const tokens = userSnap.data().fcmTokens || [];
  if (tokens.length === 0) return;

  const message = {
    tokens,
    notification: { title, body },
    webpush: {
      notification: { icon: "/favicon.ico", badge: "/favicon.ico" },
      fcmOptions: { link: "https://settlo-app.web.app/" },
    },
  };
  const res = await admin.messaging().sendEachForMulticast(message);

  // 期限切れ・削除済みのトークンを配列から除去
  const dead = [];
  res.responses.forEach((r, i) => {
    if (!r.success) {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-argument") {
        dead.push(tokens[i]);
      }
    }
  });
  if (dead.length > 0) {
    await db.collection("users").doc(uid).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead),
    });
  }
}

// お知らせ（notifications）が作られたらプッシュ
exports.pushOnNotification = onDocumentCreated(
  { document: "notifications/{id}", region: "asia-northeast1" },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data || !data.toUserId) return;
    const from = data.fromUserName || "メンバー";
    let body = `${from}さん: ${PUSH_TEXT[data.type] || data.message || "新しいお知らせがあります"}`;
    if (data.userMessage) body += `\n「${data.userMessage}」`; // 送信者が添えた自由メッセージ
    try { await sendPushTo(data.toUserId, "Settlo", body); }
    catch (e) { console.error("プッシュ送信エラー:", e); }
  }
);

// フレンド申請（friendRequests）が作られたらプッシュ
exports.pushOnFriendRequest = onDocumentCreated(
  { document: "friendRequests/{id}", region: "asia-northeast1" },
  async (event) => {
    const data = event.data && event.data.data();
    if (!data || !data.toId || data.status !== "pending") return;
    const from = data.formName || "メンバー";
    try { await sendPushTo(data.toId, "Settlo", `${from}さんからフレンド申請が届きました`); }
    catch (e) { console.error("プッシュ送信エラー:", e); }
  }
);

// =================================================================
// 5. ゲストユーザーのデモ環境セットアップ
//    「ゲストとして試す」（匿名ログイン）直後に呼ばれ、
//    体験用のイベント・立替・精算・通知・フレンド申請を一式つくる。
//    審査員・初見ユーザーがログインなしで全機能を触れるようにする。
// =================================================================
exports.setupGuestDemo = onCall(
  {
    region: "asia-northeast1",
    cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app', 'https://settlo-app.web.app', 'https://settlo-app.firebaseapp.com'],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }
    const uid = request.auth.uid;
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();

    // すでにセットアップ済みなら二重生成しない（冪等）
    if (userSnap.exists && userSnap.data().demoSetupDone) {
      return { ok: true, already: true };
    }

    const guestName = `ゲスト${Math.floor(100 + Math.random() * 900)}`;
    const now = admin.firestore.FieldValue.serverTimestamp();

    // 1) ゲスト本人のプロフィール
    await userRef.set({
      uid,
      name: guestName,
      email: "",
      photo: "",
      isGuest: true,
      demoSetupDone: true,
      lastLogin: now,
    }, { merge: true });

    // 2) デモメンバー（全ゲスト共通の相手役・無ければ作る）
    const TARO = "demo-user-taro";
    const HANAKO = "demo-user-hanako";
    await db.collection("users").doc(TARO).set({ uid: TARO, name: "デモ太郎", email: "", photo: "", isDemo: true }, { merge: true });
    await db.collection("users").doc(HANAKO).set({ uid: HANAKO, name: "デモ花子", email: "", photo: "", isDemo: true }, { merge: true });

    // 3) デモイベント（ゲストごとに独立）
    const code = "DEMO" + Math.floor(1000 + Math.random() * 9000);
    const eventRef = await db.collection("events").add({
      name: "札幌旅行（デモ）",
      tag: "旅行",
      participants: [uid, TARO, HANAKO],
      invitationCode: code,
      totalAmount: 15000,
      memo: "Settloのお試し用イベントです。自由に触ってみてください！",
      hiddenBy: [],
      createdAt: now,
    });
    const eventId = eventRef.id;
    const dateStr = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/-/g, "/");

    // 4) 立替1：ゲストが夕食6,000円を立て替え（太郎・花子が2,000円ずつ支払う）
    const tx1 = await db.collection("transactions").add({
      paidById: TARO, paidToId: uid, paidByName: "デモ太郎", amount: 2000,
      itemName: "ジンギスカン夕食", status: "unpaid", eventId, createdAt: now,
    });
    const tx2 = await db.collection("transactions").add({
      paidById: HANAKO, paidToId: uid, paidByName: "デモ花子", amount: 2000,
      itemName: "ジンギスカン夕食", status: "unpaid", eventId, createdAt: now,
    });
    await db.collection("events").doc(eventId).collection("history").add({
      payer: guestName, payerUid: uid, itemName: "ジンギスカン夕食", category: "食事",
      splitType: "all", amount: 6000, date: dateStr, time: "19:30", status: "unpaid",
      timestamp: now, taxMode: "included", registrationNumber: null, remainder: null,
      shares: [
        { uid, name: guestName, amount: 2000 },
        { uid: TARO, name: "デモ太郎", amount: 2000 },
        { uid: HANAKO, name: "デモ花子", amount: 2000 },
      ],
      items: [], transactionIds: [tx1.id, tx2.id],
    });

    // 5) 立替2：太郎がレンタカー9,000円を立て替え（ゲストは3,000円支払う側）
    const tx3 = await db.collection("transactions").add({
      paidById: uid, paidToId: TARO, paidByName: guestName, amount: 3000,
      itemName: "レンタカー", status: "unpaid", eventId, createdAt: now,
    });
    const tx4 = await db.collection("transactions").add({
      paidById: HANAKO, paidToId: TARO, paidByName: "デモ花子", amount: 3000,
      itemName: "レンタカー", status: "unpaid", eventId, createdAt: now,
    });
    await db.collection("events").doc(eventId).collection("history").add({
      payer: "デモ太郎", payerUid: TARO, itemName: "レンタカー", category: "交通",
      splitType: "all", amount: 9000, date: dateStr, time: "13:00", status: "unpaid",
      timestamp: now, taxMode: "included", registrationNumber: null, remainder: null,
      shares: [
        { uid, name: guestName, amount: 3000 },
        { uid: TARO, name: "デモ太郎", amount: 3000 },
        { uid: HANAKO, name: "デモ花子", amount: 3000 },
      ],
      items: [], transactionIds: [tx3.id, tx4.id],
    });

    // 6) お知らせ体験：太郎から支払いの催促＋花子からフレンド申請
    await db.collection("notifications").add({
      toUserId: uid, type: "payment_reminder",
      message: "レンタカー代（¥3,000）をお願いします！",
      transactionId: tx3.id,
      fromUserId: TARO, fromUserName: "デモ太郎",
      isRead: false, createdAt: now,
    });
    await db.collection("friendRequests").add({
      toId: uid, toName: guestName,
      formId: HANAKO, formName: "デモ花子", formPhoto: "",
      status: "pending", createdAt: now,
    });

    return { ok: true, eventId, guestName };
  }
);
