// Test support: the only OBS passwords the tests use (BAJAOVRLAY-60). They read as fake
// and have low entropy, so a secret scanner (GitGuardian, on every PR) never takes them for
// real ones; scripts/noRealLookingSecrets.test.ts fails on any other spelling. Every test
// imports them from here, the boot's environment tests in core/env included.

/** The password set in the fake OBS's WebSocket Server Settings. */
export const obsPasswordOfTheStreamPc = 'obs-test-password-0001';

/** Last year's password, still in the server's environment: OBS refuses it. */
export const outdatedObsPassword = 'obs-test-password-0002';
