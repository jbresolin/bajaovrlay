// Media ids for tests (BAJAOVRLAY-60). A media id must be 64 hexadecimal digits
// (mediaIdPattern in mediaId.ts), and an invented one written out in full looked like a
// real SHA-256 to GitGuardian and to scripts/noRealLookingSecrets.test.ts. These are
// built from a small number instead, so they read as fake and still pass the pattern.

// How many digits a media id has: a SHA-256 written in hexadecimal.
const mediaIdLength = 64;

/**
 * A valid media id that reads as fake: the number padded with zeros to 64 digits, so
 * buildFakeMediaId(42) is "000…0042". Two tests that name the same image use the same number.
 */
export function buildFakeMediaId(fakeNumber: number): string {
  return String(fakeNumber).padStart(mediaIdLength, '0');
}
