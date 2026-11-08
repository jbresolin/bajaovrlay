/**
 * The two PINs as the boot read them (BAJAOVRLAY-29): the login is off while neither is
 * set, and on with both. Passed around as this value, never as the raw variables, so a
 * PIN reaches only the code that compares it.
 */
export type OperatorPins =
  { isLoginRequired: false } | { isLoginRequired: true; producerPin: string; dataRolePin: string };

/** The PINs of a server with the login off: the control page stays open, as before. */
export const operatorLoginTurnedOff: OperatorPins = { isLoginRequired: false };

/** What parseOperatorPins found: the PINs, or the pt-BR reason the boot stops for. */
export type OperatorPinsParsing =
  { isValid: true; operatorPins: OperatorPins } | { isValid: false; problem: string };

// 4 to 8 digits: short enough to type at a busy desk, long enough not to be guessed in
// the five tries the lockout allows a minute.
const pinPattern = /^[0-9]{4,8}$/;

/**
 * Reads BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA (unset or empty is not set).
 * Neither: the login is off. Both, 4 to 8 digits each and different: on. Anything else is
 * a problem worded in pt-BR, for the person setting up the stream PC, and never quoting a
 * PIN, since the boot error is printed to the server's log.
 */
export function parseOperatorPins(
  producerPinText: string | undefined,
  dataRolePinText: string | undefined,
): OperatorPinsParsing {
  const producerPin = producerPinText === '' ? undefined : producerPinText;
  const dataRolePin = dataRolePinText === '' ? undefined : dataRolePinText;
  if (producerPin === undefined && dataRolePin === undefined) {
    return { isValid: true, operatorPins: operatorLoginTurnedOff };
  }
  if (producerPin === undefined || dataRolePin === undefined) {
    return {
      isValid: false,
      problem:
        'Defina BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA, ou nenhum dos dois: com só um, um dos papéis nunca entraria.',
    };
  }
  if (!pinPattern.test(producerPin)) {
    return { isValid: false, problem: describeABadPin('BAJAOVRLAY_PIN_PRODUCER') };
  }
  if (!pinPattern.test(dataRolePin)) {
    return { isValid: false, problem: describeABadPin('BAJAOVRLAY_PIN_DATA') };
  }
  if (producerPin === dataRolePin) {
    return {
      isValid: false,
      problem:
        'BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA precisam ser diferentes: o PIN é o que separa os dois papéis.',
    };
  }
  return { isValid: true, operatorPins: { isLoginRequired: true, producerPin, dataRolePin } };
}

/** The reason for a PIN that is not 4 to 8 digits, naming the variable but not the value. */
function describeABadPin(variableName: string): string {
  return `${variableName} precisa ter de 4 a 8 algarismos (só números, por exemplo 4 algarismos).`;
}
