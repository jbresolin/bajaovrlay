// Entry point of the control page: asks the server whether it wants a login (BAJAOVRLAY-29)
// and, without a session while it does, draws only the login page "#/entrar". Otherwise
// builds the server-state store and the "Prévia automática" store, opens the one
// connection to the server, and mounts <App /> into index.html with all of them made
// available to it, together with the page's records of what the item editor is open for,
// of what "Edição rápida" works on and of the quick-fire tab shown.
import './index.css';

import type { SessionAnswer } from '@bajaovrlay/shared';
import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { App } from './App';
import { hashOfEachPage } from './app/currentPage';
import { AutoPreviewSettingProvider } from './features/autoPreview/AutoPreviewSettingProvider';
import { createAutoPreviewSettingStore } from './features/autoPreview/autoPreviewSettingStore';
import { ItemEditorTargetProvider } from './features/items/ItemEditorTargetProvider';
import { LoginPage } from './features/login/LoginPage';
import { goToTheLoginWhenTheSessionEnded } from './features/login/sessionEndedWatch';
import {
  goToTheConsoleAfterTheLogin,
  goToTheLoginPage,
  readSessionAnswerFromTheServer,
  sendLoginToTheServer,
} from './features/login/sessionRequests';
import { QuickEditChoiceProvider } from './features/playout/QuickEditChoiceProvider';
import { QuickFireTabChoiceProvider } from './features/quickFire/QuickFireTabChoiceProvider';
import { ptBR } from './i18n/ptBR';
import { browserPageReloadForNewBuild } from './state/browserPageReloadForNewBuild';
import { buildWebSocketAddress, openBrowserWebSocket } from './state/browserWebSocket';
import { consoleIdMemoryOfTheBrowserTab } from './state/consoleIdOfThisTab';
import { ControlPageStateProvider } from './state/ControlPageStateProvider';
import {
  OperatorSessionProvider,
  sessionAnswerWithTheLoginOff,
} from './state/operatorSessionContext';
import { connectToServer } from './state/serverConnection';
import { createServerStateStore } from './state/serverStateStore';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('index.html must contain an element with id "root"');
}

document.title = ptBR.app.title;

/** Draws the login page alone: no connection is opened, since the server would refuse it. */
function drawTheLoginPage(root: Root): void {
  window.history.replaceState(null, '', hashOfEachPage.login);
  root.render(
    <StrictMode>
      <LoginPage sendLogin={sendLoginToTheServer} onLoggedIn={goToTheConsoleAfterTheLogin} />
    </StrictMode>,
  );
}

/** Opens the connection and draws the page, for this session (or with the login off). */
function drawTheControlPage(root: Root, sessionAnswer: SessionAnswer): void {
  // A logged-in page sent to "#/entrar" (a bookmark) goes to the console instead.
  if (window.location.hash === hashOfEachPage.login) {
    window.history.replaceState(null, '', hashOfEachPage.console);
  }
  // Created here, outside React, so there is exactly one of each for the life of the
  // page: a redraw (or StrictMode's double draw in development) can never open a second
  // WebSocket.
  const serverStateStore = createServerStateStore();
  const serverConnection = connectToServer({
    webSocketAddress: buildWebSocketAddress(window.location),
    serverStateStore,
    openSocket: openBrowserWebSocket,
    // A hello naming another build reloads this tab (at most once per announced build), so
    // a tab left open across an upgrade does not go on with the old bundle.
    pageReloadForNewBuild: browserPageReloadForNewBuild,
    // A drop may be the server closing an ended session ("Sair" on another tab, the 18
    // hours over): then the page goes back to "#/entrar" (BAJAOVRLAY-29).
    onLineDropped: () =>
      void goToTheLoginWhenTheSessionEnded({
        readSessionAnswer: readSessionAnswerFromTheServer,
        goToTheLoginPage,
      }),
    // This tab's console id, kept in its sessionStorage: a reload is the same console, a
    // second tab another one (BAJAOVRLAY-69).
    consoleIdMemory: consoleIdMemoryOfTheBrowserTab,
  });
  // The one browser setting of the page, read from localStorage once, here, as the page
  // opens. Kept apart from the server-state store, which holds only what the server sent.
  const autoPreviewSettingStore = createAutoPreviewSettingStore();

  root.render(
    <StrictMode>
      <OperatorSessionProvider sessionAnswer={sessionAnswer}>
        <ControlPageStateProvider
          serverStateStore={serverStateStore}
          sendCommand={serverConnection.sendCommand}
        >
          <AutoPreviewSettingProvider autoPreviewSettingStore={autoPreviewSettingStore}>
            <ItemEditorTargetProvider>
              <QuickEditChoiceProvider>
                <QuickFireTabChoiceProvider>
                  <App />
                </QuickFireTabChoiceProvider>
              </QuickEditChoiceProvider>
            </ItemEditorTargetProvider>
          </AutoPreviewSettingProvider>
        </ControlPageStateProvider>
      </OperatorSessionProvider>
    </StrictMode>,
  );
}

/**
 * Asks the server about the login first. A server that does not answer is taken as one
 * with the login off: the page opens and redials, and once the server is back a refused
 * connection sends it to "#/entrar" (the drop's check above).
 */
async function openThePage(root: Root): Promise<void> {
  const sessionAnswer = (await readSessionAnswerFromTheServer()) ?? sessionAnswerWithTheLoginOff;
  const isLoginNeeded = sessionAnswer.isLoginRequired && sessionAnswer.session === null;
  if (isLoginNeeded) {
    drawTheLoginPage(root);
    return;
  }
  drawTheControlPage(root, sessionAnswer);
}

void openThePage(createRoot(rootElement));
