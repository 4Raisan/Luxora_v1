import jwt from 'jsonwebtoken';
import { verifySessionToken } from '../services/sessionAuth.js';
import { JWT_SECRET } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export const verifySession = (token) => verifySessionToken(token, {
  verifyJwt: (value) => jwt.verify(value, JWT_SECRET),
  findUser: (id) => prisma.user.findUnique({ where: { id }, select: {
    id: true, email: true, name: true, phone: true, role: true, active: true, tokenVersion: true,
  } }),
});

export async function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  try { req.user = await verifySession(token); }
  catch (error) { return res.status(error.statusCode || 503).json({ error: error.message }); }
  next();
}

// Anonymous chat remains available; supplied credentials must be valid.
export function optionalAuthentication(req, res, next) {
  if (!req.headers.authorization) return next();
  return authenticateToken(req, res, next);
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
