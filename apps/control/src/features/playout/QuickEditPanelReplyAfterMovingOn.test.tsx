/**
 * "Edição rápida" when the server's reply comes after the operator moved on (apps/control)
 *
 * What this module is for:
 *   An accepted "Colocar no ar" (or "Prévia" of a loaded preview) makes the panel edit
 *   the instance it has just made. The reply takes a moment, and in that moment the
 *   operator may already have pressed "Editar" on another "Camadas" row. João's rule
 *   (gate 2 of BAJAOVRLAY-36): the panel must never retarget after the operator has moved
 *   on. So the panel notes what it worked on when the command was sent (the form's load
 *   number and the loaded instance's id) and moves to the new instance only if that is
 *   still what it works on when the reply comes.
 *
 * What these tests prove:
 *   - "Colocar no ar" from a new entry, then "Editar" on the "Tarja" row before the
 *     reply: once the take is accepted the heading still names the "Tarja" clock, and
 *     "Atualizar" still goes to that clock's id.
 *
 * What these tests deliberately do not cover:
 *   - The reply that comes while nothing changed, which does move the panel to its new
 *     instance: QuickEditPanelTarget.test.tsx.
 *   - The same rule for "Prévia" of a loaded preview: it goes through the very same
 *     compare-and-set (useQuickEditCommands.ts), so one press is enough to prove it.
 */
import type { Instance } from '@bajaovrlay/shared';
import { act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  readQuickEditHeader,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// Saturday of the endurance race: the qualifying clock went on air on "Tarja" at 10:05,
// and the operator's new clock goes on "Relógio" at 10:20.
const momentTheQualifyingClockWentOnAir = '2026-10-10T13:05:00.000Z';
const momentOfTheNewTake = '2026-10-10T13:20:00.000Z';
const idOfTheQualifyingClock = '5e8b0d24-7a19-4c3f-96e2-0b1d8f4a7c55';
const idOfTheClockTheTakeMakes = 'a90c2e61-1f4b-4d7e-b3a8-6c5d4e3f2a10';

/** The qualifying clock on the "Tarja" layer, under yellow, stopped at 10:00 remaining. */
function buildQualifyingClockOnTheLowerThirdLayer(): Instance {
  return {
    ...buildRaceClockInstanceHoldingThisData(
      {
        sessionName: 'Classificação',
        state: 'yellow',
        clockMode: 'remaining',
        referenceTimeMs: 600_000,
        referenceWallClockMs: Date.parse(momentTheQualifyingClockWentOnAir),
        running: false,
      },
      momentTheQualifyingClockWentOnAir,
    ),
    id: idOfTheQualifyingClock,
    layerId: 'lower-third',
  };
}

/** The race clock the operator's "Colocar no ar" puts on the "Relógio" layer. */
function buildClockTheTakeMakesOnTheClockLayer(): Instance {
  return {
    ...buildRaceClockInstanceHoldingThisData(
      {
        sessionName: 'Enduro de Resistência',
        state: 'pre',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        referenceWallClockMs: Date.parse(momentOfTheNewTake),
        running: false,
      },
      momentOfTheNewTake,
    ),
    id: idOfTheClockTheTakeMakes,
  };
}

/** Lets the page finish what the server's last message started (the reply's follow-up). */
async function letThePageHandleTheReply(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('"Edição rápida" when the reply comes after "Editar" on another row', () => {
  it('keeps editing the row the operator chose, not the instance the take made', async () => {
    // Arrange: the qualifying clock on "Tarja"; the panel is a new entry of the race
    // clock on "Relógio". "Colocar no ar" is pressed and the server holds its reply.
    const { fakeServer } = renderQuickEditPanelWithTheseInstancesOnAir([
      buildQualifyingClockOnTheLowerThirdLayer(),
    ]);
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Act: before the reply, the operator presses "Editar" on the "Tarja" row; then the
    // server puts the new clock on "Relógio" and answers ok.
    pressEditOnTheLayerRow('Tarja');
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [buildQualifyingClockOnTheLowerThirdLayer(), buildClockTheTakeMakesOnTheClockLayer()],
    });
    fakeServer.acceptLastCommand();
    await letThePageHandleTheReply();
    typeIntoField('Título', 'Classificação — Bateria 2');
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the heading still names the "Tarja" clock, and "Atualizar" goes to it.
    expect(
      readQuickEditHeader(),
      'a reply that comes after "Editar" on another row must not move the panel',
    ).toBe('Editando: Tarja · Relógio de prova · No ar');
    expect(
      fakeServer.listCommandsReceived().at(-1),
      '"Atualizar" must still go to the instance the operator loaded',
    ).toEqual({
      type: 'updateInstanceData',
      instanceId: idOfTheQualifyingClock,
      data: { sessionName: 'Classificação — Bateria 2' },
      takeTimeFieldKeys: [],
    });
  });
});
