import { z } from 'zod';

/**
 * The parts of an EBU OGraf v1 manifest (`*.ograf.json`) the server relies on. Every
 * other field of the manifest is kept as written, so the renderer sees all of it.
 */
export const OGrafManifestSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  /** The web component module, relative to the manifest (e.g. `race-clock.js`). */
  main: z.string().min(1),
});

/**
 * A graphic the operator can take: one built OGraf package. Its files are served at
 * `/graphics/<id>/`, so `id` is the package folder name under packages/graphics.
 */
export const GraphicSchema = z.object({
  id: z.string().min(1),
  manifest: OGrafManifestSchema,
  /** The layer a take uses when the operator does not choose one. */
  defaultLayerId: z.string().min(1),
  category: z.string().min(1),
  /** Address of a preview image, or null while the package has none. */
  thumbnailUrl: z.string().min(1).nullable(),
  /** Field values the control page starts from when preparing a take. */
  defaultFields: z.record(z.string(), z.unknown()),
});

/** A graphic that has passed GraphicSchema. */
export type Graphic = z.infer<typeof GraphicSchema>;
