// Test support: the PINs every operator-login test uses (BAJAOVRLAY-29). Made up, and
// never a production value: a real show sets its own in BAJAOVRLAY_PIN_PRODUCER and
// BAJAOVRLAY_PIN_DATA. Kept here so no test invents a PIN of its own.

/** The producer's PIN in tests. */
export const producerTestPin = '2468';

/** The data role's PIN in tests. */
export const dataRoleTestPin = '1357';

/** A PIN that is neither of the two, as an operator mistypes it. */
export const mistypedTestPin = '2469';

/** The two PINs as readServerEnvironment hands them to startServer. */
export const operatorPinsOfTheTests = {
  isLoginRequired: true,
  producerPin: producerTestPin,
  dataRolePin: dataRoleTestPin,
} as const;
