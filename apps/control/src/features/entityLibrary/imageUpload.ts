import { type MediaUploadAnswer, MediaUploadAnswerSchema } from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

/** The address the page uploads an image to, on its own server. */
export const mediaUploadAddress = '/api/v1/media';

// The body of a refused upload (400, 413, 415, 422): its pt-BR sentence is shown as it is.
const UploadRefusalBodySchema = z.object({ error: z.object({ message: z.string() }) });

/** What an upload gives: the stored image, or the pt-BR reason it was refused. */
export type ImageUploadOutcome =
  { isUploaded: true; answer: MediaUploadAnswer } | { isUploaded: false; reason: string };

/**
 * Sends one image file to the media store (POST /api/v1/media, field "file") and answers
 * its media id, or why not: the server's own sentence for a file it refused (not an
 * image, over 5 MB), or the catalog's when the server cannot be reached. The server
 * records the image through the command path; the page only puts the id in the form.
 * Never throws.
 */
export async function uploadImageFile(file: File): Promise<ImageUploadOutcome> {
  const serverUnreachable = ptBR.entityLibrary.image.serverUnreachable;
  const form = new FormData();
  form.append('file', file);
  try {
    const response = await fetch(mediaUploadAddress, { method: 'POST', body: form });
    const body: unknown = await response.json();
    if (response.ok) {
      return { isUploaded: true, answer: MediaUploadAnswerSchema.parse(body) };
    }
    const refusal = UploadRefusalBodySchema.safeParse(body);
    return {
      isUploaded: false,
      reason: refusal.success ? refusal.data.error.message : serverUnreachable,
    };
  } catch {
    return { isUploaded: false, reason: serverUnreachable };
  }
}
