import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
import { signAccessToken, verifyRefreshToken } from '../../lib/jwt.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{7,15}$/, 'Numéro de téléphone invalide.');

const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères.'),
  name: z.string().min(1, 'Le nom est requis.').max(80),
  role: z.enum(ROLES),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  res.status(201).json(await authService.register(parsed.data));
});

const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Le mot de passe est requis.'),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  res.json(await authService.login(parsed.data));
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken manquant.'),
});

authRouter.post('/refresh', async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, 'DONNEES_INVALIDES', parsed.error.issues[0].message);
  }
  let payload;
  try {
    payload = verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    throw new ApiError(401, 'TOKEN_INVALIDE', 'Session expirée, reconnecte-toi.');
  }
  res.json({ accessToken: signAccessToken(payload) });
});
