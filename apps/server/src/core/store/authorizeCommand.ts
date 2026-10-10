import type { Command } from '@bajaovrlay/shared';

import { isRendererActor } from './commandActors.js';

/**
 * The authorisation step of applyCommand: answers whether this actor may run this
 * command. A store can be given a different one (tests do, and login will).
 */
export type IsCommandAllowed = (command: Command, actor: string) => boolean;

/**
 * The default hook while there is no operator login. It decides by the actor's role
 * alone: a renderer may only report what is on screen (reportInstanceStatus), and
 * nobody else may send that report. Every other command is open to every other actor.
 * The role comes from the address the connection chose (`/ws?role=renderer`), so this
 * keeps honest pages in their lane; it is not a defence against a hostile client.
 */
export const allowCommandForActorRole: IsCommandAllowed = (command, actor) => {
  const isReportFromTheScreen = command.type === 'reportInstanceStatus';
  if (isRendererActor(actor)) {
    return isReportFromTheScreen;
  }
  return !isReportFromTheScreen;
};
