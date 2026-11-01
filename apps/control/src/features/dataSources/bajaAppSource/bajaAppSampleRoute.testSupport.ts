// Test support: the page's sample route (POST /api/v1/data-sources/http-json/sample-request)
// answering with the Baja app's answers, as the server would after fetching them. The
// answers are the shared fixtures of packages/shared/src/flexMapping/examples/bajaApp (real
// ones saved with curl, one made-up event during its competition). Each test builds its own
// fake fetch; nothing is shared.
import { vi } from 'vitest';

import teams26SE from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26SE.json';
import event26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/evento-26BR.json';
import event26BRDuringTheEvent from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/evento-26BR-during-the-event.made-up.json';
import overall26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_GER.json';

/** The Baja app's answers the tests serve, by what each one is. */
export const bajaAppAnswers = {
  event26BR,
  event26BRDuringTheEvent,
  overall26BR,
  teams26SE,
};

/** What the fake sample route answers for each endpoint of the API ("evento.php"). */
export type SampleAnswersByEndpoint = Record<string, unknown>;

/** The request the page posted to the sample route, as the route reads it. */
export type PostedSampleRequest = {
  requestId: string;
  url: string;
  queryParameters: Array<{ name: string; value: string }>;
};

/**
 * A fake fetch standing for the sample route: it reads the request the page posted and
 * answers `{ ok: true, status: 200, body }` with the answer of its endpoint, or the
 * route's 404 sentence for an endpoint it was not given. Typed as fetch is called, so a
 * test can read what was posted.
 */
export function createSampleRouteAnswering(answersByEndpoint: SampleAnswersByEndpoint) {
  return vi.fn<(address: string, options?: RequestInit) => Promise<Response>>(
    async (_address, options) => {
      const posted = JSON.parse(String(options?.body)) as PostedSampleRequest;
      const endpoint = posted.url.split('/').pop() ?? '';
      if (!Object.hasOwn(answersByEndpoint, endpoint)) {
        return Response.json({
          ok: false,
          error: `A fonte respondeu 404 (Not Found) em ${posted.requestId}`,
        });
      }
      return Response.json({ ok: true, status: 200, body: answersByEndpoint[endpoint] });
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
