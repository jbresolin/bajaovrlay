// Entry point of the control page: builds the server-state store and the "Prévia
// automática" store, opens the one connection to the server, and mounts <App /> into
// index.html with all of them made available to it, together with the page's records of
// what the item editor is open for and of what "Edição rápida" works on.
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { AutoPreviewSettingProvider } from './features/autoPreview/AutoPreviewSettingProvider';
import { createAutoPreviewSettingStore } from './features/autoPreview/autoPreviewSettingStore';
import { ItemEditorTargetProvider } from './features/items/ItemEditorTargetProvider';
import { QuickEditChoiceProvider } from './features/playout/QuickEditChoiceProvider';
import { ptBR } from './i18n/ptBR';
import { buildWebSocketAddress, openBrowserWebSocket } from './state/browserWebSocket';
import { ControlPageStateProvider } from './state/ControlPageStateProvider';
import { connectToServer } from './state/serverConnection';
import { createServerStateStore } from './state/serverStateStore';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('index.html must contain an element with id "root"');
}

document.title = ptBR.app.title;

// Created here, outside React, so there is exactly one of each for the life of the
// page: a redraw (or StrictMode's double draw in development) can never open a second
// WebSocket.
const serverStateStore = createServerStateStore();
const serverConnection = connectToServer({
  webSocketAddress: buildWebSocketAddress(window.location),
  serverStateStore,
  openSocket: openBrowserWebSocket,
});
// The one browser setting of the page, read from localStorage once, here, as the page
// opens. Kept apart from the server-state store, which holds only what the server sent.
const autoPreviewSettingStore = createAutoPreviewSettingStore();

createRoot(rootElement).render(
  <StrictMode>
    <ControlPageStateProvider
      serverStateStore={serverStateStore}
      sendCommand={serverConnection.sendCommand}
    >
      <AutoPreviewSettingProvider autoPreviewSettingStore={autoPreviewSettingStore}>
        <ItemEditorTargetProvider>
          <QuickEditChoiceProvider>
            <App />
          </QuickEditChoiceProvider>
        </ItemEditorTargetProvider>
      </AutoPreviewSettingProvider>
    </ControlPageStateProvider>
  </StrictMode>,
);
