/**
 * What the preview page shows (packages/graphics/battle-card)
 *
 * What this module is for:
 *   preview.html shows the battle card without a server: the 30ª Competição's closest
 *   enduro battle by default, the trend set by hand from `?trend=`, or any data in
 *   `?data=`; and "Atualizar" sends the next lap's reading.
 *
 * What these tests prove:
 *   - With no address data the sample is Imperador (8) 4th ahead of Equipe FEI Baja (1)
 *     5th, 2,0 s apart at lap 1, with no trend set by hand.
 *   - `?trend=closing|opening|steady` sets that trend by hand with the design's 0,7 s;
 *     another word is ignored.
 *   - `?data=` is passed through as parsed JSON, and unreadable JSON gives a pt-BR problem.
 *   - The laps of the readings grow by one each, so every press is a completed lap, and the
 *     trend the graphic works out from them goes opening, closing, opening, closing,
 *     closing (the design's motion demo, then a number change under the same word).
 *
 * What these tests deliberately do not cover:
 *   - The page itself (buttons, stage); the Playwright suites open it.
 */
import { describe, expect, it } from 'vitest';

import { chooseTrendToShow, emptyTrendMemory, followGapReading } from './battleTrend.js';
import {
  choosePreviewData,
  createImperadorAndFeiSample,
  listPreviewLapReadings,
} from './previewData.js';

describe('choosePreviewData', () => {
  it('shows the sample battle when the address has no data', () => {
    // Arrange: an address with only the stage.
    const addressQuery = '?stage=grey';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the sample, with nothing set by hand.
    expect(choice, 'the default must be the sample battle').toEqual({
      isReadable: true,
      data: createImperadorAndFeiSample(),
    });
  });

  const trendScenarios = [
    // The design's sheet-battle page, one trend at a time.
    { query: '?trend=closing', manualTrend: 'closing' },
    { query: '?trend=opening', manualTrend: 'opening' },
    { query: '?trend=steady', manualTrend: 'steady' },
  ];

  it.each(trendScenarios)('sets $manualTrend by hand for $query', ({ query, manualTrend }) => {
    // Arrange: the address of this row.

    // Act: choose the data.
    const choice = choosePreviewData(query);

    // Assert: the sample with that trend and the design's 0,7 s.
    expect(choice, 'the trend must be set by hand with 0,7 s').toEqual({
      isReadable: true,
      data: { ...createImperadorAndFeiSample(), manualTrend, manualTrendChangeMs: 700 },
    });
  });

  it('ignores a trend word it does not know', () => {
    // Arrange: a misspelt trend.
    const addressQuery = '?trend=fechando';

    // Act: choose the data.
    const choice = choosePreviewData(addressQuery);

    // Assert: the plain sample.
    expect(choice, 'an unknown trend must be ignored').toEqual({
      isReadable: true,
      data: createImperadorAndFeiSample(),
    });
  });

  it('passes ?data= through and refuses unreadable JSON in pt-BR', () => {
    // Arrange: one readable and one broken address.
    const readableQuery = `?data=${encodeURIComponent(JSON.stringify({ gapMs: 900 }))}`;
    const brokenQuery = '?data=%7Bnot-json';

    // Act: choose the data of each.
    const choices = [choosePreviewData(readableQuery), choosePreviewData(brokenQuery)];

    // Assert: the JSON as given, then the problem.
    expect(choices, 'data must pass through; broken JSON gives a problem').toEqual([
      { isReadable: true, data: { gapMs: 900 } },
      { isReadable: false, problem: 'O parâmetro ?data= do endereço não é um JSON válido.' },
    ]);
  });
});

describe('listPreviewLapReadings', () => {
  it('gives one completed lap a press, with the trends of the design’s motion demo', () => {
    // Arrange: the sample's first reading, as load takes it.
    const sample = createImperadorAndFeiSample();
    let memory = followGapReading(emptyTrendMemory, {
      aheadCarNumber: 8,
      behindCarNumber: 1,
      behindLaps: sample.behindLaps,
      gapMs: sample.gapMs,
    });

    // Act: follow every reading and note the trend words and the laps.
    const trendWords: string[] = [];
    const behindLaps: number[] = [];
    for (const reading of listPreviewLapReadings()) {
      memory = followGapReading(memory, {
        aheadCarNumber: 8,
        behindCarNumber: 1,
        behindLaps: reading.behindLaps,
        gapMs: reading.gapMs,
      });
      trendWords.push(chooseTrendToShow(memory, {}).word);
      behindLaps.push(reading.behindLaps);
    }

    // Assert: a lap a press, and the demo's trends.
    expect(behindLaps, 'every press must be one more lap').toEqual([2, 3, 4, 5, 6]);
    expect(trendWords, 'the trends must follow the design’s demo').toEqual([
      'opening',
      'closing',
      'opening',
      'closing',
      'closing',
    ]);
  });
});
