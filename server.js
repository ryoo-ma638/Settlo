import express from 'express';
import cron from 'node-cron';
import cors from 'cors';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// --- Firebase Admin 初期化 ---
let serviceAccount = null;
try {
  const saPath = path.join(process.cwd(), 'service-account.json');
  const raw = fs.readFileSync(saPath, 'utf8');
  serviceAccount = JSON.parse(raw);
  console.log('🔐 Loaded service-account.json:', serviceAccount.client_email);
} catch (e) {
  console.warn('⚠️ service-account.json が読み込めません。Firestore操作が失敗する可能性があります。');
}

if (serviceAccount) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("✅ Firebase Admin Initialized");
} else {
  admin.initializeApp();
}

const db = admin.firestore();
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'https://pairpay-4c17a.web.app'],
  credentials: true
}));

// --- 認証ミドルウェア ---
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証トークンが必要です' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; 
    next();
  } catch (error) {
    console.error("❌ Token Verify Error:", error.message);
    res.status(401).json({ error: '無効なトークンです' });
  }
};

// --- APIエンドポイント ---

// 1. ユーザー同期 (Prisma -> Firestore)
app.post('/api/users/sync', authenticateUser, async (req, res) => {
  console.log("🚀 Sync開始:", req.user.uid);
  try {
    const { uid, name, email, picture } = req.user;
    
    // DB接続チェック
    if (!db) {
      throw new Error("Firestore DBが初期化されていません");
    }

    const userRef = db.collection('users').doc(uid);
    const userData = {
      uid,
      name: name || 'ゲストユーザー',
      email: email || '',
      photoURL: picture || '',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userData, { merge: true });
    console.log(`✅ Firestore保存成功: ${userData.name}`);
    return res.json(userData);
  } catch (error) {
    // 🌟 ここでターミナルに詳細なエラーを表示
    console.error("❌ Sync内部エラー詳細:", error); 
    return res.status(500).json({ 
      error: error.message, 
      stack: error.stack 
    });
  }
});

// 2. イベント一覧取得
app.get('/api/events', authenticateUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    // 作成者であるか、参加者リストに含まれているイベントを取得
    const q1 = db.collection('events').where('creatorId', '==', uid).get();
    const q2 = db.collection('events').where('participants', 'array-contains', uid).get();

    const [snap1, snap2] = await Promise.all([q1, q2]);
    const map = new Map();
    
    const processDoc = (doc) => {
      const data = doc.data();
      map.set(doc.id, {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
      });
    };

    snap1.docs.forEach(processDoc);
    snap2.docs.forEach(processDoc);

    const events = Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return res.json(events);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. イベント作成
app.post('/api/events', authenticateUser, async (req, res) => {
  try {
    const { name, invitationCode, tag, memo } = req.body;
    const uid = req.user.uid;

    const docRef = await db.collection('events').add({
      name,
      memo: memo || '',
      tag: tag || 'その他',
      invitationCode: invitationCode || Math.random().toString(36).substring(2, 8).toUpperCase(),
      totalAmount: 0,
      entropy: 0.0,
      isClosed: false,
      creatorId: uid,
      participants: [uid], // 自分を参加者に含める
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ id: docRef.id, message: "作成成功" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. 支払い登録 (Prisma -> Firestore)
app.post('/api/transactions', authenticateUser, async (req, res) => {
  try {
    const { amount, description, eventId } = req.body;
    const uid = req.user.uid;

    // 🌟 Firestoreの transactions コレクションへ追加
    const transRef = await db.collection('transactions').add({
      amount: Number(amount),
      description: description || '',
      payerId: uid,
      eventId: eventId,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 🌟 イベント側の合計金額とエントロピーを更新
    const eventRef = db.collection('events').doc(eventId);
    await eventRef.update({
      totalAmount: admin.firestore.FieldValue.increment(Number(amount)),
      entropy: admin.firestore.FieldValue.increment(1.0)
    });

    res.json({ id: transRef.id, message: "更新完了" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- 時の矢 (Cron) ---
cron.schedule('* * * * *', async () => {
  try {
    // 終了していない(isClosed: false)イベントのエントロピーを増やす
    const snapshot = await db.collection('events').where('isClosed', '==', false).get();
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { entropy: admin.firestore.FieldValue.increment(0.1) });
    });
    await batch.commit();
    console.log(`⏰ Entropy increased for ${snapshot.size} events`);
  } catch (error) {
    console.error("❌ Cron Error:", error.message);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Settlo Backend Server running at http://localhost:${PORT}`);
});

