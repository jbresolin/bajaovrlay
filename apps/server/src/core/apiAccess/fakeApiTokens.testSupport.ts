// Test support: the only API tokens the tests use (BAJAOVRLAY-28). They are written to read
// as fake and to have low entropy, so a secret scanner (GitGuardian, on every PR) never
// takes them for real ones, while still meeting the rules a token must meet: 16 or more
// characters, no space. Every test imports them from here, so there is one spelling to
// scan; a real token is never written in this repository, only `<openssl rand -hex 16>`.

/** Companion's token on the operator's desk. */
export const companionToken = 'companion-test-token-0001';

/** The Stream Deck's token on the operator's desk. */
export const streamDeckToken = 'streamdeck-test-token-0002';

/** One token given to two devices, which the variable refuses. */
export const sharedToken = 'shared-test-token-0003';

/** A token no device has, for the 401 answers. */
export const wrongToken = 'wrong-test-token-0000';

/** BAJAOVRLAY_API_TOKENS on the operator's desk: Companion and a Stream Deck. */
export const apiTokensOfTheDesk = `companion=${companionToken},streamdeck=${streamDeckToken}`;
