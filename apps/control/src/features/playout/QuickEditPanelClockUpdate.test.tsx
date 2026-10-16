/**
 * "Edição rápida": stopping and correcting a clock on air (apps/control)
 *
 * What this module is for:
 *   A race clock on air holds one reading ("at 9:45 it read 12:34") and counts on from
 *   it. What the control page sends knows no clock rule: when the operator stops the
 *   clock or types it a new time, "Atualizar" sends that one field. It is the server that keeps the clock from jumping: the race clock's
 *   manifest names the update rule `carryClockForward`, and the server then also writes
 *   the time the screen was showing (or the typed time) and the moment of the update.
 *   The page's part is small and easy to get wrong: send only what was touched, and
 *   afterwards show what the server wrote, not what the form held before.
 *
 * What these tests prove:
 *   - Stopping a running clock sends the switch alone, although the time field was
 *     showing the time on screen (27:34) and not the 12:34 on air: a time the page only
 *     shows is never sent. After the server's answer the form shows the clock stopped at
 *     27:34 and the moment of the press, and counts as untouched: a second "Atualizar"
 *     sends nothing.
 *   - Typing a new time for a running clock sends the time alone. After the server's
 *     answer the form shows that time counting from the moment of the press, and counts
 *     as untouched: a second "Atualizar" does not put the clock back to the typed time.
 *
 * What these tests deliberately do not cover:
 *   - That the real server carries the clock forward. A fake server cannot prove that;
 *     here it answers as the real rule does, using the same clock sum from
 *     packages/shared (graphicDataAsTheServerPreparesIt.testSupport.ts, with tests of its
 *     own). The proof is apps/server's updateInstanceDataCarriesTheClock.test.ts, row by
 *     row, and e2e/clockStoppedOnAir.e2e.ts on the real program output.
 *   - Starting a held clock, a change of direction and a countdown: the page does the
 *     same for each (one field out, the answer shown), and the server's tests have a row
 *     for each.
 *   - The form after a take, a refusal, and on-air data it cannot show:
 *     QuickEditPanelUpdate.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { flipSwitch, typeIntoField } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  holdThePageClockAt,
  idOfTheRaceClockInstanceOnAir,
  letTheServerApplyTheLastUpdate,
  pressButtonAndWaitForCommand,
  pressButtonAndWaitUntilThePressIsOver,
  pressEditOnTheLayerRow,
  referenceMomentLabel,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and the operator presses a button at 10:00, fifteen minutes later. A clock running
// from 12:34 since 9:45 therefore shows 27:34 at the press.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';

/** The first heat on the clock layer: green flag, running from 12:34 since 9:45. */
function buildFirstHeatInstanceOnAir(): Instance {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(quarterToTen),
      running: true,
    },
    quarterToTen,
  );
}

/**
 * Draws the panel with the first heat on air since 9:45, on a page whose clock reads
 * 10:00 and stands still there, the same moment the fake server answers at, loaded into
 * the panel with "Editar" on the clock's row.
 */
function renderPanelWithTheFirstHeatOnAir() {
  holdThePageClockAt(tenOClock);
  const controlPage = renderQuickEditPanelWithTheseInstancesOnAir([buildFirstHeatInstanceOnAir()]);
  pressEditOnTheLayerRow('Relógio');
  return controlPage;
}

/**
 * What the form shows of the clock: the switch, the time (for an untouched field, the
 * time on screen at the page's 10:00) and the reference moment that is on air.
 */
function readClockFieldsShownInTheForm() {
  return {
    isRunning: screen
      .getByRole('switch', { name: 'Relógio correndo' })
      .getAttribute('aria-checked'),
    referenceTime: screen.getByLabelText<HTMLInputElement>(referenceTimeLabel).value,
    referenceMoment: screen.getByLabelText<HTMLInputElement>(referenceMomentLabel).value,
  };
}

describe('the quick edit form after an "Atualizar" that changed the clock itself', () => {
  it('stops a running clock at the time it was showing: sends the switch alone, then shows the 27:34 the server kept and counts as untouched', async () => {
    // Arrange: the first heat on air, running from 12:34 since 9:45. At 10:00 the screen
    // shows 27:34, and so does the form's time field, next to the 9:45 that is on air as
    // the reference moment.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();
    const clockFieldsBeforeThePress = readClockFieldsShownInTheForm();

    // Act: the operator switches "Relógio correndo" off and presses "Atualizar". The
    // server, at 10:00, carries the clock forward as the real one does and accepts. Then
    // the operator presses "Atualizar" once more without touching anything.
    flipSwitch('Relógio correndo');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerApplyTheLastUpdate(fakeServer, buildFirstHeatInstanceOnAir(), tenOClock);
    await waitUntilButtonIsOnAgain('Atualizar');
    const clockFieldsAfterTheAnswer = readClockFieldsShownInTheForm();
    await pressButtonAndWaitUntilThePressIsOver('Atualizar');

    // Assert: the page sent the switch and nothing else. The 27:34 it was showing is not
    // in the command: keeping the clock where it was is the server's job.
    expect(
      clockFieldsBeforeThePress,
      'before the press the form must show the running clock with the time on screen',
    ).toEqual({
      isRunning: 'true',
      referenceTime: '27:34',
      referenceMoment: String(Date.parse(quarterToTen)),
    });
    expect(
      fakeServer.listCommandsReceived(),
      'stopping the clock must send the switch alone, once: the second press has nothing to send',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { running: false },
        takeTimeFieldKeys: [],
      },
    ]);
    // The clock did not jump back to 12:34: the server stopped it at the 27:34 the screen
    // was showing at 10:00, and the form shows that time and that moment. Had the form
    // kept its old 12:34, the operator's next correction would start from a wrong time.
    expect(
      clockFieldsAfterTheAnswer,
      'after the answer the form must show the clock stopped at the time it was showing, 27:34 at 10:00',
    ).toEqual({
      isRunning: 'false',
      referenceTime: '27:34',
      referenceMoment: String(Date.parse(tenOClock)),
    });
  });

  it('corrects a running clock to a typed time: sends the time alone, then shows it counting from the press and counts as untouched', async () => {
    // Arrange: the first heat on air, running from 12:34 since 9:45.
    const { fakeServer } = renderPanelWithTheFirstHeatOnAir();

    // Act: the operator types 20:00 and presses "Atualizar". The server, at 10:00,
    // carries the clock forward as the real one does and accepts. Then the operator
    // presses "Atualizar" once more without touching anything.
    typeIntoField(referenceTimeLabel, '20:00');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerApplyTheLastUpdate(fakeServer, buildFirstHeatInstanceOnAir(), tenOClock);
    await waitUntilButtonIsOnAgain('Atualizar');
    const clockFieldsAfterTheAnswer = readClockFieldsShownInTheForm();
    await pressButtonAndWaitUntilThePressIsOver('Atualizar');

    // Assert: the page sent the typed time (20:00 is 1 200 000 ms) and nothing else. The
    // only command is still that one: had the form still counted the time as changed, a
    // second command would have put a clock that had run on back to 20:00.
    expect(
      fakeServer.listCommandsReceived(),
      'a typed time must be sent alone, once: a field already sent is not sent again as a change',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { referenceTimeMs: 1_200_000 },
        takeTimeFieldKeys: [],
      },
    ]);
    // The clock did not jump to 35:00 (20:00 plus the fifteen minutes since 9:45): the
    // server made the typed time true at the moment of the press, and the form shows that
    // moment although the operator never touched its field.
    expect(
      clockFieldsAfterTheAnswer,
      'after the answer the form must show 20:00 counting from 10:00, the moment of the press',
    ).toEqual({
      isRunning: 'true',
      referenceTime: '20:00',
      referenceMoment: String(Date.parse(tenOClock)),
    });
  });
});
