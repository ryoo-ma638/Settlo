// backend/src/routes/friend.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { checkAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * --- [GET] フレンド一覧取得 (裏ロジック：全イベント合算収支付き) ---
 * 自分と相手が関わった全イベントの「貸し借り」を計算して返します。
 */
router.get('/', checkAuth, async (req, res) => {
  const myUid = req.user.uid;

  try {
    // 1. 承認済みのフレンド関係をすべて取得
    const friends = await prisma.friend.findMany({
      where: {
        OR: [{ userUid: myUid }, { friendUid: myUid }],
        status: "ACCEPTED",
      },
    });

    const friendsWithBalance = await Promise.all(friends.map(async (f) => {
      // 2. 相手のUIDを特定
      const targetUid = f.userUid === myUid ? f.friendUid : f.userUid;

      // 3. 自分と相手が両方参加している共通イベントのIDを抽出
      const [myParticipations, targetParticipations] = await Promise.all([
        prisma.participant.findMany({ where: { userUid: myUid } }),
        prisma.participant.findMany({ where: { userUid: targetUid } })
      ]);

      const commonEventIds = myParticipations
        .filter(mp => targetParticipations.some(tp => tp.eventId === mp.eventId))
        .map(p => p.eventId);

      // 4. 各イベントでの二人の相対的な貸し借りを合算
      let totalBalance = 0;

      for (const eventId of commonEventIds) {
        const [transactions, participants] = await Promise.all([
          prisma.transaction.findMany({ where: { eventId } }),
          prisma.participant.findMany({ where: { eventId } })
        ]);

        const participantCount = participants.length;
        if (participantCount === 0) continue;

        const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
        const sharePerPerson = totalAmount / participantCount;

        // 自分の収支 (払った合計 - 本来の負担額)
        const myPaid = transactions
          .filter(t => t.payerUid === myUid)
          .reduce((sum, t) => sum + t.amount, 0);
        const myBalance = myPaid - sharePerPerson;

        // 相手の収支 (払った合計 - 本来の負担額)
        const targetPaid = transactions
          .filter(t => t.payerUid === targetUid)
          .reduce((sum, t) => sum + t.amount, 0);
        const targetBalance = targetPaid - sharePerPerson;

        // 相対的な貸し借りを加算
        totalBalance += (myBalance - targetBalance) / participantCount;
      }

      return {
        friendshipId: f.id,
        friendUid: targetUid,
        totalBalance: Math.round(totalBalance), // プラスなら「貸している」、マイナスなら「借りている」
        status: f.status
      };
    }));

    res.json(friendsWithBalance);
  } catch (error) {
    console.error("❌ フレンド一覧取得エラー:", error);
    res.status(500).json({ error: "情報の集計に失敗しました" });
  }
});

/**
 * --- [POST] フレンド申請 ---
 */
router.post('/request', checkAuth, async (req, res) => {
  const { friendUid } = req.body;
  const myUid = req.user.uid;

  if (myUid === friendUid) {
    return res.status(400).json({ error: "自分自身をフレンドにはできません" });
  }

  try {
    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { userUid: myUid, friendUid: friendUid },
          { userUid: friendUid, friendUid: myUid }
        ]
      }
    });

    if (existing) {
      return res.status(400).json({ error: "既にフレンドか、申請中です" });
    }

    const newFriend = await prisma.friend.create({
      data: {
        userUid: myUid,
        friendUid: friendUid,
        status: "PENDING"
      }
    });

    res.json({ message: "申請を送信しました", data: newFriend });
  } catch (error) {
    res.status(500).json({ error: "申請に失敗しました" });
  }
});

/**
 * --- [PATCH] フレンド申請承認 ---
 */
router.patch('/accept', checkAuth, async (req, res) => {
  const { requestId } = req.body;
  const myUid = req.user.uid;

  try {
    const request = await prisma.friend.findUnique({
      where: { id: Number(requestId) }
    });

    if (!request || request.friendUid !== myUid) {
      return res.status(403).json({ error: "承認権限がありません" });
    }

    const updated = await prisma.friend.update({
      where: { id: Number(requestId) },
      data: { status: "ACCEPTED" }
    });

    res.json({ message: "フレンドになりました！", data: updated });
  } catch (error) {
    res.status(500).json({ error: "承認に失敗しました" });
  }
});

export default router;