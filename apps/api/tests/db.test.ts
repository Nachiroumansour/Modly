import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

describe('base de données', () => {
  it('crée et relit un utilisateur', async () => {
    await prisma.user.create({
      data: {
        phone: '+221770000001',
        passwordHash: 'x',
        name: 'Test',
        role: 'CLIENT',
      },
    });
    const found = await prisma.user.findUnique({ where: { phone: '+221770000001' } });
    expect(found?.name).toBe('Test');
    expect(found?.role).toBe('CLIENT');
  });
});
