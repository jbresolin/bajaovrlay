/**
 * "Edição rápida": the mm:ss field of a graphic that is not a clock the page can follow (apps/control)
 *
 * What this module is for:
 *   For a clock on air the untouched time field of "Edição rápida" shows the time on
 *   screen, second by second (QuickEditPanelTimeOnScreen.test.tsx). The page decides
 *   "this is a clock" from the manifest alone: the update rule `carryClockForward` and a
 *   `v_baja.role` on each of the four clock fields. Every other graphic must be left
 *   exactly as it was: its mm:ss field shows what is on air and nothing ticks.
 *
 * What these tests prove:
 *   - A graphic that names no update rule (the lower third) shows its mm:ss field as it
 *     is on air, and the field does not move.
 *   - A graphic that names the rule but leaves one clock field unmarked behaves the
 *     same: its time field shows the reading on air and does not move.
 *
 * What these tests deliberately do not cover:
 *   - Every way a manifest can fall short of the contract: clockFieldsOfGraphic.test.ts
 *     has a row for each.
 *   - The clock that IS followed: QuickEditPanelTimeOnScreen.test.tsx.
 */
import type { Graphic } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildLowerThirdFixtureInstanceOnProgram } from '@/state/lowerThirdFixtureGraphic.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  holdAllTimeOnThePageAt,
  letTimePassAndThePageSettle,
  pressEditOnTheLayerRow,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

// The Saturday of the endurance race, in Brasília time: both graphics went on air at
// 9:45 and every test starts at 10:00, fifteen minutes later.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

/**
 * A pit-stop stopwatch whose author named the clock rule and marked the time, the
 * moment and the direction, but forgot the role on the "Contando" switch.
 */
function buildPitStopStopwatchGraphicWithOneRoleMissing(): Graphic {
  return {
    id: 'pit-stop-stopwatch',
    manifest: {
      id: 'baja-pit-stop-stopwatch',
      name: 'Cronômetro de box',
      main: 'pit-stop-stopwatch.js',
      v_baja: { updateRule: 'carryClockForward' },
      schema: {
        type: 'object',
        properties: {
          equipe: { type: 'string', title: 'Equipe' },
          sentido: {
            type: 'string',
            title: 'Sentido da contagem',
            enum: ['elapsed', 'remaining'],
            v_baja: { role: 'clockMode' },
          },
          tempoMs: {
            type: 'integer',
            title: 'Tempo de box',
            v_baja: { unit: 'ms', role: 'clockTime' },
          },
          momentoDaLeituraMs: {
            type: 'integer',
            title: 'Momento da leitura',
            v_baja: { role: 'wallClock' },
          },
          contando: { type: 'boolean', title: 'Contando' },
        },
        required: ['equipe', 'sentido', 'tempoMs', 'momentoDaLeituraMs', 'contando'],
      },
    },
    defaultLayerId: 'clock',
    category: 'clock',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

describe('the mm:ss field of a graphic the page cannot follow as a clock', () => {
  it('shows the lower third’s time on air as it is on air, and does not move', async () => {
    // Arrange: 10:00; Ana Souza's lower third went on air at 9:45 for 8 seconds on
    // screen, loaded with "Editar". The lower third names no update rule: it is not a clock.
    holdAllTimeOnThePageAt(tenOClock);
    renderQuickEditPanelWithTheseInstancesOnAir([
      buildLowerThirdFixtureInstanceOnProgram({
        id: 'e2b7c0d4-1a5f-4c3e-9b8d-6f0a2c4e8d15',
        layerId: 'lower-third',
        resolvedData: {
          nome: 'Ana Souza',
          equipe: 'baja-ufpr',
          duracaoMs: 8_000,
          destaque: false,
          numeroDoCarro: 42,
        },
        takenAt: quarterToTen,
      }),
    ]);
    pressEditOnTheLayerRow('Tarja');
    const textAtTenOClock = screen.getByLabelText<HTMLInputElement>('Tempo no ar').value;

    // Act: three seconds pass.
    await letTimePassAndThePageSettle(3000);

    // Assert: 0:08 before and after; the field is a plain duration.
    expect(textAtTenOClock, 'the duration must be the one on air').toBe('0:08');
    expect(
      screen.getByLabelText('Tempo no ar'),
      'a graphic without the clock rule must show its duration unchanged',
    ).toHaveValue('0:08');
  });

  it('shows the reading on air for a graphic that names the rule but leaves the running switch unmarked', async () => {
    // Arrange: 10:00; a pit-stop stopwatch on air since 9:45, counting from 12:34. Its
    // manifest names `carryClockForward` but gives the "Contando" switch no role, so
    // the page cannot tell which field says whether the clock runs. It is loaded with "Editar".
    holdAllTimeOnThePageAt(tenOClock);
    renderOnControlPageConnectedToFakeServer(
      <>
        <QuickEditPanel />
        <LayerStatusPanel />
      </>,
      {
        ...buildSlicesWithNothingOnAir(),
        graphics: [buildPitStopStopwatchGraphicWithOneRoleMissing()],
        instances: [
          {
            id: '5f1d8a30-7c2b-4e69-b4a1-0d9e3c7f2a48',
            layerId: 'clock',
            graphicId: 'pit-stop-stopwatch',
            target: 'program',
            resolvedData: {
              equipe: 'Baja UFPR',
              sentido: 'elapsed',
              tempoMs: 754_000,
              momentoDaLeituraMs: Date.parse(quarterToTen),
              contando: true,
            },
            currentStep: 0,
            status: 'on-air',
            takenAt: quarterToTen,
          },
        ],
      },
    );
    pressEditOnTheLayerRow('Relógio');
    const textAtTenOClock = screen.getByLabelText<HTMLInputElement>('Tempo de box').value;

    // Act: three seconds pass.
    await letTimePassAndThePageSettle(3000);

    // Assert: the field shows the 12:34 on air and stays there, as for any graphic. A
    // guessed clock would be worse than no clock.
    expect(textAtTenOClock, 'without all four roles the field must show the reading on air').toBe(
      '12:34',
    );
    expect(
      screen.getByLabelText('Tempo de box'),
      'without all four roles the field must not move',
    ).toHaveValue('12:34');
  });
});
