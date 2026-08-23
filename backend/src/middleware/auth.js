import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    try {
      const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, role: true, active: true, isSuperAdmin: true, tokenVersion: true } });
      if (!current || !current.active) return res.status(403).json({ error: 'Account is inactive or no longer exists' });
      // tokenVersion rejection: a password reset/change bumps the user's
      // version, invalidating every JWT issued before it (old tokens carry an
      // older or absent version claim).
      if (current.tokenVersion !== (user.tokenVersion ?? 0)) {
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
      }
      req.user = { ...user, ...current };
    } catch (_) { return res.status(503).json({ error: 'Authorization service unavailable' }); }
    next();
  });
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
}

export { JWT_SECRET };
