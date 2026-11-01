import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './error.js';

export const signAccess = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, handle: user.handle }, config.jwtSecret, { expiresIn: '15m' });

export const signRefresh = (user) => jwt.sign({ sub: String(user._id), v: user.tokenVersion }, config.refreshSecret, { expiresIn: '7d' });

export function verifyAccess(token) {
  const p = jwt.verify(token, config.jwtSecret);
  return { id: p.sub, role: p.role, handle: p.handle };
}

function readUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return verifyAccess(h.slice(7));
  } catch {
    return null;
  }
}

export function authOptional(req, _res, next) {
  req.user = readUser(req);
  next();
}

export function requireAuth(req, _res, next) {
  const u = readUser(req);
  if (!u) return next(new HttpError(401, 'Please log in'));
  req.user = u;
  next();
}

export const requireRole = (...roles) => (req, res, next) =>
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (!roles.includes(req.user.role)) return next(new HttpError(403, 'Not allowed'));
    next();
  });

export const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: config.isProd ? 'none' : 'lax',
  secure: config.isProd ? true : config.cookieSecure,
  path: '/api/auth',
  maxAge: 7 * 24 * 3600 * 1000,
});
