import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { prisma } from '../config/prisma.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { toPositiveInt } from '../middleware/validators.js';

const router = Router();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../private-uploads');
fs.mkdirSync(root, { recursive: true });
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, root),
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 3 }, fileFilter: (_req, file, cb) => cb(null, allowedTypes.has(file.mimetype)) });
const imageUpload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, files: 5 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png'].includes(file.mimetype)) });

function removeFiles(files = []) { for (const file of files) fs.unlink(file.path, () => {}); }
function fileResponse(res, record) { return res.sendFile(path.resolve(root, record.filePath)); }

router.post('/provider/kyc-documents', authenticateToken, requireRole('PROVIDER'), upload.array('documents', 3), async (req, res) => {
  const files = req.files || [];
  const documentType = String(req.body.document_type || '').trim().toUpperCase();
  if (!['NIC', 'PASSPORT', 'SELFIE'].includes(documentType) || !files.length) {
    removeFiles(files);
    return res.status(400).json({ error: 'document_type (NIC, PASSPORT, or SELFIE) and at least one valid file are required' });
  }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  if (!provider) { removeFiles(files); return res.status(404).json({ error: 'Provider record not found' }); }
  const documents = await prisma.kycDocument.createManyAndReturn({ data: files.map((file) => ({ providerId: provider.id, documentType, filePath: file.filename, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size })) });
  res.status(201).json({ documents: documents.map((d) => ({ id: d.id, document_type: d.documentType, original_name: d.originalName, mime_type: d.mimeType, size_bytes: d.sizeBytes, created_at: d.createdAt })) });
});

router.post('/bookings/:id/photos', authenticateToken, requireRole('PROVIDER'), imageUpload.array('photos', 5), async (req, res) => {
  const bookingId = toPositiveInt(req.params.id);
  const kind = String(req.body.kind || '').trim().toUpperCase();
  const files = req.files || [];
  if (!bookingId || !['BEFORE', 'AFTER'].includes(kind) || !files.length) { removeFiles(files); return res.status(400).json({ error: 'A booking, kind (BEFORE/AFTER), and JPEG/PNG photo are required' }); }
  const provider = await prisma.provider.findUnique({ where: { userId: req.user.id } });
  const booking = provider && await prisma.booking.findFirst({ where: { id: bookingId, providerId: provider.id } });
  if (!booking) { removeFiles(files); return res.status(403).json({ error: 'This booking is not assigned to you' }); }
  if ((kind === 'BEFORE' && booking.status !== 'IN_PROGRESS') || (kind === 'AFTER' && booking.status !== 'COMPLETED')) { removeFiles(files); return res.status(400).json({ error: `${kind} photos can only be uploaded at the appropriate service stage` }); }
  const photos = await prisma.servicePhoto.createManyAndReturn({ data: files.map((file) => ({ bookingId, kind, filePath: file.filename, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size })) });
  res.status(201).json({ photos: photos.map((p) => ({ id: p.id, kind: p.kind, original_name: p.originalName, url: `/api/uploads/photos/${p.id}` })) });
});

router.get('/uploads/photos/:id', authenticateToken, async (req, res) => {
  const photo = await prisma.servicePhoto.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 }, include: { booking: true } });
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  const provider = req.user.role === 'PROVIDER' ? await prisma.provider.findUnique({ where: { userId: req.user.id } }) : null;
  const permitted = req.user.role === 'ADMIN' || photo.booking.userId === req.user.id || provider?.id === photo.booking.providerId;
  if (!permitted) return res.status(403).json({ error: 'Access denied' });
  return fileResponse(res, photo);
});

router.get('/uploads/kyc/:id', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  const document = await prisma.kycDocument.findUnique({ where: { id: toPositiveInt(req.params.id) || 0 } });
  if (!document) return res.status(404).json({ error: 'KYC document not found' });
  return fileResponse(res, document);
});

export default router;
