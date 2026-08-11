// 🌟 ファイルの先頭はこれだけ！(チェックが爆速で終わるようになります)
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// 🌟 新しく追加：Firestore（データベース）を操作するための準備
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// =================================================================
// 1. レシート解析AI機能（レシート画像 → 会計データ）
// =================================================================
// 返してほしいJSONの形をモデルに強制する（構造化出力）。
// これを付けると型が保証され、素のテキストを JSON.parse する不安定さが無くなる。
const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    storeName: { type: "string", nullable: true, description: "店名（支店名は含めない）。読めなければ null" },
    date: { type: "string", nullable: true, description: "YYYY-MM-DD。印字が無ければ null" },
    time: { type: "string", nullable: true, description: "HH:MM（24時間）。印字が無ければ null" },
    currency: { type: "string", nullable: true, description: "通貨コード。日本円なら JPY、$なら USD。判断できなければ null" },
    totalAmount: { type: "number", nullable: true, description: "税込の最終請求額（ポイント充当前）。読めなければ null" },
    pointsUsed: { type: "number", nullable: true, description: "ポイント・商品券で充当された金額（正の数）。無ければ null" },
    taxIncluded: { type: "boolean", nullable: true, description: "品目の金額が税込表示なら true、税抜表示なら false" },
    registrationNumber: { type: "string", nullable: true, description: "インボイス登録番号 T+13桁。無ければ null" },
    items: {
      type: "array",
      description: "レシートの明細行",
      items: {
        type: "object",
        properties: {
          name: { type: "string", nullable: true, description: "品目名" },
          lineTotal: { type: "number", nullable: true, description: "その行に印字されている金額（行の合計。単価ではない）。値引・返品はマイナス" },
          quantity: { type: "integer", nullable: true, description: "明示された数量。表記が無ければ 1" },
          taxRate: { type: "number", nullable: true, description: "その行に適用される税率の数値（8 / 10 など）" },
        },
        required: ["name", "lineTotal", "quantity", "taxRate"],
      },
    },
  },
  required: [
    "storeName", "date", "time", "currency",
    "totalAmount", "pointsUsed", "taxIncluded", "registrationNumber", "items",
  ],
};

const RECEIPT_PROMPT = `
あなたはレシート画像から会計データを読み取る担当です。指定されたJSONだけを出力してください。

【最重要ルール：推測しない】
- 画像から読み取れない項目は、絶対に推測・創作せず null を入れてください。
  例）時刻の印字が無ければ "time" は null（00:00 のような値を作らない）。登録番号が無ければ null。
- 数値はレシートに印字されている数字をそのまま使います（通貨換算・単位変換・四捨五入をしない）。

【金額の定義】
- "currency"：レシートの通貨コード。日本円なら "JPY"、$表記なら "USD"。判断できなければ null。
- "totalAmount"：値引・クーポン適用後の【税込の最終請求額】。
  ポイント・商品券・金券で支払いを充当する【前】の金額です。
  「合計」と「お支払金額」が違う場合は、必ず充当前（大きい方）を "totalAmount" にします。
- "pointsUsed"：ポイントや商品券で充当された金額（正の数）。無ければ null。
  例）合計 ¥3,300 ／ ポイント利用 -500 ／ お支払金額 ¥2,800
      → "totalAmount": 3300, "pointsUsed": 500

【品目 items】
- レシートの明細1行 = items の1要素です。
- "lineTotal"：その行に印字されている金額（＝その行の合計）。単価ではありません。
  例）「日替りランチ ×2  1,760」→ "lineTotal": 1760（880 ではない）
  税抜表示のレシートなら税抜のまま、税込表示なら税込のまま。換算しないでください。
- "quantity"：「×2」「2点」「2コ」のように【数量として明示された表記】だけを数量にします。
  商品名の一部である内容量は数量ではありません。
  例）「たまご 10個」「米 5kg」「スポンジ 3個」「養生テープ 3個入」→ すべて "quantity": 1
  数量の表記が無い行は 1 です。
- 値引・クーポン・返品など、商品計から差し引かれる行も【マイナスの lineTotal を持つ品目】として必ず items に含めます。
  例）「店内クーポン値引 -300」→ { "name": "店内クーポン値引", "lineTotal": -300, "quantity": 1 }
- ただし「ポイント利用」「商品券」など支払いを充当する行は items に入れず "pointsUsed" に入れてください（二重に引かれるため）。
- 小計・消費税・合計・お預り・お釣り・ポイント残高の行は items に入れません。

【税】
- "taxIncluded"：品目の金額欄が税込表示（品目の単純合算＝最終合計）なら true。
  税抜表示（小計のあとに消費税が加算されている）なら false。
  「外税」「税抜」「消費税 ¥xxx」の加算行があれば false、「内税」「税込」表記なら true。
- "taxRate"（品目ごと）：その行に実際に適用されている税率の数値。
  日本のレシートでは「※」「*」「軽」が付く行が 8、それ以外が 10 です。
  日本のレシートで判別できない場合のみ、食品・飲料は 8、それ以外は 10 と推定して構いません。
  日本以外（外貨）のレシートは、印字されている実際の税率（例 7.5）をそのまま入れてください。

【その他】
- "storeName"：店名。支店名（○○店）は含めません。
- "date"："YYYY-MM-DD"。年の印字が無ければ推測せず null。
- "time"："HH:MM"（24時間表記）。印字が無ければ null。
- "registrationNumber"：インボイス登録番号。「T」＋13桁（例 T1234567890123）。無ければ null。
`;

// --- 返ってきた値をアプリが扱える形にそろえる（型の揺れを吸収する） ---
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toStr = (v) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s === '' ? null : s;
};

function normalizeReceipt(data) {
  const src = data && typeof data === 'object' ? data : {};

  const items = (Array.isArray(src.items) ? src.items : []).slice(0, 100).map((raw) => {
    const it = raw && typeof raw === 'object' ? raw : {};
    // lineTotal が無い＝旧仕様の出力。そのときは price を行合計として扱う（後方互換）
    const lineTotal = toNum(it.lineTotal !== undefined && it.lineTotal !== null ? it.lineTotal : it.price);
    const q = toNum(it.quantity);
    const quantity = q !== null && q >= 1 ? Math.round(q) : 1;
    return {
      name: toStr(it.name),
      lineTotal,
      // 旧フロント（ブラウザにキャッシュされた古いJS）は price × quantity で行の合計を出す。
      // そこで price には「単価」を入れておく＝掛け算しても行の合計に戻り、金額が膨らまない。
      price: lineTotal === null ? null : (quantity > 1 ? Math.round(lineTotal / quantity) : lineTotal),
      quantity,
      taxRate: toNum(it.taxRate),
    };
  });

  const currencyRaw = toStr(src.currency);
  const currency = currencyRaw && /^[A-Za-z]{3}$/.test(currencyRaw) ? currencyRaw.toUpperCase() : null;
  const points = toNum(src.pointsUsed);

  return {
    storeName: toStr(src.storeName),
    date: toStr(src.date),
    time: toStr(src.time),
    currency,
    totalAmount: toNum(src.totalAmount),
    pointsUsed: points !== null && points !== 0 ? Math.abs(points) : null,
    taxIncluded: typeof src.taxIncluded === 'boolean' ? src.taxIncluded : null,
    registrationNumber: toStr(src.registrationNumber),
    items,
  };
}

exports.analyzeReceipt = onCall(
  {
    region: "asia-northeast1",
    cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app', 'https://settlo-app.web.app', 'https://settlo-app.firebaseapp.com'],
    // 🔐 Gemini APIキーは Secret Manager から注入（コード/リポジトリには絶対に置かない）
    //   事前に: firebase functions:secrets:set GEMINI_API_KEY
    secrets: ["GEMINI_API_KEY"],
    // 品目20行のレシートは50秒以上かかることがあるため、既定の60秒では足りない
    timeoutSeconds: 120,
  },
  async (request) => {
    // ログインチェック（Gemini の課金に直結するので、未ログインは受け付けない）
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "ログインが必要です。");
    }
    if (!request.data || typeof request.data.image !== 'string') {
      throw new HttpsError('invalid-argument', '画像データが送られてきませんでした。');
    }

    const base64Image = request.data.image;
    const mimeTypeMatch = base64Image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    if (!mimeTypeMatch) {
      throw new HttpsError('invalid-argument', '画像のデータ形式が正しくありません。');
    }
    const mimeType = mimeTypeMatch[1];
    const base64Data = base64Image.slice(mimeTypeMatch[0].length);

    try {
      // 🌟 AIライブラリの読み込み自体を「関数の中」に移動（起動を軽くするため）
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const callModel = async (useSchema) => {
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          generationConfig: {
            // 同じ画像なら同じ答えを返させる（実行ごとの揺れを抑える）
            temperature: 0,
            responseMimeType: "application/json",
            ...(useSchema ? { responseSchema: RECEIPT_SCHEMA } : {}),
          },
        });
        const result = await model.generateContent([
          RECEIPT_PROMPT,
          { inlineData: { data: base64Data, mimeType: mimeType } }
        ]);
        return result.response.text();
      };

      let responseText;
      try {
        responseText = await callModel(true);
      } catch (schemaError) {
        // 構造化出力が受け付けられなかったときも読み取りは止めない（プロンプトだけで再試行）
        console.error("構造化出力に失敗したのでスキーマなしで再試行:", schemaError);
        responseText = await callModel(false);
      }
      // 構造化出力なので素のJSONで返るはずだが、念のためコードフェンスを剥がす
      const jsonString = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      return normalizeReceipt(JSON.parse(jsonString));

    } catch (error) {
      // 内部の事情（APIキー・スタック・モデル名）を利用者に見せない。詳細はログにだけ残す。
      console.error("レシート解析エラー詳細:", error);
      throw new HttpsError('internal', 'レシートの読み取りに失敗しました。時間をおいて、もう一度お試しください。');
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
  friend_removed: "フレンドから削除されました。確認してください",
  event_member_removed: "イベントから外されました。確認してください",
  event_rejoin_request: "イベントに参加したいとリクエストが届きました",
  event_rejoin_approved: "イベントへの参加が承認されました",
  event_rejoin_rejected: "イベントへの参加リクエストが拒否されました",
  event_join_request: "イベントへの参加リクエストが届きました",
  event_join_approved: "イベントへの参加が承認されました",
  event_join_rejected: "イベントへの参加リクエストが拒否されました",
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
