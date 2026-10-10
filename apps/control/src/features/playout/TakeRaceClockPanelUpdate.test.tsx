/**
 * Take race clock panel: the form following what is on air (apps/control)
 *
 * What this module is for:
 *   "Atualizar" sends the fields the operator changed and keeps the rest as it is on
 *   air. For that to stay true the form must know two things at every moment: what is
 *   on air, and which fields hold a change the operator has not sent yet. These tests
 *   follow the form through the moments where that could go wrong.
 *
 * What these tests prove:
 *   - After a take or an "Atualizar" the server accepted, the form shows what is now on
 *     air and counts as untouched again: the next "Atualizar" does not send the earlier
 *     edit a second time.
 *   - After a refusal the operator's edit is still in the form and still goes out on
 *     the next press.
 *   - "Colocar no ar" always sends the form as it stands, typed time included.
 *   - A time typed and then put back to what the field showed counts as untouched, so
 *     "Atualizar" leaves the clock on air at its own time.
 *   - On-air data that cannot be read leaves the form alone, and "Atualizar" then sends
 *     the whole form.
 *   - A value on air that the form's rules refuse (an empty session name) blocks
 *     "Atualizar" with the field's message until it is corrected.
 *
 * What these tests deliberately do not cover:
 *   - "Atualizar" after a reload (the three scenarios of the ruling) and the form as the
 *     page loads: TakeRaceClockPanel.test.tsx.
 *   - The clock changing or leaving the air through someone else while this operator is
 *     editing or waiting for an answer: TakeRaceClockPanelOtherOperator.test.tsx.
 *   - Every combination of changed fields, and stopped clocks and countdowns:
 *     raceClockUpdateCommand.test.ts and raceClockDataOnAir.test.ts.
 *   - A field other than the time put back to its old value: the form value and the
 *     on-air value are then the same, so no command could tell the two apart.
 *   - The other value the form's rules refuse, a time on air past 999:59: it takes the
 *     same road as the empty session name, and no race runs for 16 hours.
 *   - The real server's order of messages (the changed slice, then "ok"); the fake
 *     server copies it and apps/server's own tests prove it.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildSlicesWithNothingOnAir } from '@/state/slicesLikeTheServerSends.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  chooseOptionInDropdown,
  letTheServerPutTheLastTakeOnAir,
  pressButtonAndWaitForCommand,
  typeIntoField,
} from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// The Saturday of the endurance race, in Brasília time: the clock went on air at 9:45,
// the operator first presses a button at 10:00 and comes back to the panel at 10:05.
const quarterToTen = '2026-10-10T12:45:00.000Z';
const tenOClock = '2026-10-10T13:00:00.000Z';
const fivePastTen = '2026-10-10T13:05:00.000Z';

/** The first heat as the server holds it: green flag, running from 12:34 since 9:45. */
function buildFirstHeatDataOnAir() {
  return {
    sessionName: 'Enduro de Resistência — Bateria 1',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 754_000,
    referenceWallClockMs: Date.parse(quarterToTen),
    running: true,
  };
}

/**
 * Draws the panel at 10:00 on a connected page with these instances on air. The test
 * owns the page's clock: `moveThePageClockTo` changes what the panel is told "now" is.
 */
function renderPanelAtTenOClock(instancesOnAir: Instance[]) {
  const clockOfThisPage = { nowInMilliseconds: Date.parse(tenOClock) };
  const controlPage = renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => clockOfThisPage.nowInMilliseconds} />,
    { ...buildSlicesWithNothingOnAir(), instances: instancesOnAir },
  );
  return {
    fakeServer: controlPage.fakeServer,
    moveThePageClockTo: (moment: string) => {
      clockOfThisPage.nowInMilliseconds = Date.parse(moment);
    },
  };
}

/** The same panel with the first heat on air since 9:45. */
function renderPanelAtTenOClockWithTheFirstHeatOnAir() {
  return renderPanelAtTenOClock([
    buildRaceClockInstanceHoldingThisData(buildFirstHeatDataOnAir(), quarterToTen),
  ]);
}

describe('the race clock form following what is on air', () => {
  it('starts untouched again after an accepted "Atualizar": the next press does not resend the typed time', async () => {
    // Arrange: the first heat on air. At 10:00 the operator corrects the clock to 20:00
    // with "Atualizar", and the server puts that on air and accepts. Then five minutes pass.
    const { fakeServer, moveThePageClockTo } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '20:00');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(fakeServer, tenOClock);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });

    moveThePageClockTo(fivePastTen);

    // Act: at 10:05 the operator presses "Atualizar" again without touching anything.
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the second command carries the time the clock shows now, 25:00
    // (1 500 000 ms), counted from 10:05. Had the form still counted the time field as
    // changed, the clock would have jumped back to 20:00.
    expect(
      fakeServer.listCommandsReceived()[1],
      'a field already sent must not be sent again as a change',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_500_000,
        referenceWallClockMs: Date.parse(fivePastTen),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('starts untouched after an accepted "Colocar no ar": a later flag change keeps the clock running', async () => {
    // Arrange: nothing on air. At 10:00 the operator fills the form for the first heat
    // and presses "Colocar no ar"; the server puts it on air and accepts. Five minutes
    // later a yellow flag comes out, and the operator changes only the flag.
    const { fakeServer, moveThePageClockTo } = renderPanelAtTenOClock([]);
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    fireEvent.click(screen.getByRole('switch', { name: 'Relógio correndo' }));
    typeIntoField('Tempo de referência (mm:ss)', '12:34');
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);
    letTheServerPutTheLastTakeOnAir(fakeServer, tenOClock);
    await screen.findByRole('button', { name: 'Atualizar' });
    moveThePageClockTo(fivePastTen);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar" at 10:05.
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the clock goes on from 17:34 (12:34 + 5:00 = 1 054 000 ms). The 12:34 typed
    // for the take was sent once and is not a pending change any more.
    expect(
      fakeServer.listCommandsReceived()[1],
      'after a take the typed time must not be sent again by "Atualizar"',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 1_054_000,
        referenceWallClockMs: Date.parse(fivePastTen),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('keeps the edit in the form when the server refuses, so the next press sends it again', async () => {
    // Arrange: the first heat on air, the flag changed to yellow, and an "Atualizar"
    // that the server refuses.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "race-clock" não está registrado.',
    });
    await screen.findByRole('alert');
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Atualizar' }),
        'the button must come back once the server has answered',
      ).toBeEnabled();
    });

    // Act: the operator presses "Atualizar" again without touching the form.
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);

    // Assert: the form still shows yellow, and the second command still asks for it.
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'a refused change must stay in the form',
    ).toHaveTextContent('Amarela');
    expect(
      fakeServer.listCommandsReceived()[1],
      'a refused change must still be pending on the next press',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 1_654_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('"Colocar no ar" sends the form as it stands while the clock is on air, typed time included', async () => {
    // Arrange: the first heat on air showing 27:34, and 20:00 typed in the form.
    const { fakeServer } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '20:00');

    // Act: press "Colocar no ar", not "Atualizar".
    await pressButtonAndWaitForCommand('Colocar no ar', 1, fakeServer);

    // Assert: the take is the form, which was filled from what is on air, with the typed
    // 20:00 (1 200 000 ms).
    expect(
      fakeServer.listCommandsReceived()[0],
      '"Colocar no ar" must send every field as the form shows it',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_200_000,
        referenceWallClockMs: Date.parse(tenOClock),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('counts a time typed and then put back as untouched, so "Atualizar" leaves the clock at its own time', async () => {
    // Arrange: the first heat on air; the form, filled at 10:00, shows 27:34. At 10:05
    // the clock on air shows 32:34. The operator types 20:00, thinks again, and types
    // the 27:34 that was there before.
    const { fakeServer, moveThePageClockTo } = renderPanelAtTenOClockWithTheFirstHeatOnAir();
    moveThePageClockTo(fivePastTen);
    typeIntoField('Tempo de referência (mm:ss)', '20:00');
    typeIntoField('Tempo de referência (mm:ss)', '27:34');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the time field counts as untouched, so the command carries the 32:34
    // (1 954 000 ms) the clock on air shows, not the 27:34 written in the field. What
    // this means for the operator: "Atualizar" cannot set the clock to exactly the time
    // the field already shows; "Colocar no ar" does that.
    expect(
      fakeServer.listCommandsReceived()[0],
      'a field put back to what it showed must count as untouched',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência — Bateria 1',
        state: 'green',
        clockMode: 'elapsed',
        referenceTimeMs: 1_954_000,
        referenceWallClockMs: Date.parse(fivePastTen),
        running: true,
      },
    });
    fakeServer.acceptLastCommand();
  });

  it('shows the field message and sends nothing when the session name on air is empty', async () => {
    // Arrange: a clock on air with an empty session name, which the graphic allows and
    // the form's rules do not (put there by another tool, say). The operator changes
    // only the flag.
    const { fakeServer } = renderPanelAtTenOClock([
      buildRaceClockInstanceHoldingThisData(
        { ...buildFirstHeatDataOnAir(), sessionName: '' },
        quarterToTen,
      ),
    ]);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: the untouched session name is still checked. Its message is shown, and the
    // yellow flag does not go out until the operator types a name.
    expect(
      await screen.findByText('Informe o nome da sessão.'),
      'the empty session name taken from the air must be explained under its field',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'nothing may be sent while a field holds a value the form refuses',
    ).toEqual([]);
  });

  it('leaves the form alone when the on-air data cannot be read, and "Atualizar" sends the whole form', async () => {
    // Arrange: something sits on the clock layer under the race clock's name, but its
    // data has no clock fields (an older version of the graphic, say). The operator
    // changes only the flag.
    const { fakeServer } = renderPanelAtTenOClock([
      buildRaceClockInstanceHoldingThisData(
        { sessionName: 'Enduro de Resistência — Bateria 1', state: 'green' },
        quarterToTen,
      ),
    ]);
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Assert: the form was not filled from the unreadable data (it still has the default
    // session name), and with nothing on air to keep, the command is the whole form.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'unreadable on-air data must not be put into the form',
    ).toHaveValue('Enduro de Resistência');
    expect(
      fakeServer.listCommandsReceived()[0],
      'with unreadable on-air data "Atualizar" must send every field of the form',
    ).toEqual({
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: {
        sessionName: 'Enduro de Resistência',
        state: 'yellow',
        clockMode: 'elapsed',
        referenceTimeMs: 0,
        referenceWallClockMs: Date.parse(tenOClock),
        running: false,
      },
    });
    fakeServer.acceptLastCommand();
  });
});
