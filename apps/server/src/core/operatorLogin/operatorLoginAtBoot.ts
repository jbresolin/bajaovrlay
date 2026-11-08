// The boot log's line about the operator login (BAJAOVRLAY-29): on, or off. Off is a
// warning in plain words, since the control page is then open to anyone on the network,
// as it was before the login existed; `docker logs` is where that gets noticed. On, with
// the command API open, a second warning: the API takes and clears with no PIN at all.
import type { ServerLogger } from '../logger/createLogger.js';
import type { OperatorPins } from './operatorPins.js';

/**
 * Writes the boot line: a warning while no PINs are set, information otherwise; never a PIN.
 * With the PINs set and BAJAOVRLAY_API_OPEN=true, also a warning that the API bypasses them.
 */
export function logOperatorLoginAtBoot(options: {
  logger: ServerLogger;
  operatorPins: OperatorPins;
  /** BAJAOVRLAY_API_OPEN as read at boot. */
  isCommandApiOpenToTheNetwork: boolean;
}): void {
  const { logger, operatorPins } = options;
  if (!operatorPins.isLoginRequired) {
    logger.warn(
      { operator_login: false },
      'operator login off: anyone on the network may operate the control page (set BAJAOVRLAY_PIN_PRODUCER and BAJAOVRLAY_PIN_DATA)',
    );
    return;
  }
  logger.info(
    { operator_login: true },
    'operator login on: the control page asks for a role and its PIN',
  );
  // Open mode is intended (gate 2 of PR #51), but whoever set PINs may think they cover
  // everything: they cover the control page only.
  if (options.isCommandApiOpenToTheNetwork) {
    logger.warn(
      { operator_login: true, command_api_open: true },
      'the command API is open to the whole network without login or roles (BAJAOVRLAY_API_OPEN=true): any computer on the network may take, clear and run macros, whatever the PINs',
    );
  }
}
