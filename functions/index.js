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
  { region: "asia-northeast1", cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app'] }, 
  async (request) => {
    try {
      // 🌟 AIライブラリの読み込み自体を「関数の中」に移動！（タイムアウト対策の最終奥義）
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      
      const GEMINI_API_KEY = "AIzaSyC2OKKkQu51i-k4cLhaAJTHbNU7w3nFkbU"; 
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
        {
          "storeName": "店名",
          "date": "YYYY-MM-DD",
          "time": "HH:MM",
          "totalAmount": 合計金額(数値),
          "items": [
            { "name": "商品名", "price": その商品の合計金額(数値), "quantity": 個数(数値、不明な場合は1) }
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
  { region: "asia-northeast1", cors: ['http://localhost:5173', 'https://pairpay-4c17a.web.app'] }, 
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