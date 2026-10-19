/**
 * Reads a web address (https://cronometragem.example/api/classificacao) into its parts,
 * for the flex source's config checks.
 *
 * Why this file exists: this package runs in both Node (the server) and the browser (the
 * control page), so it is compiled with neither the DOM nor the Node type definitions.
 * Both runtimes have the same global `URL`, but without those definitions TypeScript
 * does not know it. Rather than let all of Node's or all of the DOM's globals into shared
 * code, this file names the three parts of `URL` the checks use and reads the global once.
 * What could go wrong: a runtime without a global `URL` (none we target) would fail here
 * on the first check, with a TypeError, not silently accept an address.
 */

/** The parts of a parsed web address the config checks read. */
interface ParsedWebAddress {
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
}

/** The parts of the global `URL` constructor the config checks use. */
interface WebAddressParser {
  new (text: string): ParsedWebAddress;
  canParse(text: string): boolean;
}

/** The global object, seen as holding the `URL` constructor both runtimes provide. */
interface GlobalWithWebAddressParser {
  readonly URL: WebAddressParser;
}

const globalWithWebAddressParser = globalThis as unknown as GlobalWithWebAddressParser;

/** Tells whether the text is a complete web address the runtime can read. */
export function isReadableWebAddress(text: string): boolean {
  return globalWithWebAddressParser.URL.canParse(text);
}

/** Reads a web address into its protocol, user and password; call only after `isReadableWebAddress`. */
export function parseWebAddress(text: string): ParsedWebAddress {
  return new globalWithWebAddressParser.URL(text);
}
