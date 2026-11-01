// Test support: the Baja app's results API as the flex form's tests paste and import it
// (BAJAOVRLAY-53). The answers are the shared fixtures of
// packages/shared/src/flexMapping/examples/bajaApp (real ones saved with curl, the doc's
// examples, one made-up bracket); the mappings are the shared draft presets, which
// BAJAOVRLAY-54 will turn into the real ones. Every builder returns new objects.
import { type HttpJsonConfig, HttpJsonConfigSchema } from '@bajaovrlay/shared';

import {
  buildDraftOverallMappings,
  buildDraftRaceMappings,
  buildDraftTournamentMappings,
} from '../../../../../../packages/shared/src/flexMapping/bajaAppDraftPresets.testSupport';
import raceTenMinutesIn00NE from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/corrida-00NE_ZZL.from-doc.json';
import teams26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26BR.json';
import overallDuringSpoilers25SU from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-25SU_GER-spoilers.from-doc.json';
import overall26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_GER.json';
import superPrime25SU from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/torneio-25SU_SPR.json';

/** The Baja API's answers the tests paste into "Testar", as text, by what each one is. */
export const bajaAppAnswerTexts = {
  raceTenMinutesIn00NE: JSON.stringify(raceTenMinutesIn00NE),
  teams26BR: JSON.stringify(teams26BR),
  overall26BR: JSON.stringify(overall26BR),
  overallDuringSpoilers25SU: JSON.stringify(overallDuringSpoilers25SU),
  superPrime25SU: JSON.stringify(superPrime25SU),
};

/** 26BR's parts of the overall score, as an operator would pick them. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

/** The words the spoilers refusal gives, as the brief writes them. */
export const spoilersRefusalSentence =
  'Resultado com spoilers ativos: a organização esconde as posições agora.';

/** One GET of the Baja API, the teams refreshed every 10 minutes. */
function buildBajaAppRequest(requestId: string, address: string) {
  const request = { requestId, url: `https://api.bajasaebrasil.net/resultados/${address}` };
  return requestId === 'equipes' ? { ...request, refreshEveryMs: 600_000 } : request;
}

/** The race as session and positions, its names joined from the teams. */
export function buildBajaAppRaceConfig(): HttpJsonConfig {
  return HttpJsonConfigSchema.parse({
    requests: [
      buildBajaAppRequest('corrida', 'corrida.php?evt=26BR&p=END'),
      buildBajaAppRequest('equipes', 'equipes.php?evt=26BR'),
    ],
    mappings: buildDraftRaceMappings(),
  });
}

/** The overall table as standings: by column, joined with the teams, refused in spoilers. */
export function buildBajaAppOverallConfig(): HttpJsonConfig {
  return HttpJsonConfigSchema.parse({
    requests: [
      buildBajaAppRequest('resultado', 'resultado.php?evt=26BR&id=26BR_GER'),
      buildBajaAppRequest('equipes', 'equipes.php?evt=26BR'),
    ],
    mappings: buildDraftOverallMappings(partHeadersOf26BR),
  });
}

/** The Super Prime as brackets: rounds holding matches, pending sides incomplete. */
export function buildBajaAppTournamentConfig(): HttpJsonConfig {
  return HttpJsonConfigSchema.parse({
    requests: [buildBajaAppRequest('torneio', 'torneio.php?evt=25SU&id=25SU_SPR')],
    mappings: buildDraftTournamentMappings(),
  });
}

/**
 * Every addition of BAJAOVRLAY-53 in one config, for the import and export round trip:
 * the three Baja configs' requests and mappings together, each request once.
 */
export function buildBajaAppConfigWithEveryAddition(): HttpJsonConfig {
  const configs = [
    buildBajaAppRaceConfig(),
    buildBajaAppOverallConfig(),
    buildBajaAppTournamentConfig(),
  ];
  const requests: HttpJsonConfig['requests'] = [];
  for (const request of configs.flatMap((config) => config.requests)) {
    const isAlreadyListed = requests.some((listed) => listed.requestId === request.requestId);
    if (!isAlreadyListed) {
      requests.push(request);
    }
  }
  const mappings = configs.flatMap((config) => config.mappings);
  return HttpJsonConfigSchema.parse({ requests, mappings });
}
