import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    try {
      const current = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, role: true, active: true, tokenVersion: true } });
      if (!current || !current.active) return res.status(403).json({ error: 'Account is inactive or no longer exists' });
      if (Number(user.tokenVersion || 0) !== current.tokenVersion) return res.status(403).json({ error: 'Session has been revoked. Please sign in again.' });
      req.user = { ...user, ...current };
    } catch { return res.status(503).json({ error: 'Authorization service unavailable' }); }
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
