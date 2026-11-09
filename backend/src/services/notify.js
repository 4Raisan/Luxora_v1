import { prisma } from '../config/prisma.js';
import { trackTask } from '../runtime/tasks.js';

// Push a notification for a user (non-fatal).
export function notify(userId, message, link = null) {
  return trackTask(writeNotification(userId, message, link));
}
async function writeNotification(userId, message, link) {
  try {
    await prisma.notification.create({ data: { userId, message, link } });
  } catch {
    /* non-fatal */
  }
}

// Log administrative mutations for security audit trail (non-fatal).
export function logAdminAction(args) {
  return trackTask(writeAdminAction(args));
}
async function writeAdminAction({ adminId, action, targetType, targetId = null, details = null, ipAddress = null }) {
  if (!adminId || !action || !targetType) return null;
  try {
    return await prisma.adminAuditLog.create({
      data: {
        adminId: Number(adminId),
        action: String(action),
        targetType: String(targetType),
        targetId: targetId ? String(targetId) : null,
        details: details ? details : undefined,
        ipAddress: ipAddress ? String(ipAddress) : null,
      },
    });
  } catch (error) {
    console.warn('[audit] failed to record audit log:', error.message);
    return null;
  }
}

