/**
 * auth.ts — Public & authenticated auth routes.
 *
 * Endpoints: register, login, logout, OAuth (Google/GitHub), profile,
 * language list, language update.
 *
 * Registration creates a locked account that an admin must unlock.
 * Login returns a JWT valid for 24 h.
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import UserGroup from '../models/UserGroup';
import Subscription from '../models/Subscription';
import Language from '../models/Language';
import { authenticateToken } from '../middleware/auth';
import { createLogger } from '../config/logger';

const router = Router();
const log = createLogger('auth');

const JWT_SECRET = process.env.JWT_SECRET ?? '';
const JWT_EXPIRY = '24h';

function signToken(userId: unknown): string {
  return jwt.sign({ userId: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password || !isValidEmail(email)) {
      log.debug({ email }, 'Registration rejected: invalid input');
      res.status(400).json({ message: 'Valid email and password are required' });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      log.debug({ email }, 'Registration rejected: password length');
      res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // Assign default user group and subscription
    const defaultGroup = await UserGroup.findOne({ name: 'General', active: true });
    const defaultSub = await Subscription.findOne({ name: 'Basic', active: true });

    const user = new User({
      email,
      password,
      provider: 'local',
      userGroupId: defaultGroup?._id,
      subscriptionId: defaultSub?._id,
      isLocked: true,
      lockedAt: new Date(),
      lockedReason: 'manual unlock required after registration',
    });
    await user.save();

    log.info({ userId: user._id, email: user.email }, 'User registered (locked, pending manual unlock)');
    res.status(201).json({
      message: 'Registration successful. Your account requires manual activation before you can sign in.',
      user: { id: user._id, email: user.email, provider: user.provider },
    });
  } catch (error) {
    log.error({ err: error }, 'Registration error');
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const normalizedEmail = email?.toLowerCase().trim();

    if (!email || !password) {
      log.debug({ hasEmail: Boolean(email), hasPassword: Boolean(password) }, 'Login rejected: missing credentials');
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    log.debug({ email: normalizedEmail }, 'Login attempt');
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      log.debug({ email: normalizedEmail }, 'Login failed: user not found');
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (!user.password) {
      log.debug({ email: normalizedEmail, provider: user.provider }, 'Login failed: account has no local password');
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    log.debug(
      {
        email: normalizedEmail,
        userId: user._id,
        provider: user.provider,
      },
      'Login user found, verifying password',
    );

    let isMatch = false;
    try {
      isMatch = await user.comparePassword(password);
    } catch (error) {
      log.debug({ email: normalizedEmail, err: error }, 'Login failed: password verification threw error');
      throw error;
    }

    if (!isMatch) {
      log.debug({ email: normalizedEmail, userId: user._id }, 'Login failed: wrong password');
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    if (user.isLocked) {
      log.debug({ email: normalizedEmail, userId: user._id }, 'Login failed: account locked');
      res.status(423).json({ error: 'account_locked' });
      return;
    }

    if (!JWT_SECRET) {
      log.debug('Login failed: JWT_SECRET is empty or missing');
      res.status(500).json({ message: 'Server configuration error' });
      return;
    }

    log.info({ userId: user._id, email: user.email }, 'Login successful');
    res.json({
      message: 'Login successful',
      token: signToken(user._id),
      user: { id: user._id, email: user.email, provider: user.provider },
    });
  } catch (error) {
    log.debug({ err: error }, 'Login failed: unexpected exception');
    log.error({ err: error }, 'Login error');
    res.status(500).json({ message: 'Login failed' });
  }
});

// Logout
router.post('/logout', authenticateToken, (_req: Request, res: Response): void => {
  res.json({ message: 'Logged out successfully' });
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req: Request, res: Response): void => {
    const user = req.user as IUser;
    if (user.isLocked) {
      res.status(423).json({ error: 'account_locked' });
      return;
    }
    res.json({
      message: 'Google login successful',
      token: signToken(user._id),
      user: { id: user._id, email: user.email, provider: user.provider },
    });
  },
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login', session: false }),
  (req: Request, res: Response): void => {
    const user = req.user as IUser;
    if (user.isLocked) {
      res.status(423).json({ error: 'account_locked' });
      return;
    }
    res.json({
      message: 'GitHub login successful',
      token: signToken(user._id),
      user: { id: user._id, email: user.email, provider: user.provider },
    });
  },
);

// Get current user profile
router.get('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById((req.user as IUser)._id).select('-password');
    res.json({ user });
  } catch (error) {
    log.error({ err: error }, 'Profile fetch error');
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// List active languages (for language picker)
router.get('/languages', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  try {
    const languages = await Language.find({ active: true }).sort({ sortOrder: 1, code: 1 }).select('code name nativeName');
    res.json({ languages });
  } catch (error) {
    log.error({ err: error }, 'Error fetching languages');
    res.status(500).json({ message: 'Error fetching languages' });
  }
});

// Update current user's language
router.patch('/language', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { languageCode } = req.body as { languageCode: string };
    if (!languageCode || typeof languageCode !== 'string') {
      res.status(400).json({ message: 'languageCode is required' });
      return;
    }
    const code = languageCode.toLowerCase().trim();
    const lang = await Language.findOne({ code, active: true });
    if (!lang) {
      res.status(400).json({ message: 'Invalid language code' });
      return;
    }
    await User.findByIdAndUpdate((req.user as IUser)._id, { languageCode: code });
    log.info({ userId: (req.user as IUser)._id, languageCode: code }, 'User language updated');
    res.json({ languageCode: code });
  } catch (error) {
    log.error({ err: error }, 'Error updating language');
    res.status(500).json({ message: 'Error updating language' });
  }
});

// Change password (local accounts only)
router.patch('/password', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    };

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ message: 'All password fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ message: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ message: 'Password must be between 8 and 128 characters' });
      return;
    }

    // authenticateToken guarantees req.user is the caller — no privilege escalation possible
    const user = await User.findById((req.user as IUser)._id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!user.password) {
      res.status(400).json({ message: 'Password change is not available for OAuth accounts' });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    await user.save();

    log.info({ userId: user._id }, 'Password changed successfully');
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    log.error({ err: error }, 'Password change error');
    res.status(500).json({ message: 'Failed to change password' });
  }
});

export default router;
