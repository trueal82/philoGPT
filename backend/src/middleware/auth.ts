/**
 * auth.ts — Express middleware for JWT authentication and role checks.
 *
 * - `authenticateToken`: verifies the Bearer JWT, loads the user, and checks
 *   the account lock status before passing control to downstream handlers.
 * - `requireAdmin`: guards admin-only routes after authentication.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { createLogger } from '../config/logger';

const log = createLogger('auth-middleware');

interface JwtPayload {
  userId: string;
}

/** Cached at module load; server.ts fails fast if missing. */
const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Verify the Authorization header, load the user, and reject locked accounts.
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    log.debug('Request missing access token');
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    log.debug({ userId: decoded.userId }, 'Token verified');
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      log.debug({ userId: decoded.userId }, 'Token valid but user not found');
      res.status(401).json({ message: 'Invalid token' });
      return;
    }

    req.user = user as IUser;

    if (user.isLocked) {
      log.debug({ userId: decoded.userId }, 'Access denied: account locked');
      res.status(423).json({ error: 'account_locked' });
      return;
    }

    next();
  } catch {
    log.debug('Token verification failed');
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/** Require the authenticated user to have the `admin` role. */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user && (req.user as IUser).role === 'admin') {
    next();
  } else {
    log.debug({ userId: (req.user as IUser)?._id }, 'Admin access denied');
    res.status(403).json({ message: 'Admin access required' });
  }
};
