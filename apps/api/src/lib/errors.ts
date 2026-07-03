import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof Error && err.name === 'MulterError') {
    res.status(400).json({
      error: {
        code: 'FICHIER_INVALIDE',
        message: 'Fichier trop volumineux (5 Mo max) ou champ inattendu.',
      },
    });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: 'ERREUR_INTERNE', message: 'Une erreur est survenue. Réessaie.' },
  });
}
