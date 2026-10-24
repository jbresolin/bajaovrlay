import { z } from 'zod';

import { MediaIdSchema } from './mediaId.js';

/** The largest image the media store accepts: 5 MB, a logo or a phone photo. */
export const largestMediaSizeInBytes = 5 * 1024 * 1024;

/**
 * The four kinds of image the media store accepts, told by the file's bytes, never by
 * its name (BAJAOVRLAY-19). GIF and the rest are refused: a logo or a photo is one of these.
 */
export const AcceptedImageContentTypeSchema = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

/** One of AcceptedImageContentTypeSchema's values. */
export type AcceptedImageContentType = z.infer<typeof AcceptedImageContentTypeSchema>;

/**
 * One image the media store holds, under DATA_DIR/media/<mediaId>: the name the file had
 * when it was uploaded (shown on the Cadastros page, never used as a path), its type and
 * size in bytes, its width and height read from its header, and when it was uploaded.
 */
export const MediaRecordSchema = z.object({
  mediaId: MediaIdSchema,
  fileName: z.string().min(1).max(255),
  contentType: AcceptedImageContentTypeSchema,
  sizeBytes: z.number().int().positive().max(largestMediaSizeInBytes),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  /** The moment of the upload, as an ISO 8601 timestamp (the command's moment). */
  uploadedAt: z.string().min(1),
});

/** One image of the media store, after validation. */
export type MediaRecord = z.infer<typeof MediaRecordSchema>;

/**
 * The `media` slice: every image the store holds, each id once, in upload order. Saved.
 * Its total size is the folder's, which the USB backup (BAJAOVRLAY-33) will copy.
 */
export const MediaSchema = z.array(MediaRecordSchema).superRefine((mediaRecords, context) => {
  const mediaIdsSeen = new Set<string>();
  mediaRecords.forEach((mediaRecord, index) => {
    if (mediaIdsSeen.has(mediaRecord.mediaId)) {
      context.addIssue({
        code: 'custom',
        path: [index, 'mediaId'],
        message: `the image ${mediaRecord.mediaId} is listed twice`,
      });
    }
    mediaIdsSeen.add(mediaRecord.mediaId);
  });
});

/** The `media` slice, after validation. */
export type Media = z.infer<typeof MediaSchema>;
