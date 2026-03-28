import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// テスト用の固定UID（Prisma Studioで作成したユーザーのfirebaseUidと一致させてください）
const TEST_USER_UID = "test-user-123";

// --- [GET] イベント一覧取得API ---
router.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' }, // 新しい順に並べる
      include: { 
        creator: true,     // 作成者情報も一緒に持ってくる
        transactions: true // 紐づく支払い履歴も持ってくる（エントロピー計算に必要）
      }
    });
    
    console.log(`📂 データ取得成功: ${events.length}件のイベントが見つかりました`);
    res.json(events);
  } catch (error) {
    console.error("❌ 取得エラー:", error);
    res.status(500).json({ error: "イベントの取得に失敗しました" });
  }
});

// --- [POST] イベント作成API ---
router.post('/events', async (req, res) => {
  const { name, amount } = req.body;

  try {
    const event = await prisma.event.create({
      data: {
        name: name,
        totalAmount: amount,
        creatorId: TEST_USER_UID, 
      },
    });

    console.log("✅ DBに保存成功:", event);
    res.json(event);
  } catch (error) {
    console.error("❌ 保存エラー詳細:", error);
    res.status(500).json({ 
      error: "イベントの作成に失敗しました。Userテーブルに指定のfirebaseUidがあるか確認してください。" 
    });
  }
});

// --- [POST] 支払い（Transaction）の登録API ---
router.post('/transactions', async (req, res) => {
  const { amount, description, eventId, payerUid } = req.body;

  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount: Number(amount),
        description: description,
        eventId: Number(eventId),
        payerUid: payerUid || TEST_USER_UID, // 指定がなければテストユーザー
      },
    });

    // ★ ここで将来的に「エントロピー計算ロジック」を呼び出す
    console.log("💰 支払い記録成功:", transaction);
    res.json(transaction);
  } catch (error) {
    console.error("❌ 支払い登録エラー:", error);
    res.status(500).json({ error: "支払い記録に失敗しました" });
  }
});

export default router;