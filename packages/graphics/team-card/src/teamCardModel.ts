/**
 * The team card's data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, pt-BR descriptions of bad data, and what the card is made
 * of for given data: which cells exist, the place line, and the card's width around its
 * text. team-card.ograf.json describes the same data as JSON Schema for renderers and
 * forms; teamCardManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * The field names are the team entity's attribute keys (packages/shared, entities), so an
 * item that reads team N from Cadastros maps each field to the attribute of the same name.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
// The plate is optional here rather than `.default(false)`: a default inside the schema
// would also be filled into every partial update, and an update that only fixed the city
// would then quietly take a team's logo off its plate. isLogoOnLightPlate reads the default.
const teamCardDataSchema = z.strictObject({
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  city: z.string().optional(),
  state: z.string().optional(),
  carPhotoUrl: z.string().optional(),
  logoUrl: z.string().optional(),
  logoOnLightPlate: z.boolean().optional(),
});

const partialTeamCardDataSchema = teamCardDataSchema.partial();

/** Everything the team card shows, as the renderer sends it. */
export type TeamCardData = z.infer<typeof teamCardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type TeamCardDataCheck =
  { isValid: true; data: TeamCardData } | { isValid: false; problem: string };

/** What the card is made of for given data; each media cell exists only when it has an image. */
export type TeamCardCells = {
  /** The car's photo, at the card's left. */
  hasPhotoCell: boolean;
  /** The team's logo, at the card's right. */
  hasLogoCell: boolean;
  /** The logo sits on the small light plate instead of straight on the panel. */
  isLogoOnLightPlate: boolean;
  /** The "city · state" line after the school. */
  hasPlaceLine: boolean;
};

/**
 * The sizes the card's frame is built from, in px, each the value of the token the styles
 * use for it: `--space-3` (padding), `--space-4` (gap between cells), `--team-photo-width`
 * and `--team-logo-size`.
 */
export type TeamCardSizes = {
  cardPaddingPx: number;
  cellGapPx: number;
  photoWidthPx: number;
  logoSizePx: number;
};

/**
 * Answers whether a text field has something to show. A text of blanks counts as
 * missing: an operator who cleared a field by typing spaces, or a record with an empty
 * value, must not leave an empty frame or a dangling dot on air.
 */
export function isTextGiven(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '';
}

/** Whether the logo sits on the light plate; a missing switch reads as false (on the panel). */
export function isLogoOnLightPlate(data: TeamCardData): boolean {
  return data.logoOnLightPlate ?? false;
}

/**
 * Writes the place line: "Campinas · SP", the city alone, the state alone, or undefined
 * when neither is given (the card is then one line shorter). Spaces around each part are
 * dropped, as a CSV import may leave them.
 */
export function writePlaceLine(data: TeamCardData): string | undefined {
  const city = isTextGiven(data.city) ? data.city.trim() : undefined;
  const state = isTextGiven(data.state) ? data.state.trim() : undefined;
  if (city !== undefined && state !== undefined) {
    return `${city}${ptBR.placeLineSeparator}${state}`;
  }
  return city ?? state;
}

/** Lists the cells the card has for this data: one per media the team has, and the place line. */
export function listTeamCardCells(data: TeamCardData): TeamCardCells {
  const hasLogoCell = isTextGiven(data.logoUrl);
  return {
    hasPhotoCell: isTextGiven(data.carPhotoUrl),
    hasLogoCell,
    isLogoOnLightPlate: hasLogoCell && isLogoOnLightPlate(data),
    hasPlaceLine: writePlaceLine(data) !== undefined,
  };
}

/**
 * Measures the card around its text block, in px: the padding at both ends, plus each
 * media cell present with the gap that separates it from the text. The text block's own
 * width depends on the face and the names, so the whole card is this plus that block.
 */
export function measureTeamCardFrameWidthPx(cells: TeamCardCells, sizes: TeamCardSizes): number {
  const paddingAtBothEndsPx = 2 * sizes.cardPaddingPx;
  const photoCellPx = cells.hasPhotoCell ? sizes.photoWidthPx + sizes.cellGapPx : 0;
  const logoCellPx = cells.hasLogoCell ? sizes.cellGapPx + sizes.logoSizePx : 0;
  return paddingAtBothEndsPx + photoCellPx + logoCellPx;
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteTeamCardData(input: unknown): TeamCardDataCheck {
  const parsed = teamCardDataSchema.safeParse(input);
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
export function mergePartialUpdateIntoTeamCardData(
  currentData: TeamCardData,
  partialInput: unknown,
): TeamCardDataCheck {
  const parsedUpdate = partialTeamCardDataSchema.safeParse(partialInput);
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
  return parseCompleteTeamCardData(mergedData);
}
