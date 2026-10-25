/**
 * The QR card's data: its Zod schema (the boundary check for `load` and `updateAction`), the
 * merge of partial updates, the address's own rules with pt-BR problems, and the code's
 * squares for the address. qr-card.ograf.json describes the same data as JSON Schema for
 * renderers and forms; qrCardManifestDataAgreement.test.ts keeps the two in agreement.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';
import { encodeAddressAsQrModules } from './qrCodeEncoding.js';

/**
 * The longest address the card takes: what a version 6 code holds at level M in byte mode,
 * version 6 being the largest whose modules stay at least 4 px in the 176 px box
 * (qrCodeEncoding.ts). The manifest's `maxLength` says the same, so the item editor refuses
 * a longer one while it is typed; qrCodeEncoding.test.ts derives the number from the
 * encoder and the theme's `--qr-size` and checks both against it.
 */
export const longestAddressLength = 106;

/**
 * The characters an address may hold: printable ASCII, no space, which is what a web address
 * is written in (an accented domain travels as its xn-- form). The manifest's `pattern` is the
 * same rule. The reason it matters: the encoder turns each character into one byte, which is
 * only right for ASCII, and a code that scans to the wrong address is worse than none.
 */
export const addressCharactersPattern = /^[!-~]*$/;

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored. The
// address is only checked as text here; its own rules give their own pt-BR sentences below.
const qrCardDataSchema = z.strictObject({
  callToAction: z.string(),
  address: z.string(),
});

const partialQrCardDataSchema = qrCardDataSchema.partial();

/** Everything the QR card shows, as the renderer sends it. */
export type QrCardData = z.infer<typeof qrCardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type QrCardDataCheck =
  { isValid: true; data: QrCardData } | { isValid: false; problem: string };

/**
 * Says what is wrong with an address, as one pt-BR sentence, or undefined when it can be
 * made into a code that fits the card: not empty, plain ASCII with no space, and at most
 * `longestAddressLength` characters.
 */
export function findProblemInAddress(address: string): string | undefined {
  if (address === '') {
    return ptBR.addressProblems.empty;
  }
  if (!addressCharactersPattern.test(address)) {
    return ptBR.addressProblems.notPlainText;
  }
  if (address.length > longestAddressLength) {
    return ptBR.addressProblems.tooLong(address.length, longestAddressLength);
  }
  return undefined;
}

/**
 * The code's squares for the card's address, row by row, `true` for dark. The code encodes
 * the address exactly as typed; only the line of text under the call is set in caps.
 */
export function makeQrCodeModulesOfCard(data: QrCardData): boolean[][] {
  return encodeAddressAsQrModules(data.address);
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteQrCardData(input: unknown): QrCardDataCheck {
  const parsed = qrCardDataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
    };
  }
  const addressProblem = findProblemInAddress(parsed.data.address);
  if (addressProblem !== undefined) {
    return { isValid: false, problem: addressProblem };
  }
  return { isValid: true, data: parsed.data };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current data
 * is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoQrCardData(
  currentData: QrCardData,
  partialInput: unknown,
): QrCardDataCheck {
  const parsedUpdate = partialQrCardDataSchema.safeParse(partialInput);
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
  return parseCompleteQrCardData(mergedData);
}
