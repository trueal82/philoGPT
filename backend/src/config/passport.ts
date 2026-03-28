import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github';
import User, { IUser } from '../models/User';
import { createLogger } from './logger';

const log = createLogger('passport');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends IUser {}
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  log.warn('JWT_SECRET is not set — authentication will not work');
}

// JWT Strategy
if (JWT_SECRET) {
  log.debug('Registering JWT strategy');
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async (payload: { userId: string }, done) => {
        try {
          const user = await User.findById(payload.userId).select('-password');
          if (!user) return done(null, false);
          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      },
    ),
  );
}

// Google OAuth Strategy — only register when credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  log.debug('Registering Google OAuth strategy');
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          let user = await User.findOne({ provider: 'google', providerId: profile.id });
          if (!user) {
            user = await User.create({
              email: profile.emails?.[0]?.value ?? `${profile.id}@google.com`,
              provider: 'google',
              providerId: profile.id,
            });
          }
          return done(null, user as IUser);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}

// GitHub OAuth Strategy — only register when credentials are configured
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  log.debug('Registering GitHub OAuth strategy');
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: '/api/auth/github/callback',
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: passport.Profile,
        done: (err: Error | null, user?: IUser | false) => void,
      ) => {
        try {
          let user = await User.findOne({ provider: 'github', providerId: profile.id });
          if (!user) {
            const emails = (profile as { emails?: Array<{ value: string }> }).emails;
            user = await User.create({
              email: emails?.[0]?.value ?? `${profile.id}@github.com`,
              provider: 'github',
              providerId: profile.id,
            });
          }
          return done(null, user as IUser);
        } catch (err) {
          return done(err as Error);
        }
      },
    ),
  );
}

export default passport;
