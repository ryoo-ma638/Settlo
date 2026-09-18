import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// 🌟 TypeScriptに「Request型の中に user も入れてね」と教える設定
interface AuthRequest extends Request {
  user?: any;
}

export const checkAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("❌ 認証エラー: Authorizationヘッダーがありません");
    return res.status(403).json({ error: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // ✅ これでエラーが消えます！
    console.log("✅ 認証成功: ユーザーUID =", decodedToken.uid);
    next();
  } catch (error) {
    console.error("❌ トークン検証失敗:", error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};