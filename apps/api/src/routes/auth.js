import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '@judgebox/shared';
import { asyncHandler, HttpError } from '../middleware/error.js';
import { refreshCookieOptions, requireAuth, signAccess, signRefresh } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  handle: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, '3-20 letters, digits or underscore'),
  email: z.string().email().max(120),
  password: z.string().min(8).max(100),
});

const publicUser = (u) => ({ id: String(u._id), handle: u.handle, email: u.email, role: u.role });

function issue(res, user) {
  res.cookie('jb_refresh', signRefresh(user), refreshCookieOptions());
  return { accessToken: signAccess(user), user: publicUser(user) };
}

router.post(
  '/register',
  limiter,
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const exists = await User.findOne({ $or: [{ handle: body.handle }, { email: body.email.toLowerCase() }] }).lean();
    if (exists) throw new HttpError(409, 'Handle or email already in use');
    const user = await User.create({ ...body, email: body.email.toLowerCase(), passwordHash: await bcrypt.hash(body.password, 10) });
    res.status(201).json(issue(res, user));
  })
);

router.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const { login, password } = z.object({ login: z.string().min(1).max(120), password: z.string().min(1).max(100) }).parse(req.body);
    const user = await User.findOne({ $or: [{ handle: login }, { email: login.toLowerCase() }] });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Wrong handle/email or password');
    res.json(issue(res, user));
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.jb_refresh;
    if (!token) throw new HttpError(401, 'No session');
    let payload;
    try {
      payload = jwt.verify(token, config.refreshSecret);
    } catch {
      throw new HttpError(401, 'Session expired');
    }
    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.v) throw new HttpError(401, 'Session revoked');
    res.json(issue(res, user));
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.jb_refresh;
    if (token) {
      try {
        const p = jwt.verify(token, config.refreshSecret);
        await User.updateOne({ _id: p.sub }, { $inc: { tokenVersion: 1 } }); // revokes every refresh token of this user
      } catch {
        /* already invalid */
      }
    }
    res.clearCookie('jb_refresh', { ...refreshCookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(401, 'Unknown user');
    res.json({ user: publicUser(user) });
  })
);

export default router;
