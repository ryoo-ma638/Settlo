import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// テスト用の固定UID（Prisma Studioの firebaseUid 欄と一致させる必要があります）
const TEST_USER_UID = "test-user-123";

// イベント作成API
router.post('/events', async (req, res) => {
  const { name, amount } = req.body;

  try {
    const event = await prisma.event.create({
      data: {
        name: name,
        totalAmount: amount,
        // creatorIdに、Userテーブルの firebaseUid 欄に実在する値を入れます
        creatorId: TEST_USER_UID, 
      },
    });

    console.log("✅ DBに保存成功:", event);
    res.json(event);
  } catch (error) {
    console.error("❌ 保存エラー詳細:", error);
    res.status(500).json({ error: "イベントの作成に失敗しました。Userテーブルに指定のfirebaseUidがあるか確認してください。" });
  }
});

export default router;