// Dados's part of the inbox's triage (BAJAOVRLAY-35, gate 2 of PR #54): it may discard and
// restore a viewer's Super Chat, its own moderation, and no race event. The role column of
// dismissEvent and restoreEvent opens both to Dados by type, so the kind is held here, as
// the server holds it (automationAndTheDataRole.ts).
import type { InboxEvent } from '@bajaovrlay/shared';

import { ptBR } from '@/i18n/ptBR';
import { useIsTheDataRoleLoggedIn } from '@/state/operatorSessionContext';

/**
 * A function telling why the logged-in operator may not discard or restore an event: the
 * reason for Dados on a race event, undefined for a Super Chat or for the Produtor.
 */
export function useWhyTheDataRoleMayNotTriage(): (event: InboxEvent) => string | undefined {
  const isTheDataRoleLoggedIn = useIsTheDataRoleLoggedIn();
  return (event) =>
    isTheDataRoleLoggedIn && event.kind !== 'superChat'
      ? ptBR.events.dataRoleTriagesOnlySuperChats
      : undefined;
}

/**
 * A function telling why the logged-in operator may not bring back a shown or expired
 * event ("Mostrar de novo", BAJAOVRLAY-67): for Dados, a decision about the air on any
 * event, a Super Chat too, as the server holds it; undefined for the Produtor.
 */
export function useWhyTheDataRoleMayNotShowAgain(): (event: InboxEvent) => string | undefined {
  const isTheDataRoleLoggedIn = useIsTheDataRoleLoggedIn();
  return (event) => {
    if (!isTheDataRoleLoggedIn) {
      return undefined;
    }
    return event.kind === 'superChat'
      ? ptBR.events.dataRoleRestoresOnlyDiscardedSuperChats
      : ptBR.events.dataRoleTriagesOnlySuperChats;
  };
}
