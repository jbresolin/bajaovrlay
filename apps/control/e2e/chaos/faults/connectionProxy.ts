// Test support (chaos suite): a TCP proxy that stands between one browser page and the
// real server, so a scenario can break that page's connection the way a flaky studio
// network does, while every other page and the server carry on untouched. It forwards
// bytes, never reads them, so the HTTP requests and the WebSocket pass through it exactly
// as they would reach the server. It is the one place the suite cuts a connection; no
// switch of the kind exists in the server or the pages.
//
// A connection counts as a WebSocket when its first bytes from the page ask for an upgrade
// ("Upgrade: websocket"); every other connection is plain HTTP (the page, its scripts,
// GET /api/v1/state).
import { createServer, type Server, Socket } from 'node:net';

/** One connection the proxy carries: the page's side, the server's side, what it is. */
type CarriedConnection = {
  pageSide: Socket;
  serverSide: Socket;
  isWebSocket: boolean;
  /** Bytes from the page held back while the page-to-server direction is held. */
  heldFromThePage: Buffer[];
  /** Bytes from the server held back while the server-to-page direction is held. */
  heldFromTheServer: Buffer[];
};

/** A started proxy: its address, its switches, and how to stop it. */
export type ConnectionProxy = {
  /** Where the page is opened instead of the server: `http://127.0.0.1:<port>`. */
  address: string;
  /** How many WebSocket connections are open through it right now. */
  countOpenWebSockets: () => number;
  /** Cuts every open WebSocket at once, as a cable pulled out does; new ones may connect. */
  dropWebSockets: () => void;
  /**
   * Holds every byte the server sends on a WebSocket, open or new, from now on: the page
   * hears nothing, the connection stays open (a stalled network). `release` lets them through.
   */
  holdWhatTheServerSends: () => void;
  /** Holds every byte the page sends on a WebSocket from now on; the server hears nothing. */
  holdWhatThePageSends: () => void;
  /**
   * How many chunks of bytes from the page are held now: above 0 once the page has sent
   * something (a command) that the server has not heard.
   */
  countChunksHeldFromThePage: () => number;
  /** Lets every held byte through, in order, and stops holding. */
  release: () => void;
  /** The page offline: every connection cut and every new one refused until `goOnline`. */
  goOffline: () => void;
  /** The page back online: new connections are carried again. */
  goOnline: () => void;
  /** Cuts everything and stops listening. */
  stop: () => Promise<void>;
};

const upgradeToWebSocketPattern = /upgrade:\s*websocket/i;

/**
 * Starts a proxy on `proxyPort` of 127.0.0.1 that carries every connection to the server
 * on `serverPort`. Resolves once it is listening. The server may be down: a connection
 * made then is simply closed, as the server's own closed port would close it.
 */
export async function startConnectionProxy(
  proxyPort: number,
  serverPort: number,
): Promise<ConnectionProxy> {
  const carriedConnections = new Set<CarriedConnection>();
  let isOffline = false;
  let isHoldingWhatTheServerSends = false;
  let isHoldingWhatThePageSends = false;

  function cutConnection(connection: CarriedConnection): void {
    connection.pageSide.destroy();
    connection.serverSide.destroy();
    carriedConnections.delete(connection);
  }

  function carryConnection(pageSide: Socket): void {
    if (isOffline) {
      pageSide.destroy();
      return;
    }
    const serverSide = new Socket();
    const connection: CarriedConnection = {
      pageSide,
      serverSide,
      isWebSocket: false,
      heldFromThePage: [],
      heldFromTheServer: [],
    };
    carriedConnections.add(connection);
    let hasSeenTheFirstBytes = false;

    pageSide.on('data', (bytes: Buffer) => {
      if (!hasSeenTheFirstBytes) {
        hasSeenTheFirstBytes = true;
        connection.isWebSocket = upgradeToWebSocketPattern.test(bytes.toString('latin1'));
      }
      if (connection.isWebSocket && isHoldingWhatThePageSends) {
        connection.heldFromThePage.push(bytes);
        return;
      }
      serverSide.write(bytes);
    });
    serverSide.on('data', (bytes: Buffer) => {
      if (connection.isWebSocket && isHoldingWhatTheServerSends) {
        connection.heldFromTheServer.push(bytes);
        return;
      }
      pageSide.write(bytes);
    });
    // Either side closing or failing closes the other, as a dead link would.
    pageSide.on('close', () => cutConnection(connection));
    serverSide.on('close', () => cutConnection(connection));
    pageSide.on('error', () => cutConnection(connection));
    serverSide.on('error', () => cutConnection(connection));
    serverSide.connect(serverPort, '127.0.0.1');
  }

  const server: Server = createServer(carryConnection);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(proxyPort, '127.0.0.1', () => resolve());
  });

  function listWebSockets(): CarriedConnection[] {
    return [...carriedConnections].filter((connection) => connection.isWebSocket);
  }

  return {
    address: `http://127.0.0.1:${String(proxyPort)}`,
    countOpenWebSockets: () => listWebSockets().length,
    dropWebSockets: () => {
      for (const connection of listWebSockets()) {
        cutConnection(connection);
      }
    },
    holdWhatTheServerSends: () => {
      isHoldingWhatTheServerSends = true;
    },
    holdWhatThePageSends: () => {
      isHoldingWhatThePageSends = true;
    },
    countChunksHeldFromThePage: () => {
      let chunkCount = 0;
      for (const connection of carriedConnections) {
        chunkCount += connection.heldFromThePage.length;
      }
      return chunkCount;
    },
    release: () => {
      isHoldingWhatTheServerSends = false;
      isHoldingWhatThePageSends = false;
      for (const connection of carriedConnections) {
        for (const bytes of connection.heldFromThePage) {
          connection.serverSide.write(bytes);
        }
        for (const bytes of connection.heldFromTheServer) {
          connection.pageSide.write(bytes);
        }
        connection.heldFromThePage = [];
        connection.heldFromTheServer = [];
      }
    },
    goOffline: () => {
      isOffline = true;
      for (const connection of [...carriedConnections]) {
        cutConnection(connection);
      }
    },
    goOnline: () => {
      isOffline = false;
    },
    stop: async () => {
      for (const connection of [...carriedConnections]) {
        cutConnection(connection);
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
