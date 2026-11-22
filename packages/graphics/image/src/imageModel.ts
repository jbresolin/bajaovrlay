/**
 * The image graphic's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, and the
 * look the data asks for with the defaults filled in. image.ograf.json describes the same
 * data as JSON Schema for renderers and the item form; imageManifestDataAgreement.test.ts
 * keeps the two in agreement, and imageManifest.test.ts keeps the defaults and limits
 * below equal to the manifest's.
 *
 * The image is the one required field: with no image there is nothing to show, so the
 * item form refuses it before the take and load refuses it after. Every other field is
 * optional rather than `.default(...)`, for the logo bug's reason: a default inside the
 * schema would be filled into every partial update, and an update that only moved the
 * image would put its width back to 480 px. readImageLook reads the defaults.
 *
 * The background (João's addition to the brief): no colour by default, so the picture
 * sits on the video as it is; a `#rrggbb` colour fills the box, the margin around the
 * picture included, and with a height set also the bands left beside a picture that is
 * fitted inside it.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { type ImageAnchor, ImageAnchorSchema } from './imageBoxPosition.js';
import { ptBR } from './ptBR.js';

/** How the image comes on and goes off air: a fade, or a plain cut. */
export const imageEntrances = ['fade', 'none'] as const;

/** One of the two entrances. */
export type ImageEntrance = (typeof imageEntrances)[number];

/**
 * The brief's defaults: 480 px wide, centred with no offset, fully opaque, a fade, no
 * margin. No background colour is a default too: the field is simply left out.
 */
export const imageDefaults = {
  widthPx: 480,
  position: 'middle-center',
  offsetXPx: 0,
  offsetYPx: 0,
  opacityPercent: 100,
  entrance: 'fade',
  marginPx: 0,
} as const satisfies {
  widthPx: number;
  position: ImageAnchor;
  offsetXPx: number;
  offsetYPx: number;
  opacityPercent: number;
  entrance: ImageEntrance;
  marginPx: number;
};

/**
 * A background colour as `#rrggbb`: six hex digits in lower case. Deliberate: the brief
 * wrote `^#[0-9a-fA-F]{6}$`, but the official OGraf GDD schema fixes the pattern of a
 * `gddType: "color-rrggbb"` field to exactly `^#[0-9a-f]{6}$`, and a manifest with any
 * other pattern fails it. Lower case only is also what a browser's colour input writes.
 * The same pattern is in the manifest, for the item form and the server.
 */
export const backgroundColorPattern = /^#[0-9a-f]{6}$/;

/**
 * The limits. A size or an offset may take the image partly or wholly off the 1920x1080
 * canvas: the operator decides where it goes, so the limits only stop absurd numbers
 * (twice the canvas at most). The opacity stops at 10% so an image on air is never
 * invisible by mistake.
 */
export const imageLimits = {
  smallestSizePx: 16,
  largestWidthPx: 3840,
  largestHeightPx: 2160,
  largestOffsetXPx: 1920,
  largestOffsetYPx: 1080,
  faintestOpacityPercent: 10,
  fullOpacityPercent: 100,
  largestMarginPx: 200,
} as const;

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const imageDataSchema = z.strictObject({
  imageUrl: z.string().min(1),
  widthPx: z
    .number()
    .int()
    .min(imageLimits.smallestSizePx)
    .max(imageLimits.largestWidthPx)
    .optional(),
  heightPx: z
    .number()
    .int()
    .min(imageLimits.smallestSizePx)
    .max(imageLimits.largestHeightPx)
    .optional(),
  position: ImageAnchorSchema.optional(),
  offsetXPx: z
    .number()
    .int()
    .min(-imageLimits.largestOffsetXPx)
    .max(imageLimits.largestOffsetXPx)
    .optional(),
  offsetYPx: z
    .number()
    .int()
    .min(-imageLimits.largestOffsetYPx)
    .max(imageLimits.largestOffsetYPx)
    .optional(),
  opacityPercent: z
    .number()
    .int()
    .min(imageLimits.faintestOpacityPercent)
    .max(imageLimits.fullOpacityPercent)
    .optional(),
  entrance: z.enum(imageEntrances).optional(),
  backgroundColor: z.string().regex(backgroundColorPattern).optional(),
  marginPx: z.number().int().min(0).max(imageLimits.largestMarginPx).optional(),
});

const partialImageDataSchema = imageDataSchema.partial();

/** Everything the image graphic shows, as the renderer sends it. */
export type ImageData = z.infer<typeof imageDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type ImageDataCheck =
  { isValid: true; data: ImageData } | { isValid: false; problem: string };

/**
 * The look the data asks for, every default filled in. `heightPx` stays undefined when
 * the item set none: the height then follows the image's own proportions; so does
 * `backgroundColor`, which then means no background at all. The opacity is as CSS wants
 * it, 0..1.
 */
export type ImageLook = {
  imageUrl: string;
  widthPx: number;
  heightPx: number | undefined;
  position: ImageAnchor;
  offsetXPx: number;
  offsetYPx: number;
  opacity: number;
  entrance: ImageEntrance;
  backgroundColor: string | undefined;
  marginPx: number;
};

/** Reads the look from the data, the brief's default for each field left out. */
export function readImageLook(data: ImageData): ImageLook {
  const opacityPercent = data.opacityPercent ?? imageDefaults.opacityPercent;
  return {
    imageUrl: data.imageUrl,
    widthPx: data.widthPx ?? imageDefaults.widthPx,
    heightPx: data.heightPx,
    position: data.position ?? imageDefaults.position,
    offsetXPx: data.offsetXPx ?? imageDefaults.offsetXPx,
    offsetYPx: data.offsetYPx ?? imageDefaults.offsetYPx,
    opacity: opacityPercent / 100,
    entrance: data.entrance ?? imageDefaults.entrance,
    backgroundColor: data.backgroundColor,
    marginPx: data.marginPx ?? imageDefaults.marginPx,
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteImageData(input: unknown): ImageDataCheck {
  const parsed = imageDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoImageData(
  currentData: ImageData,
  partialInput: unknown,
): ImageDataCheck {
  const parsedUpdate = partialImageDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(
        partialInput,
        parsedUpdate.error,
        ptBR.validationProblems,
      ),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteImageData(mergedData);
}
