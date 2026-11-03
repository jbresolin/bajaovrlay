// Test support: the page's sample route (POST /api/v1/data-sources/http-json/sample-request)
// answering with the Baja app's answers, as the server would after fetching them. The
// answers are the shared fixtures of packages/shared/src/flexMapping/examples/bajaApp (real
// ones saved with curl, a few made up and labelled so). Each test builds its own fake
// fetch; nothing is shared.
import { vi } from 'vitest';

import teams26SE from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26SE.json';
import event26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/evento-26BR.json';
import event26BRDuringTheEvent from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/evento-26BR-during-the-event.made-up.json';
import enduroTable26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_END.json';
import enduroTableWithNoRankingColumn26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_END-no-ranking-column.made-up.json';
import enduroTableWithANullHeader26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_END-null-header.made-up.json';
import overall26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_GER.json';
import staticSafetyTableRankingNobody26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_SGE.json';
import superPrime26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/torneio-26BR_SPR.json';

/** The Baja app's answers the tests serve, by what each one is. */
export const bajaAppAnswers = {
  event26BR,
  event26BRDuringTheEvent,
  overall26BR,
  enduroTable26BR,
  enduroTableWithANullHeader26BR,
  enduroTableWithNoRankingColumn26BR,
  staticSafetyTableRankingNobody26BR,
  superPrime26BR,
  teams26SE,
};

/** An answer of the API outside 2xx, as the sample route hands it on (gate 2 of PR #38). */
export type SampleRouteFailure = { isAnswerOutside2xx: true; status: number; body: unknown };

/** The API's own 404s, as the real API answers them (saved with curl on 2026-11-02). */
export const bajaAppErrorAnswers = {
  /** resultado.php asked for a tournament (26BR_SPR). */
  tournamentAskedAsATable: buildSampleRouteFailure(404, {
    success: false,
    error: 'Este resultado é um torneio: use torneio.php.',
    code: 'wrong_type',
  }),
  /** An id the event does not have (26BR_ZZZ). */
  resultNotFound: buildSampleRouteFailure(404, {
    success: false,
    error: 'Resultado não encontrado neste evento.',
    code: 'not_found',
  }),
};

/** The source answering `status` with `body`, which the route hands on beside its sentence. */
export function buildSampleRouteFailure(status: number, body: unknown): SampleRouteFailure {
  return { isAnswerOutside2xx: true, status, body };
}

/**
 * What the fake sample route answers, keyed by the endpoint ("evento.php"), or by the
 * endpoint and the id asked ("resultado.php?id=26BR_SPR"), which wins over the endpoint.
 */
export type SampleAnswersByEndpoint = Record<string, unknown>;

/** Says whether a value given to the fake route stands for an answer outside 2xx. */
function isASampleRouteFailure(answer: unknown): answer is SampleRouteFailure {
  return typeof answer === 'object' && answer !== null && 'isAnswerOutside2xx' in answer;
}

/** The request the page posted to the sample route, as the route reads it. */
export type PostedSampleRequest = {
  requestId: string;
  url: string;
  queryParameters: Array<{ name: string; value: string }>;
};

/**
 * A fake fetch standing for the sample route: it reads the request the page posted and
 * answers `{ ok: true, status: 200, body }` with the answer of its id or its endpoint; for
 * a SampleRouteFailure, the route's sentence with the status and body handed on; and the
 * route's 404 sentence alone for an endpoint it was not given. Typed as fetch is called,
 * so a test can read what was posted.
 */
export function createSampleRouteAnswering(answersByEndpoint: SampleAnswersByEndpoint) {
  return vi.fn<(address: string, options?: RequestInit) => Promise<Response>>(
    async (_address, options) => {
      const posted = JSON.parse(String(options?.body)) as PostedSampleRequest;
      const endpoint = posted.url.split('/').pop() ?? '';
      const idAsked = posted.queryParameters.find((parameter) => parameter.name === 'id')?.value;
      const keyOfTheId = `${endpoint}?id=${idAsked ?? ''}`;
      const answerKey = Object.hasOwn(answersByEndpoint, keyOfTheId) ? keyOfTheId : endpoint;
      if (!Object.hasOwn(answersByEndpoint, answerKey)) {
        return Response.json({
          ok: false,
          error: `A fonte respondeu 404 (Not Found) em ${posted.requestId}`,
        });
      }
      const answer = answersByEndpoint[answerKey];
      if (isASampleRouteFailure(answer)) {
        return Response.json({
          ok: false,
          error: `A fonte respondeu ${String(answer.status)} (Not Found) em ${posted.requestId}`,
          answerOutside2xx: { status: answer.status, body: answer.body },
        });
      }
      return Response.json({ ok: true, status: 200, body: answer });
    },
  );
}

/** The requests a fake sample route was posted, in order. */
export function listPostedSampleRequests(
  sampleRoute: ReturnType<typeof createSampleRouteAnswering>,
): PostedSampleRequest[] {
  return sampleRoute.mock.calls.map(
    ([, options]) => JSON.parse(String(options?.body)) as PostedSampleRequest,
  );
}
