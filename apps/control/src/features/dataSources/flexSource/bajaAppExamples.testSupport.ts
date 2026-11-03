// Test support: the Baja app's results API as the flex form's tests paste and import it
// (BAJAOVRLAY-53). The answers are the shared fixtures of
// packages/shared/src/flexMapping/examples/bajaApp (real ones saved with curl, the doc's
// examples, one made-up bracket); the configs are the shared Baja app presets
// (BAJAOVRLAY-54). Every builder returns new objects.
import {
  bajaAppApiAddress,
  buildBajaAppBracketSourceConfig,
  buildBajaAppRaceSourceConfig,
  buildBajaAppResultsTableSourceConfig,
  type HttpJsonConfig,
  HttpJsonConfigSchema,
} from '@bajaovrlay/shared';

import raceTenMinutesIn00NE from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/corrida-00NE_ZZL.from-doc.json';
import teams25SU from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-25SU.json';
import teams26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26BR.json';
import overallDuringSpoilers25SU from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-25SU_GER-spoilers.from-doc.json';
import overall26BR from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/resultado-26BR_GER.json';
import superPrime25SU from '../../../../../../packages/shared/src/flexMapping/examples/bajaApp/torneio-25SU_SPR.json';

/** The Baja API's answers the tests paste into "Testar", as text, by what each one is. */
export const bajaAppAnswerTexts = {
  raceTenMinutesIn00NE: JSON.stringify(raceTenMinutesIn00NE),
  teams26BR: JSON.stringify(teams26BR),
  teams25SU: JSON.stringify(teams25SU),
  overall26BR: JSON.stringify(overall26BR),
  overallDuringSpoilers25SU: JSON.stringify(overallDuringSpoilers25SU),
  superPrime25SU: JSON.stringify(superPrime25SU),
};

/** 26BR's parts of the overall score, as an operator would pick them. */
const partHeadersOf26BR = ['Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'];

/** The words the spoilers refusal gives, as the brief writes them. */
export const spoilersRefusalSentence =
  'Resultado com spoilers ativos: a organização esconde as posições agora.';

/** The race preset on 26BR's Enduro: session and positions, names joined from the teams. */
export function buildBajaAppRaceConfig(): HttpJsonConfig {
  return buildBajaAppRaceSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    provaId: 'END',
    acceptsSimulatedRace: false,
  });
}

/** The results table preset on 26BR's overall table: by column, refused in spoilers. */
export function buildBajaAppOverallConfig(): HttpJsonConfig {
  return buildBajaAppResultsTableSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '26BR',
    resultadoId: '26BR_GER',
    pointsHeader: 'Total',
    partHeaders: partHeadersOf26BR,
    standingsScope: 'overall',
  });
}

/** The tournament preset on 25SU's Super Prime: rounds holding matches. */
export function buildBajaAppTournamentConfig(): HttpJsonConfig {
  return buildBajaAppBracketSourceConfig({
    apiAddress: bajaAppApiAddress,
    eventId: '25SU',
    resultadoId: '25SU_SPR',
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
