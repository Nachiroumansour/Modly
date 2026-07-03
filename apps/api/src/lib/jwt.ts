import jwt from 'jsonwebtoken';

export type TokenPayload = { sub: string; role: 'TAILLEUR' | 'CLIENT' };

function secret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret('JWT_SECRET'), { expiresIn: '15m' });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret('JWT_REFRESH_SECRET'), { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): TokenPayload {
  const { sub, role } = jwt.verify(token, secret('JWT_SECRET')) as TokenPayload;
  return { sub, role };
}

export function verifyRefreshToken(token: string): TokenPayload {
  const { sub, role } = jwt.verify(token, secret('JWT_REFRESH_SECRET')) as TokenPayload;
  return { sub, role };
}
