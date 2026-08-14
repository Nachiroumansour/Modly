import type { Express } from 'express';
import request from 'supertest';
import sharp from 'sharp';

export async function registerUser(
  app: Express,
  role: 'TAILLEUR' | 'CLIENT',
  phone: string,
  interests?: string[],
) {
  const res = await request(app).post('/auth/register').send({
    phone,
    password: 'secret123',
    name: role === 'TAILLEUR' ? 'Mamadou' : 'Fatou',
    role,
    ...(interests ? { interests } : {}),
  });
  if (res.status !== 201) {
    throw new Error(`registerUser a échoué : ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { token: res.body.accessToken as string, user: res.body.user as { id: string; name: string } };
}

export async function makeTestImage(width = 600, height = 800): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 210, g: 105, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}
