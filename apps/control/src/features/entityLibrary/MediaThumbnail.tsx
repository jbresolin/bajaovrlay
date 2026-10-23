import { buildMediaUrl } from '@bajaovrlay/shared';
import { cn } from 'cn';

/**
 * A small picture of one image of the media store, drawn through <img> from its
 * /media/<mediaId> address, as the graphics draw it: an <img> runs no script, even for an
 * SVG. `sizeClassName` sets the box (a table cell's is smaller than the form's).
 */
export function MediaThumbnail(props: { mediaId: string; alt: string; sizeClassName: string }) {
  return (
    <img
      src={buildMediaUrl(props.mediaId)}
      alt={props.alt}
      className={cn('rounded border bg-muted object-contain', props.sizeClassName)}
    />
  );
}
