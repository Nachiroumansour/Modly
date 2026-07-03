import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

async function createTailor(phone: string) {
  return prisma.user.create({
    data: { phone, passwordHash: 'x', name: 'Mamadou', role: 'TAILLEUR' },
  });
}

describe('modèles communauté', () => {
  it('crée un modèle avec image et compteurs à zéro', async () => {
    const tailor = await createTailor('+221770000100');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Boubou brodé',
        category: 'BOUBOU',
        imageUrl: 'http://localhost:3000/uploads/x.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    expect(design.likesCount).toBe(0);
    expect(design.commentsCount).toBe(0);
    expect(design.bookmarksCount).toBe(0);
  });

  it('interdit deux likes du même utilisateur sur le même modèle', async () => {
    const tailor = await createTailor('+221770000101');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Robe wax',
        category: 'ROBE',
        imageUrl: 'http://localhost:3000/uploads/y.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    await prisma.like.create({ data: { userId: tailor.id, designId: design.id } });
    await expect(
      prisma.like.create({ data: { userId: tailor.id, designId: design.id } }),
    ).rejects.toThrow();
  });

  it('supprime en cascade likes et modèles quand le tailleur est supprimé', async () => {
    const tailor = await createTailor('+221770000102');
    const design = await prisma.design.create({
      data: {
        tailorId: tailor.id,
        title: 'Ensemble',
        category: 'ENSEMBLE',
        imageUrl: 'http://localhost:3000/uploads/z.webp',
        imageWidth: 600,
        imageHeight: 800,
      },
    });
    await prisma.like.create({ data: { userId: tailor.id, designId: design.id } });
    await prisma.user.delete({ where: { id: tailor.id } });
    expect(await prisma.design.findUnique({ where: { id: design.id } })).toBeNull();
    expect(await prisma.like.count()).toBe(0);
  });
});
