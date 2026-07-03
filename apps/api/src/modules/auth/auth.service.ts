import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import type { Role } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { signAccessToken, signRefreshToken } from '../../lib/jwt.js';
import { prisma } from '../../lib/prisma.js';

type DbUser = {
  id: string;
  phone: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
};

function toPublicUser(user: DbUser) {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

function tokensFor(user: { id: string; role: Role }) {
  const payload = { sub: user.id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function register(input: {
  phone: string;
  password: string;
  name: string;
  role: Role;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        passwordHash,
        name: input.name,
        role: input.role,
        ...(input.role === 'TAILLEUR' ? { tailorProfile: { create: {} } } : {}),
      },
    });
    return { user: toPublicUser(user), ...tokensFor(user) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ApiError(409, 'TELEPHONE_DEJA_UTILISE', 'Ce numéro est déjà inscrit.');
    }
    throw err;
  }
}
