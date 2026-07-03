import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '@moodly/shared';
import { ApiError } from '../../lib/errors.js';
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
