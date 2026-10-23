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

// Where the server serves the images, followed by the media id.
const mediaUrlPrefix = '/media/';

/** The address an image is served at, and the value a resolved image field holds. */
export function buildMediaUrl(mediaId: string): string {
  return `${mediaUrlPrefix}${mediaId}`;
}

/**
 * The media id of an address of the media store ("/media/<mediaId>"), or undefined for
 * any other text (an outside URL typed into an image field, a typo). The item editor's
 * image picker reads a stored image field with it.
 */
export function readMediaIdOfMediaUrl(url: string): string | undefined {
  if (!url.startsWith(mediaUrlPrefix)) {
    return undefined;
  }
  const mediaId = url.slice(mediaUrlPrefix.length);
  return mediaIdPattern.test(mediaId) ? mediaId : undefined;
}
