import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ptBR } from '@/i18n/ptBR';
import { useOperatorSession } from '@/state/operatorSessionContext';

import { goToTheLoginPage, sendLogoutToTheServer } from './sessionRequests';

const texts = ptBR.login;

/**
 * Who operates this page, in the header (BAJAOVRLAY-29): "Produtor · Mesa 1" and "Sair"
 * while the PINs are set; "Sem login", in amber with a hint saying how to turn the login
 * on, while they are not, so nobody forgets the page is open to the whole network. "Sair"
 * ends the session on the server first, then goes to "#/entrar". `logOut` and
 * `onLoggedOut` are the real ones unless a test hands in stand-ins.
 */
export function OperatorBadge(props: {
  logOut?: () => Promise<void>;
  onLoggedOut?: () => void;
}) {
  const { isLoginRequired, session } = useOperatorSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logOut = props.logOut ?? sendLogoutToTheServer;
  const onLoggedOut = props.onLoggedOut ?? goToTheLoginPage;

  if (!isLoginRequired || session === null) {
    return (
      <Badge variant="warning" title={texts.noLoginHint}>
        {texts.noLoginBadge}
      </Badge>
    );
  }

  async function logOutThenGoToTheLogin(): Promise<void> {
    setIsLoggingOut(true);
    await logOut();
    onLoggedOut();
  }

  return (
    <span className="flex items-center gap-2">
      <Badge variant="secondary">
        {texts.roleAtStation(texts.roleNames[session.role], session.station)}
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        disabled={isLoggingOut}
        onClick={() => void logOutThenGoToTheLogin()}
      >
        {texts.logOutButton}
      </Button>
    </span>
  );
}
