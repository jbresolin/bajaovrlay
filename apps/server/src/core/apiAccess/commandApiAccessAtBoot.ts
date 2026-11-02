// The boot log's one line about who may use the command API (BAJAOVRLAY-28): off, by token,
// or open to the whole network. Open is a warning in plain words, since a server started
// with BAJAOVRLAY_API_OPEN=true anywhere but the studio network lets any machine on it
// put graphics on air; `docker logs` is where that gets noticed.
import type { ServerLogger } from '../logger/createLogger.js';
import type { ApiTokens } from './apiTokens.js';

/**
 * Writes the boot line: a warning when the API is open, information otherwise. It names
 * the devices that have a token, never a token.
 */
export function logCommandApiAccessAtBoot(options: {
  logger: ServerLogger;
  apiTokens: ApiTokens;
  isOpenToTheNetwork: boolean;
}): void {
  const { logger, apiTokens, isOpenToTheNetwork } = options;
  const namesOfTheDevices = apiTokens.isSet
    ? apiTokens.tokens.map((apiToken) => apiToken.name)
    : [];
  const fields = { api_token_names: namesOfTheDevices, api_open: isOpenToTheNetwork };
  if (isOpenToTheNetwork) {
    logger.warn(
      fields,
      'command API open to the whole network: any machine on it may send commands with no token (BAJAOVRLAY_API_OPEN=true)',
    );
    return;
  }
  if (apiTokens.isSet) {
    logger.info(fields, 'command API on, by token');
    return;
  }
  logger.info(
    fields,
    'command API off: set BAJAOVRLAY_API_TOKENS, or BAJAOVRLAY_API_OPEN=true on a studio-only network',
  );
}
