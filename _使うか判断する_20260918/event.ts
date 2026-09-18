import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getOptimizedSettlements, calculateEntropy } from '../logic/settlement';
// 🌟 門番（認証ミドルウェア）をインポート
import { checkAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// --- [GET] イベント一覧取得API ---
router.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        creator: true,
        participants: { include: { user: true } },
        transactions: true
      }
    });
    res.json(events);
  } catch (error) {
    console.error("❌ 取得エラー:", error);
    res.status(500).json({ error: "イベントの取得に失敗しました" });
  }
});

// --- 🌟 [GET] 特定のイベント詳細取得API ---
// 詳細画面で「名前」「履歴」を表示するために使用します
router.get('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const event = await prisma.event.findUnique({
      where: { id: Number(id) },
      include: {
        participants: { include: { user: true } },
        transactions: { 
          orderBy: { createdAt: 'desc' } // 新しい支払い履歴を上に
        }
      }
    });

    if (!event) {
      return res.status(404).json({ error: "イベントが見つかりません" });
    }

    res.json(event);
  } catch (error) {
    console.error("❌ 詳細取得エラー:", error);
    res.status(500).json({ error: "サーバー内部エラーです" });
  }
});

// --- [POST] イベント作成API ---
router.post('/events', checkAuth, async (req, res) => {
  const { name, amount, memo, tag, invitationCode } = req.body;
  const uid = req.user.uid;

  try {
    const event = await prisma.event.create({
      data: {
        name: name,
        memo: memo,
        tag: tag,
        invitationCode: invitationCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
        totalAmount: Number(amount) || 0,
        creatorId: uid,
        participants: {
          create: {
            userUid: uid
          }
        }
      },
      include: { participants: true }
    });
    console.log("✅ 本物のユーザーでイベント作成成功:", event.name);
    res.json(event);
  } catch (error) {
    console.error("❌ 作成エラー:", error);
    res.status(500).json({ error: "イベントの作成に失敗しました。" });
  }
});

// --- [POST] イベント参加API (招待コードを使用) ---
router.post('/events/join', checkAuth, async (req, res) => {
  const { invitationCode } = req.body;
  const uid = req.user.uid;

  try {
    const event = await prisma.event.findUnique({
      where: { invitationCode: invitationCode }
    });

    if (!event) return res.status(404).json({ error: "無効な招待コードです" });

    const participation = await prisma.participant.create({
      data: {
        eventId: event.id,
        userUid: uid
      }
    });

    console.log(`👤 ユーザー ${uid} がイベント ${event.name} に参加しました！`);
    res.json({ message: "イベントに参加しました", eventId: event.id });
  } catch (error) {
    console.error("❌ 参加エラー:", error);
    res.status(500).json({ error: "既に参加しているか、エラーが発生しました" });
  }
});

// --- [POST] 支払い登録API ---
router.post('/transactions', checkAuth, async (req, res) => {
  const { amount, description, eventId } = req.body;
  const uid = req.user.uid;

  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount: Number(amount),
        description: description,
        eventId: Number(eventId),
        payerUid: uid,
      },
    });

    // 🌟 イベントの合計金額も更新する（オプション）
    await prisma.event.update({
      where: { id: Number(eventId) },
      data: { totalAmount: { increment: Number(amount) } }
    });

    console.log(`💰 支払い記録成功: ${description} (${amount}円)`);
    res.json(transaction);
  } catch (error) {
    console.error("❌ 支払い登録エラー:", error);
    res.status(500).json({ error: "支払い記録に失敗しました" });
  }
});

// --- 🌟 [DELETE] イベント削除API ---
router.delete('/events/:id', checkAuth, async (req, res) => {
  const { id } = req.params;
  try {
    // 関連データを削除（Prismaの構成に合わせて）
    await prisma.transaction.deleteMany({ where: { eventId: Number(id) } });
    await prisma.participant.deleteMany({ where: { eventId: Number(id) } });
    await prisma.event.delete({ where: { id: Number(id) } });
    
    res.json({ message: "イベントを削除しました" });
  } catch (error) {
    console.error("❌ 削除エラー:", error);
    res.status(500).json({ error: "削除に失敗しました" });
  }
});

// --- 🌟 [GET] 精算ロジック実行API ---
router.get('/events/:id/settle', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    const [transactions, event, participants] = await Promise.all([
      prisma.transaction.findMany({ where: { eventId } }),
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.participant.findMany({ where: { eventId } })
    ]);

    if (!event) return res.status(404).json({ error: "イベントが見つかりません" });

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const participantCount = participants.length;
    const sharePerPerson = participantCount > 0 ? totalAmount / participantCount : 0;

    const balances = participants.map(p => {
      const uid = p.userUid;
      const paid = transactions
        .filter(t => t.payerUid === uid)
        .reduce((sum, t) => sum + t.amount, 0);
      return { userId: uid, amount: paid - sharePerPerson };
    });

    const optimizedSettlements = getOptimizedSettlements(balances);
    const entropy = calculateEntropy(optimizedSettlements.length, event.createdAt);

    await prisma.event.update({
      where: { id: eventId },
      data: { entropy: entropy }
    });

    res.json({
      eventId,
      eventName: event.name,
      totalAmount,
      participantCount,
      entropy,
      settlements: optimizedSettlements
    });

  } catch (error) {
    console.error("❌ 精算ロジックエラー:", error);
    res.status(500).json({ error: "精算計算に失敗しました" });
  }
});

export default router;