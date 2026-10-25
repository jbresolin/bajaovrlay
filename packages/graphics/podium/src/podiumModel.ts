/**
 * The podium's data and its rules: the Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, the settings with their defaults, and the
 * pure answers the view and the steps are built from: which entry stands on which card,
 * the place each card writes, and which cards a step shows. podium.ograf.json describes the
 * same data as JSON Schema; podiumManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * The entries are a positions list (`position`) or a standings list (`rank`), cut to three by
 * the binding's topN and given their team logos by withTeamLogos (`logoUrl`,
 * `logoOnLightPlate`). The graphic draws them as given and repeats no rule of the shapes.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { isTextGiven } from '@bajaovrlay/graphics-kit/textPresence';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** How many places the podium has: one card each. */
export const podiumPlaceCount = 3;

/**
 * Must match "stepCount" in podium.ograf.json. Step 0 is the head alone (Entrar); steps 1,
 * 2 and 3 reveal the 3rd, the 2nd and the 1st (each Próximo); one more Próximo is the end,
 * which takes the podium off air, as the OGraf step rule says.
 */
export const podiumStepCount = 4;

// Loose on purpose, like the standings' entries: a canonical entry passes as is, with the
// fields the podium does not draw (laps, status, points…) riding along.
const podiumEntrySchema = z.looseObject({
  position: z.int().min(1).optional(),
  rank: z.int().min(1).optional(),
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  logoUrl: z.string().optional(),
  logoOnLightPlate: z.boolean().optional(),
});

// Strict at the top: a field the graphic does not know (usually a typo) is refused.
const podiumDataSchema = z.strictObject({
  entries: z.array(podiumEntrySchema).min(1),
  title: z.string().optional(),
  eventLine: z.string().optional(),
});

const partialPodiumDataSchema = podiumDataSchema.partial();

/** One car or team as the podium reads it (extra fields of a canonical entry ride along). */
export type PodiumEntry = z.infer<typeof podiumEntrySchema>;

/** Everything the podium shows, as the renderer sends it. */
export type PodiumData = z.infer<typeof podiumDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type PodiumDataCheck =
  { isValid: true; data: PodiumData } | { isValid: false; problem: string };

/** What the head writes, every setting present (defaults applied). */
export type PodiumSettings = {
  title: string;
  /** The event beside the title; empty when the item gives none (the line is then left out). */
  eventLine: string;
};

/** Where a card stands, left to right: the 2nd place, the 1st (taller, in the middle), the 3rd. */
export type PodiumSlot = 'second' | 'first' | 'third';

/** One card of the podium: where it stands, whose it is (none past the list's end), when it shows. */
export type PodiumCard = {
  slot: PodiumSlot;
  entry: PodiumEntry | undefined;
  /** The step from which the card is revealed: 1 for the 3rd, 2 for the 2nd, 3 for the 1st. */
  revealedAtStep: number;
};

/**
 * Reads the head's settings, applying the manifest's defaults to whatever was left out:
 * the title "PÓDIO", no event line. The one place the defaults live in code.
 */
export function readPodiumSettings(data: PodiumData): PodiumSettings {
  return {
    title: data.title ?? ptBR.defaultTitle,
    eventLine: data.eventLine ?? '',
  };
}

/** The step from which each slot's card is revealed: the 3rd first, the 1st last. */
export const revealStepOfSlot: Record<PodiumSlot, number> = { third: 1, second: 2, first: 3 };

/** The slots in the order their cards come up, one per Próximo. */
const slotsInRevealOrder: PodiumSlot[] = ['third', 'second', 'first'];

/**
 * The three cards left to right, each with its entry by list order: the first entry is the
 * middle card, the second the left, the third the right. The order of the list decides,
 * never the numbers in it: with a tie for a place ("1º" twice in the standings) both cards
 * write the shared place as given, and the list still says who stands where. A list
 * shorter than three leaves the cards past its end empty (they keep their room, never
 * shown); entries past the third are not drawn.
 */
export function listPodiumCardsLeftToRight(entries: readonly PodiumEntry[]): PodiumCard[] {
  return [
    { slot: 'second', entry: entries[1], revealedAtStep: revealStepOfSlot.second },
    { slot: 'first', entry: entries[0], revealedAtStep: revealStepOfSlot.first },
    { slot: 'third', entry: entries[2], revealedAtStep: revealStepOfSlot.third },
  ];
}

/** The place an entry writes: its position (positions list) or its rank (standings). */
export function readPlaceOfEntry(entry: PodiumEntry): number | undefined {
  return entry.position ?? entry.rank;
}

/** The place on the card, "1º"; "—" for an entry with neither (a disqualified team). */
export function writePlaceText(entry: PodiumEntry): string {
  const place = readPlaceOfEntry(entry);
  return place === undefined ? ptBR.emptyMark : ptBR.placeText(place);
}

/**
 * Whether the place sits on the green chip: the 1st place, as on the towers; a team tied for
 * first in the standings is on it too, whichever card it stands on.
 */
export function isPlaceOnTheLeaderChip(entry: PodiumEntry): boolean {
  return readPlaceOfEntry(entry) === 1;
}

/** Whether the card has its logo row: only when the entry carries a logo address. */
export function hasLogo(entry: PodiumEntry): boolean {
  return isTextGiven(entry.logoUrl);
}

/** Whether the logo sits on the light plate; a missing switch reads as false (on the panel). */
export function isLogoOnLightPlate(entry: PodiumEntry): boolean {
  return hasLogo(entry) && (entry.logoOnLightPlate ?? false);
}

/** The head's line at a step: empty at the head alone, then "1/3", "2/3", "3/3". */
export function writeStepLine(step: number): string {
  if (step <= 0) {
    return '';
  }
  return ptBR.stepLine(Math.min(step, podiumPlaceCount), podiumPlaceCount);
}

/**
 * The slots whose cards are revealed after `fromStep` and by `toStep`, in the order they
 * come up (3rd, 2nd, 1st): what a play from one step to a later one brings in. Empty when
 * `toStep` is not after `fromStep`. Pass -1 as `fromStep` for a play from off air.
 */
export function listSlotsRevealedBetweenSteps(fromStep: number, toStep: number): PodiumSlot[] {
  return slotsInRevealOrder.filter((slot) => {
    const revealStep = revealStepOfSlot[slot];
    return revealStep > fromStep && revealStep <= toStep;
  });
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompletePodiumData(input: unknown): PodiumDataCheck {
  const parsed = podiumDataSchema.safeParse(input);
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
export function mergePartialUpdateIntoPodiumData(
  currentData: PodiumData,
  partialInput: unknown,
): PodiumDataCheck {
  const parsedUpdate = partialPodiumDataSchema.safeParse(partialInput);
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
  return parseCompletePodiumData(mergedData);
}
