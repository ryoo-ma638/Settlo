// 🌟 ファイルの先頭はこれだけ！(チェックが爆速で終わるようになります)
const { onCall, HttpsError } = require("firebase-functions/v2/https");

exports.analyzeReceipt = onCall(
  { region: "asia-northeast1", cors: ['http://localhost:5173',
    'https://pairpay-4c17a.web.app'] }, 
  async (request) => {
    try {
      // 🌟 AIライブラリの読み込み自体を「関数の中」に移動！（タイムアウト対策の最終奥義）
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      
      const GEMINI_API_KEY = "AIzaSyBBd16XDBjbk0d4ZBhlZ9wkDABRDrYs82U"; 
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
        不明な項目は空文字 "" または 0 にしてください。
        {
          "storeName": "店名",
          "date": "YYYY-MM-DD",
          "time": "HH:MM",
          "totalAmount": 合計金額(数値),
          "items": [
            { "name": "商品名", "price": 金額(数値) }
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