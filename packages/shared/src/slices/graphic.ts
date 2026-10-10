import { z } from 'zod';

/**
 * BajaOvrLay's own field in a manifest. OGraf leaves every name starting with `v_` to
 * vendors, so a manifest carrying it still passes the EBU schema. Fields we do not
 * know yet are kept as written.
 */
export const BajaVendorManifestFieldsSchema = z.looseObject({
  /**
   * The layer a take of this graphic uses when the operator does not choose one. The
   * server checks that the layer exists; this schema only checks that it is a text.
   */
  defaultLayerId: z.string().min(1).optional(),
  /** How the control page groups the graphic (for example `clock`). */
  category: z.string().min(1).optional(),
});

/** A manifest's `v_baja` field after validation. */
export type BajaVendorManifestFields = z.infer<typeof BajaVendorManifestFieldsSchema>;

/**
 * The parts of an EBU OGraf v1 manifest (`*.ograf.json`) the server relies on. Every
 * other field of the manifest is kept as written, so the renderer sees all of it.
 */
export const OGrafManifestSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  /** The web component module, relative to the manifest (e.g. `race-clock.js`). */
  main: z.string().min(1),
  /**
   * The JSON Schema of the data the graphic shows, as OGraf defines it. The server
   * checks a take's and an update's data against it. Optional in OGraf: a graphic
   * without one takes no data. Only "is an object" is checked here; whether it is a
   * usable JSON Schema is found out by the server when it compiles it.
   */
  schema: z.record(z.string(), z.unknown()).optional(),
  /** Our vendor field: where the graphic goes by default and how it is grouped. */
  v_baja: BajaVendorManifestFieldsSchema.optional(),
});

/** A manifest that has passed OGrafManifestSchema. */
export type OGrafManifest = z.infer<typeof OGrafManifestSchema>;

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
