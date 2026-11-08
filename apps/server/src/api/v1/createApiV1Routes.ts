import { buildEventLogNamesFromSlices } from '@bajaovrlay/shared';
import { OpenAPIHono } from '@hono/zod-openapi';
import { bodyLimit } from 'hono/body-limit';

import { type ApiTokens, apiTurnedOff } from '../../core/apiAccess/apiTokens.js';
import { readFilteredEventLogPage } from '../../core/events/eventLogPages.js';
import type { ErrorAnswerBody } from '../../core/http/errorAnswers.js';
import type { ServerAppEnvironment } from '../../core/http/httpContextVariables.js';
import { ptBR } from '../../core/messages/ptBR.js';
import { type OperatorLogin } from '../../core/operatorLogin/operatorLogin.js';
import { middlewareForTheAccessOfRoute } from '../../core/operatorLogin/routeAccess.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  buildInvalidSampleRequestAnswer,
  fetchSampleOfHttpJsonRequest,
  findDataSnapshotAnswer,
  getDataSnapshotRoute,
  noSourceHostAllowlist,
  postHttpJsonSampleRequestRoute,
  type ReadEnvironmentVariable,
  readServerEnvironmentVariable,
  type SourceHostAllowlist,
} from '../../modules/dataSources/index.js';
import {
  buildSimulatorTeamsAsEntities,
  getSimulatorTeamsRoute,
  simulatorTeamsNotice,
} from '../../modules/entities/index.js';
import {
  buildFileMissingAnswer,
  buildFileTooLargeAnswer,
  buildUploadFromAnotherSiteAnswer,
  isUploadFromAnotherSite,
  largestMediaUploadBodyInBytes,
  postMediaRoute,
  readUploadedFile,
  storeUploadedImage,
} from '../../modules/media/index.js';
import { getEventLogRoute } from './eventLogRoute.js';
import { mountButtonStateRoutes } from './mountButtonStateRoutes.js';
import { mountCommandApiRoutes } from './mountCommandApiRoutes.js';
import { mountSessionRoutes } from './sessionRoutes.js';
import { chooseSlicesForStateReader, getStateRoute } from './stateRoute.js';

/**
 * Builds every route under /api/v1 and the OpenAPI document generated from their Zod
 * schemas, served at /api/v1/openapi.json. Routes stay thin: parse, authorise, call.
 */
export function createApiV1Routes(options: {
  stateStore: StateStore;
  version: string;
  /** How the sample route reads BAJAOVRLAY_SOURCE_ variables; process.env when left out. */
  readSourceEnvironmentVariable?: ReadEnvironmentVariable | undefined;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot, for the sample route; no list when left out. */
  sourceHostAllowlist?: SourceHostAllowlist | undefined;
  /** The sample route's timeout; 10 s when left out (tests shorten it). */
  sampleRequestTimeoutInMilliseconds?: number | undefined;
  /** DATA_DIR/media, where uploads are written; no upload route when left out. */
  mediaFolder?: string | undefined;
  /** BAJAOVRLAY_API_TOKENS as read at boot; the command API is off when left out. */
  apiTokens?: ApiTokens | undefined;
  /** BAJAOVRLAY_API_OPEN as read at boot: the command API with no token; not open when left out. */
  isApiOpenToTheNetwork?: boolean | undefined;
  /** BAJAOVRLAY_PUBLIC_ORIGINS as read at boot: a proxy's pages that may upload; none when left out. */
  publicOrigins?: readonly string[] | undefined;
  /** The operator login (BAJAOVRLAY-29); with the login off every page read is open. */
  operatorLogin: OperatorLogin;
}): OpenAPIHono<ServerAppEnvironment> {
  const readSourceEnvironmentVariable =
    options.readSourceEnvironmentVariable ?? readServerEnvironmentVariable;
  const apiRoutes = new OpenAPIHono<ServerAppEnvironment>();
  // The command API (BAJAOVRLAY-28) is always mounted, so with no tokens it answers 403
  // with how to turn it on rather than 404.
  const commandApiAccess = {
    stateStore: options.stateStore,
    apiTokens: options.apiTokens ?? apiTurnedOff,
    isOpenToTheNetwork: options.isApiOpenToTheNetwork ?? false,
  };
  // Who may call each route is written once, in core/operatorLogin/routeAccess.ts; every
  // route below takes its middleware from there (BAJAOVRLAY-29).
  const routeAccessOptions = { ...commandApiAccess, operatorLogin: options.operatorLogin };
  /** The route with the middleware its row of the access table asks for. */
  function withItsAccess<Route extends { method: string; path: string }>(route: Route) {
    return { ...route, middleware: middlewareForTheAccessOfRoute(route, routeAccessOptions) };
  }

  // GET, POST and DELETE /session: the login, open to everyone (BAJAOVRLAY-29).
  mountSessionRoutes(apiRoutes, options.operatorLogin);

  apiRoutes.openapi(
    withItsAccess(getStateRoute),
    (context) => {
      const query = context.req.valid('query');
      const slices = chooseSlicesForStateReader(options.stateStore.readAllSlices(), query);
      return context.json(slices, 200);
    },
    // The only thing the query can get wrong is the role; the answer says which exist,
    // in the same JSON error shape as every other refusal, not Zod's own report.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      const body: ErrorAnswerBody = {
        error: { code: 'INVALID_STATE_ROLE', message: ptBR.errors.invalidStateRole },
      };
      return context.json(body, 400);
    },
  );

  apiRoutes.openapi(withItsAccess(getDataSnapshotRoute), (context) => {
    const { sourceId } = context.req.valid('param');
    const answer = findDataSnapshotAnswer(options.stateStore.readAllSlices(), sourceId);
    if (!answer.isFound) {
      return context.json(answer.errorBody, 404);
    }
    return context.json(answer.snapshot, 200);
  });

  apiRoutes.openapi(
    withItsAccess(postHttpJsonSampleRequestRoute),
    async (context) => {
      const request = context.req.valid('json');
      const answer = await fetchSampleOfHttpJsonRequest(request, {
        readEnvironmentVariable: readSourceEnvironmentVariable,
        sourceHostAllowlist: options.sourceHostAllowlist ?? noSourceHostAllowlist,
        logger: context.get('requestLogger'),
        timeoutInMilliseconds: options.sampleRequestTimeoutInMilliseconds,
      });
      return context.json(answer, 200);
    },
    // The config schema words every refusal in pt-BR; the first one is sent as it is.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      const firstIssueMessage = validation.error.issues[0]?.message;
      return context.json(buildInvalidSampleRequestAnswer(firstIssueMessage), 400);
    },
  );

  apiRoutes.openapi(withItsAccess(getSimulatorTeamsRoute), (context) => {
    return context.json(
      { notice: simulatorTeamsNotice, teams: buildSimulatorTeamsAsEntities() },
      200,
    );
  });

  const mediaFolder = options.mediaFolder;
  if (mediaFolder !== undefined) {
    // The body is refused before it is read in full when it is far over the limit, so a
    // runaway upload cannot fill the server's memory; the image itself is held to 5 MB
    // exactly by storeUploadedImage.
    apiRoutes.use(
      '/media',
      bodyLimit({
        maxSize: largestMediaUploadBodyInBytes,
        onError: (context) => context.json(buildFileTooLargeAnswer(), 413),
      }),
    );
    apiRoutes.openapi(withItsAccess(postMediaRoute), async (context) => {
      // A page of another site must not upload through the operator's browser; with the
      // login on, SameSite=Strict already keeps the session cookie from such a request.
      const isFromAnotherSite = isUploadFromAnotherSite(
        context.req.header('origin'),
        context.req.url,
        options.publicOrigins ?? [],
      );
      if (isFromAnotherSite) {
        return context.json(buildUploadFromAnotherSiteAnswer(), 403);
      }
      const upload = await readUploadedFile(context);
      if (upload === undefined) {
        return context.json(buildFileMissingAnswer(), 400);
      }
      const outcome = storeUploadedImage(upload, { stateStore: options.stateStore, mediaFolder });
      if (!outcome.isStored) {
        return context.json(outcome.body, outcome.httpStatus);
      }
      return context.json(outcome.answer, 200);
    });
  }

  mountCommandApiRoutes(apiRoutes, commandApiAccess);
  // The D200's per-button status URLs (BAJAOVRLAY-56), behind the same access.
  mountButtonStateRoutes(apiRoutes, commandApiAccess);

  // The history's older pages (BAJAOVRLAY-30): the control page reads them as it reads
  // /state; anyone else goes through the command API's access rules.
  apiRoutes.openapi(
    withItsAccess(getEventLogRoute),
    (context) => {
      const query = context.req.valid('query');
      const page = readFilteredEventLogPage(
        options.stateStore.readEventLogEntriesBelow,
        buildEventLogNamesFromSlices(options.stateStore.readAllSlices()),
        query,
      );
      return context.json(page, 200);
    },
    // A limit, a row id or a filter value it cannot read: one pt-BR sentence saying what
    // the query takes, in the error shape every refusal has.
    (validation, context) => {
      if (validation.success) {
        return undefined;
      }
      const body: ErrorAnswerBody = {
        error: { code: 'INVALID_EVENT_LOG_QUERY', message: ptBR.errors.invalidEventLogQuery },
      };
      return context.json(body, 400);
    },
  );

  apiRoutes.doc31('/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'BajaOvrLay server API', version: options.version },
    // Paths in the document are relative to this mount point.
    servers: [{ url: '/api/v1' }],
  });

  return apiRoutes;
}
