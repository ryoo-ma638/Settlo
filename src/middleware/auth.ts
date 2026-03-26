import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin'; // firebase-adminの初期化が必要

declare global {
  namespace Express {
    interface Request {
      user?: any; // もしくは admin.auth.DecodedIdToken
    }
  }
}
export const checkAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).send('Unauthorized');
  }

  const idToken = header.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // reqにユーザー情報を格納
    next();
  } catch (error) {
    res.status(403).send('Forbidden');
  }
};