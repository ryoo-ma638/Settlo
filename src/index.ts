// src/index.ts
import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin'; // * as admin ではなく、このように変更
import eventRoutes from './routes/event';

const app = express();

// 1. Firebase Admin SDKの初期化（より安全な書き方に変更）
if (admin.apps.length === 0) {
  admin.initializeApp({
    // 環境変数 GOOGLE_APPLICATION_CREDENTIALS で指定したファイルが自動で読み込まれます
    credential: admin.credential.applicationDefault(),
  });
  console.log("🔥 Firebase Admin initialized");
}

app.use(cors());
app.use(express.json());

app.use('/api', eventRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});