import type { OpenedServerSocket, ServerSocketHandlers } from './serverConnection';

/**
 * Builds the server's WebSocket address from the page's own address: the same host and
 * port, `/ws`, and `wss` when the page was loaded over https. The page and the server
 * always share an origin (the server serves the page; in development Vite forwards /ws).
 */
export function buildWebSocketAddress(pageLocation: Pick<Location, 'protocol' | 'host'>): string {
  const webSocketProtocol = pageLocation.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${webSocketProtocol}//${pageLocation.host}/ws`;
}

/**
 * Opens a real browser WebSocket and reports to `handlers`. This is the only place the
 * control page touches the WebSocket API; everything above it works on the three
 * handlers, which is what lets tests replace the network with a fake.
 */
export function openBrowserWebSocket(
  address: string,
  handlers: ServerSocketHandlers,
): OpenedServerSocket {
  const webSocket = new WebSocket(address);
  webSocket.addEventListener('open', () => handlers.onOpen());
  webSocket.addEventListener('message', (event: MessageEvent<unknown>) =>
    handlers.onMessageText(event.data),
  );
  // A failed call fires `error` and then `close`; `close` alone drives the redialling.
  webSocket.addEventListener('close', () => handlers.onClose());

  return {
    send: (text) => webSocket.send(text),
    close: () => webSocket.close(),
  };
}
