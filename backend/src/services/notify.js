import { prisma } from '../config/prisma.js';

// Push a notification for a user (non-fatal).
export async function notify(userId, message, link = null) {
  try {
    await prisma.notification.create({ data: { userId, message, link } });
  } catch {
    /* non-fatal */
  }
}
