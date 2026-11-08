import {
  type Command,
  describeWhyTheDataRoleCannotSend,
  isCommandTypeOpenToTheRole,
  type SessionAnswer,
} from '@bajaovrlay/shared';
import { createContext, type ReactNode, useContext } from 'react';

/** What a page of a server with no PINs knows: no login is asked for, there is no role. */
export const sessionAnswerWithTheLoginOff: SessionAnswer = { isLoginRequired: false, session: null };

// The default is the login off, so a component drawn without the provider (most tests)
// behaves as the page did before BAJAOVRLAY-29: nothing greyed out for a role.
const OperatorSessionContext = createContext<SessionAnswer>(sessionAnswerWithTheLoginOff);

/**
 * Makes the server's answer about the login (GET /api/v1/session, read once as the page
 * opens, in main.tsx) available to every component below it: whether a login is asked
 * for, and the role and station of this page. It changes only with a reload: logging in
 * and "Sair" both reload the page.
 */
export function OperatorSessionProvider(props: {
  sessionAnswer: SessionAnswer;
  children: ReactNode;
}) {
  return (
    <OperatorSessionContext.Provider value={props.sessionAnswer}>
      {props.children}
    </OperatorSessionContext.Provider>
  );
}

/** The server's answer about the login, as the page read it when it opened. */
export function useOperatorSession(): SessionAnswer {
  return useContext(OperatorSessionContext);
}

/**
 * Why this page's role may not send this type of command, in pt-BR ("O papel Dados não
 * pode …"), or undefined when it may: always with the login off or for the Produtor.
 * A button sending it is greyed out with this as its tooltip; the server refuses the
 * command anyway, so this only spares the operator a press that would be refused.
 */
export function useWhyTheRoleCannotSend(
  commandType: Command['type'] | undefined,
): string | undefined {
  const { session } = useOperatorSession();
  if (commandType === undefined || session === null) {
    return undefined;
  }
  if (isCommandTypeOpenToTheRole(commandType, session.role)) {
    return undefined;
  }
  return describeWhyTheDataRoleCannotSend(commandType);
}

/**
 * Whether this page's role may send at least one of these command types: a keyboard
 * shortcut is switched off when it may send none of the commands its entry lists. An
 * empty list (a key that only changes the page, F1–F4) is always allowed.
 */
export function useMayTheRoleSendAnyOf(commandTypes: readonly Command['type'][]): boolean {
  const { session } = useOperatorSession();
  if (session === null || commandTypes.length === 0) {
    return true;
  }
  return commandTypes.some((commandType) => isCommandTypeOpenToTheRole(commandType, session.role));
}
