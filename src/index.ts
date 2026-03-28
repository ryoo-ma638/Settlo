import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import eventRoutes from './routes/event';

const app = express();

// 1. Firebase Admin SDKの初期化
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log("🔥 Firebase Admin initialized");
  } catch (error) {
    console.error("❌ Firebase初期化エラー:", error);
  }
}

// 2. ミドルウェア設定
app.use(cors());
app.use(express.json());

// 3. ルーティング設定
// http://localhost:3001/api/events などの窓口になります
app.use('/api', eventRoutes);

// 4. サーバー起動
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 API Base URL: http://localhost:${PORT}/api`);
});