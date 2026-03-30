import express from 'express';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import cors from 'cors';
import admin from 'firebase-admin';
import serviceAccount from './service-account.json' assert { type: 'json' };

// Firebase Adminの初期化
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("✅ Firebase Admin Initialized");
} catch (e) {
  console.error("❌ Firebase初期化失敗:", e.message);
}

const app = express();
const prisma = new PrismaClient();
const PORT = 3001;

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'https://pairpay-4c17a.web.app'],
  credentials: true
}));

// 🌟 デバッグ機能を強化した認証ミドルウェア
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("⚠️ 認証エラー: ヘッダーにBearerトークンがありません");
    return res.status(401).json({ error: '認証トークンが必要です' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; 
    next();
  } catch (error) {
    // 🌟 ここでターミナルに詳しいエラーを出します
    console.error("❌ Firebaseトークン検証エラーの正体:");
    console.error(`  Error Code: ${error.code}`);
    console.error(`  Message: ${error.message}`);
    
    res.status(401).json({ 
      error: '無効なトークンです', 
      debug_message: error.message 
    });
  }
};

// --- APIエンドポイント ---

// ユーザー同期
app.post('/api/users/sync', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.upsert({
      where: { firebaseUid: req.user.uid },
      update: { name: req.user.name || 'ゲストユーザー' },
      create: { 
        firebaseUid: req.user.uid, 
        name: req.user.name || 'ゲストユーザー' 
      },
    });
    console.log(`👤 User Sync: ${user.name} (${user.firebaseUid})`);
    res.json(user);
  } catch (error) {
    console.error("❌ Sync Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// イベント一覧取得
app.get('/api/events', authenticateUser, async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      where: {
        OR: [
          { creator: { firebaseUid: req.user.uid } },
          { participants: { some: { firebaseUid: req.user.uid } } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// イベント新規作成
app.post('/api/events', authenticateUser, async (req, res) => {
  try {
    const { name, invitationCode, tag, memo } = req.body;
    if (!name) return res.status(400).json({ error: "イベント名が必要です" });

    const code = invitationCode || Math.random().toString(36).substring(2, 8).toUpperCase();

    const newEvent = await prisma.event.create({
      data: {
        name,
        invitationCode: code,
        tag: tag || 'その他',
        memo: memo || '',
        entropy: 0.0,
        isClosed: true,
        creator: {
          connect: { firebaseUid: req.user.uid }
        }
      }
    });
    console.log(`🌌 創世記: ${req.user.uid} が系「${name}」を誕生させました。`);
    res.json(newEvent);
  } catch (error) {
    console.error("❌ Create Event Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 支払い登録
app.post('/api/transactions', authenticateUser, async (req, res) => {
  try {
    const { amount, description, payerId, eventId } = req.body;
    const calculatedEa = Math.log10(parseInt(amount)) * 5;

    const newTransaction = await prisma.transaction.create({
      data: {
        amount: parseInt(amount),
        description,
        payerId: parseInt(payerId),
        eventId: parseInt(eventId),
        activationEnergy: calculatedEa
      }
    });

    await prisma.event.update({
      where: { id: parseInt(eventId) },
      data: { entropy: { increment: 1.0 } }
    });

    res.json({ message: "エントロピー増大。", data: newTransaction });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 精算状況取得 (既存のロジックをここに貼り付けてください)
app.get('/api/settlement/:eventId', authenticateUser, async (req, res) => {
  // calculateMinimalTransfers などの関数が定義されている前提です
  res.status(501).json({ message: "実装に合わせてここを埋めてください" });
});

// 時の矢 (Cron)
cron.schedule('* * * * *', async () => {
  try {
    await prisma.event.updateMany({
      where: { isClosed: true },
      data: { entropy: { increment: 0.1 } }
    });
  } catch (error) {
    console.error("時間経過処理失敗:", error);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Settlo Backend Server running at http://localhost:${PORT}`);
});