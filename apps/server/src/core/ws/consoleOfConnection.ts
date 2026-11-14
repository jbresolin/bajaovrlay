import { randomUUID } from 'node:crypto';

import { ConsoleIdSchema } from '@bajaovrlay/shared';

/**
 * The console a connection is (BAJAOVRLAY-69): none for a screen (a renderer or a monitor
 * sends no take); for a control page, the id it named in its address (`/ws?console=<id>`),
 * kept from its first hello in the tab's sessionStorage, or a new one from `createConsoleId`
 * when it named none or one that is not a console id.
 * The server hands the id out, rather than the page making its own, because a browser
 * offers crypto.randomUUID only on https or localhost, and the operators' laptops open the
 * page over plain http on the LAN.
 * What could go wrong: the id is not proven, so a page can name another tab's id. It would
 * only make that page one console with the other tab (never refused against it, as before
 * BAJAOVRLAY-69): the id tells two operators apart for their own sake, it guards nothing.
 */
export function chooseConsoleIdOfConnection(
  requestTarget: string | undefined,
  isScreen: boolean,
  createConsoleId: () => string = randomUUID,
): string | undefined {
  if (isScreen) {
    return undefined;
  }
  const consoleIdNamed = readConsoleIdFromRequestTarget(requestTarget);
  const consoleIdCheck = ConsoleIdSchema.safeParse(consoleIdNamed);
  if (consoleIdCheck.success) {
    return consoleIdCheck.data;
  }
  return createConsoleId();
}

/**
 * The `console` query field of an upgrade request, or null when there is none or the
 * target is not a URL (`new URL` throws on targets such as `http://[`; a throw inside the
 * hub's connection listener would crash the server that owns the state).
 */
function readConsoleIdFromRequestTarget(requestTarget: string | undefined): string | null {
  try {
    return new URL(requestTarget ?? '/', 'http://localhost').searchParams.get('console');
  } catch {
    return null;
  }
}
