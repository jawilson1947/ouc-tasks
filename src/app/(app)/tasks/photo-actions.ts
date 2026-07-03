'use server';

/**
 * Delete a photo/document attachment: allowed for admins or the original
 * uploader (same rule the Supabase RLS policy enforced). Removes the Vercel
 * Blob first (best-effort — del() accepts the pathname stored in
 * storage_path; already-gone blobs are ignored), then the attachment row.
 */
import { revalidatePath } from 'next/cache';
import { del } from '@vercel/blob';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function deletePhoto(attachmentId: string, legacyId: number) {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');

  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, storagePath: true, uploadedById: true },
  });
  if (!att) throw new Error('Photo not found');

  const isAdmin = user.role === 'admin';
  const isOwner = att.uploadedById === user.id;
  if (!isAdmin && !isOwner) throw new Error('Permission denied');

  // Best-effort blob cleanup; the DB row is the source of truth.
  await del(att.storagePath).catch(() => {});
  await prisma.attachment.delete({ where: { id: attachmentId } });

  revalidatePath(`/tasks/${legacyId}`);
}
