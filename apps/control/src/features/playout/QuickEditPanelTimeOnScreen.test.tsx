/**
 * "Edição rápida": the time field of a clock on air shows the time on screen (apps/control)
 *
 * What this module is for:
 *   A clock on air holds one reading ("at 9:45 it read 12:34") and counts on from it, so
 *   fifteen minutes later the screen shows 27:34 while the data on air still says 12:34.
 *   An operator who wants to correct the clock must see the time they are about to
 *   change. So for a graphic whose manifest describes a clock (the update rule
 *   `carryClockForward` and a role on each of its four clock fields), the untouched time
 *   field shows the time on screen, second by second. The form itself goes on holding
 *   the reading that is on air, which is what keeps a time the page merely shows from
 *   ever being sent as if the operator had typed it.
 *
 * What these tests prove:
 *   - A clock taken at 12:34 fifteen minutes ago shows 27:34, and 27:35 a second later.
 *   - A held clock shows its reading and does not move.
 *   - With the cursor in the field the text stands still; it catches up when the cursor
 *     leaves.
 *   - A typed time stays as typed while seconds pass, and "Atualizar" sends that time
 *     alone; after the server's answer the field follows the screen again.
 *   - Retyping the very time the field was showing is a correction like any other: it
 *     is sent.
 *   - With the time untouched, "Atualizar" after a flag change sends the flag alone.
 *   - With the time untouched, "Colocar no ar" sends the reading that is on air (12:34
 *     at 9:45), not the 27:34 shown: the two together are the same clock, with no jump.
 *   - Choosing "Momento da entrada no ar" for the reference moment brings the reference
 *     time back into the field, because the operator is now editing the reading itself.
 *
 * What these tests deliberately do not cover:
 *   - Graphics the page cannot follow as a clock (no rule, or a role missing):
 *     QuickEditPanelTimeOnScreenOtherGraphics.test.tsx.
 *   - The clock sum and its rounding (timeOnScreenOfClockOnAir.test.ts, packages/shared),
 *     and which manifests count as a clock (clockFieldsOfGraphic.test.ts).
 *   - The real server keeping the clock from jumping on an update: the fake server
 *     answers as the real rule does (graphicDataAsTheServerPreparesIt.testSupport.ts).
 *   - A page whose clock disagrees with the server's. Here both read 10:00.
 *   - Typing the reference time that is on air (12:34) while the screen shows another
 *     time: the form counts that as no change and sends nothing. Still an open point.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  holdAllTimeOnThePageAt,
  idOfTheRaceClockInstanceOnAir,
  letTheServerApplyTheLastUpdate,
  letTimePassAndThePageSettle,
  referenceMomentKindSelectorName,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
} from './operatingTheQuickEditPanel.testSupport';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45
// and every test starts at 10:00, fifteen minutes later. A clock running from 12:34
// since 9:45 therefore shows 27:34 when the test starts.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';
const twoSecondsPastTen = '2026-10-10T13:00:02.000Z';

/** The first heat on the clock layer since 9:45: green flag, reading 12:34, running or held. */
function buildFirstHeatInstanceOnAir(isRunning: boolean): Instance {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência — Bateria 1',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(quarterToTen),
      running: isRunning,
    },
    quarterToTen,
  );
}

/** Presses a button and lets the page check its form and send what the press sends. */
async function pressButtonAndLetThePageSend(buttonName: string): Promise<void> {
  pressButton(buttonName);
  await letTimePassAndThePageSettle(0);
}

/** Draws the panel at 10:00 with the first heat on air since 9:45, running or held. */
function renderPanelAtTenOClockWithTheFirstHeatOnAir(isRunning: boolean) {
  holdAllTimeOnThePageAt(tenOClock);
  return renderQuickEditPanelWithTheseInstancesOnAir([buildFirstHeatInstanceOnAir(isRunning)]);
}

/** The text in the time field of the race clock's form, as the operator reads it. */
function readTimeFieldText(): string {
  return screen.getByLabelText<HTMLInputElement>(referenceTimeLabel).value;
}

describe('the time field of a clock on air, untouched', () => {
  it('shows 27:34 for a clock taken at 12:34 fifteen minutes ago, and 27:35 a second later', async () => {
    // Arrange: 10:00; the first heat has been running from 12:34 since 9:45.
    renderPanelAtTenOClockWithTheFirstHeatOnAir(true);
    const textAtTenOClock = readTimeFieldText();

    // Act: one second passes.
    await letTimePassAndThePageSettle(1000);

    // Assert: the field showed the time on screen, and moved on with it.
    expect(textAtTenOClock, 'at 10:00 the field must show the 27:34 that is on screen').toBe(
      '27:34',
    );
    expect(readTimeFieldText(), 'a second later the field must show 27:35').toBe('27:35');
  });

  it('shows a held clock at its reading and does not move', async () => {
    // Arrange: 10:00; the first heat is on air held at 12:34 (a red flag, say).
    renderPanelAtTenOClockWithTheFirstHeatOnAir(false);
    const textAtTenOClock = readTimeFieldText();

    // Act: five seconds pass.
    await letTimePassAndThePageSettle(5000);

    // Assert: 12:34 before and after, as on screen.
    expect(textAtTenOClock, 'a held clock must show its reading').toBe('12:34');
    expect(readTimeFieldText(), 'a held clock must not move as time passes').toBe('12:34');
  });

  it('stands still while the cursor is in the field, and catches up when the cursor leaves', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34.
    renderPanelAtTenOClockWithTheFirstHeatOnAir(true);
    const timeField = screen.getByLabelText(referenceTimeLabel);

    // Act: the operator clicks into the field and reads it for three seconds without
    // typing, then clicks somewhere else.
    fireEvent.focus(timeField);
    await letTimePassAndThePageSettle(3000);
    const textWithTheCursorInTheField = readTimeFieldText();
    fireEvent.blur(timeField);
    await letTimePassAndThePageSettle(0);

    // Assert: nothing moved under the cursor; afterwards the field is with the screen again.
    expect(
      textWithTheCursorInTheField,
      'the text must not change while the cursor is in the field',
    ).toBe('27:34');
    expect(
      readTimeFieldText(),
      'once the cursor left, the field must show the time on screen again',
    ).toBe('27:37');
  });

  it('sends the flag alone on "Atualizar" after a flag change, never the time it was showing', async () => {
    // Arrange: 10:00; the first heat running; the field shows the time on screen.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir(true);

    // Act: two seconds later the operator chooses the yellow flag and presses "Atualizar".
    await letTimePassAndThePageSettle(2000);
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndLetThePageSend('Atualizar');

    // Assert: the command holds the flag and no time. Had the shown 27:36 been sent,
    // every flag change would also have reset the clock to a rounded second.
    expect(
      fakeServer.listCommandsReceived(),
      'a time the page only shows must not be sent as if the operator had typed it',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { state: 'yellow' },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('sends the reading that is on air on "Colocar no ar", so the same clock goes back on screen', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir(true);

    // Act: the operator presses "Colocar no ar" without touching anything.
    await pressButtonAndLetThePageSend('Colocar no ar');

    // Assert: the take carries 12:34 (754 000 ms) at 9:45, the reading on air, and not
    // the 27:34 the field shows. 12:34 at 9:45 IS 27:34 at 10:00: the clock does not
    // jump. 27:34 sent with the moment 9:45 would have put 42:34 on screen.
    expect(
      fakeServer.listCommandsReceived(),
      'an untouched clock must be taken with the reading that is on air, time and moment together',
    ).toEqual([
      {
        type: 'takeGraphic',
        graphicId: 'race-clock',
        layerId: 'clock',
        data: {
          sessionName: 'Enduro de Resistência — Bateria 1',
          state: 'green',
          clockMode: 'elapsed',
          referenceTimeMs: 754_000,
          referenceWallClockMs: Date.parse(quarterToTen),
          running: true,
        },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });

  it('goes back to the reference time when the operator asks the server to fill the reference moment', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34.
    renderPanelAtTenOClockWithTheFirstHeatOnAir(true);

    // Act: the operator chooses "Momento da entrada no ar" for the reference moment,
    // and a second passes.
    chooseOptionInDropdown(referenceMomentKindSelectorName, 'Momento da entrada no ar');
    await letTimePassAndThePageSettle(1000);

    // Assert: the field shows the 12:34 the form holds. An "Atualizar" now would make
    // the clock count 12:34 from the press, so that is the time the operator must see.
    expect(
      readTimeFieldText(),
      'with the reference moment changed, the time field must show the reference time the form holds',
    ).toBe('12:34');
  });

  it('keeps following the screen while the operator changes another clock field', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34.
    renderPanelAtTenOClockWithTheFirstHeatOnAir(true);

    // Act: the operator switches "Relógio correndo" off without pressing "Atualizar"
    // yet, and a second passes.
    flipSwitch('Relógio correndo');
    await letTimePassAndThePageSettle(1000);

    // Assert: the clock on screen is still running, so the field still follows it.
    expect(
      readTimeFieldText(),
      'until "Atualizar" is pressed the screen runs on, and the field must run with it',
    ).toBe('27:35');
  });
});

describe('the time field of a clock on air, once the operator types', () => {
  it('keeps the typed time while seconds pass, sends it alone on "Atualizar", then follows the screen again', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir(true);

    // Act: the operator clicks into the field, types 20:00 and waits two seconds; the
    // text is read. Then the cursor leaves the field, as it does in a browser when the
    // operator clicks a button, and they press "Atualizar"; the server, at 10:00:02, makes
    // 20:00 true at that moment, as the real rule does, and accepts. The text is read
    // again, and once more a second later.
    const timeField = screen.getByLabelText(referenceTimeLabel);
    fireEvent.focus(timeField);
    typeIntoField(referenceTimeLabel, '20:00');
    await letTimePassAndThePageSettle(2000);
    const textTwoSecondsAfterTyping = readTimeFieldText();
    fireEvent.blur(timeField);
    await pressButtonAndLetThePageSend('Atualizar');
    letTheServerApplyTheLastUpdate(
      fakeServer,
      buildFirstHeatInstanceOnAir(true),
      twoSecondsPastTen,
    );
    await letTimePassAndThePageSettle(0);
    const textRightAfterTheAnswer = readTimeFieldText();
    await letTimePassAndThePageSettle(1000);

    // Assert: what was typed did not move; the command is the typed time (1 200 000 ms)
    // and nothing else; and the corrected clock is followed from 20:00 on.
    expect(
      textTwoSecondsAfterTyping,
      'a typed time must stay exactly as typed, however long the operator waits',
    ).toBe('20:00');
    expect(
      fakeServer.listCommandsReceived(),
      '"Atualizar" must send the typed time and nothing else',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { referenceTimeMs: 1_200_000 },
        takeTimeFieldKeys: [],
      },
    ]);
    expect(
      textRightAfterTheAnswer,
      'after the answer the field must show the corrected clock, 20:00 at the press',
    ).toBe('20:00');
    expect(
      readTimeFieldText(),
      'a second after the answer the field must follow the corrected clock to 20:01',
    ).toBe('20:01');
  });

  it('sends the very time the field was showing when the operator retypes it', async () => {
    // Arrange: 10:00; the first heat running; the field shows 27:34. Ten seconds pass
    // with the cursor in the field, so the screen is at 27:44 and the field still at 27:34.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir(true);
    const timeField = screen.getByLabelText(referenceTimeLabel);
    fireEvent.focus(timeField);
    await letTimePassAndThePageSettle(10_000);

    // Act: the operator deletes the last digit, types it again ("the clock must read
    // 27:34 now"), leaves the field and presses "Atualizar".
    fireEvent.change(timeField, { target: { value: '27:3' } });
    fireEvent.change(timeField, { target: { value: '27:34' } });
    fireEvent.blur(timeField);
    await pressButtonAndLetThePageSend('Atualizar');

    // Assert: 27:34 (1 654 000 ms) is sent as a typed time, although it is what the
    // field was showing: the operator typed it, and the form held 12:34 until then.
    expect(
      fakeServer.listCommandsReceived(),
      'a time typed over the same time shown must be sent like any other correction',
    ).toEqual([
      {
        type: 'updateInstanceData',
        instanceId: idOfTheRaceClockInstanceOnAir,
        data: { referenceTimeMs: 1_654_000 },
        takeTimeFieldKeys: [],
      },
    ]);
    fakeServer.acceptLastCommand();
  });
});
