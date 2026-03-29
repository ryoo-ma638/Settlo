import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
// 🌟 logicフォルダから計算ロジックをインポート
import { getOptimizedSettlements, calculateEntropy } from '../logic/settlement';

const router = Router();
const prisma = new PrismaClient();

// テスト用の固定UID（Firebase Auth実装後はここを動的に取得します）
const TEST_USER_UID = "test-user-123";

// --- [GET] イベント一覧取得API ---
router.get('/events', async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        creator: true,
        participants: { include: { user: true } }, // 🌟 参加者リストも含める
        transactions: true
      }
    });
    res.json(events);
  } catch (error) {
    console.error("❌ 取得エラー:", error);
    res.status(500).json({ error: "イベントの取得に失敗しました" });
  }
});

// --- [POST] イベント作成API ---
router.post('/events', async (req, res) => {
  const { name, amount, memo, tag, invitationCode } = req.body;
  try {
    const event = await prisma.event.create({
      data: {
        name: name,
        memo: memo,
        tag: tag,
        // 招待コードがなければ自動生成
        invitationCode: invitationCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
        totalAmount: Number(amount) || 0,
        creatorId: TEST_USER_UID, 
        // 🌟 作成と同時に、作成者を「最初の参加者」として登録
        participants: {
          create: {
            userUid: TEST_USER_UID
          }
        }
      },
      include: { participants: true }
    });
    console.log("✅ イベント作成 & 参加者登録成功:", event.name);
    res.json(event);
  } catch (error) {
    console.error("❌ 作成エラー:", error);
    res.status(500).json({ error: "イベントの作成に失敗しました。" });
  }
});

// --- [POST] イベント参加API (招待コードを使用) ---
router.post('/events/join', async (req, res) => {
  const { invitationCode, userUid } = req.body;
  const uid = userUid || TEST_USER_UID;

  try {
    // 1. コードからイベントを探す
    const event = await prisma.event.findUnique({
      where: { invitationCode: invitationCode }
    });

    if (!event) return res.status(404).json({ error: "無効な招待コードです" });

    // 2. Participantテーブルに登録
    const participation = await prisma.participant.create({
      data: {
        eventId: event.id,
        userUid: uid
      }
    });

    // 🌟 ログ出力を追加しました
    console.log(`👤 ユーザー ${uid} がイベント ${event.name} に参加しました！`);

    res.json({ message: "イベントに参加しました", eventId: event.id });
  } catch (error) {
    console.error("❌ 参加エラー:", error);
    res.status(500).json({ error: "既に参加しているか、エラーが発生しました" });
  }
});

// --- [POST] 支払い登録API ---
router.post('/transactions', async (req, res) => {
  const { amount, description, eventId, payerUid } = req.body;
  try {
    const transaction = await prisma.transaction.create({
      data: {
        amount: Number(amount),
        description: description,
        eventId: Number(eventId),
        payerUid: payerUid || TEST_USER_UID,
      },
    });
    // 🌟 支払い時もログを出すようにしています
    console.log(`💰 支払い記録成功: ${description} (${amount}円)`);
    res.json(transaction);
  } catch (error) {
    console.error("❌ 支払い登録エラー:", error);
    res.status(500).json({ error: "支払い記録に失敗しました" });
  }
});

// --- 🌟 [GET] 精算ロジック実行API ---
router.get('/events/:id/settle', async (req, res) => {
  const eventId = parseInt(req.params.id);

  try {
    // 1. 取引データ、イベント情報、そして「参加者リスト」を取得
    const [transactions, event, participants] = await Promise.all([
      prisma.transaction.findMany({ where: { eventId } }),
      prisma.event.findUnique({ where: { id: eventId } }),
      prisma.participant.findMany({ where: { eventId } }) // 🌟 ここが重要
    ]);

    if (!event) return res.status(404).json({ error: "イベントが見つかりません" });

    // 2. 参加者テーブルを基準に「純残高(Balance)」を算出
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
    const participantCount = participants.length;
    const sharePerPerson = participantCount > 0 ? totalAmount / participantCount : 0;

    const balances = participants.map(p => {
      const uid = p.userUid;
      const paid = transactions
        .filter(t => t.payerUid === uid)
        .reduce((sum, t) => sum + t.amount, 0);
      
      // (自分が払った総額) - (自分が負担すべき額)
      return { userId: uid, amount: paid - sharePerPerson };
    });

    // 3. ロジック呼び出し：最小送金ペアを算出
    const optimizedSettlements = getOptimizedSettlements(balances);

    // 4. ロジック呼び出し：精算エントロピーを算出
    const entropy = calculateEntropy(optimizedSettlements.length, event.createdAt);

    // 5. DBのエントロピー値を更新
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