// The boot log's one line about the operator login (BAJAOVRLAY-29): on, or off. Off is a
// warning in plain words, since the control page is then open to anyone on the network,
// as it was before the login existed; `docker logs` is where that gets noticed.
import type { ServerLogger } from '../logger/createLogger.js';
import type { OperatorPins } from './operatorPins.js';

/** Writes the boot line: a warning while no PINs are set, information otherwise; never a PIN. */
export function logOperatorLoginAtBoot(options: {
  logger: ServerLogger;
  operatorPins: OperatorPins;
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
}
