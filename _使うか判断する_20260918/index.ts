// backend/src/index.ts

import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import path from 'path';
import eventRoutes from './routes/event';
import friendRoutes from './routes/friend'; // 🌟 既にインポート済みですね！

const app = express();

// 1. CORS設定
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // 🌟 PATCHを追加（承認用）
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// 3. Firebase Admin初期化
const serviceAccountPath = path.join(process.cwd(), 'service-account.json');

if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
    });
    console.log("✅ Firebase Admin initialized successfully");
  } catch (error) {
    console.error("❌ Firebase初期化エラー:", error);
  }
}

// 4. ルーティング
app.use('/api', eventRoutes);
app.use('/api/friends', friendRoutes); // 🌟 これを追加！

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});