// Test support for the sample route (POST /api/v1/data-sources/http-json/sample-request):
// the server app on a fresh store, the example request and the post the page makes.
// Shared by httpJsonSampleRoute.test.ts and httpJsonSampleRouteHostAllowlist.test.ts.
// Functions and constants only; nothing is shared or mutated between tests.
import { openTemporaryDatabase } from '../../core/db/temporaryDatabase.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { operatorLoginOff } from '../../core/operatorLogin/operatorLoginOff.testSupport.js';
import { missingGraphicsFolderPath } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';
import type { SourceHostAllowlist } from './adapters/httpJson/sourceHostAllowlist.js';

/** Where the sample route answers. */
export const sampleRoutePath = '/api/v1/data-sources/http-json/sample-request';

/** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS=127.0.0.1: the test timing system, on any port. */
export const allowlistOfTheTestTimingSystem: SourceHostAllowlist = {
  isSet: true,
  allowedHosts: [{ hostName: '127.0.0.1', port: undefined }],
};

/** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS=cronometragem.local:8080: the LAN timing system only. */
export const allowlistOfTheLanTimingSystemOnly: SourceHostAllowlist = {
  isSet: true,
  allowedHosts: [{ hostName: 'cronometragem.local', port: '8080' }],
};

/**
 * Builds the server app on a fresh store, reading BAJAOVRLAY_SOURCE_ variables from
 * `environment`, with the logger and the sample timeout a test chooses. Its host list
 * allows the test timing system (127.0.0.1) unless the test hands in another.
 */
export function createServerAppForSampleRequests(
  options: {
    environment?: Record<string, string>;
    logger?: ServerLogger;
    sampleRequestTimeoutInMilliseconds?: number;
    sourceHostAllowlist?: SourceHostAllowlist;
  } = {},
) {
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const { database } = openTemporaryDatabase();
  const stateStore = createStateStore({
    database,
    logger,
    graphicPackagesFolder: missingGraphicsFolderPath,
  });
  const environment = options.environment ?? {};
  const app = createServerApp({
    operatorLogin: operatorLoginOff,
    logger,
    version: '0.3.1',
    stateStore,
    readSourceEnvironmentVariable: (variableName) => environment[variableName],
    sourceHostAllowlist: options.sourceHostAllowlist ?? allowlistOfTheTestTimingSystem,
    sampleRequestTimeoutInMilliseconds: options.sampleRequestTimeoutInMilliseconds,
  });
  return { app, database, stateStore };
}

/** The request "classificacao" of the example preset, pointed at the test timing system. */
export function buildClassificationRequestAt(baseUrl: string) {
  return {
    requestId: 'classificacao',
    url: `${baseUrl}/cronometragem/classificacao`,
    headers: [{ name: 'Accept', value: 'application/json' }],
    queryParameters: [{ name: 'etapa', value: 'nacional-2027' }],
  };
}

/** Posts a request config to the sample route, as the page's "Buscar da fonte" does. */
export async function postSampleRequest(
  app: ReturnType<typeof createServerAppForSampleRequests>['app'],
  request: unknown,
) {
  const response = await app.request(sampleRoutePath, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json();
  return { status: response.status, body };
}
