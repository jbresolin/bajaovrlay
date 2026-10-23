import { z } from 'zod';

import { MediaIdSchema } from './mediaId.js';
import { MediaRecordSchema } from './mediaRecord.js';

/**
 * Records an image the upload route has just written to DATA_DIR/media (POST
 * /api/v1/media). Sent only by the media store, `sistema:midia`: a page that could send
 * it would list an image with no file behind it. The record carries everything but its
 * moment, which the server stamps (the command's moment, as setOverride's setAt). An id
 * already listed changes nothing, since the same bytes are the same media.
 */
export const RecordUploadedMediaCommandSchema = z.object({
  type: z.literal('recordUploadedMedia'),
  media: MediaRecordSchema.omit({ uploadedAt: true }),
});

/** A recordUploadedMedia command after validation. */
export type RecordUploadedMediaCommand = z.infer<typeof RecordUploadedMediaCommandSchema>;

/**
 * Deletes an image from the media store ("Limpar imagens sem uso"). Operators only.
 * Refused with MEDIA_IN_USE while any record of the entity library names it, so a logo on
 * air never loses its file; the media service then removes the file. An id not listed
 * changes nothing.
 */
export const DeleteMediaCommandSchema = z.object({
  type: z.literal('deleteMedia'),
  mediaId: MediaIdSchema,
});

/** A deleteMedia command after validation. */
export type DeleteMediaCommand = z.infer<typeof DeleteMediaCommandSchema>;

/**
 * What POST /api/v1/media answers for an accepted upload: the media id the record names
 * the image by, its type and its size, so the form can show the thumbnail at once.
 */
export const MediaUploadAnswerSchema = z.object({
  mediaId: MediaIdSchema,
  contentType: MediaRecordSchema.shape.contentType,
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
});

/** An upload answer, after validation. */
export type MediaUploadAnswer = z.infer<typeof MediaUploadAnswerSchema>;
