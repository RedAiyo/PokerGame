import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  console.error(err.stack);

  res.status(500).json({ error: 'Internal server error' });
};
