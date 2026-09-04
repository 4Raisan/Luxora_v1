import { Router } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';
import { getObject, putObject, removeObject } from '../services/storage.js';

const router = Router();

// Content-based file validation: the client-declared MIME type and the original
// filename extension are both attacker-controlled, so every upload is identified
// by its magic bytes and the sniffed type must match what the client declared.
// Stored extensions come from the sniffed type, never from the original name.
const SIGNATURES = [
  { type: 'image/jpeg', ext: '.jpg', match: (b) => b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { type: 'image/png', ext: '.png', match: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A },
  { type: 'application/pdf', ext: '.pdf', match: (b) => b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2D }, // "%PDF-"
];

export function detectFileSignature(buffer) {
  for (const signature of SIGNATURES) {
    if (signature.match(buffer)) return signature;
  }
  return null;
}

const ALLOWED_KYC_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 3 } });
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5 } });

// Buffers are held in memory only until validation; accepted files are stored
// under a random key in configured object storage (or the development-only local
// fallback), so client input never influences a path and uploads are never executed.
async function persistValidatedFile(file, allowedTypes) {
  const signature = detectFileSignature(file.buffer);
  if (!signature || !allowedTypes.has(signature.type) || signature.type !== file.mimetype) return null;
  const filename = `${crypto.randomUUID()}${signature.ext}`;
  await putObject(filename, file.buffer, signature.type);
  return { filename, mimeType: signature.type, sizeBytes: file.buffer.length };
}

async function removeFiles(files = []) { await Promise.all(files.map((persisted) => removeObject(persisted).catch(() => {}))); }
async function fileResponse(res, record) {
  const buffer = await getObject(record.filePath);
  if (!buffer) return res.status(404).json({ error: 'Stored file is unavailable' });
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', record.mimeType);
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(record.originalName || 'file'))}"`);
  res.setHeader('Content-Length', String(buffer.length));
  return res.send(buffer);
}

router.post('/provider/kyc-documents', authenticateToken, requireRole('PROVIDER'), upload.array('documents', 3), async (req, res) => {
  const files = req.files || [];
  const documentType = String(req.body.document_type || '').trim().toUpperCase();
  if (!['NIC', 'PASSPORT', 'SELFIE'].includes(documentType) || !files.length) {
    return res.status(400).json({ error: 'document_type (NIC, PASSPORT, or SELFIE) and at least one valid file are required' });
  }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) return res.status(404).json({ error: 'Provider record not found' });
  const persisted = [];
  for (const file of files) {
    const stored = await persistValidatedFile(file, ALLOWED_KYC_TYPES);
    if (!stored) {
      await removeFiles(persisted.map((item) => item.filename));
      return res.status(415).json({ error: 'Files must be genuine JPEG, PNG, or PDF content matching the declared type' });
    }
    persisted.push(stored);
  }
  let documents;
  try {
    documents = await prisma.kycDocument.createManyAndReturn({ data: persisted.map((stored, index) => ({ providerId: provider.id, documentType, filePath: stored.filename, originalName: path.basename(String(files[index].originalname || 'document')), mimeType: stored.mimeType, sizeBytes: stored.sizeBytes })) });
  } catch (error) {
    await removeFiles(persisted.map((item) => item.filename));
    throw error;
  }
  res.status(201).json({ documents: documents.map((d) => ({ id: d.id, document_type: d.documentType, original_name: d.originalName, mime_type: d.mimeType, size_bytes: d.sizeBytes, created_at: d.createdAt })) });
});

router.post('/bookings/:id/photos', authenticateToken, requireRole('PROVIDER'), imageUpload.array('photos', 5), async (req, res) => {
  const bookingId = toPositiveInt(req.params.id);
  const kind = String(req.body.kind || '').trim().toUpperCase();
  const files = req.files || [];
  if (!bookingId || !['BEFORE', 'AFTER'].includes(kind) || !files.length) { return res.status(400).json({ error: 'A booking, kind (BEFORE/AFTER), and JPEG/PNG photo are required' }); }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  const booking = provider && await prisma.booking.findFirst({ where: { id: bookingId, providerId: provider.id } });
  if (!booking) return res.status(403).json({ error: 'This booking is not assigned to you' });
  if ((kind === 'BEFORE' && booking.status !== 'ASSIGNED') || (kind === 'AFTER' && booking.status !== 'IN_PROGRESS')) { return res.status(400).json({ error: `${kind} photos can only be uploaded at the appropriate service stage` }); }
  const persisted = [];
  for (const file of files) {
    const stored = await persistValidatedFile(file, new Set(['image/jpeg', 'image/png']));
    if (!stored) {
      await removeFiles(persisted.map((item) => item.filename));
      return res.status(415).json({ error: 'Photos must be genuine JPEG or PNG content matching the declared type' });
    }
    persisted.push(stored);
  }
  let photos;
  try {
    photos = await prisma.servicePhoto.createManyAndReturn({ data: persisted.map((stored, index) => ({ bookingId, kind, filePath: stored.filename, originalName: path.basename(String(files[index].originalname || 'photo')), mimeType: stored.mimeType, sizeBytes: stored.sizeBytes })) });
  } catch (error) {
    await removeFiles(persisted.map((item) => item.filename));
    throw error;
  }
  res.status(201).json({ photos: photos.map((p) => ({ id: p.id, kind: p.kind, original_name: p.originalName, url: `/api/uploads/photos/${p.id}` })) });
});

// List persisted service evidence without exposing internal storage keys. The
// same booking-level authorization used by the file endpoint applies here so a
// customer, assigned provider, or admin can restore the gallery after reload.
router.get('/bookings/:id/photos', authenticateToken, async (req, res) => {
  const bookingId = toPositiveInt(req.params.id);
  if (!bookingId) return res.status(400).json({ error: 'A valid booking id is required' });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { userId: true, providerId: true },
  });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });

  const provider = req.user.role === 'PROVIDER'
    ? await prisma.provider.findUnique({ where: { userId: req.user.id }, select: { id: true } })
    : null;
  const permitted = req.user.role === 'ADMIN'
    || booking.userId === req.user.id
    || (provider && provider.id === booking.providerId);
  if (!permitted) return res.status(403).json({ error: 'Access denied' });

  const photos = await prisma.servicePhoto.findMany({
    where: { bookingId },
    orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({
    photos: photos.map((photo) => ({
      id: photo.id,
      kind: photo.kind,
      original_name: photo.originalName,
      mime_type: photo.mimeType,
      size_bytes: photo.sizeBytes,
      created_at: photo.createdAt,
      url: `/api/uploads/photos/${photo.id}`,
    })),
  });
});

router.get('/uploads/photos/:id', authenticateToken, async (req, res) => {
  const photo = await prisma.servicePhoto.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 }, include: { booking: true } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  const provider = req.user.role === 'PROVIDER' ? await prisma.provider.findUnique({ where: { userId: req.user.id } }) : null;
  const permitted = req.user.role === 'ADMIN' || photo.booking.userId === req.user.id || provider?.id === photo.booking.providerId;
  if (!permitted) return res.status(403).json({ error: 'Access denied' });
  return fileResponse(res, photo);
});

router.get('/uploads/kyc/:id', authenticateToken, async (req, res) => {
  const document = await prisma.kycDocument.findUnique({
    where: { id: toPositiveInt(req.params.id) || 0 },
    include: { provider: true },
  });
  if (!document) return res.status(404).json({ error: 'KYC document not found' });
  const isOwner = req.user.role === 'PROVIDER' && document.provider?.userId === req.user.id;
  const isAdmin = req.user.role === 'ADMIN';
  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Access denied: insufficient permissions to view this KYC document' });
  return fileResponse(res, document);
});

export default router;
