import { z } from 'zod';

/**
 * How the media store names an uploaded image: the SHA-256 of its bytes, as 64 lower-case
 * hexadecimal digits. Named by content on purpose: a media id never changes content, so
 * its URL can be cached for a year, and the same file uploaded twice is one media.
 * What could go wrong: an id is also a file name under DATA_DIR/media, so the pattern is
 * the path-safety check; anything else (a "..", a slash) is refused before any disk read.
 */
export const mediaIdPattern = /^[0-9a-f]{64}$/;

/** A media id that has passed the pattern above. */
export const MediaIdSchema = z.string().regex(mediaIdPattern);

/** The address an image is served at, and the value a resolved image field holds. */
export function buildMediaUrl(mediaId: string): string {
  return `/media/${mediaId}`;
}
