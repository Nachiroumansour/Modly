import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/errors.js';
import { verifyAccessToken, type TokenPayload } from '../lib/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'NON_AUTHENTIFIE', 'Connexion requise.');
  }
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw new ApiError(401, 'TOKEN_INVALIDE', 'Session expirée, reconnecte-toi.');
  }
  next();
}

export function requireRole(role: 'TAILLEUR' | 'CLIENT') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      throw new ApiError(403, 'ACCES_REFUSE', 'Tu n\'as pas accès à cette action.');
    }
    next();
  };
}
