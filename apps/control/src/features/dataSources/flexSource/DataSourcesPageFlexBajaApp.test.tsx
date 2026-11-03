/**
 * The flex form with the Baja app's results API: "Testar" and the import round trip
 * (apps/control)
 *
 * What this module is for:
 *   BAJAOVRLAY-53 lets a flex source read the Baja app's public results API. The operator
 *   imports a config that uses its additions (lookups, alternatives, nested lists, table
 *   columns, a refusal flag, gaps from laps, incomplete matches, a refreshed request),
 *   pastes the API's answers into "Testar", and sees what the source would produce, or
 *   the sentence that refuses the answer.
 *
 * What these tests prove:
 *   - The doc's race ten minutes in, with the real 26BR teams, shows the session card and
 *     the three cars in the positions table.
 *   - The real 26BR overall table, joined with the real 26BR teams, shows the standings
 *     table, the leader by its short name "Poli".
 *   - The doc's 25SU table during spoilers shows exactly the refusal sentence, alone, and
 *     no problems list.
 *   - The real 25SU Super Prime shows its rounds in order with their match counts, the
 *     third place just before the final.
 *   - "Testar" asks for a sample of a lookup's request too (the teams).
 *   - Importing a config that uses every addition and exporting it right away gives back
 *     the very config.
 *
 * What these tests deliberately do not cover:
 *   - What each addition does to an answer: the shared applyFlexMapping*.test.ts files.
 *   - Each addition's controls one by one: DataSourcesPageFlexReadings.test.tsx and
 *     DataSourcesPageFlexMappingOptions.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { pressButton } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import { letThePageFinishWhatItStarted } from '@/state/controlPageOnFakeServer.testSupport';

import {
  bajaAppAnswerTexts,
  buildBajaAppConfigWithEveryAddition,
  buildBajaAppOverallConfig,
  buildBajaAppRaceConfig,
  buildBajaAppTournamentConfig,
  spoilersRefusalSentence,
} from './bajaAppExamples.testSupport';
import {
  importConfigText,
  openTheNewFlexForm,
  renderPageWithSources,
} from './flexFormOnThePage.testSupport';

/** Pastes an answer into the "Testar" sample box of one request. */
function pasteSampleOf(requestId: string, answerText: string): void {
  const testPanel = within(screen.getByRole('region', { name: 'Testar' }));
  const sampleBox = testPanel.getByLabelText(`Resposta de exemplo de ${requestId} (JSON)`);
  fireEvent.change(sampleBox, { target: { value: answerText } });
}

/** Opens the new flex form and imports a config into it. */
function openTheFormWithConfig(config: unknown): void {
  renderPageWithSources();
  openTheNewFlexForm();
  importConfigText(JSON.stringify(config, null, 2));
}

describe('"Testar" with the Baja app’s answers', () => {
  it('shows the doc race ten minutes in: the session card and its three cars', async () => {
    // Arrange: the race config, the doc's race and the real 26BR teams pasted.
    openTheFormWithConfig(buildBajaAppRaceConfig());
    pasteSampleOf('corrida', bajaAppAnswerTexts.raceTenMinutesIn00NE);
    pasteSampleOf('equipes', bajaAppAnswerTexts.teams26BR);

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: the session card and a header row plus three car rows.
    const result = within(screen.getByRole('region', { name: 'Resultado' }));
    expect(
      result.getByText('Enduro de teste'),
      'the session card must show the race',
    ).toBeInTheDocument();
    const positionsTable = result.getByRole('table', { name: 'Posições' });
    expect(
      within(positionsTable).getAllByRole('row'),
      'the table must show the three cars of the race',
    ).toHaveLength(4);
  });

  it('shows the real 26BR overall table, the leader by its short name', async () => {
    // Arrange: the overall config, the real 26BR table and teams pasted.
    openTheFormWithConfig(buildBajaAppOverallConfig());
    pasteSampleOf('resultado', bajaAppAnswerTexts.overall26BR);
    pasteSampleOf('equipes', bajaAppAnswerTexts.teams26BR);

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: the standings table, its first team named from the teams list.
    const result = within(screen.getByRole('region', { name: 'Resultado' }));
    const standingsTable = result.getByRole('table', { name: 'Classificação' });
    expect(
      within(standingsTable).getAllByRole('row')[1],
      'the leader must carry its short name from the teams list',
    ).toHaveTextContent('Poli');
  });

  it('shows exactly the spoilers sentence for the doc 25SU table, and no problems list', async () => {
    // Arrange: the overall config, the doc's 25SU table during spoilers and the teams.
    openTheFormWithConfig(buildBajaAppOverallConfig());
    pasteSampleOf('resultado', bajaAppAnswerTexts.overallDuringSpoilers25SU);
    pasteSampleOf('equipes', bajaAppAnswerTexts.teams26BR);

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: the refusal shows the sentence alone; no problems list, no table.
    expect(
      screen.getByRole('alert', { name: 'Resposta recusada' }),
      'the refusal must read as the operator’s sentence',
    ).toHaveTextContent(new RegExp(`^${spoilersRefusalSentence}$`));
    expect(
      screen.queryByRole('alert', { name: 'Problemas' }),
      'a refusal is not a list of problems',
    ).not.toBeInTheDocument();
  });

  it('lists the real 25SU Super Prime’s rounds, the third place before the final', async () => {
    // Arrange: the tournament config, the real 25SU Super Prime and its teams pasted (the
    // tournament's names are joined from them, gate 2 of PR #38).
    openTheFormWithConfig(buildBajaAppTournamentConfig());
    pasteSampleOf('torneio', bajaAppAnswerTexts.superPrime25SU);
    pasteSampleOf('equipes', bajaAppAnswerTexts.teams25SU);

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: each round with its count of matches, in the order the brackets hold them.
    const brackets = within(screen.getByRole('region', { name: 'Chaves' }));
    expect(
      brackets.getAllByRole('listitem').map((round) => round.textContent),
      'the rounds must come in order, the third place before the final',
    ).toEqual([
      'Oitavas de Final: 8 disputas',
      'Quartas de final: 4 disputas',
      'Semifinais: 2 disputas',
      'Disputa 3° lugar: 1 disputa',
      'Final: 1 disputa',
    ]);
  });

  it('asks for a sample of the teams request, which a lookup reads', async () => {
    // Arrange: the race config with only the race pasted.
    openTheFormWithConfig(buildBajaAppRaceConfig());
    pasteSampleOf('corrida', bajaAppAnswerTexts.raceTenMinutesIn00NE);

    // Act: press "Testar".
    pressButton('Testar');
    await letThePageFinishWhatItStarted();

    // Assert: the missing teams sample is named.
    expect(
      screen.getByRole('alert', { name: 'Problemas' }),
      'the lookup’s request must have its sample too',
    ).toHaveTextContent('Falta a resposta de exemplo de equipes');
  });
});

describe('"Importar" then "Exportar" with every addition', () => {
  it('gives back the very config imported', () => {
    // Arrange: the new flex form with the config that uses every addition imported.
    const config = buildBajaAppConfigWithEveryAddition();
    openTheFormWithConfig(config);

    // Act: export it.
    pressButton('Exportar configuração');

    // Assert: the box holds that very config.
    const exportedText = (
      screen.getByLabelText('Configuração (JSON para copiar)') as HTMLTextAreaElement
    ).value;
    expect(JSON.parse(exportedText), 'an export must round-trip every addition').toEqual(config);
  });
});
