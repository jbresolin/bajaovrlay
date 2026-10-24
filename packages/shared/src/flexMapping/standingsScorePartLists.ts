/**
 * A flex source's score parts, read into the standings shape (BAJAOVRLAY-24). A source
 * sends each team's parts as one list, each part a `label` and a `value`
 * (`[{ "label": "PROJETO", "value": 246.81 }, …]`); the mapping keys the team's
 * `pointsByPart` by the label and lists every label it met as the standings' `scoreParts`,
 * in the order met, a part with no value included: the real export has blank 4X4 cells,
 * and a column must not vanish, or move, because of one (gate 2 of PR #25). The label is
 * the part's id too: the source names its parts, and a second, invented id would be one
 * more thing to keep in step.
 */
import type { StandingsScorePart } from '../dataShapes/standingsShape.js';
import { ptBRFlexMapping } from './ptBRFlexMapping.js';

/**
 * A team's points by part and every label its list named (a part with no value too), or a
 * pt-BR reason saying why its list could not be read.
 */
export type ScorePartListReading =
  | { ok: true; pointsByPart: Record<string, number>; labelsInOrder: string[] }
  | { ok: false; reason: string };

/** Says whether a value is a plain object, so its `label` and `value` can be read. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads one team's list of parts into its points by part. A part whose value is null or
 * missing is left out (the source does not know it; the graphic shows "—"); a list that
 * is not a list, or a part without a text label or with a value that is not a number, is
 * refused with a reason naming the part's place (1-based), so nothing is guessed.
 */
export function readScorePartListIntoPointsByPart(partsList: unknown): ScorePartListReading {
  const reasons = ptBRFlexMapping.scorePartReasons;
  if (!Array.isArray(partsList)) {
    return { ok: false, reason: reasons.partsNotAList };
  }

  const pointsByPart: Record<string, number> = {};
  const labelsInOrder: string[] = [];
  for (const [index, part] of partsList.entries()) {
    const placeInList = index + 1;
    if (!isPlainObject(part)) {
      return { ok: false, reason: reasons.partNotReadable(placeInList) };
    }
    const label = part.label;
    const value = part.value;
    const hasTextLabel = typeof label === 'string' && label !== '';
    const isValueUnknown = value === null || value === undefined;
    const isValueANumber = typeof value === 'number' && Number.isFinite(value);
    if (!hasTextLabel || (!isValueUnknown && !isValueANumber)) {
      return { ok: false, reason: reasons.partNotReadable(placeInList) };
    }
    labelsInOrder.push(label);
    if (isValueANumber) {
      pointsByPart[label] = value;
    }
  }
  return { ok: true, pointsByPart, labelsInOrder };
}

/**
 * The standings' parts of the score from the labels the teams' lists named: each label once,
 * in the order first met (the source's own order, since each team lists its parts in it).
 * Empty when no team has parts.
 */
export function listScorePartsOfLabelsMet(labelsMet: string[]): StandingsScorePart[] {
  const scoreParts: StandingsScorePart[] = [];
  const labelsListed = new Set<string>();
  for (const label of labelsMet) {
    if (!labelsListed.has(label)) {
      labelsListed.add(label);
      scoreParts.push({ partId: label, label });
    }
  }
  return scoreParts;
}
